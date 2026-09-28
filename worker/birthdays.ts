// One-off run of the morning birthday job (the worker does this every day at 09:00):  npm run birthdays
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { awardBirthdays } from "../src/server/loyalty/core";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

awardBirthdays(db)
  .then((n) => console.log(`Birthday points given: ${n}`))
  .finally(() => db.$disconnect());
