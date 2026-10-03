// What a master hears about her own day, in her own Telegram chat.
// No "server-only": the worker (plain Node) builds the morning plan with this file too.
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { clock, longDate, somoni } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

type Tx = Prisma.TransactionClient | PrismaClient;
type Row = Prisma.OutboxMessageCreateManyInput;

/** Outbox address of one master's chats. Delivery fans it out in outbox.ts. */
export const masterAddress = (staffId: string) => `staff:${staffId}`;
export const staffIdFromAddress = (to: string) => (to.startsWith("staff:") ? to.slice("staff:".length) : null);

/** Chats a master has linked with "/master CODE". Simulator chats never leave the server. */
export const linkedChats = (tx: Tx, staffId: string) => tx.telegramChat.findMany({ where: { staffId, NOT: { id: { startsWith: "sim-" } } }, select: { id: true } });

/**
 * A message for the master, or null when she has not linked a chat — which is most of them, most
 * of the time. Returning null rather than queueing keeps the CMS outbox free of rows that could
 * never be delivered; whether she is linked at all is shown on her row in CMS → Мастера.
 */
async function alert(tx: Tx, staffId: string | null | undefined, body: string, meta: Prisma.InputJsonValue): Promise<Row | null> {
  if (!staffId) return null;
  const chats = await linkedChats(tx, staffId);
  return chats.length ? { channel: "telegram", to: masterAddress(staffId), body, meta } : null;
}

type Visit = { guestName: string; phone: string | null; serviceLabel: string; startsAt: Date };

const line = (v: Visit) => `${v.guestName}${v.phone ? `, ${formatPhone(v.phone)}` : ""} - ${v.serviceLabel}\n${longDate(v.startsAt)}, ${clock(v.startsAt)}`;

export function newBookingAlert(tx: Tx, staffId: string | null, v: Visit, meta: { appointmentId: string; deposit?: number | null }) {
  const tail = meta.deposit ? `\n\nВремя держится до предоплаты ${somoni(meta.deposit)}.` : "";
  return alert(tx, staffId, `Новая запись к вам:\n${line(v)}${tail}`, { kind: "master-booking", appointmentId: meta.appointmentId });
}

export function cancelAlert(tx: Tx, staffId: string | null, v: Visit, appointmentId: string) {
  return alert(tx, staffId, `Запись отменена:\n${line(v)}\n\nЭто время у вас освободилось.`, { kind: "master-cancel", appointmentId });
}

export function rescheduleAlert(tx: Tx, staffId: string | null, v: Visit, was: Date, appointmentId: string) {
  return alert(tx, staffId, `Запись перенесена:\n${line(v)}\n\nБыло: ${longDate(was)}, ${clock(was)}.`, { kind: "master-reschedule", appointmentId });
}

/**
 * One message per master at the start of her day. The safety net for every path that does not
 * send its own alert: whatever happened overnight, she still opens the morning with the real list.
 */
export async function queueMasterDayPlans(db: PrismaClient, from: Date, to: Date): Promise<number> {
  const visits = await db.appointment.findMany({
    where: { startsAt: { gte: from, lt: to }, status: { in: ["PENDING", "CONFIRMED"] } },
    orderBy: { startsAt: "asc" },
    include: { guest: { select: { phone: true } }, staff: { select: { staffId: true } } },
  });
  const linked = await db.telegramChat.findMany({ where: { staffId: { not: null }, NOT: { id: { startsWith: "sim-" } } }, select: { staffId: true } });
  const byStaff = new Map<string, Visit[]>();
  for (const id of new Set(linked.map((c) => c.staffId!))) byStaff.set(id, []);
  for (const a of visits) {
    for (const s of a.staff) {
      const list = byStaff.get(s.staffId);
      // Only masters who linked a chat are in the map, so this skips everyone else.
      if (list) list.push({ guestName: a.guestName, phone: a.guest?.phone ?? null, serviceLabel: a.serviceLabel, startsAt: a.startsAt });
    }
  }
  const rows: Row[] = [];
  for (const [staffId, list] of byStaff) {
    // A master with nothing booked is told so: silence would read as "the bot is broken".
    const body = list.length
      ? `Ваш день, ${longDate(from)}:\n\n${list.map((v) => `${clock(v.startsAt)} - ${v.guestName}${v.phone ? `, ${formatPhone(v.phone)}` : ""}\n${v.serviceLabel}`).join("\n\n")}`
      : `Ваш день, ${longDate(from)}: записей пока нет.`;
    rows.push({ channel: "telegram", to: masterAddress(staffId), body, meta: { kind: "master-day" } });
  }
  if (rows.length) await db.outboxMessage.createMany({ data: rows });
  return rows.length;
}
