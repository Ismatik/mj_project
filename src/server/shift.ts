import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { clock } from "@/lib/format";
import { countCash, shiftTotals } from "@/lib/payroll";
import { addDays, todayYmd, type Ymd } from "@/lib/time";
import { dayRange } from "./ranges";

// End of day at the till: the day's money by method, cash put in / taken out, the cash count and the Z-report.

const dateOf = (ymd: Ymd) => new Date(`${ymd}T00:00:00Z`);
const ymdOf = (d: Date) => d.toISOString().slice(0, 10);

export type ShiftDetails = {
  deposits: number;
  gifts: number;
  bonus: number;
  discounts: number;
  giftSold: { cash: number; card: number; qr: number };
  online: { deposits: number; gifts: number };
  byMaster: { name: string; receipts: number; revenue: number }[];
  movements: { at: string; amount: number; note: string; by: string | null }[];
};

/** What the till did on a day, live (and what the shift recorded if it's closed). */
export async function getShiftDay(day: Ymd = todayYmd()) {
  // Up to now: a receipt can't be rung up in the future
  const full = dayRange(day);
  const range = { gte: full.gte, lt: new Date(Math.min(full.lt.getTime(), Date.now() + 1000)) };
  const [closed, previous, sales, items, giftPays, onlinePays, movements, staff] = await Promise.all([
    db.cashShift.findUnique({ where: { day: dateOf(day) } }),
    db.cashShift.findFirst({ where: { day: { lt: dateOf(day) } }, orderBy: { day: "desc" } }),
    db.sale.findMany({ where: { createdAt: range }, orderBy: { createdAt: "asc" }, include: { guest: { select: { name: true } }, staff: { select: { name: true } }, items: { select: { name: true } } } }),
    db.saleItem.aggregate({ where: { sale: { createdAt: range } }, _sum: { discount: true } }),
    db.payment.findMany({ where: { purpose: "GIFT_CARD", status: "PAID", provider: "pos", paidAt: range }, select: { amount: true, method: true } }),
    db.payment.findMany({ where: { status: "PAID", provider: { not: "pos" }, paidAt: range }, select: { amount: true, purpose: true } }),
    db.cashMovement.findMany({ where: { day: dateOf(day) }, orderBy: { createdAt: "asc" } }),
    db.staff.findMany({ select: { id: true, name: true } }),
  ]);

  const opening = previous?.leftCash ?? 0;
  const t = shiftTotals({
    opening,
    sales: sales.map((s) => ({ method: s.method, paid: s.paid })),
    giftSales: giftPays.map((g) => ({ method: g.method ?? "CASH", amount: g.amount })),
    movements: movements.map((m) => m.amount),
  });
  const masters = new Map<string, { name: string; receipts: number; revenue: number }>();
  const names = new Map(staff.map((s) => [s.id, s.name]));
  for (const s of sales) {
    const key = s.staffId ?? "";
    const m = masters.get(key) ?? { name: names.get(key) ?? "Без мастера", receipts: 0, revenue: 0 };
    m.receipts++;
    m.revenue += s.total;
    masters.set(key, m);
  }
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const giftBy = (m: string) => sum(giftPays.filter((g) => (g.method ?? "CASH") === m).map((g) => g.amount));
  const details: ShiftDetails = {
    deposits: sum(sales.map((s) => s.depositAmount)),
    gifts: sum(sales.map((s) => s.giftCardAmount)),
    bonus: sum(sales.map((s) => s.bonusAmount)),
    discounts: items._sum.discount ?? 0,
    giftSold: { cash: giftBy("CASH"), card: giftBy("CARD"), qr: giftBy("QR") },
    online: { deposits: sum(onlinePays.filter((p) => p.purpose === "DEPOSIT").map((p) => p.amount)), gifts: sum(onlinePays.filter((p) => p.purpose === "GIFT_CARD").map((p) => p.amount)) },
    byMaster: [...masters.values()].sort((a, b) => b.revenue - a.revenue),
    movements: movements.map((m) => ({ at: clock(m.createdAt), amount: m.amount, note: m.note, by: m.createdBy })),
  };
  const revenue = sum(sales.map((s) => s.total));
  // Receipts rung up after the shift was closed are not in its Z-report
  const late = closed ? sales.filter((s) => s.createdAt > closed.closedAt) : [];

  return {
    day,
    opening,
    closed,
    live: { ...t, receipts: sales.length, revenue, details },
    late: { count: late.length, total: sum(late.map((s) => s.total)) },
    receipts: sales.map((s) => ({
      id: s.id,
      number: s.number,
      at: clock(s.createdAt),
      guest: s.guest?.name ?? "-",
      master: s.staff?.name ?? "-",
      services: s.items.map((i) => i.name).join(", "),
      total: s.total,
      paid: s.paid,
      method: s.method,
    })),
    movements: movements.map((m) => ({ id: m.id, at: clock(m.createdAt), amount: m.amount, note: m.note, by: m.createdBy, payout: !!m.payoutId })),
  };
}
export type ShiftDay = Awaited<ReturnType<typeof getShiftDay>>;

export type CloseResult = { ok: true; id: string; difference: number } | { ok: false; error: string };

export async function closeShift(day: Ymd, input: { counted: number; handedOver: number; note?: string }, by: string): Promise<CloseResult> {
  if (day > todayYmd()) return { ok: false, error: "Этот день ещё не наступил" };
  const d = await getShiftDay(day);
  if (d.closed) return { ok: false, error: "Смена за этот день уже закрыта" };
  const count = countCash(d.live.expectedCash, input.counted, input.handedOver);
  if (!count.ok) return count;
  try {
    const row = await db.cashShift.create({
      data: {
        day: dateOf(day),
        openingCash: d.opening,
        cashSales: d.live.cashSales,
        cardSales: d.live.cardSales,
        qrSales: d.live.qrSales,
        cashIn: d.live.cashIn,
        cashOut: d.live.cashOut,
        expectedCash: d.live.expectedCash,
        countedCash: input.counted,
        difference: count.difference,
        handedOver: input.handedOver,
        leftCash: count.leftCash,
        receipts: d.live.receipts,
        revenue: d.live.revenue,
        details: d.live.details as unknown as Prisma.InputJsonValue,
        note: input.note?.trim().slice(0, 300) || null,
        closedBy: by,
      },
    });
    if (count.difference !== 0) {
      await db.outboxMessage.create({
        data: {
          channel: "telegram",
          to: "reception",
          body: `Смена ${day.split("-").reverse().join(".")} закрыта с ${count.difference > 0 ? "излишком" : "недостачей"} ${Math.abs(count.difference)} c. (закрыла ${by}).`,
          meta: { kind: "shift-difference", shiftId: row.id },
        },
      });
    }
    return { ok: true, id: row.id, difference: count.difference };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { ok: false, error: "Смена за этот день уже закрыта" };
    throw e;
  }
}

/** Is the till's day still open (cash can be taken out / put in)? */
export async function isDayOpen(day: Ymd = todayYmd()) {
  return !(await db.cashShift.findUnique({ where: { day: dateOf(day) }, select: { id: true } }));
}

export async function addMovement(amount: number, note: string, by: string, day: Ymd = todayYmd()) {
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000_000) return { ok: false as const, error: "Введите сумму" };
  if (!note.trim()) return { ok: false as const, error: "Укажите, за что" };
  if (!(await isDayOpen(day))) return { ok: false as const, error: "Смена уже закрыта" };
  await db.cashMovement.create({ data: { day: dateOf(day), amount, note: note.trim().slice(0, 200), createdBy: by } });
  return { ok: true as const };
}

export async function deleteMovement(id: string) {
  const m = await db.cashMovement.findUnique({ where: { id } });
  if (!m) return { ok: false as const, error: "Уже удалено" };
  if (m.payoutId) return { ok: false as const, error: "Выплату мастеру отменяют на странице зарплаты" };
  if (!(await isDayOpen(ymdOf(m.day)))) return { ok: false as const, error: "Смена уже закрыта" };
  await db.cashMovement.delete({ where: { id } });
  return { ok: true as const };
}

/** Closed shifts, newest first */
export async function recentShifts(from?: Ymd, to?: Ymd, take = 60) {
  const rows = await db.cashShift.findMany({
    where: from && to ? { day: { gte: dateOf(from), lt: dateOf(to) } } : undefined,
    orderBy: { day: "desc" },
    take,
  });
  return rows.map((r) => ({ ...r, ymd: ymdOf(r.day) }));
}

export async function getShift(id: string) {
  const r = await db.cashShift.findUnique({ where: { id } });
  return r ? { ...r, ymd: ymdOf(r.day), details: r.details as unknown as ShiftDetails } : null;
}

/** Yesterday's shift wasn't closed but had receipts (shown as a reminder at the till) */
export async function unclosedBefore(day: Ymd = todayYmd()) {
  for (let back = 1; back <= 7; back++) {
    const d = addDays(day, -back);
    const [shift, count] = await Promise.all([db.cashShift.findUnique({ where: { day: dateOf(d) } }), db.sale.count({ where: { createdAt: dayRange(d) } })]);
    if (shift) return null;
    if (count) return d;
  }
  return null;
}
