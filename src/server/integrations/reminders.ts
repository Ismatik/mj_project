// Queues reminder messages for upcoming bookings. Run by the worker every 10 minutes (and from the CMS on demand).
// No "server-only" import: the worker (plain Node) uses this file too.
import type { PrismaClient } from "@/generated/prisma/client";
import { clock, longDate } from "../../lib/format";
import { dueReminders } from "../../lib/reminders";

export async function queueReminders(db: PrismaClient, now = new Date()): Promise<number> {
  const candidates = await db.appointment.findMany({
    where: {
      startsAt: { gt: now, lte: new Date(now.getTime() + 26 * 3600_000) },
      status: { in: ["PENDING", "CONFIRMED"] },
      guestId: { not: null },
    },
    include: { guest: { include: { telegramChats: { where: { isStaff: false }, orderBy: { updatedAt: "desc" }, take: 1 } } }, staff: { include: { staff: true } } },
  });
  const due = dueReminders(candidates, now);
  for (const { id, kind } of due) {
    const a = candidates.find((x) => x.id === id)!;
    const chat = a.guest!.telegramChats[0];
    const master = a.staff.map((s) => s.staff.name).join(" + ");
    const body =
      kind === "day"
        ? `Mavzunai Jovid ✦ Напоминаем: ${longDate(a.startsAt)} в ${clock(a.startsAt)} — ${a.serviceLabel}, мастер ${master}. ул. Бухоро, 23/25. Если планы изменились, перенесите или отмените запись в боте («Мои записи») или напишите нам.`
        : `Mavzunai Jovid ✦ Ждём вас сегодня в ${clock(a.startsAt)} — ${a.serviceLabel}, мастер ${master}. ул. Бухоро, 23/25.`;
    await db.$transaction([
      db.outboxMessage.create({
        data: {
          channel: chat ? "telegram" : "whatsapp",
          to: chat ? chat.id : a.guest!.phone,
          body,
          meta: { kind: `reminder-${kind}`, appointmentId: a.id },
        },
      }),
      db.appointment.update({ where: { id: a.id }, data: kind === "day" ? { remindedDayAt: now } : { remindedHoursAt: now } }),
    ]);
  }
  return due.length;
}
