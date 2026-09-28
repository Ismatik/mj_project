// Minimal Telegram Bot API client (no SDK). Used by the webhook, the outbox worker and the integrations page.
// No "server-only" import: the worker (plain Node) uses this file too.
import type { BotReply } from "@/lib/bot/engine";

export const telegramConfigured = () => !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_WEBHOOK_SECRET;

type ApiResult<T> = { ok: true; result: T } | { ok: false; description?: string };

export async function tgCall<T = unknown>(method: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not set" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    return (await res.json()) as ApiResult<T>;
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "network error" };
  }
}

/** Converts an engine reply to Telegram's reply_markup. */
export function replyMarkup(r: BotReply): Record<string, unknown> | undefined {
  if (r.askContact) {
    return { keyboard: [[{ text: r.contactLabel ?? "📱 Поделиться номером", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };
  }
  // Telegram only opens https links from buttons
  if (r.buttons?.length) return { inline_keyboard: r.buttons.map((row) => row.map((b) => (b.url?.startsWith("https://") ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data }))) };
  if (r.removeKeyboard) return { remove_keyboard: true };
  return undefined;
}

export async function sendReply(chatId: string, r: BotReply) {
  return tgCall("sendMessage", { chat_id: chatId, text: r.text, reply_markup: replyMarkup(r), link_preview_options: { is_disabled: true } });
}

export async function sendText(chatId: string, text: string) {
  return tgCall("sendMessage", { chat_id: chatId, text, link_preview_options: { is_disabled: true } });
}

export async function answerCallback(id: string) {
  return tgCall("answerCallbackQuery", { callback_query_id: id });
}

export async function setWebhook(url: string) {
  return tgCall("setWebhook", {
    url,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

export async function getMe() {
  return tgCall<{ username: string; first_name: string }>("getMe", {});
}

/** Telegram update → engine input. Returns null for updates the bot ignores. */
export type TgUpdate = {
  message?: { chat: { id: number; type: string }; from?: { first_name?: string; username?: string; language_code?: string }; text?: string; contact?: { phone_number: string; user_id?: number } };
  callback_query?: { id: string; data?: string; from: { id: number; first_name?: string; username?: string; language_code?: string }; message?: { chat: { id: number; type: string } } };
};

export function toBotUpdate(u: TgUpdate) {
  if (u.callback_query?.message) {
    const q = u.callback_query;
    return {
      callbackId: q.id,
      update: { chatId: String(q.message!.chat.id), firstName: q.from.first_name, username: q.from.username, data: q.data, languageCode: q.from.language_code },
    };
  }
  const m = u.message;
  if (!m || m.chat.type !== "private") return null;
  // Only accept the sender's own contact, not a forwarded one
  const contact = m.contact && (!m.contact.user_id || String(m.contact.user_id) === String(m.chat.id)) ? m.contact.phone_number : undefined;
  return {
    callbackId: null,
    update: { chatId: String(m.chat.id), firstName: m.from?.first_name, username: m.from?.username, text: m.text, contactPhone: contact, languageCode: m.from?.language_code },
  };
}
