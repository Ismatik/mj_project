"use server";

import { revalidatePath } from "next/cache";
import { canOpen } from "@/lib/access";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";

async function requireDashboard() {
  const user = await getCurrentUser();
  if (!user || !canOpen(user.role, "dashboard")) throw new Error("Нет доступа");
  return user;
}

export async function toggleReminder(id: string, done: boolean) {
  await requireDashboard();
  await db.reminder.update({ where: { id }, data: { done } });
  revalidatePath("/cms");
}

export async function addReminder(text: string) {
  await requireDashboard();
  const clean = text.trim().slice(0, 200);
  if (clean.length < 2) return;
  await db.reminder.create({ data: { text: clean } });
  revalidatePath("/cms");
}

export async function deleteDoneReminders() {
  await requireDashboard();
  await db.reminder.deleteMany({ where: { done: true } });
  revalidatePath("/cms");
}
