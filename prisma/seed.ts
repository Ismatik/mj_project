// Demo data for local runs and staging. Wipes the database and rebuilds it around "today" in Dushanbe.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type PaymentMethod } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";
import { addDays, atSalonTime, isClosed, mondayOf, todayYmd, weekdayOf, type Ymd } from "../src/lib/time";
import * as data from "./seed-data";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// Deterministic randomness so every seed produces the same demo.
let rngState = 20260921;
function rand() {
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

function anchorDay(): Ymd {
  const fromEnv = process.env.SEED_TODAY?.trim();
  const day = fromEnv || todayYmd();
  return isClosed(day) ? addDays(day, 1) : day; // never anchor the demo on the day off
}

async function wipe() {
  await db.$transaction([
    db.outboxMessage.deleteMany(),
    db.integration.deleteMany(),
    db.review.deleteMany(),
    db.sitePhoto.deleteMany(),
    db.siteText.deleteMany(),
    db.reminder.deleteMany(),
    db.setting.deleteMany(),
    db.dressBooking.deleteMany(),
    db.dress.deleteMany(),
    db.saleItem.deleteMany(),
    db.sale.deleteMany(),
    db.appointmentStaff.deleteMany(),
    db.appointment.deleteMany(),
    db.guest.deleteMany(),
    db.service.deleteMany(),
    db.serviceCategory.deleteMany(),
    db.session.deleteMany(),
    db.user.deleteMany(),
    db.staff.deleteMany(),
  ]);
}

async function main() {
  const today = anchorDay();
  console.log(`Seeding demo data around ${today}…`);
  await wipe();

  // Team
  const staffId: Record<string, string> = {};
  for (const [i, s] of data.staff.entries()) {
    const row = await db.staff.create({
      data: { name: s.name, title: s.title, workDays: [...s.workDays], commission: s.commission, sortOrder: i },
    });
    staffId[s.key] = row.id;
  }
  const worksOn = (key: string, day: Ymd) =>
    data.staff.find((s) => s.key === key)!.workDays.includes(weekdayOf(day) as never);

  // Services
  const serviceId: Record<string, string> = {};
  const servicePrice: Record<string, number> = {};
  const serviceMin: Record<string, number> = {};
  for (const [ci, c] of data.categories.entries()) {
    const cat = await db.serviceCategory.create({ data: { slug: c.slug, name: c.name, icon: c.icon, sortOrder: ci } });
    for (const [si, s] of data.services.filter((x) => x.cat === c.slug).entries()) {
      const row = await db.service.create({
        data: {
          categoryId: cat.id,
          name: s.name,
          durationMin: s.min,
          price: s.price,
          showOnSite: s.site,
          showInPos: s.pos,
          sortOrder: si,
        },
      });
      serviceId[s.key] = row.id;
      servicePrice[s.key] = s.price;
      serviceMin[s.key] = s.min;
    }
  }

  /** Keeps the prototype's master where possible; otherwise someone qualified who works that day. */
  function staffFor(service: string, wanted: string[], day: Ymd): string[] {
    const working = wanted.filter((k) => worksOn(k, day));
    if (working.length) return working;
    const qualified = data.services.find((s) => s.key === service)!.staff.filter((k) => worksOn(k, day));
    if (qualified.length) return [qualified[0]!];
    // Nobody qualified is on shift: keep the booked master as an extra shift rather than hand the service to the wrong specialist.
    return wanted;
  }

  // Guests
  const monday = mondayOf(today);
  const guestId: Record<string, string> = {};
  for (const g of data.guests) {
    const birthday = g.birthdayWeekday !== undefined ? new Date(`1994${addDays(monday, g.birthdayWeekday).slice(4)}`) : null;
    // Regulars joined long ago; new guests this month.
    const joinedDaysAgo = g.tag === "NEW" ? 10 + g.visits : 340 + Math.round(rand() * 400);
    const createdAt = atSalonTime(addDays(today, -joinedDaysAgo), "12:00");
    const row = await db.guest.create({ data: { name: g.name, phone: g.phone, tag: g.tag, birthday, createdAt } });
    guestId[g.key] = row.id;
  }
  const shortName = (key: string) => {
    const [first, last] = data.guests.find((g) => g.key === key)!.name.split(" ");
    return `${first} ${last![0]}.`;
  };

  const methods: PaymentMethod[] = ["CASH", "CASH", "CARD", "CARD", "QR"];
  const revenueByDay: Record<Ymd, number> = {};

  async function book(day: Ymd, a: data.SeedAppt, status: "PENDING" | "CONFIRMED" | "IN_CHAIR" | "DONE") {
    const startsAt = atSalonTime(day, a.time);
    const durationMin = serviceMin[a.service]!;
    const staffKeys = staffFor(a.service, a.staff, day);
    await db.appointment.create({
      data: {
        guestId: a.guest ? guestId[a.guest] : null,
        guestName: a.guest ? shortName(a.guest) : a.guestName!,
        serviceId: serviceId[a.service],
        serviceLabel: a.label,
        startsAt,
        durationMin,
        price: a.price,
        status,
        source: "CMS",
        staff: { create: staffKeys.map((k) => ({ staffId: staffId[k]! })) },
      },
    });
    if (status === "DONE") {
      await db.sale.create({
        data: {
          guestId: a.guest ? guestId[a.guest] : null,
          staffId: staffId[staffKeys[0]!],
          total: a.price,
          method: pick(methods),
          createdAt: new Date(startsAt.getTime() + durationMin * 60_000),
          items: { create: [{ serviceId: serviceId[a.service], name: a.label, price: a.price }] },
        },
      });
      revenueByDay[day] = (revenueByDay[day] ?? 0) + a.price;
    }
  }

  // Guest history: earlier visits, mostly their favourite service.
  const siteServices = data.services.filter((s) => s.site);
  for (const g of data.guests.filter((x) => x.visits > 0)) {
    const inToday = data.today.some((a) => a.guest === g.key);
    const count = inToday ? g.visits - 1 : g.visits;
    const gap = Math.max(10, Math.floor(330 / Math.max(1, g.visits)));
    for (let i = 0; i < count; i++) {
      let day = addDays(today, -(inToday ? gap * (i + 1) : g.lastDaysAgo + gap * i));
      if (isClosed(day)) day = addDays(day, -1);
      const svc = rand() < 0.7 ? data.services.find((s) => s.key === g.fav)! : pick(siteServices);
      await book(day, {
        time: pick(["09:30", "11:00", "12:30", "14:00", "15:30"]),
        guest: g.key,
        label: svc.name,
        service: svc.key,
        staff: [...svc.staff],
        price: svc.price,
      }, "DONE");
    }
  }

  // This week's calendar; today uses the dashboard list.
  for (let wd = 0; wd < 7; wd++) {
    const day = addDays(monday, wd);
    if (isClosed(day)) continue;
    if (day === today) {
      for (const a of data.today) await book(day, a, a.status!);
    } else {
      for (const [i, a] of data.week[wd]!.entries()) {
        await book(day, a, day < today ? "DONE" : i % 3 === 2 ? "PENDING" : "CONFIRMED");
      }
    }
  }

  // Walk-in sales so daily revenue matches the dashboard chart (last 14 days) and looks plausible before that.
  const posServices = data.services.filter((s) => s.pos);
  for (let back = 60; back >= 0; back--) {
    const day = addDays(today, -back);
    if (isClosed(day)) continue;
    const target = back < 14 ? data.revenue14[13 - back]! : 4000 + Math.round(rand() * 35) * 100;
    let total = revenueByDay[day] ?? 0;
    while (total < target - 150) {
      const candidates = posServices.filter((s) => s.price <= target - total + 100);
      const svc = candidates.length ? pick(candidates) : posServices.reduce((a, b) => (a.price < b.price ? a : b));
      const master = staffFor(svc.key, [...svc.staff], day)[0]!;
      const hour = 9 + Math.floor(rand() * 9);
      const minute = pick(["00", "15", "30", "45"]);
      await db.sale.create({
        data: {
          staffId: staffId[master],
          total: svc.price,
          method: pick(methods),
          createdAt: atSalonTime(day, `${String(hour).padStart(2, "0")}:${minute}`),
          items: { create: [{ serviceId: serviceId[svc.key], name: svc.name, price: svc.price }] },
        },
      });
      total += svc.price;
    }
  }

  // Dress rental
  for (const [i, d] of data.dresses.entries()) {
    const dress = await db.dress.create({
      data: { name: d.name, type: d.type, size: d.size, pricePerDay: d.price, status: d.status, sortOrder: i },
    });
    if (d.bookedInDays !== null) {
      const start = addDays(today, d.bookedInDays);
      await db.dressBooking.create({
        data: {
          dressId: dress.id,
          guestId: i === 1 ? guestId.farzona : null,
          startsOn: new Date(`${start}T00:00:00Z`),
          endsOn: new Date(`${addDays(start, 1)}T00:00:00Z`),
        },
      });
    }
  }

  // Salon settings, reminders, website content, integrations
  await db.setting.createMany({ data: Object.entries(data.settings).map(([key, value]) => ({ key, value })) });
  await db.reminder.createMany({ data: data.reminders.map((text) => ({ text })) });
  await db.siteText.createMany({ data: data.siteTexts.map((t) => ({ ...t, locale: "ru" })) });
  await db.sitePhoto.createMany({ data: data.sitePhotos });
  await db.review.createMany({ data: data.reviews.map((r, i) => ({ ...r, sortOrder: i })) });
  await db.integration.createMany({ data: data.integrations.map((key) => ({ key })) });

  // Sign-in accounts (the same demo password for every role; change it after first sign-in)
  const password = process.env.SEED_OWNER_PASSWORD || "change-me-now";
  const hash = await hashPassword(password);
  await db.user.createMany({
    data: [
      { name: "Мавзуна", login: process.env.SEED_OWNER_LOGIN || "mavzuna", passwordHash: hash, role: "OWNER", staffId: staffId.mavzuna },
      { name: "Ресепшен", login: "reception", passwordHash: hash, role: "RECEPTION" },
      { name: "Контент-менеджер", login: "content", passwordHash: hash, role: "CONTENT" },
    ],
  });

  const counts = {
    staff: await db.staff.count(),
    services: await db.service.count(),
    guests: await db.guest.count(),
    appointments: await db.appointment.count(),
    sales: await db.sale.count(),
    dresses: await db.dress.count(),
  };
  console.log("Done:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
