// Stock and consumables: deliveries, write-offs per paid service, waste, stocktakes, low-stock alerts.
// No "server-only" import: it runs inside the till's payment transaction and may be used by the worker.
import type { Prisma, PrismaClient, StockMoveKind } from "@/generated/prisma/client";
import { consumptionFor, crossedLow, qty, stockStatus, stockValue } from "../lib/stock";

type Db = PrismaClient | Prisma.TransactionClient;

async function move(db: Db, itemId: string, delta: number, kind: StockMoveKind, o: { saleId?: string; note?: string | null; by?: string | null; setTo?: number }) {
  const before = await db.stockItem.findUniqueOrThrow({ where: { id: itemId } });
  const item = await db.stockItem.update({
    where: { id: itemId },
    data: o.setTo !== undefined ? { quantity: o.setTo } : { quantity: { increment: delta } },
  });
  const real = item.quantity - before.quantity;
  await db.stockMove.create({ data: { itemId, delta: real, balance: item.quantity, kind, saleId: o.saleId, note: o.note ?? null, createdBy: o.by ?? null } });
  if (crossedLow(before.quantity, item.quantity, item.minQuantity)) {
    await db.outboxMessage.create({
      data: {
        channel: "telegram",
        to: "reception",
        body: `Заканчивается на складе: ${item.name} — осталось ${qty(item.quantity, item.unit)} (минимум ${qty(item.minQuantity, item.unit)}). Пора заказать${item.supplier ? ` у «${item.supplier}»` : ""}.`,
        meta: { kind: "stock-low", itemId },
      },
    });
  }
  return item;
}

/** The till: consumables of the services in a paid receipt are written off. */
export async function writeOffForSale(db: Db, saleId: string, serviceIds: (string | null)[], by?: string | null) {
  const ids = [...new Set(serviceIds.filter(Boolean) as string[])];
  if (!ids.length) return 0;
  const norms = await db.serviceConsumption.findMany({ where: { serviceId: { in: ids }, item: { active: true } } });
  const used = consumptionFor(serviceIds, norms);
  for (const [itemId, amount] of used) await move(db, itemId, -amount, "SERVICE", { saleId, by });
  return used.size;
}

type Fail = { ok: false; error: string };
const whole = (n: number) => Number.isInteger(n) && Math.abs(n) <= 100_000_000;

/** Delivery (+), waste (−) or stocktake (set to the counted quantity) */
export async function stockAction(db: Db, itemId: string, action: "RECEIPT" | "WASTE" | "COUNT", amount: number, note: string, by: string): Promise<{ ok: true; quantity: number } | Fail> {
  if (!whole(amount) || amount < 0 || (action !== "COUNT" && amount === 0)) return { ok: false, error: "Введите количество" };
  if (action === "WASTE" && !note.trim()) return { ok: false, error: "Укажите причину списания" };
  const item = await db.stockItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "Позиция не найдена" };
  const text = note.trim().slice(0, 200) || null;
  const res =
    action === "RECEIPT"
      ? await move(db, itemId, amount, "RECEIPT", { note: text, by })
      : action === "WASTE"
        ? await move(db, itemId, -amount, "WASTE", { note: text, by })
        : await move(db, itemId, 0, "COUNT", { note: text ?? `Пересчёт: было ${qty(item.quantity, item.unit)}`, by, setTo: amount });
  return { ok: true, quantity: res.quantity };
}

export type ItemInput = { id?: string; name: string; unit: string; category: string; minQuantity: number; packSize: number; packPrice: number; supplier: string; quantity?: number; active?: boolean };

export async function saveItem(db: Db, input: ItemInput, by: string): Promise<{ ok: true; id: string } | Fail> {
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) return { ok: false, error: "Название позиции" };
  if (!["мл", "г", "шт"].includes(input.unit)) return { ok: false, error: "Единица: мл, г или шт" };
  if (![input.minQuantity, input.packSize, input.packPrice].every((n) => whole(n) && n >= 0) || input.packSize < 1) return { ok: false, error: "Проверьте числа: упаковка от 1, цена и минимум — не меньше 0" };
  const data = {
    name,
    unit: input.unit,
    category: input.category.trim().slice(0, 40) || "Расходники",
    minQuantity: input.minQuantity,
    packSize: input.packSize,
    packPrice: input.packPrice,
    supplier: input.supplier.trim().slice(0, 80) || null,
    active: input.active ?? true,
  };
  if (input.id) {
    await db.stockItem.update({ where: { id: input.id }, data });
    return { ok: true, id: input.id };
  }
  const start = Math.max(0, Math.round(input.quantity ?? 0));
  const item = await db.stockItem.create({ data: { ...data, quantity: 0 } });
  if (start) await move(db, item.id, start, "RECEIPT", { note: "Начальный остаток", by });
  return { ok: true, id: item.id };
}

/** Replaces the consumables written off for one service */
export async function saveNorms(db: Db, serviceId: string, norms: { itemId: string; amount: number }[]): Promise<{ ok: true } | Fail> {
  const clean = norms.filter((n) => n.itemId && whole(n.amount) && n.amount > 0);
  if (new Set(clean.map((n) => n.itemId)).size !== clean.length) return { ok: false, error: "Одна позиция указана дважды" };
  await db.serviceConsumption.deleteMany({ where: { serviceId } });
  if (clean.length) await db.serviceConsumption.createMany({ data: clean.map((n) => ({ serviceId, itemId: n.itemId, amount: n.amount })) });
  return { ok: true };
}

// ─── Stock page ──────────────────────────────────────────

export async function getStockPage(db: PrismaClient) {
  const [items, services, moves] = await Promise.all([
    db.stockItem.findMany({ orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }], include: { consumption: { include: { service: { select: { name: true } } } } } }),
    db.service.findMany({ where: { active: true }, orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }], include: { consumption: true } }),
    db.stockMove.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { item: { select: { name: true, unit: true } }, sale: { select: { number: true } } } }),
  ]);
  const rows = items.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    category: i.category,
    quantity: i.quantity,
    minQuantity: i.minQuantity,
    packSize: i.packSize,
    packPrice: i.packPrice,
    supplier: i.supplier ?? "",
    active: i.active,
    status: stockStatus(i.quantity, i.minQuantity),
    value: stockValue(i.quantity, i.packSize, i.packPrice),
    usedBy: i.consumption.map((c) => `${c.service.name} — ${c.amount} ${i.unit}`),
  }));
  const active = rows.filter((r) => r.active);
  return {
    stats: { items: active.length, low: active.filter((r) => r.status !== "ok").length, value: active.reduce((a, r) => a + r.value, 0) },
    items: rows,
    services: services.map((s) => ({ id: s.id, name: s.name, norms: s.consumption.map((c) => ({ itemId: c.itemId, amount: c.amount })) })),
    moves: moves.map((m) => ({ id: m.id, at: m.createdAt, item: m.item.name, unit: m.item.unit, delta: m.delta, balance: m.balance, kind: m.kind, note: m.note, by: m.createdBy, receipt: m.sale?.number ?? null })),
  };
}
export type StockPage = Awaited<ReturnType<typeof getStockPage>>;

/** Items below their minimum (sidebar badge) */
export async function lowStockCount(db: PrismaClient) {
  const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "StockItem" WHERE active AND (quantity <= 0 OR (quantity < "minQuantity"))`;
  return Number(rows[0]?.n ?? 0);
}
