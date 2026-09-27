// Outbox delivery shared by the background worker and the CMS "Доставить сейчас" button.
// No "server-only" import: the worker (plain Node) uses this file too.
import type { PrismaClient } from "@/generated/prisma/client";
import { channelFor, type ChannelKey } from "./channels";

/** Sends queued messages through their channel (mock or live, per the Integration table). Returns how many were processed. */
export async function sweepOutbox(db: PrismaClient, limit = 50): Promise<number> {
  const [queued, integrations] = await Promise.all([
    db.outboxMessage.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: limit }),
    db.integration.findMany(),
  ]);
  const modeOf = new Map(integrations.map((i) => [i.key, i.enabled ? i.mode : null]));
  let processed = 0;
  for (const msg of queued) {
    const mode = modeOf.get(msg.channel);
    if (!mode) continue; // channel switched off — stays queued
    const channel = channelFor(msg.channel as ChannelKey, mode);
    let result: { ok: true } | { ok: false; error: string };
    if (mode === "LIVE" && msg.channel === "telegram" && msg.to === "reception") {
      // Reception alerts go to every chat linked with "/staff CODE"
      const staff = await db.telegramChat.findMany({ where: { isStaff: true, NOT: { id: { startsWith: "sim-" } } }, select: { id: true } });
      if (!staff.length) result = { ok: false, error: "Нет чата ресепшена: отправьте боту /staff КОД из CMS → Интеграции" };
      else {
        const all = await Promise.all(staff.map((c) => channel.send(c.id, msg.body)));
        result = all.find((r) => !r.ok) ?? { ok: true };
      }
    } else if (mode === "LIVE" && msg.channel === "telegram" && msg.to.startsWith("sim-")) {
      result = { ok: true }; // simulator chats never leave the server
    } else {
      result = await channel.send(msg.to, msg.body);
    }
    await db.outboxMessage.update({
      where: { id: msg.id },
      data: result.ok
        ? { status: "SENT", sentAt: new Date(), mock: mode === "MOCK", error: null }
        : { status: "FAILED", error: result.error, mock: mode === "MOCK" },
    });
    processed++;
  }
  return processed;
}
