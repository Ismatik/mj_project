"use server";

import { revalidatePath } from "next/cache";
import { isMonth } from "@/lib/payroll";
import { getCurrentUser } from "@/server/auth";
import { addAdjustment, addPayout, deleteAdjustment, deletePayout, setRate } from "@/server/payroll";

async function ownerOnly() {
  const user = await getCurrentUser();
  return user?.role === "OWNER" ? user : null;
}
const done = <T extends { ok: boolean }>(res: T) => {
  if (res.ok) revalidatePath("/cms", "layout");
  return res;
};
const NO = { ok: false as const, error: "Только для владелицы" };

export async function saveRate(staffId: string, commission: number, salary: number) {
  if (!(await ownerOnly())) return NO;
  return done(await setRate(String(staffId), Math.round(Number(commission)), Math.round(Number(salary))));
}

export async function saveAdjustment(staffId: string, month: string, amount: number, note: string) {
  const user = await ownerOnly();
  if (!user) return NO;
  if (!isMonth(month)) return { ok: false as const, error: "Неверный месяц" };
  return done(await addAdjustment(String(staffId), month, Math.round(Number(amount)), String(note ?? ""), user.name));
}

export async function removeAdjustment(id: string) {
  if (!(await ownerOnly())) return NO;
  return done(await deleteAdjustment(String(id)));
}

export async function savePayout(staffId: string, month: string, amount: number, method: "CASH" | "CARD", note: string) {
  const user = await ownerOnly();
  if (!user) return NO;
  if (!isMonth(month)) return { ok: false as const, error: "Неверный месяц" };
  return done(await addPayout(String(staffId), month, Math.round(Number(amount)), method, String(note ?? ""), user.name));
}

export async function removePayout(id: string) {
  if (!(await ownerOnly())) return NO;
  return done(await deletePayout(String(id)));
}
