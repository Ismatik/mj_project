"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";

/** Owner only: switch a working weekday (0 = Monday) on or off. */
export async function toggleWorkDay(staffId: string, weekday: number): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") return { ok: false, error: "График меняет владелица" };
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: "Неверный день" };
  const m = await db.staff.findUnique({ where: { id: staffId } });
  if (!m) return { ok: false, error: "Мастер не найден" };
  const days = m.workDays.includes(weekday) ? m.workDays.filter((d) => d !== weekday) : [...m.workDays, weekday].sort();
  await db.staff.update({ where: { id: staffId }, data: { workDays: days } });
  revalidatePath("/cms/staff");
  return { ok: true };
}
