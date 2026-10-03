import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { guestBonus } from "./loyalty/core";
import { phoneDigits } from "@/lib/phone";
import { todayYmd } from "@/lib/time";
import { nextBirthday } from "@/lib/birthday";
import { monthPrepositional, monthToDate } from "./ranges";

export type GuestFilter = "all" | "VIP" | "BRIDE" | "REGULAR" | "NEW" | "birthdays";

/** "Дни рождения" shows birthdays in the next two weeks */
export const BIRTHDAY_DAYS = 14;

/** Guest book rows with visit statistics (done visits, last visit, favourite service). */
export async function getGuestBook({ q = "", tag = "all", limit = 50 }: { q?: string; tag?: GuestFilter; limit?: number }) {
  const term = q.trim();
  const digits = phoneDigits(term);
  const where: Prisma.GuestWhereInput = {
    ...(tag === "birthdays" ? { birthday: { not: null } } : tag !== "all" ? { tag } : {}),
    ...(term
      ? { OR: [{ name: { contains: term, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] }
      : {}),
  };

  const today = todayYmd();
  const [total, newThisMonth, byTag, guests, visits, favs, birthdays] = await Promise.all([
    db.guest.count(),
    db.guest.count({ where: { createdAt: monthToDate(today) } }),
    db.guest.groupBy({ by: ["tag"], _count: true }),
    db.guest.findMany({ where, select: { id: true, name: true, phone: true, tag: true, createdAt: true, birthday: true, allergies: true } }),
    db.appointment.groupBy({ by: ["guestId"], where: { status: "DONE", guestId: { not: null } }, _count: true, _max: { startsAt: true } }),
    db.appointment.groupBy({ by: ["guestId", "serviceId"], where: { status: "DONE", guestId: { not: null } }, _count: true }),
    db.guest.findMany({ where: { birthday: { not: null } }, select: { birthday: true } }),
  ]);

  const services = new Map((await db.service.findMany({ select: { id: true, name: true } })).map((s) => [s.id, s.name]));
  const visitMap = new Map(visits.map((v) => [v.guestId!, { count: v._count, last: v._max.startsAt }]));
  const favMap = new Map<string, { serviceId: string | null; count: number }>();
  for (const f of favs) {
    const cur = favMap.get(f.guestId!);
    if (!cur || f._count > cur.count) favMap.set(f.guestId!, { serviceId: f.serviceId, count: f._count });
  }

  const soon = (b: Date | null) => (b ? nextBirthday(b.toISOString().slice(0, 10), today) : null);
  const rows = guests
    .map((g) => {
      const v = visitMap.get(g.id);
      const fav = favMap.get(g.id);
      const bd = soon(g.birthday);
      return {
        ...g,
        allergy: !!g.allergies,
        birthdayIn: bd && bd.days <= BIRTHDAY_DAYS ? bd : null,
        visits: v?.count ?? 0,
        last: v?.last ?? null,
        fav: fav?.serviceId ? (services.get(fav.serviceId) ?? "-") : "-",
      };
    })
    .filter((g) => tag !== "birthdays" || g.birthdayIn)
    .sort((a, b) =>
      tag === "birthdays" ? a.birthdayIn!.days - b.birthdayIn!.days : (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0) || a.name.localeCompare(b.name, "ru"),
    );

  return {
    total,
    newThisMonth,
    monthPrep: monthPrepositional(today),
    counts: {
      ...Object.fromEntries(byTag.map((t) => [t.tag, t._count])),
      birthdays: birthdays.filter((g) => soon(g.birthday)!.days <= BIRTHDAY_DAYS).length,
    } as Record<string, number>,
    found: rows.length,
    rows: rows.slice(0, limit),
  };
}

/** One guest with history for the guest card. */
export async function getGuestCard(id: string) {
  const guest = await db.guest.findUnique({
    where: { id },
    include: {
      appointments: { orderBy: { startsAt: "desc" }, take: 100, include: { staff: { include: { staff: true } } } },
      sales: { select: { total: true } },
      formulas: { orderBy: { createdAt: "desc" }, include: { staff: { select: { name: true } } } },
      photos: { orderBy: { createdAt: "desc" }, include: { appointment: { select: { serviceLabel: true, startsAt: true } } } },
    },
  });
  if (!guest) return null;
  const now = new Date();
  const done = guest.appointments.filter((a) => a.status === "DONE");
  const spent = guest.sales.reduce((s, x) => s + x.total, 0);
  const counts = new Map<string, number>();
  for (const a of done) counts.set(a.serviceLabel, (counts.get(a.serviceLabel) ?? 0) + 1);
  const favourite = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const row = (a: (typeof guest.appointments)[number]) => ({
    id: a.id,
    startsAt: a.startsAt,
    service: a.serviceLabel,
    staff: a.staff.map((s) => s.staff.name).join(" + "),
    price: a.price,
    status: a.status,
  });

  const bonus = await guestBonus(db, guest.id);
  return {
    bonus,
    id: guest.id,
    name: guest.name,
    phone: guest.phone,
    tag: guest.tag,
    birthday: guest.birthday ? guest.birthday.toISOString().slice(0, 10) : "",
    notes: guest.notes ?? "",
    allergies: guest.allergies ?? "",
    nextBirthday: guest.birthday ? nextBirthday(guest.birthday.toISOString().slice(0, 10), todayYmd()) : null,
    formulas: guest.formulas.map((f) => ({ id: f.id, title: f.title, formula: f.formula, note: f.note, master: f.staff?.name ?? null, at: f.createdAt, by: f.createdBy })),
    photos: guest.photos.map((p) => ({ id: p.id, kind: p.kind, caption: p.caption, at: p.createdAt, visit: p.appointment ? `${p.appointment.serviceLabel}` : null })),
    recentVisits: done.slice(0, 15).map((a) => ({ id: a.id, label: `${a.serviceLabel}, ${a.startsAt.toISOString().slice(0, 10).split("-").reverse().join(".")}` })),
    since: guest.createdAt,
    visits: done.length,
    spent,
    averageCheck: guest.sales.length ? Math.round(spent / guest.sales.length) : 0,
    favourite,
    upcoming: guest.appointments.filter((a) => a.startsAt >= now && !["CANCELLED", "DONE", "NO_SHOW"].includes(a.status)).reverse().map(row),
    history: guest.appointments.filter((a) => a.startsAt < now || a.status === "DONE").map(row),
  };
}

export type GuestCardData = NonNullable<Awaited<ReturnType<typeof getGuestCard>>>;
