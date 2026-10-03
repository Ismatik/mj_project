// Outbox delivery shared by the background worker and the CMS "Доставить сейчас" button.
// No "server-only" import: the worker (plain Node) uses this file too.
import type { OutboxMessage, PrismaClient } from "@/generated/prisma/client";
import { channelFor, type ChannelKey, type DeliveryResult, type OutgoingMeta } from "./channels";
import { linkedChats, staffIdFromAddress } from "./master-alerts";

type Modes = Map<string, "MOCK" | "LIVE" | null>;

async function modes(db: PrismaClient): Promise<Modes> {
  const integrations = await db.integration.findMany();
  return new Map(integrations.map((i) => [i.key, i.enabled ? i.mode : null]));
}

/** Sends one message through its channel and records the result. Returns false when the channel is switched off. */
async function deliver(db: PrismaClient, msg: OutboxMessage, modeOf: Modes): Promise<boolean> {
  const mode = modeOf.get(msg.channel);
  if (!mode) return false; // channel switched off — stays queued
  const channel = channelFor(msg.channel as ChannelKey, mode);
  let result: DeliveryResult;
  if (mode === "LIVE" && msg.channel === "telegram" && msg.to === "reception") {
    // Reception alerts go to every chat linked with "/staff CODE"
    const staff = await db.telegramChat.findMany({ where: { isStaff: true, NOT: { id: { startsWith: "sim-" } } }, select: { id: true } });
    if (!staff.length) result = { ok: false, error: "Нет чата ресепшена: отправьте боту /staff КОД из CMS → Интеграции" };
    else {
      const all = await Promise.all(staff.map((c) => channel.send(c.id, msg.body)));
      result = all.find((r) => !r.ok) ?? { ok: true };
    }
  } else if (mode === "LIVE" && msg.channel === "telegram" && staffIdFromAddress(msg.to)) {
    // One master's own alerts, to every chat she linked with "/master CODE"
    const chats = await linkedChats(db, staffIdFromAddress(msg.to)!);
    if (!chats.length) result = { ok: false, error: "Мастер отвязала свой чат: код можно выдать заново в CMS → Мастера" };
    else {
      const all = await Promise.all(chats.map((c) => channel.send(c.id, msg.body)));
      result = all.find((r) => !r.ok) ?? { ok: true };
    }
  } else if (mode === "LIVE" && msg.channel === "telegram" && msg.to.startsWith("sim-")) {
    result = { ok: true }; // simulator chats never leave the server
  } else {
    result = await channel.send(msg.to, msg.body, msg.meta as OutgoingMeta);
  }
  // A sign-in code that really left the server is masked, so it can't be read from the CMS outbox.
  const meta = (msg.meta ?? {}) as { secret?: string | null };
  const externalId = result.ok ? result.externalId : undefined;
  const hideSecret = result.ok && mode === "LIVE" && !!meta.secret;
  const masked =
    hideSecret || externalId
      ? {
          ...(hideSecret ? { body: msg.body.replaceAll(meta.secret!, "••••") } : {}),
          meta: { ...meta, ...(hideSecret ? { secret: null } : {}), ...(externalId ? { wamid: externalId } : {}) },
        }
      : {};
  await db.outboxMessage.update({
    where: { id: msg.id },
    data: result.ok
      ? { status: "SENT", sentAt: new Date(), mock: mode === "MOCK", error: null, ...masked }
      : { status: "FAILED", error: result.error, mock: mode === "MOCK" },
  });
  return true;
}

/** Sends queued messages through their channel (mock or live, per the Integration table). Returns how many were processed. */
export async function sweepOutbox(db: PrismaClient, limit = 50): Promise<number> {
  const [queued, modeOf] = await Promise.all([db.outboxMessage.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: limit }), modes(db)]);
  let processed = 0;
  for (const msg of queued) if (await deliver(db, msg, modeOf)) processed++;
  return processed;
}

/** Delivers one message right away (sign-in codes can't wait for the worker). */
export async function deliverNow(db: PrismaClient, id: string): Promise<"SENT" | "FAILED" | "QUEUED"> {
  const msg = await db.outboxMessage.findUnique({ where: { id } });
  if (!msg) return "FAILED";
  if (msg.status === "QUEUED") await deliver(db, msg, await modes(db));
  return (await db.outboxMessage.findUnique({ where: { id }, select: { status: true } }))!.status;
}
