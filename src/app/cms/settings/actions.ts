"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { SETTING_KEYS } from "@/lib/settings-keys";
import { getCurrentUser } from "@/server/auth";

type Result = { ok: true } | { ok: false; error: string };

async function requireOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") throw new Error("Только для владелицы");
  return user;
}

export async function saveSettings(values: Record<string, string>): Promise<Result> {
  await requireOwner();
  for (const key of SETTING_KEYS) {
    const value = String(values[key] ?? "").trim().slice(0, 200);
    if (!value) return { ok: false, error: "Заполните все поля" };
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  revalidatePath("/cms", "layout");
  return { ok: true };
}

/** Any signed-in user may change their own password. */
export async function changeOwnPassword(current: string, next: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Войдите заново" };
  if (String(next).length < 8) return { ok: false, error: "Новый пароль - минимум 8 символов" };
  const row = await db.user.findUnique({ where: { id: user.id } });
  if (!row || !(await verifyPassword(String(current), row.passwordHash))) return { ok: false, error: "Текущий пароль неверный" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: true };
}

export async function resetUserPassword(userId: string, next: string): Promise<Result> {
  const owner = await requireOwner();
  if (userId === owner.id) return { ok: false, error: "Свой пароль меняйте в блоке выше" };
  if (String(next).length < 8) return { ok: false, error: "Пароль - минимум 8 символов" };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await db.session.deleteMany({ where: { userId } });
  return { ok: true };
}

export async function setUserActive(userId: string, active: boolean): Promise<Result> {
  const owner = await requireOwner();
  if (userId === owner.id) return { ok: false, error: "Нельзя отключить себя" };
  await db.user.update({ where: { id: userId }, data: { active } });
  if (!active) await db.session.deleteMany({ where: { userId } });
  revalidatePath("/cms/settings");
  return { ok: true };
}
