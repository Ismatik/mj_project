"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { INTEGRATIONS } from "@/lib/integrations";
import { getCurrentUser } from "@/server/auth";
import { sweepOutbox } from "@/server/integrations/outbox";
import { queueReminders } from "@/server/integrations/reminders";
import { getMe, setWebhook, telegramConfigured } from "@/server/integrations/telegram-api";
import { rotateStaffCode } from "@/server/telegram/deps";

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
  if (mode === "LIVE") {
    if (!info.liveReady) return { ok: false, error: `Живое подключение ${info.title} появится в ${info.liveIn}. Пока работает мок.` };
    if (!info.envKeys.every((k) => !!process.env[k])) return { ok: false, error: `Сначала добавьте ${info.envKeys.join(" и ")} в .env на сервере.` };
  }
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

export async function runRemindersNow(): Promise<number> {
  await requireOwner();
  const n = await queueReminders(db);
  revalidatePath("/cms/integrations");
  return n;
}

export async function newStaffCode(): Promise<string> {
  await requireOwner();
  const code = await rotateStaffCode();
  revalidatePath("/cms/integrations");
  return code;
}

/** Points Telegram at this server's webhook. Needs the token, the secret and a public HTTPS domain. */
export async function connectTelegramWebhook(): Promise<{ ok: boolean; message: string }> {
  await requireOwner();
  if (!telegramConfigured()) return { ok: false, message: "Добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET в .env и перезапустите сервер." };
  const domain = (process.env.SITE_DOMAIN ?? "").replace(/^https?:\/\//, "");
  if (!domain || domain.startsWith("localhost")) return { ok: false, message: "Нужен публичный домен с HTTPS (SITE_DOMAIN в .env)." };
  const me = await getMe();
  if (!me.ok) return { ok: false, message: `Telegram не принял токен: ${me.description ?? "ошибка"}` };
  const res = await setWebhook(`https://${domain}/api/telegram/webhook`);
  return res.ok ? { ok: true, message: `Бот @${me.result.username} подключён к https://${domain}` } : { ok: false, message: res.description ?? "Ошибка Telegram" };
}
