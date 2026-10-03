import "server-only";
import { db } from "@/lib/db";
import { addDays, atSalonTime, mondayOf, todayYmd } from "@/lib/time";
import { monthPrepositional, monthToDate } from "./ranges";

const DAY_MINUTES = 9 * 60; // 09:00-18:00

export async function getStaffBoard() {
  const today = todayYmd();
  const monday = mondayOf(today);
  const [staff, weekAppts, monthSales] = await Promise.all([
    db.staff.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.appointmentStaff.findMany({
      where: {
        appointment: {
          startsAt: { gte: atSalonTime(monday), lt: atSalonTime(addDays(monday, 7)) },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
      },
      select: { staffId: true, appointment: { select: { durationMin: true } } },
    }),
    db.sale.groupBy({ by: ["staffId"], where: { createdAt: monthToDate(today) }, _sum: { total: true } }),
  ]);

  const booked = new Map<string, number>();
  for (const a of weekAppts) booked.set(a.staffId, (booked.get(a.staffId) ?? 0) + a.appointment.durationMin);
  const revenue = new Map(monthSales.map((s) => [s.staffId, s._sum.total ?? 0]));
  // Simulator chats are left out: one tried in the CMS must not read as "she is connected".
  const chats = await db.telegramChat.groupBy({ by: ["staffId"], where: { staffId: { in: staff.map((m) => m.id) }, NOT: { id: { startsWith: "sim-" } } }, _count: true });
  const botChats = new Map(chats.map((c) => [c.staffId!, c._count]));

  return {
    monthPrep: monthPrepositional(today),
    staff: staff.map((m) => {
      const capacity = m.workDays.length * DAY_MINUTES;
      const load = capacity ? Math.min(100, Math.round(((booked.get(m.id) ?? 0) / capacity) * 100)) : 0;
      return { id: m.id, name: m.name, title: m.title, workDays: m.workDays, load, revenue: revenue.get(m.id) ?? 0, botChats: botChats.get(m.id) ?? 0 };
    }),
  };
}
