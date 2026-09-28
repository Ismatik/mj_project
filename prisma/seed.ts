// Demo data for local runs and staging. Wipes the database and rebuilds it around "today" in Dushanbe.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type PaymentMethod, type Prisma } from "../src/generated/prisma/client";
import { clock } from "../src/lib/format";
import { hashPassword } from "../src/lib/password";
import { addDays, atSalonTime, isClosed, mondayOf, todayYmd, weekdayOf, type Ymd } from "../src/lib/time";
import { depositFor } from "../src/lib/money";
import { DEFAULT_CONTENT, type SiteContent } from "../src/lib/site-content";
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
    db.stockMove.deleteMany(),
    db.serviceConsumption.deleteMany(),
    db.stockItem.deleteMany(),
    db.waitlistEntry.deleteMany(),
    db.guestPhoto.deleteMany(),
    db.colourFormula.deleteMany(),
    db.cashShift.deleteMany(),
    db.cashMovement.deleteMany(),
    db.staffPayout.deleteMany(),
    db.staffAdjustment.deleteMany(),
    db.bonusTx.deleteMany(),
    db.giftRedemption.deleteMany(),
    db.payment.deleteMany(),
    db.giftCard.deleteMany(),
    db.loginCode.deleteMany(),
    db.telegramChat.deleteMany(),
    db.integration.deleteMany(),
    db.siteDocument.deleteMany(),
    db.bookingRequest.deleteMany(),
    db.reminder.deleteMany(),
    db.setting.deleteMany(),
    db.dressBooking.deleteMany(),
    db.bridalPackage.deleteMany(),
    db.dress.deleteMany(),
    db.saleItem.deleteMany(),
    db.promotion.deleteMany(),
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
  // Receipts start at №1001 on a fresh demo
  await db.$executeRawUnsafe(`ALTER SEQUENCE "Sale_number_seq" RESTART WITH 1001`);
}

async function main() {
  const today = anchorDay();
  console.log(`Seeding demo data around ${today}…`);
  await wipe();

  // Team
  const staffId: Record<string, string> = {};
  for (const [i, s] of data.staff.entries()) {
    const row = await db.staff.create({
      data: { name: s.name, title: s.title, workDays: [...s.workDays], commission: s.commission, salary: "salary" in s ? s.salary : 0, sortOrder: i },
    });
    staffId[s.key] = row.id;
  }
  const worksOn = (key: string, day: Ymd) =>
    data.staff.find((s) => s.key === key)!.workDays.includes(weekdayOf(day) as never);

  // Services
  const serviceId: Record<string, string> = {};
  const categoryId: Record<string, string> = {};
  const servicePrice: Record<string, number> = {};
  const serviceMin: Record<string, number> = {};
  for (const [ci, c] of data.categories.entries()) {
    const cat = await db.serviceCategory.create({ data: { slug: c.slug, name: c.name, icon: c.icon, sortOrder: ci } });
    categoryId[c.slug] = cat.id;
    for (const [si, s] of data.services.filter((x) => x.cat === c.slug).entries()) {
      const row = await db.service.create({
        data: {
          categoryId: cat.id,
          name: s.name,
          durationMin: s.min,
          price: s.price,
          showOnSite: s.site,
          showInPos: s.pos,
          depositPercent: s.deposit ?? 0,
          sortOrder: si,
          staff: { connect: s.staff.map((k) => ({ id: staffId[k]! })) },
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
          paid: a.price,
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
  // Today only gets sales up to the current hour, never in the future
  const [nowH] = clock(new Date()).split(":").map(Number);
  const realToday = todayYmd() === today;
  for (let back = 60; back >= 0; back--) {
    const day = addDays(today, -back);
    if (isClosed(day)) continue;
    const lastHour = back === 0 && realToday ? Math.min(17, nowH! - 1) : 17;
    if (lastHour < 9) continue;
    const target = back < 14 ? data.revenue14[13 - back]! : 4000 + Math.round(rand() * 35) * 100;
    let total = revenueByDay[day] ?? 0;
    while (total < target - 150) {
      const candidates = posServices.filter((s) => s.price <= target - total + 100);
      const svc = candidates.length ? pick(candidates) : posServices.reduce((a, b) => (a.price < b.price ? a : b));
      const master = staffFor(svc.key, [...svc.staff], day)[0]!;
      const hour = 9 + Math.floor(rand() * (lastHour - 8));
      const minute = pick(["00", "15", "30", "45"]);
      await db.sale.create({
        data: {
          staffId: staffId[master],
          total: svc.price,
          paid: svc.price,
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
  // Website content: draft and published start identical (texts from the design, master profiles)
  const masters: SiteContent["masters"] = {};
  for (const [key, p] of Object.entries(data.masterProfiles)) {
    masters[staffId[key]!] = {
      visible: true,
      slug: "",
      specialty: "",
      bio: p.bio,
      portfolio: (p.works ?? []).map((w, i) => ({ id: `${key}${i}`, ...w })),
    };
  }
  // Tajik and English: names of categories, services and masters, master profiles and captions
  const i18n = structuredClone(DEFAULT_CONTENT.i18n);
  for (const lang of ["tg", "en"] as const) {
    const names = { services: {} as Record<string, string>, categories: {} as Record<string, string>, staff: {} as Record<string, string> };
    for (const c of data.categories) names.categories[categoryId[c.slug]!] = data.translations.categories[c.slug]![lang];
    for (const sv of data.services) names.services[serviceId[sv.key]!] = data.translations.services[sv.key]![lang];
    const mastersOv: Record<string, unknown> = {};
    for (const [key, t] of Object.entries(data.translations.staff)) {
      const id = staffId[key]!;
      if (t[lang].name) names.staff[id] = t[lang].name!;
      mastersOv[id] = {
        specialty: t[lang].specialty,
        bio: t[lang].bio,
        portfolio: masters[id]!.portfolio.map((w) => ({ id: w.id, caption: data.translations.captions[w.id]?.[lang] ?? "" })),
      };
    }
    i18n[lang] = { ...i18n[lang], names, masters: mastersOv };
  }
  const content = { ...DEFAULT_CONTENT, masters, i18n } as unknown as Prisma.InputJsonValue;
  await db.siteDocument.createMany({
    data: [
      { id: "draft", data: content },
      { id: "published", data: content },
    ],
  });
  await db.integration.createMany({ data: data.integrations.map((key) => ({ key })) });

  // Wedding looks booked ahead were prepaid online (30 %)
  for (const sv of data.services.filter((x) => x.deposit)) {
    const deposit = depositFor(sv.price, sv.deposit!);
    await db.appointment.updateMany({
      where: { serviceId: serviceId[sv.key], status: { in: ["PENDING", "CONFIRMED", "IN_CHAIR"] } },
      data: { depositRequired: deposit, depositPaid: deposit },
    });
  }

  // Gift certificates: one active (partly used on the website demo), one fully used
  for (const g of data.giftCards) {
    const created = atSalonTime(addDays(today, -g.daysAgo), "12:00");
    await db.giftCard.create({
      data: {
        code: g.code,
        token: g.token,
        amount: g.amount,
        balance: g.balance,
        status: g.balance > 0 ? "ACTIVE" : "USED",
        recipientName: g.recipient,
        buyerName: g.buyer,
        buyerPhone: g.buyerPhone,
        message: g.message,
        soldVia: "CMS",
        soldBy: "Ресепшен",
        createdAt: created,
        expiresAt: new Date(created.getTime() + 365 * 864e5),
        payments: { create: { purpose: "GIFT_CARD", amount: g.amount, status: "PAID", provider: "pos", method: "CARD", description: `Сертификат ${g.code}`, paidAt: created, createdAt: created, expiresAt: created } },
      },
    });
  }

  // Promotions: an automatic autumn offer on skin care (shown on the site) and a promo code for all services
  const ymdDate = (d: Ymd) => new Date(`${d}T00:00:00Z`);
  await db.promotion.createMany({
    data: [
      {
        title: "Осенний уход за кожей −20%",
        titleTg: "Нигоҳубини тирамоҳии пӯст −20%",
        titleEn: "Autumn skin care −20%",
        description: "Уход за кожей со скидкой 20% — цена уже со скидкой при записи на сайте и на кассе.",
        descriptionTg: "Нигоҳубини пӯст бо тахфифи 20% — нарх ҳангоми сабт дар сайт ва дар касса аллакай бо тахфиф аст.",
        descriptionEn: "Skin care 20% off — the price is already reduced when you book on the website or pay at the salon.",
        kind: "PERCENT",
        value: 20,
        serviceIds: [serviceId.skin!],
        startsOn: ymdDate(addDays(today, -3)),
        endsOn: ymdDate(addDays(today, 25)),
        showOnSite: true,
      },
      {
        title: "Промокод MJ10: −10% на всё",
        titleTg: "Промокоди MJ10: −10% ба ҳама",
        titleEn: "Promo code MJ10: 10% off everything",
        description: "Введите MJ10 при записи на сайте или назовите на кассе.",
        descriptionTg: "MJ10-ро ҳангоми сабт дар сайт ворид кунед ё дар касса гӯед.",
        descriptionEn: "Enter MJ10 when booking online or mention it at reception.",
        kind: "PERCENT",
        value: 10,
        serviceIds: [],
        startsOn: ymdDate(addDays(today, -7)),
        endsOn: ymdDate(addDays(today, 60)),
        code: "MJ10",
        usageLimit: 200,
        showOnSite: true,
      },
    ],
  });

  // Bonus points: 5 % of every past receipt of a known guest (the "Классика" rate), a few already spent
  const guestSales = await db.sale.findMany({ where: { guestId: { not: null } }, orderBy: { createdAt: "asc" } });
  const balance: Record<string, number> = {};
  for (const s of guestSales) {
    const earned = Math.floor((s.paid * 5) / 100);
    if (!earned) continue;
    await db.sale.update({ where: { id: s.id }, data: { bonusEarned: earned } });
    await db.bonusTx.create({ data: { guestId: s.guestId!, delta: earned, kind: "EARN", saleId: s.id, createdAt: s.createdAt } });
    balance[s.guestId!] = (balance[s.guestId!] ?? 0) + earned;
  }
  for (const key of ["marta", "gulnora"]) {
    const id = guestId[key]!;
    const spend = Math.min(200, balance[id] ?? 0);
    if (!spend) continue;
    await db.bonusTx.create({ data: { guestId: id, delta: -spend, kind: "SPEND", note: "Оплата бонусами", createdAt: atSalonTime(addDays(today, -20), "13:00") } });
    balance[id] -= spend;
  }
  for (const [id, b] of Object.entries(balance)) await db.guest.update({ where: { id }, data: { bonusBalance: b } });

  // Till: every past working day of the last five weeks was closed; 500 c. stays in the drawer overnight
  const FLOAT = 500;
  for (let back = 35; back >= 1; back--) {
    const day = addDays(today, -back);
    if (isClosed(day)) continue;
    const range = { gte: atSalonTime(day), lt: atSalonTime(addDays(day, 1)) };
    const [byMethod, agg] = await Promise.all([
      db.sale.groupBy({ by: ["method"], where: { createdAt: range }, _sum: { paid: true } }),
      db.sale.aggregate({ where: { createdAt: range }, _sum: { total: true }, _count: true }),
    ]);
    const paid = (m: string) => byMethod.find((x) => x.method === m)?._sum.paid ?? 0;
    const cashOut = back === 8 ? 150 : 0;
    if (cashOut) await db.cashMovement.create({ data: { day: new Date(`${day}T00:00:00Z`), amount: -cashOut, note: "Расходники: перчатки, салфетки", createdBy: "Ресепшен", createdAt: atSalonTime(day, "13:10") } });
    const expected = FLOAT + paid("CASH") - cashOut;
    const difference = back === 12 ? -20 : back === 5 ? 10 : 0;
    const counted = expected + difference;
    await db.cashShift.create({
      data: {
        day: new Date(`${day}T00:00:00Z`),
        openingCash: FLOAT,
        cashSales: paid("CASH"),
        cardSales: paid("CARD"),
        qrSales: paid("QR"),
        cashIn: 0,
        cashOut,
        expectedCash: expected,
        countedCash: counted,
        difference,
        handedOver: counted - FLOAT,
        leftCash: FLOAT,
        receipts: agg._count,
        revenue: agg._sum.total ?? 0,
        details: { deposits: 0, gifts: 0, bonus: 0, discounts: 0, giftSold: { cash: 0, card: 0, qr: 0 }, online: { deposits: 0, gifts: 0 }, byMaster: [], movements: [] },
        note: difference < 0 ? "Не хватило на сдачу, разменяли у соседей" : null,
        closedBy: "Ресепшен",
        closedAt: atSalonTime(day, "18:10"),
      },
    });
  }

  // Payroll: last month paid in full by transfer (advance on the 15th, the rest on the 1st); this month an advance
  const month = today.slice(0, 7);
  const [py, pm] = month.split("-").map(Number) as [number, number];
  const prevMonth = pm === 1 ? `${py - 1}-12` : `${py}-${String(pm - 1).padStart(2, "0")}`;
  const prevRange = { gte: atSalonTime(`${prevMonth}-01`), lt: atSalonTime(`${month}-01`) };
  const prevRevenue = await db.sale.groupBy({ by: ["staffId"], where: { createdAt: prevRange }, _sum: { total: true } });
  for (const s of data.staff) {
    if (!s.commission) continue;
    const id = staffId[s.key]!;
    const salary = "salary" in s ? s.salary : 0;
    const earned = salary + Math.round(((prevRevenue.find((r) => r.staffId === id)?._sum.total ?? 0) * s.commission) / 100);
    const advance = Math.min(1500, earned);
    await db.staffPayout.createMany({
      data: [
        { staffId: id, month: prevMonth, amount: advance, method: "CARD", note: "аванс", paidBy: "Мавзуна", paidAt: atSalonTime(`${prevMonth}-15`, "17:00") },
        ...(earned > advance ? [{ staffId: id, month: prevMonth, amount: earned - advance, method: "CARD" as const, note: "расчёт", paidBy: "Мавзуна", paidAt: atSalonTime(`${month}-01`, "17:00") }] : []),
      ],
    });
    if (today >= `${month}-15`) await db.staffPayout.create({ data: { staffId: id, month, amount: 1000, method: "CARD", note: "аванс", paidBy: "Мавзуна", paidAt: atSalonTime(`${month}-15`, "17:00") } });
  }
  await db.staffAdjustment.createMany({
    data: [
      { staffId: staffId.mira!, month, amount: 300, note: "Лучшие отзывы месяца", createdBy: "Мавзуна" },
      { staffId: staffId.dario!, month, amount: -100, note: "Опоздание", createdBy: "Мавзуна" },
    ],
  });

  // Guest card: allergies and colour formulas
  await db.guest.update({ where: { id: guestId.marta }, data: { allergies: "Аммиак — только безаммиачные красители. Чувствительная кожа головы." } });
  await db.guest.update({ where: { id: guestId.sevara }, data: { allergies: "Латекс (перчатки — нитриловые)" } });
  await db.colourFormula.createMany({
    data: [
      { guestId: guestId.marta!, staffId: staffId.ines, title: "Балаяж", formula: "Осветление Blondor + 6% 1:2, 40 мин; тонирование Igora Vibrance 9-24 + 1,9% 1:2, 20 мин", note: "Корни не трогать", createdBy: "Инес", createdAt: atSalonTime(addDays(today, -40), "13:00") },
      { guestId: guestId.marta!, staffId: staffId.ines, title: "Тонирование", formula: "Igora Vibrance 9-24 + 9-0 1:1, оксид 1,9%, 20 мин", createdBy: "Инес", createdAt: atSalonTime(addDays(today, -12), "15:00") },
      { guestId: guestId.gulnora!, staffId: staffId.ines, title: "Окрашивание в один тон", formula: "Igora Royal 6-68 + 6-0 2:1, оксид 6%, 35 мин", createdBy: "Инес", createdAt: atSalonTime(addDays(today, -9), "11:30") },
      { guestId: guestId.anna!, staffId: staffId.mira, title: "Ламинирование ресниц", formula: "Состав 1 — 9 мин, состав 2 — 8 мин, краска графит 5 мин", createdBy: "Мира", createdAt: atSalonTime(addDays(today, -20), "12:00") },
    ],
  });

  // Waitlist: someone waits for a balayage in ten days (afternoon), one walk-in waits now
  let waitDay = addDays(today, 10);
  if (isClosed(waitDay)) waitDay = addDays(waitDay, 1);
  await db.waitlistEntry.create({
    data: {
      kind: "WAITLIST",
      name: "Дилноза Каримова",
      phone: "+992900000201",
      serviceId: serviceId.balayage!,
      staffId: staffId.ines,
      date: new Date(`${waitDay}T00:00:00Z`),
      timeFrom: "14:00",
      timeTo: "18:00",
      source: "WEBSITE",
      token: "demo-waitlist-dilnoza",
      createdAt: atSalonTime(addDays(today, -1), "19:20"),
    },
  });
  await db.waitlistEntry.create({
    data: { kind: "WALK_IN", name: "Мадина", serviceId: serviceId.gel!, date: new Date(`${today}T00:00:00Z`), source: "WALK_IN", token: "demo-walkin-madina", note: "Спешит к 13:00", createdBy: "Ресепшен", createdAt: new Date(Date.now() - 12 * 60_000) },
  });

  // Stock: consumables with norms per service (two are already running low)
  const stock = [
    { key: "igora", name: "Краситель Igora Royal 6-0", unit: "мл", category: "Окрашивание", packSize: 60, packPrice: 95, quantity: 420, min: 180, supplier: "Schwarzkopf Professional" },
    { key: "oxide", name: "Оксид Igora 6%", unit: "мл", category: "Окрашивание", packSize: 1000, packPrice: 160, quantity: 2400, min: 1000, supplier: "Schwarzkopf Professional" },
    { key: "blondor", name: "Осветлитель Blondor", unit: "г", category: "Окрашивание", packSize: 450, packPrice: 380, quantity: 300, min: 450, supplier: "Wella" },
    { key: "gelRose", name: "Гель-лак «розовое золото»", unit: "мл", category: "Ногти", packSize: 15, packPrice: 180, quantity: 12, min: 20, supplier: "Kodi" },
    { key: "base", name: "База для гель-лака", unit: "мл", category: "Ногти", packSize: 15, packPrice: 150, quantity: 60, min: 15, supplier: "Kodi" },
    { key: "files", name: "Пилки одноразовые", unit: "шт", category: "Ногти", packSize: 50, packPrice: 90, quantity: 160, min: 50, supplier: null },
    { key: "lashKit", name: "Набор для ламинирования ресниц", unit: "шт", category: "Брови и ресницы", packSize: 10, packPrice: 450, quantity: 14, min: 5, supplier: "InLei" },
    { key: "mask", name: "Альгинатная маска", unit: "г", category: "Уход", packSize: 500, packPrice: 320, quantity: 900, min: 300, supplier: null },
    { key: "gloves", name: "Перчатки нитриловые", unit: "шт", category: "Расходники", packSize: 100, packPrice: 120, quantity: 340, min: 100, supplier: null },
  ];
  const itemId: Record<string, string> = {};
  for (const it of stock) {
    const row = await db.stockItem.create({
      data: { name: it.name, unit: it.unit, category: it.category, packSize: it.packSize, packPrice: it.packPrice, quantity: it.quantity, minQuantity: it.min, supplier: it.supplier, createdAt: atSalonTime(addDays(today, -30), "10:00") },
    });
    itemId[it.key] = row.id;
    await db.stockMove.create({ data: { itemId: row.id, delta: it.quantity, balance: it.quantity, kind: "RECEIPT", note: "Начальный остаток", createdBy: "Мавзуна", createdAt: atSalonTime(addDays(today, -30), "10:00") } });
  }
  await db.stockMove.create({ data: { itemId: itemId.base!, delta: 0, balance: 60, kind: "COUNT", note: "Пересчёт: сошлось", createdBy: "Ресепшен", createdAt: atSalonTime(addDays(today, -7), "18:05") } });
  const norms: [string, string, number][] = [
    ["color", "igora", 60], ["color", "oxide", 60], ["color", "gloves", 2],
    ["balayage", "blondor", 60], ["balayage", "oxide", 90], ["balayage", "igora", 30], ["balayage", "gloves", 2],
    ["gel", "base", 1], ["gel", "gelRose", 1], ["gel", "files", 1], ["gel", "gloves", 2],
    ["pedi", "files", 2], ["pedi", "gloves", 2],
    ["lashes", "lashKit", 1],
    ["skin", "mask", 50], ["skin", "gloves", 2],
  ];
  await db.serviceConsumption.createMany({ data: norms.map(([sv, it, amount]) => ({ serviceId: serviceId[sv]!, itemId: itemId[it]!, amount })) });

  // Bridal package: Фарзона's wedding, with the dress already booked for her
  const farzonaDress = await db.dressBooking.findFirst({ where: { guestId: guestId.farzona }, include: { dress: true } });
  if (farzonaDress) {
    const wedding = farzonaDress.startsOn.toISOString().slice(0, 10);
    const svc = ["bridalHair", "bridal", "gel"].map((k) => data.services.find((x) => x.key === k)!);
    const sum = svc.reduce((a, x) => a + x.price, 0);
    const dressPrice = farzonaDress.dress.pricePerDay * 2;
    const pkg = await db.bridalPackage.create({
      data: {
        status: "CONFIRMED",
        guestId: guestId.farzona,
        name: "Фарзона Икромова",
        phone: data.guests.find((g) => g.key === "farzona")!.phone,
        weddingDate: new Date(`${wedding}T00:00:00Z`),
        services: svc.map((x) => ({ serviceId: serviceId[x.key], name: x.name, price: x.price })),
        dressId: farzonaDress.dressId,
        dressDays: 2,
        dressPrice,
        subtotal: sum + dressPrice,
        discountPercent: 10,
        total: sum - Math.round(sum * 0.1) + dressPrice,
        note: "Сбор в 07:00, фотограф к 10:00",
        createdAt: atSalonTime(addDays(today, -20), "16:00"),
      },
    });
    await db.dressBooking.update({ where: { id: farzonaDress.id }, data: { bridalPackageId: pkg.id } });
  }

  // Sign-in accounts (the same demo password for every role; change it after first sign-in)
  const password = process.env.SEED_OWNER_PASSWORD || "change-me-now";
  const hash = await hashPassword(password);
  await db.user.createMany({
    data: [
      { name: "Мавзуна", login: process.env.SEED_OWNER_LOGIN || "mavzuna", passwordHash: hash, role: "OWNER", staffId: staffId.mavzuna },
      { name: "Ресепшен", login: "reception", passwordHash: hash, role: "RECEPTION" },
      { name: "Контент-менеджер", login: "content", passwordHash: hash, role: "CONTENT" },
      { name: "Мира", login: "mira", passwordHash: hash, role: "MASTER", staffId: staffId.mira },
    ],
  });

  const counts = {
    staff: await db.staff.count(),
    services: await db.service.count(),
    guests: await db.guest.count(),
    appointments: await db.appointment.count(),
    sales: await db.sale.count(),
    dresses: await db.dress.count(),
    promotions: await db.promotion.count(),
  };
  console.log("Done:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
