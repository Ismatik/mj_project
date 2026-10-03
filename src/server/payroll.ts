import "server-only";
import { db } from "@/lib/db";
import { clock, shortDate } from "@/lib/format";
import { monthSpan, payFor, type Month } from "@/lib/payroll";
import { atSalonTime, todayYmd } from "@/lib/time";
import { isDayOpen } from "./shift";

// Master pay for a month: commission on the services she did + fixed pay + bonuses − fines − what was already paid.

export async function getPayroll(month: Month, onlyStaffId?: string | null) {
  const { from, to } = monthSpan(month);
  const range = { gte: atSalonTime(from), lt: atSalonTime(to) };
  const staffWhere = onlyStaffId ? { id: onlyStaffId } : {};
  const [staff, sales, items, adjustments, payouts] = await Promise.all([
    db.staff.findMany({ where: { ...staffWhere, OR: [{ active: true }, { sales: { some: { createdAt: range } } }] }, orderBy: { sortOrder: "asc" } }),
    db.sale.groupBy({ by: ["staffId"], where: { createdAt: range, staffId: onlyStaffId ?? { not: null } }, _sum: { total: true }, _count: true }),
    db.saleItem.findMany({ where: { sale: { createdAt: range, staffId: onlyStaffId ?? { not: null } } }, select: { sale: { select: { staffId: true } } } }).then((rows) => {
      const out = new Map<string, number>(); // services done, per master
      for (const r of rows) out.set(r.sale.staffId!, (out.get(r.sale.staffId!) ?? 0) + 1);
      return out;
    }),
    db.staffAdjustment.findMany({ where: { month, ...(onlyStaffId ? { staffId: onlyStaffId } : {}) }, orderBy: { createdAt: "asc" } }),
    db.staffPayout.findMany({ where: { month, ...(onlyStaffId ? { staffId: onlyStaffId } : {}) }, orderBy: { paidAt: "asc" } }),
  ]);
  const bySale = new Map(sales.map((s) => [s.staffId, s]));

  const rows = staff.map((m) => {
    const s = bySale.get(m.id);
    const adj = adjustments.filter((a) => a.staffId === m.id);
    const pays = payouts.filter((p) => p.staffId === m.id);
    const revenue = s?._sum.total ?? 0;
    return {
      staff: { id: m.id, name: m.name, title: m.title, commission: m.commission, salary: m.salary },
      receipts: s?._count ?? 0,
      services: items.get(m.id) ?? 0,
      revenue,
      pay: payFor({ revenue, commission: m.commission, salary: m.salary, adjustments: adj.map((a) => a.amount), payouts: pays.map((p) => p.amount) }),
      adjustments: adj.map((a) => ({ id: a.id, amount: a.amount, note: a.note, by: a.createdBy, at: shortDate(a.createdAt) })),
      payouts: pays.map((p) => ({ id: p.id, amount: p.amount, method: p.method, note: p.note, by: p.paidBy, at: `${shortDate(p.paidAt)}, ${clock(p.paidAt)}` })),
    };
  });
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  return {
    month,
    rows,
    totals: {
      receipts: sum((r) => r.receipts),
      services: sum((r) => r.services),
      revenue: sum((r) => r.revenue),
      salary: sum((r) => r.staff.salary),
      commission: sum((r) => r.pay.commission),
      bonuses: sum((r) => r.pay.bonuses),
      fines: sum((r) => r.pay.fines),
      earned: sum((r) => r.pay.earned),
      paid: sum((r) => r.pay.paid),
      due: sum((r) => r.pay.due),
    },
  };
}
export type Payroll = Awaited<ReturnType<typeof getPayroll>>;

export async function setRate(staffId: string, commission: number, salary: number) {
  if (!Number.isInteger(commission) || commission < 0 || commission > 100) return { ok: false as const, error: "Процент - от 0 до 100" };
  if (!Number.isInteger(salary) || salary < 0 || salary > 1_000_000) return { ok: false as const, error: "Оклад - целое число сомони" };
  await db.staff.update({ where: { id: staffId }, data: { commission, salary } });
  return { ok: true as const };
}

export async function addAdjustment(staffId: string, month: Month, amount: number, note: string, by: string) {
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000) return { ok: false as const, error: "Введите сумму: +500 премия, −200 штраф" };
  if (!note.trim()) return { ok: false as const, error: "Укажите причину" };
  await db.staffAdjustment.create({ data: { staffId, month, amount, note: note.trim().slice(0, 200), createdBy: by } });
  return { ok: true as const };
}

export async function deleteAdjustment(id: string) {
  await db.staffAdjustment.deleteMany({ where: { id } });
  return { ok: true as const };
}

/** A payment to a master. Cash comes out of today's till (it shows in the shift), a card payment is a bank transfer. */
export async function addPayout(staffId: string, month: Month, amount: number, method: "CASH" | "CARD", note: string, by: string) {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) return { ok: false as const, error: "Введите сумму выплаты" };
  if (method !== "CASH" && method !== "CARD") return { ok: false as const, error: "Выберите способ" };
  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff) return { ok: false as const, error: "Мастер не найден" };
  const today = todayYmd();
  if (method === "CASH" && !(await isDayOpen(today))) return { ok: false as const, error: "Смена на сегодня закрыта - выдайте завтра или переводом" };
  const text = note.trim().slice(0, 200) || null;
  await db.$transaction(async (tx) => {
    const p = await tx.staffPayout.create({ data: { staffId, month, amount, method, note: text, paidBy: by } });
    if (method === "CASH") {
      await tx.cashMovement.create({
        data: { day: new Date(`${today}T00:00:00Z`), amount: -amount, note: `Зарплата: ${staff.name}${text ? ` (${text})` : ""}`, payoutId: p.id, createdBy: by },
      });
    }
  });
  return { ok: true as const };
}

export async function deletePayout(id: string) {
  const p = await db.staffPayout.findUnique({ where: { id }, include: { movement: true } });
  if (!p) return { ok: true as const };
  if (p.movement && !(await isDayOpen(p.movement.day.toISOString().slice(0, 10)))) return { ok: false as const, error: "Смена того дня закрыта - выплату уже посчитали в кассе" };
  await db.staffPayout.delete({ where: { id } }); // the till movement goes with it
  return { ok: true as const };
}
