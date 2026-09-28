import "server-only";
import { db } from "@/lib/db";
import { atSalonTime, todayYmd, type Ymd } from "@/lib/time";
import { recentShifts } from "../shift";

// Everything that happened with money over a period [from, to): receipts, services, masters, payments, shifts.

const isYmd = (s: unknown): s is Ymd => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Period from the query string; defaults to the month so far. `to` is inclusive in the URL, exclusive here. */
export function periodFrom(sp: { from?: unknown; to?: unknown }) {
  const today = todayYmd();
  const from = isYmd(sp.from) ? sp.from : `${today.slice(0, 8)}01`;
  const toIncl = isYmd(sp.to) && sp.to >= from ? sp.to : today;
  const end = new Date(`${toIncl}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const to = end.toISOString().slice(0, 10);
  // Up to a year and a bit at once
  return Date.parse(to) - Date.parse(from) > 400 * 864e5 ? null : { from, to, toIncl };
}

export async function getPeriodReport(from: Ymd, to: Ymd) {
  const range = { gte: atSalonTime(from), lt: atSalonTime(to) };
  const [sales, payments, shifts] = await Promise.all([
    db.sale.findMany({
      where: { createdAt: range },
      orderBy: { createdAt: "asc" },
      include: { guest: { select: { name: true, phone: true } }, staff: { select: { name: true, commission: true } }, items: { select: { name: true, price: true, discount: true, serviceId: true, promotion: { select: { title: true, code: true } } } } },
    }),
    db.payment.findMany({ where: { status: "PAID", paidAt: range }, orderBy: { paidAt: "asc" }, }),
    recentShifts(from, to, 400),
  ]);

  const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
  const byMethod = (m: string) => sum(sales.filter((s) => s.method === m), (s) => s.paid);
  const tillGift = payments.filter((p) => p.purpose === "GIFT_CARD" && p.provider === "pos");
  const summary = {
    revenue: sum(sales, (s) => s.total),
    receipts: sales.length,
    average: sales.length ? Math.round(sum(sales, (s) => s.total) / sales.length) : 0,
    cash: byMethod("CASH"),
    card: byMethod("CARD"),
    qr: byMethod("QR"),
    deposits: sum(sales, (s) => s.depositAmount),
    gifts: sum(sales, (s) => s.giftCardAmount),
    bonus: sum(sales, (s) => s.bonusAmount),
    bonusEarned: sum(sales, (s) => s.bonusEarned),
    discounts: sum(sales, (s) => sum(s.items, (i) => i.discount)),
    giftCardsSold: sum(payments.filter((p) => p.purpose === "GIFT_CARD"), (p) => p.amount),
    giftCardsSoldTill: sum(tillGift, (p) => p.amount),
    onlinePrepayments: sum(payments.filter((p) => p.purpose === "DEPOSIT"), (p) => p.amount),
  };

  const services = new Map<string, { name: string; count: number; revenue: number; discounts: number }>();
  for (const s of sales)
    for (const i of s.items) {
      const k = i.serviceId ?? i.name;
      const row = services.get(k) ?? { name: i.name, count: 0, revenue: 0, discounts: 0 };
      row.count++;
      row.revenue += i.price;
      row.discounts += i.discount;
      services.set(k, row);
    }

  const masters = new Map<string, { name: string; receipts: number; services: number; revenue: number; commissionPct: number; commission: number }>();
  for (const s of sales) {
    const k = s.staffId ?? "";
    const row = masters.get(k) ?? { name: s.staff?.name ?? "Без мастера", receipts: 0, services: 0, revenue: 0, commissionPct: s.staff?.commission ?? 0, commission: 0 };
    row.receipts++;
    row.services += s.items.length;
    row.revenue += s.total;
    masters.set(k, row);
  }
  for (const m of masters.values()) m.commission = Math.round((m.revenue * m.commissionPct) / 100);

  const days = new Map<Ymd, { day: Ymd; receipts: number; revenue: number; cash: number; card: number; qr: number }>();
  for (const s of sales) {
    const day = todayYmd(s.createdAt);
    const row = days.get(day) ?? { day, receipts: 0, revenue: 0, cash: 0, card: 0, qr: 0 };
    row.receipts++;
    row.revenue += s.total;
    if (s.method === "CASH") row.cash += s.paid;
    if (s.method === "CARD") row.card += s.paid;
    if (s.method === "QR") row.qr += s.paid;
    days.set(day, row);
  }

  return {
    from,
    to,
    summary,
    receipts: sales.map((s) => ({
      number: s.number,
      at: s.createdAt,
      guest: s.guest?.name ?? "",
      phone: s.guest?.phone ?? "",
      master: s.staff?.name ?? "",
      services: s.items.map((i) => i.name).join(", "),
      promo: [...new Set(s.items.map((i) => (i.promotion ? i.promotion.code ?? i.promotion.title : "")).filter(Boolean))].join(", "),
      total: s.total,
      discount: sum(s.items, (i) => i.discount),
      deposit: s.depositAmount,
      gift: s.giftCardAmount,
      bonus: s.bonusAmount,
      paid: s.paid,
      method: s.method,
    })),
    services: [...services.values()].sort((a, b) => b.revenue - a.revenue),
    masters: [...masters.values()].sort((a, b) => b.revenue - a.revenue),
    days: [...days.values()],
    payments: payments.map((p) => ({
      at: p.paidAt!,
      purpose: p.purpose,
      description: p.description,
      provider: p.provider,
      method: p.method,
      amount: p.amount,
    })),
    shifts: shifts.slice().reverse(),
  };
}
export type PeriodReport = Awaited<ReturnType<typeof getPeriodReport>>;
