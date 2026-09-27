import "server-only";
import { db } from "@/lib/db";
import { addDays, atSalonTime, todayYmd, type Ymd } from "@/lib/time";

const dayRange = (ymd: Ymd) => ({ gte: atSalonTime(ymd), lt: atSalonTime(addDays(ymd, 1)) });

/** Everything the dashboard needs, computed from real records. */
export async function getDashboard(today: Ymd = todayYmd()) {
  const monthStart = `${today.slice(0, 8)}01`;
  const from14 = addDays(today, -13);

  const [todaySales, monthSales, guestsTotal, guestsNewThisMonth, appointments, recentSales, items] = await Promise.all([
    db.sale.aggregate({ where: { createdAt: dayRange(today) }, _sum: { total: true }, _count: true }),
    db.sale.aggregate({ where: { createdAt: { gte: atSalonTime(monthStart), lt: atSalonTime(addDays(today, 1)) } }, _sum: { total: true } }),
    db.guest.count(),
    db.guest.count({ where: { createdAt: { gte: atSalonTime(monthStart) } } }),
    db.appointment.findMany({
      where: { startsAt: dayRange(today), status: { notIn: ["CANCELLED"] } },
      orderBy: { startsAt: "asc" },
      include: { staff: { include: { staff: true } } },
    }),
    db.sale.findMany({ where: { createdAt: { gte: atSalonTime(from14), lt: atSalonTime(addDays(today, 1)) } }, select: { total: true, createdAt: true } }),
    db.saleItem.findMany({
      where: { sale: { createdAt: { gte: atSalonTime(addDays(today, -29)) } }, service: { isNot: null } },
      select: { price: true, service: { select: { category: { select: { name: true, icon: true, sortOrder: true } } } } },
    }),
  ]);

  const byDay = new Map<Ymd, number>();
  for (const s of recentSales) {
    const ymd = todayYmd(s.createdAt);
    byDay.set(ymd, (byDay.get(ymd) ?? 0) + s.total);
  }
  const revenue14 = Array.from({ length: 14 }, (_, i) => {
    const ymd = addDays(from14, i);
    return { ymd, amount: byDay.get(ymd) ?? 0 };
  });

  const byCategory = new Map<string, { name: string; icon: string; amount: number }>();
  for (const it of items) {
    const c = it.service!.category;
    const row = byCategory.get(c.name) ?? { name: c.name, icon: c.icon, amount: 0 };
    row.amount += it.price;
    byCategory.set(c.name, row);
  }
  const categoryTotal = [...byCategory.values()].reduce((a, c) => a + c.amount, 0);
  const categories = [...byCategory.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((c) => ({ ...c, share: categoryTotal ? c.amount / categoryTotal : 0 }));

  return {
    today,
    todayRevenue: todaySales._sum.total ?? 0,
    todayPaidCount: todaySales._count,
    monthRevenue: monthSales._sum.total ?? 0,
    guestsTotal,
    guestsNewThisMonth,
    appointments: appointments.map((a) => ({
      id: a.id,
      guestName: a.guestName,
      service: a.serviceLabel,
      staff: a.staff.map((s) => s.staff.name).join(" + "),
      startsAt: a.startsAt,
      price: a.price,
      status: a.status,
    })),
    revenue14,
    categories,
  };
}
