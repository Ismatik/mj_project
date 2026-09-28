// Guest sign-in by a one-time code: which channel carries it and the limits around it.

export const CODE_TTL_MIN = 10;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_RESEND_SECONDS = 60;
/** Codes one phone may request per hour */
export const CODES_PER_HOUR = 4;

export type CodeChannel = "telegram" | "whatsapp" | "sms";
type Mode = "MOCK" | "LIVE" | null; // null = switched off

/**
 * Telegram when the guest has chatted with the bot (free and instant), otherwise WhatsApp, otherwise SMS.
 * Simulator chats ("sim-…") only count while Telegram is in mock mode — a live bot can't reach them.
 */
export function pickCodeChannel(chatIds: string[], modes: Record<CodeChannel, Mode>): { channel: CodeChannel; to?: string } | null {
  if (modes.telegram) {
    const chat = chatIds.find((id) => !id.startsWith("sim-")) ?? (modes.telegram === "MOCK" ? chatIds[0] : undefined);
    if (chat) return { channel: "telegram", to: chat };
  }
  if (modes.whatsapp) return { channel: "whatsapp" };
  if (modes.sms) return { channel: "sms" };
  return null;
}
