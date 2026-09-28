// Master pay and the till's end of day: pure calculations (the CMS pages, reports and tests use them).
import { addDays, type Ymd } from "./time";

// ─── Months ──────────────────────────────────────────────

export type Month = string; // "YYYY-MM"

export const monthOf = (ymd: Ymd): Month => ymd.slice(0, 7);
export const isMonth = (s: unknown): s is Month => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** First day of the month and the first day of the next one */
export function monthSpan(month: Month): { from: Ymd; to: Ymd } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

export function shiftMonth(month: Month, by: number): Month {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
/** "Сентябрь 2026" */
export const monthTitle = (month: Month) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** Every day of [from, to) */
export function daysBetween(from: Ymd, to: Ymd): Ymd[] {
  const out: Ymd[] = [];
  for (let d = from; d < to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

// ─── Payroll ─────────────────────────────────────────────

export type PayInput = {
  /** Value of the services she did (after promotion discounts) */
  revenue: number;
  /** Percent of the revenue */
  commission: number;
  /** Fixed monthly pay */
  salary: number;
  /** Bonuses (+) and fines (−) */
  adjustments: number[];
  /** Already paid for the month (advances and payments) */
  payouts: number[];
};

export function payFor(p: PayInput) {
  const commission = Math.round((Math.max(0, p.revenue) * Math.min(100, Math.max(0, p.commission))) / 100);
  const bonuses = p.adjustments.filter((a) => a > 0).reduce((s, a) => s + a, 0);
  const fines = p.adjustments.filter((a) => a < 0).reduce((s, a) => s - a, 0);
  const earned = Math.max(0, p.salary) + commission + bonuses - fines;
  const paid = p.payouts.reduce((s, a) => s + a, 0);
  return { commission, bonuses, fines, earned, paid, due: earned - paid };
}
export type Pay = ReturnType<typeof payFor>;

// ─── End of day ──────────────────────────────────────────

type Method = "CASH" | "CARD" | "QR";
export type ShiftInput = {
  /** Left in the drawer by the previous shift */
  opening: number;
  /** Receipts of the day: money paid now, by method */
  sales: { method: Method; paid: number }[];
  /** Gift certificates sold at the till that day */
  giftSales: { method: Method; amount: number }[];
  /** Cash put in (+) or taken out (−), salary payouts from the till included */
  movements: number[];
};

export function shiftTotals(s: ShiftInput) {
  const by = { CASH: 0, CARD: 0, QR: 0 } as Record<Method, number>;
  for (const x of s.sales) by[x.method] += x.paid;
  for (const g of s.giftSales) by[g.method] += g.amount;
  const cashIn = s.movements.filter((m) => m > 0).reduce((a, m) => a + m, 0);
  const cashOut = s.movements.filter((m) => m < 0).reduce((a, m) => a - m, 0);
  return { cashSales: by.CASH, cardSales: by.CARD, qrSales: by.QR, cashIn, cashOut, expectedCash: s.opening + by.CASH + cashIn - cashOut };
}

/** The cash count at closing: how far it is from the expected cash, and what stays for tomorrow. */
export function countCash(expected: number, counted: number, handedOver: number): { ok: true; difference: number; leftCash: number } | { ok: false; error: string } {
  if (!Number.isInteger(counted) || counted < 0) return { ok: false, error: "Введите, сколько наличных в кассе" };
  if (!Number.isInteger(handedOver) || handedOver < 0) return { ok: false, error: "Сумма к сдаче не может быть отрицательной" };
  if (handedOver > counted) return { ok: false, error: "Нельзя сдать больше, чем есть в кассе" };
  return { ok: true, difference: counted - expected, leftCash: counted - handedOver };
}
