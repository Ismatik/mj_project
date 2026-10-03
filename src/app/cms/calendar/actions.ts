"use server";

import { revalidatePath } from "next/cache";
import { canBook, canOpen } from "@/lib/access";
import { validateBooking, type Busy } from "@/lib/booking";
import { db } from "@/lib/db";
import { clock } from "@/lib/format";
import { addDays, atSalonTime, todayYmd } from "@/lib/time";
import { getCurrentUser } from "@/server/auth";
import { cancelAlert, forEachMaster, rescheduleAlert } from "@/server/integrations/master-alerts";
import { onBookingCancelled } from "@/server/waitlist/core";

type Status = "PENDING" | "CONFIRMED" | "IN_CHAIR" | "CANCELLED" | "NO_SHOW";

/** Reception and owner may set any status except "done" (that happens at payment); masters may only seat their guest. */
export async function setAppointmentStatus(id: string, status: Status): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !canOpen(user.role, "calendar")) return { ok: false, error: "Нет доступа" };
  if (!["PENDING", "CONFIRMED", "IN_CHAIR", "CANCELLED", "NO_SHOW"].includes(status)) return { ok: false, error: "Неизвестный статус" };
  const a = await db.appointment.findUnique({ where: { id }, include: { staff: true, guest: { select: { phone: true } } } });
  if (!a) return { ok: false, error: "Запись не найдена" };
  if (a.status === "DONE") return { ok: false, error: "Запись уже оплачена" };
  if (user.role === "MASTER") {
    if (!a.staff.some((s) => s.staffId === user.staffId) || status !== "IN_CHAIR") return { ok: false, error: "Мастер может только отметить «в кресле»" };
  }
  await db.appointment.update({ where: { id }, data: { status, ...(status === "CANCELLED" ? { holdUntil: null } : {}) } });
  if (status === "CANCELLED" && a.status !== "CANCELLED") {
    // Cancelled at the desk, so nobody has told the master. Without this she only finds out from
    // the 8:30 plan the next morning - too late if the visit was this afternoon.
    const visit = { guestName: a.guestName, phone: a.guest?.phone ?? null, serviceLabel: a.serviceLabel, startsAt: a.startsAt };
    const rows = await forEachMaster(a.staff.map((s) => s.staffId), (staffId) => cancelAlert(db, staffId, visit, a.id));
    if (rows.length) await db.outboxMessage.createMany({ data: rows });
    await onBookingCancelled(db, a); // offer the time to the waitlist
  }
  revalidatePath("/cms", "layout");
  return { ok: true };
}

export async function rescheduleAppointment(id: string, date: string, time: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !canBook(user.role)) return { ok: false, error: "Нет доступа" };
  const a = await db.appointment.findUnique({ where: { id }, include: { staff: { include: { staff: true } }, guest: { select: { phone: true } } } });
  if (!a) return { ok: false, error: "Запись не найдена" };
  if (a.status === "DONE" || a.status === "CANCELLED") return { ok: false, error: "Эту запись уже нельзя перенести" };

  const staffIds = a.staff.map((s) => s.staffId);
  const others = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? await db.appointment.findMany({
        where: {
          id: { not: id },
          startsAt: { gte: atSalonTime(date), lt: atSalonTime(addDays(date, 1)) },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          staff: { some: { staffId: { in: staffIds } } },
        },
        include: { staff: true },
      })
    : [];
  const busy: Busy[] = others.flatMap((o) => {
    const [h, m] = clock(o.startsAt).split(":").map(Number);
    const start = h! * 60 + m!;
    return o.staff.filter((s) => staffIds.includes(s.staffId)).map((s) => ({ staffId: s.staffId, start, end: start + o.durationMin, label: `${o.guestName}, ${o.serviceLabel}` }));
  });
  const now = new Date();
  const [nh, nm] = clock(now).split(":").map(Number);
  const errors = validateBooking(
    { guestId: a.guestId ?? "group", guestName: a.guestName, guestPhone: "", serviceId: a.serviceId ?? "x", staffIds, date, time, durationMin: a.durationMin, price: a.price },
    {
      today: todayYmd(now),
      nowMinutes: nh! * 60 + nm!,
      workDays: Object.fromEntries(a.staff.map((s) => [s.staffId, s.staff.workDays])),
      staffNames: Object.fromEntries(a.staff.map((s) => [s.staffId, s.staff.name])),
      busy,
    },
  );
  const first = errors.date ?? errors.time ?? errors.staff;
  if (first) return { ok: false, error: first };

  const startsAt = atSalonTime(date, time.padStart(5, "0"));
  await db.appointment.update({ where: { id }, data: { startsAt } });
  // a.startsAt is still the old time here: that is what the master needs to stop expecting.
  const visit = { guestName: a.guestName, phone: a.guest?.phone ?? null, serviceLabel: a.serviceLabel, startsAt };
  const rows = await forEachMaster(staffIds, (staffId) => rescheduleAlert(db, staffId, visit, a.startsAt, a.id));
  if (rows.length) await db.outboxMessage.createMany({ data: rows });
  await onBookingCancelled(db, a); // its old time is free now
  revalidatePath("/cms", "layout");
  return { ok: true };
}
