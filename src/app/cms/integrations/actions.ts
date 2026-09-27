"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { INTEGRATIONS } from "@/lib/integrations";
import { getCurrentUser } from "@/server/auth";
import { sweepOutbox } from "@/server/integrations/outbox";

async function requireOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") throw new Error("Только для владелицы");
}

const known = (key: string) => INTEGRATIONS.some((i) => i.key === key);

export async function setIntegrationEnabled(key: string, enabled: boolean) {
  await requireOwner();
  if (!known(key)) throw new Error("Неизвестная интеграция");
  await db.integration.upsert({ where: { key }, update: { enabled }, create: { key, enabled } });
  revalidatePath("/cms/integrations");
}

/** Live mode needs the API key in the server environment and a live driver (added per release). */
export async function setIntegrationMode(key: string, mode: "MOCK" | "LIVE"): Promise<{ ok: boolean; error?: string }> {
  await requireOwner();
  const info = INTEGRATIONS.find((i) => i.key === key);
  if (!info) return { ok: false, error: "Неизвестная интеграция" };
  if (mode === "LIVE") return { ok: false, error: `Живое подключение ${info.title} появится в ${info.liveIn}. Пока работает мок.` };
  await db.integration.upsert({ where: { key }, update: { mode }, create: { key, mode } });
  revalidatePath("/cms/integrations");
  return { ok: true };
}

export async function sendTestMessage(channel: "telegram" | "whatsapp" | "sms") {
  await requireOwner();
  if (!["telegram", "whatsapp", "sms"].includes(channel)) throw new Error("Неизвестный канал");
  await db.outboxMessage.create({
    data: { channel, to: channel === "telegram" ? "reception" : "+992981031111", body: "Тестовое сообщение из CMS Mavzunai Jovid ✦", meta: { kind: "test" } },
  });
  revalidatePath("/cms/integrations");
}

export async function deliverNow(): Promise<number> {
  await requireOwner();
  const n = await sweepOutbox(db);
  revalidatePath("/cms/integrations");
  return n;
}
