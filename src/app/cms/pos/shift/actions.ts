"use server";

import { revalidatePath } from "next/cache";
import { canOpen } from "@/lib/access";
import { todayYmd } from "@/lib/time";
import { getCurrentUser } from "@/server/auth";
import { addMovement, closeShift, deleteMovement } from "@/server/shift";

async function tillUser() {
  const user = await getCurrentUser();
  return user && canOpen(user.role, "pos") ? user : null;
}

/** Cash put into (+) or taken out of (−) the till today */
export async function saveMovement(amount: number, note: string) {
  const user = await tillUser();
  if (!user) return { ok: false as const, error: "Нет доступа к кассе" };
  const res = await addMovement(Math.round(Number(amount)), String(note ?? ""), user.name);
  if (res.ok) revalidatePath("/cms/pos/shift");
  return res;
}

export async function removeMovement(id: string) {
  const user = await tillUser();
  if (!user) return { ok: false as const, error: "Нет доступа к кассе" };
  const res = await deleteMovement(String(id));
  if (res.ok) revalidatePath("/cms/pos/shift");
  return res;
}

export async function closeDay(day: string, counted: number, handedOver: number, note: string) {
  const user = await tillUser();
  if (!user) return { ok: false as const, error: "Нет доступа к кассе" };
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(day)) ? String(day) : todayYmd();
  const res = await closeShift(d, { counted: Math.round(Number(counted)), handedOver: Math.round(Number(handedOver)), note: String(note ?? "") }, user.name);
  if (res.ok) revalidatePath("/cms", "layout");
  return res;
}
