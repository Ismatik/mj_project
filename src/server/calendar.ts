import "server-only";
import { db } from "@/lib/db";
import { addDays, atSalonTime, isClosed, mondayOf, todayYmd, weekdayOf, WEEKDAYS_SHORT } from "@/lib/time";
import type { CurrentUser } from "./auth";

export async function getWeek({ week, staffId, user }: { week?: string; staffId?: string | null; user: CurrentUser }) {
  const today = todayYmd();
  const monday = mondayOf(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today);
  const onlyStaff = user.role === "MASTER" ? (user.staffId ?? "-") : staffId || null;

  const [appts, staff] = await Promise.all([
    db.appointment.findMany({
      where: {
        startsAt: { gte: atSalonTime(monday), lt: atSalonTime(addDays(monday, 7)) },
        ...(onlyStaff ? { staff: { some: { staffId: onlyStaff } } } : {}),
      },
      orderBy: { startsAt: "asc" },
      include: { staff: { include: { staff: true } } },
    }),
    db.staff.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, workDays: true } }),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const ymd = addDays(monday, i);
    return {
      ymd,
      dow: WEEKDAYS_SHORT[i]!,
      date: Number(ymd.slice(8)),
      closed: isClosed(ymd),
      isToday: ymd === today,
      working: staff.filter((m) => m.workDays.includes(weekdayOf(ymd))).map((m) => m.name),
      appts: appts
        .filter((a) => todayYmd(a.startsAt) === ymd)
        .map((a) => ({
          id: a.id,
          startsAt: a.startsAt,
          guestName: a.guestName,
          service: a.serviceLabel,
          staff: a.staff.map((s) => s.staff.name).join(" + "),
          status: a.status,
        })),
    };
  });

  return { monday, today, days, staff: staff.map(({ id, name }) => ({ id, name })), onlyStaff, total: appts.filter((a) => a.status !== "CANCELLED").length };
}

export async function getAppointment(id: string, user: CurrentUser) {
  const a = await db.appointment.findUnique({
    where: { id },
    include: { staff: { include: { staff: true } }, guest: true, service: true },
  });
  if (!a) return null;
  if (user.role === "MASTER" && !a.staff.some((s) => s.staffId === user.staffId)) return null;
  return {
    id: a.id,
    guestId: a.guestId,
    guestName: a.guest?.name ?? a.guestName,
    guestPhone: a.guest?.phone ?? null,
    service: a.serviceLabel,
    serviceId: a.serviceId,
    staff: a.staff.map((s) => ({ id: s.staffId, name: s.staff.name })),
    startsAt: a.startsAt,
    durationMin: a.durationMin,
    price: a.price,
    status: a.status,
    source: a.source,
    depositRequired: a.depositRequired,
    depositPaid: a.depositPaid,
    holdUntil: a.holdUntil,
    note: a.note,
    ymd: todayYmd(a.startsAt),
  };
}

export type AppointmentDetail = NonNullable<Awaited<ReturnType<typeof getAppointment>>>;
