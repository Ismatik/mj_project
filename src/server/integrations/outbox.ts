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
    const result = await channelFor(msg.channel as ChannelKey, mode).send(msg.to, msg.body);
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
