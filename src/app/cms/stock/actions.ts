"use server";

import { revalidatePath } from "next/cache";
import { canOpen } from "@/lib/access";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";
import { saveItem, saveNorms, stockAction, type ItemInput } from "@/server/stock";

async function staff() {
  const user = await getCurrentUser();
  return user && canOpen(user.role, "stock") ? user : null;
}
const NO = { ok: false as const, error: "Нет доступа" };
const num = (v: unknown) => Math.round(Number(v));

export async function doStock(itemId: string, action: "RECEIPT" | "WASTE" | "COUNT", amount: number, note: string) {
  const user = await staff();
  if (!user) return NO;
  if (!["RECEIPT", "WASTE", "COUNT"].includes(action)) return { ok: false as const, error: "Неизвестное действие" };
  const res = await stockAction(db, String(itemId), action, num(amount), String(note ?? ""), user.name);
  if (res.ok) revalidatePath("/cms", "layout");
  return res;
}

export async function saveStockItem(input: ItemInput) {
  const user = await staff();
  if (!user) return NO;
  const res = await saveItem(
    db,
    {
      id: input.id ? String(input.id) : undefined,
      name: String(input.name ?? ""),
      unit: String(input.unit ?? ""),
      category: String(input.category ?? ""),
      minQuantity: num(input.minQuantity),
      packSize: num(input.packSize),
      packPrice: num(input.packPrice),
      supplier: String(input.supplier ?? ""),
      quantity: num(input.quantity ?? 0),
      active: input.active !== false,
    },
    user.name,
  );
  if (res.ok) revalidatePath("/cms", "layout");
  return res;
}

export async function saveServiceNorms(serviceId: string, norms: { itemId: string; amount: number }[]) {
  const user = await staff();
  if (!user) return NO;
  const res = await saveNorms(db, String(serviceId), (norms ?? []).slice(0, 30).map((n) => ({ itemId: String(n.itemId), amount: num(n.amount) })));
  if (res.ok) revalidatePath("/cms/stock");
  return res;
}
