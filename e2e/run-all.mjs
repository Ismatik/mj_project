// Runs every browser suite, re-seeding the demo data before each.
// Needs the app running (npm run build && npm start, or docker compose) and DATABASE_URL for the seed.
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";

const suites = readdirSync(new URL(".", import.meta.url)).filter((f) => /^\d\d-.*\.mjs$/.test(f)).sort();
let failed = 0;
for (const suite of suites) {
  execSync("npx prisma db seed", { stdio: "ignore" });
  console.log(`\n▶ ${suite}`);
  try {
    execSync(`node ${new URL(suite, import.meta.url).pathname}`, { stdio: "inherit" });
  } catch {
    failed++;
  }
}
execSync("npx prisma db seed", { stdio: "ignore" });
if (failed) {
  console.error(`\n${failed} suite(s) failed`);
  process.exit(1);
}
