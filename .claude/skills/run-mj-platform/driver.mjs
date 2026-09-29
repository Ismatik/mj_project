#!/usr/bin/env node
// Drives the running MJ platform in a real browser. See SKILL.md.
//
//   node .claude/skills/run-mj-platform/driver.mjs doctor
//   node .claude/skills/run-mj-platform/driver.mjs smoke
//   node .claude/skills/run-mj-platform/driver.mjs shot /cms/calendar --as mavzuna
//   node .claude/skills/run-mj-platform/driver.mjs eval / "document.title"
//   node .claude/skills/run-mj-platform/driver.mjs repl
//
// BASE_URL   where the app is            (default http://localhost:3000)
// OUT        screenshot folder           (default run-output)
// PASSWORD   CMS password for --as       (default change-me-now, = SEED_OWNER_PASSWORD)
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "run-output";
const PASSWORD = process.env.PASSWORD ?? "change-me-now";
mkdirSync(OUT, { recursive: true });

// Prices render as "180 c." — that is a LATIN c, not a Cyrillic с, in otherwise
// Russian text. Matching the Cyrillic letter silently finds nothing. Accept both.
const SOMONI = /\d[\d\s]*[cс]\./;

// Seeded CMS accounts (prisma/seed.ts) — each sees a different slice of the CMS.
const ROLES = {
  mavzuna: "owner — all 17 CMS sections + /admin",
  reception: "reception — till, guests, calendar; no analytics/payroll/settings",
  mira: "master — own calendar, services, own pay",
  content: "content manager — /admin only",
};

// ── browser ──────────────────────────────────────────────────────────────────
// Prefer Playwright's own Chromium (`npx playwright install chromium`). Fall back
// to a system Chrome so the driver still works before that download has happened.
async function launch() {
  try {
    return await chromium.launch();
  } catch (e) {
    for (const p of ["/usr/bin/google-chrome", "/usr/bin/chromium", "/snap/bin/chromium"]) {
      if (existsSync(p)) {
        console.error(`! bundled chromium missing, falling back to ${p}`);
        console.error("! run `npx playwright install chromium` for the supported browser");
        return await chromium.launch({ executablePath: p });
      }
    }
    throw e;
  }
}

// ── the settle that every screenshot needs ───────────────────────────────────
// src/components/site/SiteEffects.tsx paints a full-screen intro loader and
// unmounts it on a timer, and reveals sections on scroll. `networkidle` fires
// while the loader is still up, so a naive screenshot is a beige splash screen.
// Wait for the loader text to detach, then let the reveal animations land.
async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  for (const t of ["Добро пожаловать", "Открываем салон"]) {
    await page
      .getByText(t, { exact: false })
      .first()
      .waitFor({ state: "detached", timeout: 15000 })
      .catch(() => {});
  }
  await page.waitForTimeout(700);
}

async function login(page, who) {
  if (!ROLES[who]) throw new Error(`unknown role "${who}" — one of ${Object.keys(ROLES).join(", ")}`);
  await page.goto(`${BASE}/login`);
  await settle(page);
  await page.fill("input[name=login]", who);
  await page.fill("input[name=password]", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  await settle(page);
}

function newPage(ctx, errors) {
  return ctx.newPage().then((p) => {
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    return p;
  });
}

// ── commands ─────────────────────────────────────────────────────────────────
const cmds = {};

cmds.doctor = async () => {
  let bad = 0;
  const say = (ok, label, extra = "") => {
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  };

  const r = await fetch(BASE + "/").catch((e) => ({ error: e.message }));
  say(r.status === 200, `app answering at ${BASE}`, r.error ?? `HTTP ${r.status}`);
  if (r.error) console.log("      start it with: npm run dev");

  const guard = await fetch(BASE + "/cms", { redirect: "manual" }).catch(() => ({}));
  say(guard.status === 307, "auth guard redirects /cms → /login", `HTTP ${guard.status}`);

  let b;
  try {
    b = await launch();
    say(true, `browser launches (${b.version()})`);
  } catch (e) {
    say(false, "browser launches", e.message.split("\n")[0]);
  }

  if (b) {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    try {
      await login(p, "mavzuna");
      say(p.url().includes("/cms"), "seeded owner can sign in", p.url());
      const rows = await p.locator("aside nav a").count();
      say(rows > 10, `CMS sidebar rendered (${rows} links)`, rows <= 10 ? "database may not be seeded" : "");
    } catch (e) {
      say(false, "seeded owner can sign in", e.message.split("\n")[0]);
      console.log("      seed the database with: npm run db:seed");
    }
    await b.close();
  }
  process.exit(bad ? 1 : 0);
};

cmds.shot = async (args) => {
  const path = args._[0] ?? "/";
  const b = await launch();
  const errors = [];
  const [w, h] = (args.viewport ?? "1440x900").split("x").map(Number);
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await newPage(ctx, errors);

  if (args.as) await login(page, args.as);
  await page.goto(BASE + path);
  await settle(page);
  if (args.click) {
    await page.locator(args.click).first().click();
    await page.waitForTimeout(1500);
  }
  if (args.wait) await page.locator(args.wait).first().waitFor({ timeout: 15000 });
  if (args.scrollTo) {
    await page.locator(args.scrollTo).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
  }

  const file = args.out ?? `${OUT}/${(path.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "home")}.png`;
  await page.screenshot({ path: file, fullPage: !!args.full });
  console.log(`url:    ${page.url()}`);
  console.log(`title:  ${await page.title()}`);
  console.log(`h1:     ${await page.locator("h1").first().innerText().catch(() => "(none)")}`.replace(/\n/g, " "));
  console.log(`shot:   ${file}`);
  console.log(`errors: ${errors.length ? errors.slice(0, 5).join(" | ") : "none"}`);
  await b.close();
};

cmds.eval = async (args) => {
  const [path, expr] = args._;
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await newPage(ctx, []);
  if (args.as) await login(page, args.as);
  await page.goto(BASE + path);
  await settle(page);
  console.log(JSON.stringify(await page.evaluate(expr), null, 2));
  await b.close();
};

cmds.smoke = async () => {
  const b = await launch();
  const errors = [];
  const results = [];
  const check = (name, ok, extra = "") => {
    results.push({ ok, name, extra });
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  };

  // 1. Public site renders past the intro loader.
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await newPage(ctx, errors);
  await page.goto(BASE + "/");
  await settle(page);
  const h1 = await page.locator("h1").first().innerText();
  check("website hero renders", h1.includes("КРАСОТА"), h1.replace(/\n/g, " "));
  await page.screenshot({ path: `${OUT}/smoke-home.png` });

  // 2. Online booking, step 1 — services and prices come from the CMS menu.
  await page.locator("#zapis").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.locator("#zapis button").first().click();
  await page.waitForTimeout(1200);
  await page.locator("#zapis").scrollIntoViewIfNeeded();
  const svcText = await page.locator("#zapis").innerText();
  check("booking step 1 lists priced services", SOMONI.test(svcText), (svcText.match(new RegExp(SOMONI, "g")) ?? []).slice(0, 3).join(", "));
  await page.screenshot({ path: `${OUT}/smoke-booking.png` });

  // 3. Auth guard.
  const anon = await page.request.get(BASE + "/api/cms/search?q=Марта");
  check("CMS API refuses anonymous", anon.status() === 401, `HTTP ${anon.status()}`);

  // 4. Owner signs in, dashboard shows seeded money + today's chairs.
  await login(page, "mavzuna");
  check("owner lands in the CMS", page.url().includes("/cms"), page.url());
  const dash = await page.locator("main").innerText();
  check("dashboard shows seeded revenue", SOMONI.test(dash), (dash.match(SOMONI) ?? [])[0]);
  await page.screenshot({ path: `${OUT}/smoke-cms.png` });

  // 5. Calendar renders the seeded week.
  await page.goto(BASE + "/cms/calendar");
  await settle(page);
  const booked = await page.locator("main").innerText();
  const n = (booked.match(/Записей на неделе:\s*(\d+)/) ?? [])[1];
  check("calendar shows the seeded week", Number(n) > 0, `${n} appointments`);
  await page.screenshot({ path: `${OUT}/smoke-calendar.png` });

  // 6. Roles really differ — reception must not see payroll.
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await newPage(ctx2, errors);
  await login(p2, "reception");
  const nav = await p2.locator("aside nav a").allInnerTexts();
  check("reception has no payroll link", !nav.some((t) => t.includes("Зарплата")), `${nav.length} links`);

  check("no browser console errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  await b.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed · screenshots in ${OUT}/`);
  process.exit(failed ? 1 : 0);
};

cmds.repl = async () => {
  // Keeps one browser + one signed-in session warm across commands.
  const b = await launch();
  let errors = [];
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  let page = await newPage(ctx, errors);
  const help = `commands:
  goto <path>              navigate + settle
  as <role>                sign in (${Object.keys(ROLES).join(" | ")})
  click <selector>         click first match + settle
  fill <selector> <value>  fill an input
  text [selector]          innerText (default main)
  eval <js>                evaluate in the page
  ss [name]                screenshot → ${OUT}/<name>.png
  errors                   console errors so far
  fresh                    new incognito context (signs out)
  quit`;
  console.log(help);
  process.stdout.write("> ");
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    const [cmd, ...rest] = line.trim().split(/\s+/);
    const arg = rest.join(" ");
    try {
      if (!cmd) { /* blank */ }
      else if (cmd === "quit" || cmd === "exit") break;
      else if (cmd === "help") console.log(help);
      else if (cmd === "goto") { await page.goto(BASE + (arg || "/")); await settle(page); console.log(page.url()); }
      else if (cmd === "as") { await login(page, arg); console.log(page.url()); }
      else if (cmd === "click") { await page.locator(arg).first().click(); await settle(page); console.log("clicked"); }
      else if (cmd === "fill") { await page.fill(rest[0], rest.slice(1).join(" ")); console.log("filled"); }
      else if (cmd === "text") console.log(await page.locator(arg || "main").first().innerText());
      else if (cmd === "eval") console.log(JSON.stringify(await page.evaluate(arg)));
      else if (cmd === "ss") { const f = `${OUT}/${arg || "repl"}.png`; await page.screenshot({ path: f }); console.log(f); }
      else if (cmd === "errors") console.log(errors.length ? errors.join("\n") : "none");
      else if (cmd === "fresh") { await ctx.close(); errors = []; ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); page = await newPage(ctx, errors); console.log("new context"); }
      else console.log(`? ${cmd} — "help" for commands`);
    } catch (e) {
      console.log("ERR " + e.message.split("\n")[0]);
    }
    process.stdout.write("> ");
  }
  await b.close();
};

// ── arg parsing ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const name = argv.shift();
const args = { _: [] };
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) {
    const k = argv[i].slice(2);
    if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) args[k] = argv[++i];
    else args[k] = true;
  } else args._.push(argv[i]);
}

if (!cmds[name]) {
  console.log(`usage: driver.mjs <doctor|smoke|shot|eval|repl> [args]

  doctor                        check app, database, browser and sign-in
  smoke                         6 checks across site + booking + CMS + roles
  shot <path> [--as <role>]     screenshot a page
        [--full] [--click sel] [--wait sel] [--scrollTo sel]
        [--viewport 390x844] [--out file.png]
  eval <path> <js> [--as role]  evaluate JS in the page, print JSON
  repl                          interactive session (keeps login warm)

roles: ${Object.entries(ROLES).map(([k, v]) => `\n  ${k.padEnd(10)} ${v}`).join("")}

env: BASE_URL=${BASE}  OUT=${OUT}`);
  process.exit(name ? 1 : 0);
}
await cmds[name](args);
