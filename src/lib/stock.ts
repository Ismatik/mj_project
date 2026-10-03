// Stock: quantities are whole units (ml, g, pcs). Pure helpers shared by the till, the stock page and reports.

export const UNITS = ["мл", "г", "шт"] as const;
export type StockStatus = "out" | "low" | "ok";

export function stockStatus(quantity: number, min: number): StockStatus {
  if (quantity <= 0) return "out";
  return min > 0 && quantity < min ? "low" : "ok";
}

/** Did this change take it below the minimum (so reception should hear about it once)? */
export const crossedLow = (before: number, after: number, min: number) => min > 0 && before >= min && after < min;

/** Value of `quantity` units at the package price, whole somoni */
export const stockValue = (quantity: number, packSize: number, packPrice: number) => (packSize > 0 ? Math.round((Math.max(0, quantity) * packPrice) / packSize) : 0);

/** Units used by a receipt: every service line × its norms, per item */
export function consumptionFor(serviceIds: (string | null | undefined)[], norms: { serviceId: string; itemId: string; amount: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of serviceIds) {
    if (!id) continue;
    for (const n of norms) if (n.serviceId === id && n.amount > 0) out.set(n.itemId, (out.get(n.itemId) ?? 0) + n.amount);
  }
  return out;
}

const group = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
/** "1 250 мл" */
export const qty = (n: number, unit: string) => `${group.format(n)} ${unit}`;

/** "3 уп. + 120 мл" - how it looks on the shelf */
export function inPacks(quantity: number, packSize: number, unit: string): string {
  if (packSize <= 1 || quantity <= 0) return qty(quantity, unit);
  const packs = Math.floor(quantity / packSize);
  const rest = quantity % packSize;
  return packs ? `${packs} уп.${rest ? ` + ${qty(rest, unit)}` : ""}` : qty(rest, unit);
}
