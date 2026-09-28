// Queues reminder messages for upcoming bookings. Run by the worker every 10 minutes (and from the CMS on demand).
// No "server-only" import: the worker (plain Node) uses this file too.
import type { PrismaClient } from "@/generated/prisma/client";
import type { Lang } from "../../lib/i18n/locales";
import { dueReminders } from "../../lib/reminders";
import { appointmentVars, guestMessage, messageContext } from "./guest-messages";

export async function queueReminders(db: PrismaClient, now = new Date()): Promise<number> {
  const candidates = await db.appointment.findMany({
    where: {
      startsAt: { gt: now, lte: new Date(now.getTime() + 26 * 3600_000) },
      status: { in: ["PENDING", "CONFIRMED"] },
      guestId: { not: null },
    },
    include: { guest: true, staff: { include: { staff: true } } },
  });
  const due = dueReminders(candidates, now);
  if (!due.length) return 0;
  const ctx = await messageContext(db);
  for (const { id, kind } of due) {
    const a = candidates.find((x) => x.id === id)!;
    const guest = a.guest!;
    // In her language, into the bot if she uses it, otherwise WhatsApp
    const vars = (lang: Lang) => appointmentVars(ctx, lang, { ...a, staff: a.staff.map((s) => s.staff) }, guest.name);
    const message = await guestMessage(db, ctx, { guest, kind: kind === "day" ? "reminder-day" : "reminder-hours", vars, meta: { appointmentId: a.id } });
    await db.$transaction([
      db.outboxMessage.create({ data: message }),
      db.appointment.update({ where: { id: a.id }, data: kind === "day" ? { remindedDayAt: now } : { remindedHoursAt: now } }),
    ]);
  }
  return due.length;
}
