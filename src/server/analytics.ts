import "server-only";
import { db } from "@/lib/db";
import { clock } from "@/lib/format";
import { addDays, atSalonTime, todayYmd } from "@/lib/time";
import { revenueByDay } from "./dashboard";
import { changeLabel, monthToDate, previousMonthDative, previousMonthToDate } from "./ranges";

const HOUR_BUCKETS = [
  { label: "09:00–11:00", to: 11 * 60 },
  { label: "11:00–13:00", to: 13 * 60 },
  { label: "13:00–15:00", to: 15 * 60 },
  { label: "15:00–17:00", to: 17 * 60 },
  { label: "17:00–18:00", to: 24 * 60 },
];

export async function getAnalytics() {
  const today = todayYmd();
  const since90 = atSalonTime(addDays(today, -89));
  const since30 = atSalonTime(addDays(today, -29));

  const [month, prev, visitsRecent, doneCounts, online, requests, recentAppts, byMethod, topItems, revenue14] = await Promise.all([
    db.sale.aggregate({ where: { createdAt: monthToDate(today) }, _sum: { total: true }, _count: true }),
    db.sale.aggregate({ where: { createdAt: previousMonthToDate(today) }, _sum: { total: true }, _count: true }),
    db.appointment.findMany({ where: { status: "DONE", startsAt: { gte: since90 }, guestId: { not: null } }, select: { guestId: true }, distinct: ["guestId"] }),
    db.appointment.groupBy({ by: ["guestId"], where: { status: "DONE", guestId: { not: null } }, _count: true }),
    db.appointment.count({ where: { createdAt: monthToDate(today), source: { in: ["WEBSITE", "TELEGRAM", "WHATSAPP"] } } }),
    db.bookingRequest.count({ where: { createdAt: monthToDate(today) } }),
    db.appointment.findMany({ where: { startsAt: { gte: since30, lt: atSalonTime(addDays(today, 1)) }, status: { notIn: ["CANCELLED"] } }, select: { startsAt: true } }),
    db.sale.groupBy({ by: ["method"], where: { createdAt: monthToDate(today) }, _sum: { total: true } }),
    db.saleItem.groupBy({ by: ["name"], where: { sale: { createdAt: monthToDate(today) } }, _sum: { price: true }, _count: true, orderBy: { _sum: { price: "desc" } }, take: 5 }),
    revenueByDay(today, 14),
  ]);

  const monthRevenue = month._sum.total ?? 0;
  const prevRevenue = prev._sum.total ?? 0;
  const avg = month._count ? Math.round(monthRevenue / month._count) : 0;
  const prevAvg = prev._count ? Math.round(prevRevenue / prev._count) : 0;

  const visitCount = new Map(doneCounts.map((d) => [d.guestId, d._count]));
  const recentGuests = visitsRecent.map((v) => v.guestId);
  const returning = recentGuests.filter((g) => (visitCount.get(g) ?? 0) >= 2).length;
  const retention = recentGuests.length ? Math.round((returning / recentGuests.length) * 100) : 0;

  const buckets = HOUR_BUCKETS.map((b) => ({ ...b, count: 0 }));
  for (const a of recentAppts) {
    const [h, m] = clock(a.startsAt).split(":").map(Number);
    const minutes = h! * 60 + m!;
    buckets.find((b) => minutes < b.to)!.count++;
  }
  const apptTotal = recentAppts.length;

  const methodTotal = byMethod.reduce((s, m) => s + (m._sum.total ?? 0), 0);

  return {
    prevDative: previousMonthDative(today),
    kpis: {
      monthRevenue,
      monthChange: changeLabel(monthRevenue, prevRevenue),
      avg,
      avgChange: changeLabel(avg, prevAvg),
      retention,
      online: online + requests,
    },
    revenue14,
    hours: buckets.map((b) => ({ label: b.label, share: apptTotal ? b.count / apptTotal : 0 })),
    methods: (["CASH", "CARD", "QR"] as const).map((k) => {
      const amount = byMethod.find((m) => m.method === k)?._sum.total ?? 0;
      return { key: k, amount, share: methodTotal ? amount / methodTotal : 0 };
    }),
    top: topItems.map((t) => ({ name: t.name, amount: t._sum.price ?? 0, count: t._count })),
  };
}
