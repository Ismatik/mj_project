---
name: run-mj-platform
description: Build, run, and drive the MJ platform (Next.js salon CMS + public website). Use when asked to start the app, run the dev server or its tests, take a screenshot of a page, sign in as a role, or interact with the running site or CMS.
---

Next.js 16 app for the Mavzunai Jovid salon: a public Russian-language website with
online booking, a 17-section CMS, and a guest account. Postgres via Prisma, run in
Docker. Drive it with `.claude/skills/run-mj-platform/driver.mjs` — a Playwright
harness that knows how to get past the site's intro loader and how to sign in as
each seeded role.

All paths are relative to the repo root.

## Prerequisites

Node 22+ and Docker. **No `apt-get` packages are needed** — Playwright's bundled
Chromium ran headless in this container with no extra system libraries.

## Setup

Run these **in this order**. The browser download must come *after* `npm install` —
see the first gotcha, it is not optional.

```bash
cp .env.example .env           # defaults work as-is for local runs
docker compose up -d postgres  # only postgres; the other services need a built image
npm install                    # runs `prisma generate` via postinstall
npx playwright install chromium   # ~280 MB, AFTER npm install. npm install does not do this.
npx prisma migrate deploy
npm run db:seed                # 5 staff, 15 services, 21 guests, 111 appointments, 861 sales
```

`npm run db:seed` rebuilds the demo data around **today's** date. Re-run it whenever
data looks stale or a suite has mutated it; `npm run db:reset` drops and re-seeds.

## Run (agent path)

Start the server, then drive it:

```bash
npm run dev > /tmp/mj-dev.log 2>&1 &
until grep -qE "Ready in|Error" /tmp/mj-dev.log; do sleep 1; done
```

```bash
node .claude/skills/run-mj-platform/driver.mjs doctor
```

```
ok    app answering at http://localhost:3000 — HTTP 200
ok    auth guard redirects /cms → /login — HTTP 307
ok    browser launches (141.0.7390.37)
ok    seeded owner can sign in — http://localhost:3000/cms
ok    CMS sidebar rendered (17 links)
```

| command | what it does |
|---|---|
| `doctor` | app / auth guard / browser / sign-in / seed-data check. Run this first; it names the fix for each failure. |
| `smoke` | 8 checks: hero, booking prices, anonymous API 401, owner login, dashboard revenue, calendar week, role separation, console errors. |
| `shot <path>` | screenshot + prints url, title, h1 and console errors |
| `eval <path> <js>` | evaluate JS in the page, print the JSON result |
| `repl` | interactive session that keeps one login warm across commands |

`shot` flags: `--as <role>`, `--full`, `--click <sel>`, `--wait <sel>`,
`--scrollTo <sel>`, `--viewport 390x844`, `--out file.png`.

```bash
node .claude/skills/run-mj-platform/driver.mjs smoke
node .claude/skills/run-mj-platform/driver.mjs shot /cms/payroll --as mavzuna
node .claude/skills/run-mj-platform/driver.mjs shot / --viewport 390x844 --out run-output/mobile.png
node .claude/skills/run-mj-platform/driver.mjs eval /cms "document.querySelector('main').innerText" --as mavzuna
```

Screenshots land in `run-output/` (gitignored; override with `OUT=`).

The REPL reads commands on stdin, so it scripts cleanly without tmux:

```bash
printf "as mira\neval document.querySelectorAll('aside nav a').length\ntext h1\nquit\n" \
  | node .claude/skills/run-mj-platform/driver.mjs repl
```

```
> http://localhost:3000/cms/calendar
> 4
> Календарь записей
```

REPL commands: `goto` `as` `click` `fill` `text` `eval` `ss` `errors` `fresh` `quit`.

### Roles

Password for all of them is `change-me-now` (`SEED_OWNER_PASSWORD` in `.env`).

| login | role | lands on | sees |
|---|---|---|---|
| `mavzuna` | owner | `/cms` | all 17 CMS sections + `/admin` |
| `reception` | reception | `/cms` | 11 sections; no analytics, reports, payroll, settings |
| `mira` | master | `/cms/calendar` | 4 sections; own bookings and own pay |
| `content` | content manager | `/admin` | site admin only, CMS refused |

### Routes

Public: `/` `/portfolio` `/mastera` `/mastera/[slug]` `/blog` `/blog/[slug]` `/svadba`
`/podarok` `/kabinet` `/login` `/admin` `/styleguide`

CMS: `/cms` `/cms/calendar` `/cms/guests` `/cms/waitlist` `/cms/services` `/cms/rental`
`/cms/bridal` `/cms/stock` `/cms/certificates` `/cms/staff` `/cms/payroll` `/cms/loyalty`
`/cms/analytics` `/cms/reports` `/cms/settings` `/cms/integrations` `/cms/pos`
`/cms/pos/shift` `/cms/account`

## Run (human path)

```bash
npm run dev      # → http://localhost:3000, Ctrl-C to stop
npm run worker   # optional, second terminal — reminders and background jobs
```

## Test

```bash
npm test                  # vitest unit tests
npm run typecheck         # next typegen && tsc --noEmit
node e2e/01-access.mjs    # one browser suite — 30 PASS in this container
npm run e2e               # all 13 suites, re-seeding before each (slow)
```

`e2e/README.md` says the suites need `npm run build && npm start`. **They also pass
against `npm run dev`** — suite 01 gave 30/30 that way here. Suites 07 and 13 additionally
need stand-in API servers and extra env vars; see that README before running them.

## Gotchas

- **`npx playwright install chromium` before `npm install` installs the wrong browser
  and deletes the right one.** With no `node_modules`, `npx` fetches the *latest*
  Playwright from the registry, which downloads build v1243 — but this repo pins
  `playwright@1.56.1`, which needs **v1194**. Worse, the newer CLI prunes older builds,
  so it removes any v1194 already in `~/.cache/ms-playwright`. Verified in a clean room:
  the result is `Executable doesn't exist at .../chromium_headless_shell-1194`. Always
  `npm install` first. If you've already hit it, just re-run `npx playwright install
  chromium` with `node_modules` present — it refetches v1194.
- **Prices are a Latin `c.`, not a Cyrillic `с.`** — "180 c." in otherwise Russian text
  uses U+0063. A regex or `grep` for the Cyrillic letter silently matches nothing. This
  cost two false failures while building the smoke suite; `driver.mjs` matches `[cс]`.
- **`networkidle` is not enough for a screenshot.** `src/components/site/SiteEffects.tsx`
  paints a full-screen intro loader and unmounts it on a timer, and reveals sections on
  scroll. Screenshotting at `networkidle` gives a beige splash with the MJ logo — it looks
  like a hung page but the app is fine. The driver's `settle()` waits for the loader text
  ("Добро пожаловать" on the site, "Открываем салон" after login) to *detach*, then pauses
  for the reveals. Reuse it rather than adding a fixed sleep.
- **`playwright` is CommonJS.** `import { chromium } from "playwright"` works inside the
  repo (its `package.json` resolves it), but in a standalone `.mjs` pointed at
  `node_modules/playwright/index.js` you get *"Named export 'chromium' not found"* —
  use a default import there.
- **Monday is the salon's day off.** If the real today is a Monday, the CMS "today"
  panels are legitimately empty and `smoke`'s revenue check will fail. `SEED_TODAY`
  does **not** fix this: it moves the seeded data's anchor, not the app's clock. Seeding
  with `SEED_TODAY=2026-10-05` left only 2 appointments in the real current week.
- **`docker compose up -d` (no service) will fail on a fresh clone** — `web`, `worker`
  and `migrate` build from the Dockerfile and `caddy` wants ports 80/443. For local work
  start only `postgres` and run Next on the host.
- **The website's forms are rate-limited per address.** Running booking or callback
  flows repeatedly within an hour starts getting rejected; restart the app to clear it.
- **`npm run dev` rewrites `AGENTS.md` and `CLAUDE.md`** at the repo root on every boot
  (Next 16 `agentRules`). They are tracked, so a dev run can show up as a spurious diff —
  check before committing whether the change is real or just regeneration. Set
  `agentRules: false` in `next.config.ts` to stop it.

## Troubleshooting

- **`browserType.launch: Executable doesn't exist at .../chromium_headless_shell-1194/...`**:
  the browser for *this* Playwright version is missing — either never downloaded, or
  pruned by a stray `npx playwright install` run without `node_modules` (see gotcha 1).
  Fix: `npm install && npx playwright install chromium`. `driver.mjs` degrades to
  `/usr/bin/google-chrome` with a warning so it still works; the suites in `e2e/` hard-fail.
- **`POSTGRES_PASSWORD` "set POSTGRES_PASSWORD in .env"** from docker compose: no `.env`.
  `cp .env.example .env`.
- **CMS sidebar has ≤10 links, dashboard blank**: the database is migrated but not seeded.
  `npm run db:seed`.
- **A page 404s with `h1: 404`**: the CMS route is probably misremembered — payroll is
  `/cms/payroll`, not `/cms/zarplata`. See the route list above.
