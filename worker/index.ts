// Background worker: delivers queued outbox messages. Scheduled reminders join in R2.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PgBoss } from "pg-boss";
import { PrismaClient } from "../src/generated/prisma/client";
import { channelFor, type ChannelKey } from "../src/server/integrations/channels";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const boss = new PgBoss({ connectionString, schema: "pgboss" });

const SWEEP = "outbox-sweep";

/** Sends every queued message through its channel (mock or live, per the Integration table). */
export async function sweepOutbox() {
  const [queued, integrations] = await Promise.all([
    db.outboxMessage.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: 50 }),
    db.integration.findMany(),
  ]);
  const modeOf = new Map(integrations.map((i) => [i.key, i.enabled ? i.mode : null]));

  for (const msg of queued) {
    const mode = modeOf.get(msg.channel);
    if (!mode) continue; // channel switched off — leave queued
    const result = await channelFor(msg.channel as ChannelKey, mode).send(msg.to, msg.body);
    await db.outboxMessage.update({
      where: { id: msg.id },
      data: result.ok
        ? { status: "SENT", sentAt: new Date(), mock: mode === "MOCK", error: null }
        : { status: "FAILED", error: result.error, mock: mode === "MOCK" },
    });
  }
  return queued.length;
}

async function main() {
  boss.on("error", (e) => console.error("[worker]", e));
  await boss.start();
  await boss.createQueue(SWEEP);
  await boss.schedule(SWEEP, "* * * * *");
  await boss.work(SWEEP, async () => {
    const n = await sweepOutbox();
    if (n) console.log(`[worker] outbox: processed ${n}`);
  });
  console.log("[worker] ready");

  const shutdown = async () => {
    await boss.stop({ graceful: true });
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
