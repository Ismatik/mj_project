// Background worker: every minute releases unpaid prepayment holds and delivers queued outbox messages;
// every 10 minutes queues visit reminders.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PgBoss } from "pg-boss";
import { PrismaClient } from "../src/generated/prisma/client";
import { sweepOutbox } from "../src/server/integrations/outbox";
import { releaseExpired } from "../src/server/payments/core";
import { queueReminders } from "../src/server/integrations/reminders";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const boss = new PgBoss({ connectionString, schema: "pgboss" });

const SWEEP = "outbox-sweep";
const REMINDERS = "reminders";

async function main() {
  boss.on("error", (e) => console.error("[worker]", e));
  await boss.start();
  await boss.createQueue(SWEEP);
  await boss.schedule(SWEEP, "* * * * *");
  await boss.work(SWEEP, async () => {
    // Unpaid prepayments past their time release the held booking
    const released = await releaseExpired(db);
    if (released) console.log(`[worker] payments: released ${released}`);
    const n = await sweepOutbox(db);
    if (n) console.log(`[worker] outbox: processed ${n}`);
  });
  await boss.createQueue(REMINDERS);
  await boss.schedule(REMINDERS, "*/10 * * * *");
  await boss.work(REMINDERS, async () => {
    const n = await queueReminders(db);
    if (n) console.log(`[worker] reminders: queued ${n}`);
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
