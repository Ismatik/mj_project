// Messaging connectors. Every channel has a mock driver (records the message as sent) and a live driver.
// Live drivers are added per release: Telegram (R2 Sprint 1), WhatsApp later in R2, SMS when a gateway contract exists.
import { sendText, telegramConfigured } from "./telegram-api";

export type ChannelKey = "telegram" | "whatsapp" | "sms";
export type DeliveryResult = { ok: true } | { ok: false; error: string };

export interface MessageChannel {
  send(to: string, body: string): Promise<DeliveryResult>;
}

/** Mock mode: nothing leaves the server; the message stays visible in the CMS outbox as "sent". */
export const mockChannel: MessageChannel = {
  async send() {
    return { ok: true };
  },
};


const liveChannels: Partial<Record<ChannelKey, MessageChannel>> = {
  telegram: {
    async send(to, body) {
      if (!telegramConfigured()) return { ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET are not set" };
      const res = await sendText(to, body);
      return res.ok ? { ok: true } : { ok: false, error: res.description ?? "Telegram error" };
    },
  },
};

export function channelFor(key: ChannelKey, mode: "MOCK" | "LIVE"): MessageChannel {
  if (mode === "MOCK") return mockChannel;
  const live = liveChannels[key];
  if (live) return live;
  return {
    async send() {
      return { ok: false, error: `Live driver for ${key} is not connected yet` };
    },
  };
}
