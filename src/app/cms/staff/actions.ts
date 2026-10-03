"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";
import { getMasterCode, rotateMasterCode, unlinkMaster } from "@/server/telegram/deps";

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

/** Owner only: her personal "/master CODE" for the bot. Made on first ask, then kept. */
export async function masterBotCode(staffId: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") return { ok: false, error: "Код выдаёт владелица" };
  return { ok: true, code: await getMasterCode(staffId) };
}

/** Owner only: a new code. The old one stops working and every chat on it is unlinked. */
export async function newMasterBotCode(staffId: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") return { ok: false, error: "Код выдаёт владелица" };
  const code = await rotateMasterCode(staffId);
  revalidatePath("/cms/staff");
  return { ok: true, code };
}

/** Owner only: stop sending her bookings to Telegram. Her code keeps working if she links again. */
export async function unlinkMasterBot(staffId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") return { ok: false, error: "Это меняет владелица" };
  await unlinkMaster(staffId);
  revalidatePath("/cms/staff");
  return { ok: true };
}
