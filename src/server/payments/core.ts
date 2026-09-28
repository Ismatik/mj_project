// Online payments: prepayments for bookings and certificate purchases.
// The test checkout (and later a bank's webhook) calls markPaid / cancelPayment.
// No "server-only" import: the worker (plain Node) releases expired holds with this file.
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { clock, longDate, somoni } from "../../lib/format";
import { asLang } from "../../lib/i18n/locales";
import { GIFT_VALID_DAYS } from "../../lib/money";
import { formatPhone } from "../../lib/phone";
import { appointmentVars, guestMessage, messageContext } from "../integrations/guest-messages";
import { onBookingCancelled } from "../waitlist/core";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export type PayOutcome = { ok: true } | { ok: false; error: "not-found" | "expired" | "not-pending" };

/** The guest paid: the booking keeps its time (and she gets her confirmation), or the certificate becomes valid. */
export async function markPaid(db: Db, paymentId: string, externalId?: string): Promise<PayOutcome> {
  return db.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!p) return { ok: false, error: "not-found" } as const;
    if (p.status !== "PENDING") return { ok: false, error: "not-pending" } as const;
    if (p.expiresAt < new Date()) return { ok: false, error: "expired" } as const;
    const now = new Date();
    await tx.payment.update({ where: { id: p.id }, data: { status: "PAID", paidAt: now, externalId: externalId ?? p.externalId } });

    if (p.purpose === "DEPOSIT" && p.appointmentId) {
      const a = await tx.appointment.update({
        where: { id: p.appointmentId },
        data: { depositPaid: { increment: p.amount }, holdUntil: null },
        include: { guest: true, staff: { include: { staff: true } } },
      });
      await tx.outboxMessage.create({
        data: {
          channel: "telegram",
          to: "reception",
          body: `Предоплата ${somoni(p.amount)} получена: ${a.guest?.name ?? a.guestName} — ${a.serviceLabel}, ${longDate(a.startsAt)}, ${clock(a.startsAt)}. Подтвердите в календаре.`,
          meta: { kind: "deposit-paid", appointmentId: a.id, paymentId: p.id },
        },
      });
      // Her confirmation waited for the prepayment
      if (a.guest && a.source === "WEBSITE") {
        const ctx = await messageContext(tx);
        const staff = a.staff.map((s) => s.staff);
        const msg = await guestMessage(tx, ctx, {
          guest: a.guest,
          kind: "booking-confirmation",
          vars: (lang) => appointmentVars(ctx, lang, { ...a, staff }, a.guest!.name),
          meta: { appointmentId: a.id },
        });
        await tx.outboxMessage.create({ data: msg });
      }
    }

    if (p.purpose === "GIFT_CARD" && p.giftCardId) {
      const g = await tx.giftCard.update({
        where: { id: p.giftCardId },
        data: { status: "ACTIVE", expiresAt: new Date(now.getTime() + GIFT_VALID_DAYS * 864e5) },
      });
      await tx.outboxMessage.create({
        data: {
          channel: "telegram",
          to: "reception",
          body: `Продан сертификат на сайте: ${g.code} на ${somoni(g.amount)} — для ${g.recipientName}, покупатель ${g.buyerName}${g.buyerPhone ? `, ${formatPhone(g.buyerPhone)}` : ""}.`,
          meta: { kind: "gift-card-sold", giftCardId: g.id },
        },
      });
    }
    return { ok: true } as const;
  });
}

/** Payment abandoned (or its time ran out): the held booking time is released, the certificate cancelled. */
export async function cancelPayment(db: Db | Tx, paymentId: string, reason: "cancelled" | "expired"): Promise<boolean> {
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.status !== "PENDING") return false;
  await db.payment.update({ where: { id: p.id }, data: { status: "CANCELLED" } });
  if (p.purpose === "DEPOSIT" && p.appointmentId) {
    const a = await db.appointment.findUnique({ where: { id: p.appointmentId }, include: { guest: true } });
    // Only release a booking still waiting for its prepayment (reception may have confirmed it by phone)
    if (a && a.holdUntil && a.depositPaid < a.depositRequired && ["PENDING"].includes(a.status)) {
      await db.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED", holdUntil: null, note: reason === "expired" ? "Предоплата не внесена вовремя" : "Гостья отменила оплату" } });
      await db.outboxMessage.create({
        data: {
          channel: "telegram",
          to: "reception",
          body: `Запись снята — предоплата не внесена: ${a.guest?.name ?? a.guestName}, ${a.serviceLabel}, ${longDate(a.startsAt)}, ${clock(a.startsAt)}. Время снова свободно.`,
          meta: { kind: "deposit-expired", appointmentId: a.id },
        },
      });
      if ("$transaction" in db) await onBookingCancelled(db as PrismaClient, a);
    }
  }
  if (p.purpose === "GIFT_CARD" && p.giftCardId) {
    await db.giftCard.updateMany({ where: { id: p.giftCardId, status: "PENDING" }, data: { status: "CANCELLED" } });
  }
  return true;
}

/** Worker: every minute, payments past their time are cancelled and held booking times released. */
export async function releaseExpired(db: Db, now = new Date()): Promise<number> {
  const due = await db.payment.findMany({ where: { status: "PENDING", expiresAt: { lt: now } }, select: { id: true } });
  let n = 0;
  for (const p of due) if (await cancelPayment(db, p.id, "expired")) n++;
  return n;
}

export { siteUrl } from "../../lib/site-url";

export const langOf = (p: { lang: string }) => asLang(p.lang);
