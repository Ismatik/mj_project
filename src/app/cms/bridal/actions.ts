"use server";

import { revalidatePath } from "next/cache";
import { canOpen } from "@/lib/access";
import { getCurrentUser } from "@/server/auth";
import { saveBridalRules, setBridalStatus } from "@/server/bridal";

export async function packageStatus(id: string, status: "CONFIRMED" | "DONE" | "CANCELLED") {
  const user = await getCurrentUser();
  if (!user || !canOpen(user.role, "bridal")) return { ok: false as const, error: "Нет доступа" };
  if (!["CONFIRMED", "DONE", "CANCELLED"].includes(status)) return { ok: false as const, error: "Неизвестный статус" };
  const res = await setBridalStatus(String(id), status);
  if (res.ok) revalidatePath("/cms", "layout");
  return res;
}

export async function bridalRules(input: { discountPercent: number; minServices: number; dressDays: number; trialServiceId: string | null }) {
  const user = await getCurrentUser();
  if (user?.role !== "OWNER") return { ok: false as const, error: "Только для владелицы" };
  const res = await saveBridalRules({ ...input, trialServiceId: input.trialServiceId ? String(input.trialServiceId) : null });
  revalidatePath("/cms/bridal");
  revalidatePath("/svadba");
  return res;
}
