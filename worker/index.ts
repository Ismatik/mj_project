// Background worker: every minute releases unpaid prepayment holds, passes unanswered waitlist offers on
// and delivers queued outbox messages;
// every 10 minutes queues visit reminders; every morning gives birthday points.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PgBoss } from "pg-boss";
import { PrismaClient } from "../src/generated/prisma/client";
import { sweepOutbox } from "../src/server/integrations/outbox";
import { awardBirthdays } from "../src/server/loyalty/core";
import { releaseExpired } from "../src/server/payments/core";
import { queueReminders } from "../src/server/integrations/reminders";
import { closePastEntries, expireOffers } from "../src/server/waitlist/core";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const boss = new PgBoss({ connectionString, schema: "pgboss" });

const SWEEP = "outbox-sweep";
const REMINDERS = "reminders";
const BIRTHDAYS = "birthdays";

async function main() {
  boss.on("error", (e) => console.error("[worker]", e));
  await boss.start();
  await boss.createQueue(SWEEP);
  await boss.schedule(SWEEP, "* * * * *");
  await boss.work(SWEEP, async () => {
    // Unpaid prepayments past their time release the held booking
    const released = await releaseExpired(db);
    if (released) console.log(`[worker] payments: released ${released}`);
    // Waitlist offers nobody answered go to the next guest
    const expired = await expireOffers(db);
    if (expired) console.log(`[worker] waitlist: ${expired} offers expired`);
    await closePastEntries(db);
    const n = await sweepOutbox(db);
    if (n) console.log(`[worker] outbox: processed ${n}`);
  });
  await boss.createQueue(REMINDERS);
  await boss.schedule(REMINDERS, "*/10 * * * *");
  await boss.work(REMINDERS, async () => {
    const n = await queueReminders(db);
    if (n) console.log(`[worker] reminders: queued ${n}`);
  });
  // Birthday points and greetings, every morning at 09:00 in Dushanbe
  await boss.createQueue(BIRTHDAYS);
  await boss.schedule(BIRTHDAYS, "0 9 * * *", undefined, { tz: "Asia/Dushanbe" });
  await boss.work(BIRTHDAYS, async () => {
    const n = await awardBirthdays(db);
    if (n) console.log(`[worker] birthdays: ${n}`);
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
