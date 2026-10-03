import "server-only";
import { db } from "@/lib/db";
import { addDays, atSalonTime, mondayOf, todayYmd, type Ymd } from "@/lib/time";
import { changeLabel, dayRange, monthName, monthToDate, previousMonthDative, previousMonthToDate } from "./ranges";

/** Daily revenue for `days` days ending on `today` (oldest first). */
export async function revenueByDay(today: Ymd, days: number) {
  const from = addDays(today, -(days - 1));
  const sales = await db.sale.findMany({
    where: { createdAt: { gte: atSalonTime(from), lt: atSalonTime(addDays(today, 1)) } },
    select: { total: true, createdAt: true },
  });
  const byDay = new Map<Ymd, number>();
  for (const s of sales) {
    const ymd = todayYmd(s.createdAt);
    byDay.set(ymd, (byDay.get(ymd) ?? 0) + s.total);
  }
  return Array.from({ length: days }, (_, i) => {
    const ymd = addDays(from, i);
    return { ymd, amount: byDay.get(ymd) ?? 0 };
  });
}

/** Share of revenue per service category over the last `days` days. */
export async function categoryShares(today: Ymd, days = 30) {
  const items = await db.saleItem.findMany({
    where: { sale: { createdAt: { gte: atSalonTime(addDays(today, -(days - 1))) } }, service: { isNot: null } },
    select: { price: true, service: { select: { category: { select: { name: true, icon: true } } } } },
  });
  const byCategory = new Map<string, { name: string; icon: string; amount: number }>();
  for (const it of items) {
    const c = it.service!.category;
    const row = byCategory.get(c.name) ?? { name: c.name, icon: c.icon, amount: 0 };
    row.amount += it.price;
    byCategory.set(c.name, row);
  }
  const total = [...byCategory.values()].reduce((a, c) => a + c.amount, 0);
  return [...byCategory.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((c) => ({ ...c, share: total ? c.amount / total : 0 }));
}

const sum = (span: { gte: Date; lt: Date }) => db.sale.aggregate({ where: { createdAt: span }, _sum: { total: true } });
const span = (from: Ymd, toIncl: Ymd) => ({ gte: atSalonTime(from), lt: atSalonTime(addDays(toIncl, 1)) });

/**
 * Money and week-on-week figures for "Мой салон сегодня". Owner only - reception
 * sees the operational half of the dashboard but not the revenue breakdown.
 */
export async function getDashboardMoney(today: Ymd = todayYmd()) {
  const weekFrom = mondayOf(today);
  const prevWeekFrom = addDays(weekFrom, -7);
  const [sales, sameDayLastWeek, thisWeek, prevWeek, monthByDay] = await Promise.all([
    db.sale.findMany({
      where: { createdAt: dayRange(today) },
      select: { total: true, paid: true, method: true, depositAmount: true, giftCardAmount: true, bonusAmount: true },
    }),
    sum(dayRange(addDays(today, -7))),
    sum(span(weekFrom, today)),
    // same weekday span a week earlier, so a half-finished week compares fairly
    sum(span(prevWeekFrom, addDays(today, -7))),
    db.sale.findMany({ where: { createdAt: monthToDate(today) }, select: { total: true, createdAt: true } }),
  ]);

  const add = (f: (s: (typeof sales)[number]) => number) => sales.reduce((a, s) => a + f(s), 0);
  const byMethod = { CASH: 0, CARD: 0, QR: 0 };
  for (const s of sales) byMethod[s.method] += s.paid;

  const revenue = add((s) => s.total);
  // "средний рабочий день" - Mondays are the day off, so count only days that had receipts
  const daysWithSales = new Set(monthByDay.map((s) => todayYmd(s.createdAt))).size;
  const monthRevenue = monthByDay.reduce((a, s) => a + s.total, 0);

  const weekNow = thisWeek._sum.total ?? 0;
  const weekBefore = prevWeek._sum.total ?? 0;
  const dayBefore = sameDayLastWeek._sum.total ?? 0;

  return {
    byMethod,
    avgCheck: sales.length ? Math.round(revenue / sales.length) : 0,
    receipts: sales.length,
    deposits: add((s) => s.depositAmount),
    giftCards: add((s) => s.giftCardAmount),
    bonus: add((s) => s.bonusAmount),
    sameDayLastWeek: dayBefore,
    sameDayChange: changeLabel(revenue, dayBefore),
    weekRevenue: weekNow,
    weekChange: changeLabel(weekNow, weekBefore),
    avgWorkingDay: daysWithSales ? Math.round(monthRevenue / daysWithSales) : 0,
    daysWithSales,
  };
}

/** Everything "Мой салон сегодня" shows, computed from real records. */
export async function getDashboard(today: Ymd = todayYmd()) {
  const [todaySales, monthSales, prevMonthSales, guestsTotal, guestsNewThisMonth, appointments, revenue14, categories, reminders, requests] =
    await Promise.all([
      db.sale.aggregate({ where: { createdAt: dayRange(today) }, _sum: { total: true }, _count: true }),
      db.sale.aggregate({ where: { createdAt: monthToDate(today) }, _sum: { total: true } }),
      db.sale.aggregate({ where: { createdAt: previousMonthToDate(today) }, _sum: { total: true } }),
      db.guest.count(),
      db.guest.count({ where: { createdAt: monthToDate(today) } }),
      db.appointment.findMany({
        where: { startsAt: dayRange(today), status: { notIn: ["CANCELLED"] } },
        orderBy: { startsAt: "asc" },
        include: { staff: { include: { staff: true } } },
      }),
      revenueByDay(today, 14),
      categoryShares(today),
      db.reminder.findMany({ orderBy: [{ done: "asc" }, { createdAt: "asc" }] }),
      db.bookingRequest.findMany({ where: { status: { in: ["NEW", "CALLED"] } }, orderBy: { createdAt: "asc" }, take: 20 }),
    ]);

  // Busiest chairs today
  const load = new Map<string, number>();
  for (const a of appointments) for (const s of a.staff) load.set(s.staff.name, (load.get(s.staff.name) ?? 0) + a.durationMin);
  const busiest = [...load.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n);

  const monthRevenue = monthSales._sum.total ?? 0;
  const prevRevenue = prevMonthSales._sum.total ?? 0;

  return {
    today,
    todayRevenue: todaySales._sum.total ?? 0,
    todayPaidCount: todaySales._count,
    monthRevenue,
    monthChange: changeLabel(monthRevenue, prevRevenue),
    monthName: monthName(today),
    previousMonthDative: previousMonthDative(today),
    guestsTotal,
    guestsNewThisMonth,
    walkIns: appointments.filter((a) => a.source === "WALK_IN").length,
    busiest,
    appointments: appointments.map((a) => ({
      id: a.id,
      guestName: a.guestName,
      service: a.serviceLabel,
      staff: a.staff.map((s) => s.staff.name).join(" + "),
      startsAt: a.startsAt,
      endsAt: new Date(a.startsAt.getTime() + a.durationMin * 60_000),
      price: a.price,
      status: a.status,
    })),
    revenue14,
    categories,
    reminders: reminders.map((r) => ({ id: r.id, text: r.text, done: r.done })),
    requests: requests.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      date: r.date.toISOString().slice(0, 10),
      service: r.service,
      status: r.status,
      createdAt: r.createdAt,
      guestId: r.guestId,
    })),
  };
}
