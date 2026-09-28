import "server-only";
import { db } from "@/lib/db";
import { dayRange } from "./ranges";
import { todayYmd } from "@/lib/time";

/** CMS "Сертификаты и оплаты": certificates, what is still owed on them, online payments. */
export async function getCertificatesPage() {
  const monthStart = new Date(`${todayYmd().slice(0, 7)}-01T00:00:00+05:00`);
  const [cards, outstanding, soldMonth, payments, pendingDeposits] = await Promise.all([
    db.giftCard.findMany({ where: { status: { not: "PENDING" } }, orderBy: { createdAt: "desc" }, take: 60, include: { redemptions: { include: { sale: { select: { number: true } } } } } }),
    db.giftCard.aggregate({ where: { status: "ACTIVE", expiresAt: { gt: new Date() } }, _sum: { balance: true }, _count: true }),
    db.payment.aggregate({ where: { purpose: "GIFT_CARD", status: "PAID", paidAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    db.payment.findMany({ where: { provider: { not: "pos" } }, orderBy: { createdAt: "desc" }, take: 40, include: { appointment: { select: { guestName: true } }, giftCard: { select: { code: true, token: true } } } }),
    db.payment.aggregate({ where: { purpose: "DEPOSIT", status: "PAID", paidAt: dayRange(todayYmd()) }, _sum: { amount: true } }),
  ]);
  return {
    stats: {
      activeCount: outstanding._count,
      outstanding: outstanding._sum.balance ?? 0,
      soldMonth: soldMonth._sum.amount ?? 0,
      soldMonthCount: soldMonth._count,
      depositsToday: pendingDeposits._sum.amount ?? 0,
    },
    cards: cards.map((c) => ({
      id: c.id,
      code: c.code,
      token: c.token,
      recipientName: c.recipientName,
      buyerName: c.buyerName,
      amount: c.amount,
      balance: c.balance,
      status: c.status === "ACTIVE" && c.expiresAt < new Date() ? "EXPIRED" : c.status,
      soldVia: c.soldVia,
      createdAt: c.createdAt,
      expiresAt: c.expiresAt,
      used: c.redemptions.map((r) => ({ amount: r.amount, receipt: r.sale.number, at: r.createdAt })),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      purpose: p.purpose,
      amount: p.amount,
      status: p.status,
      description: p.description,
      who: p.appointment?.guestName ?? null,
      gift: p.giftCard,
      createdAt: p.createdAt,
      paidAt: p.paidAt,
    })),
  };
}
