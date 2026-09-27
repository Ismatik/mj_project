# MJ Project

Website, website admin and salon CMS for **Mavzunai Jovid — Gallery of Beauty MJ** (Dushanbe).

- `PLAN.md` — scope, decisions, releases.
- `design/` — HTML prototypes the app implements (open them in a browser for reference).

## Stack

Next.js 16 (App Router, TypeScript) · PostgreSQL 16 + Prisma 7 · pg-boss worker · Caddy (HTTPS) · Docker Compose.

```
src/app/            routes (/, /styleguide; /cms, /admin, /login follow in Sprint 2+)
src/components/fx/  effects: MJ nail loader, toasts, count-up, skeleton, sparkles
src/components/ui/  shared components: buttons, tags, headings, stat cards, bars, fields, monogram
src/lib/            formatting (somoni, dates in Dushanbe time), passwords, db client
src/server/         server-side queries and integration connectors
prisma/             schema, migrations, demo seed
worker/             background jobs (outbox delivery; reminders in R2)
deploy/             Caddyfile
```

## Run on a server (Docker)

```bash
cp .env.example .env          # set POSTGRES_PASSWORD, SEED_OWNER_PASSWORD, SITE_DOMAIN
docker compose up -d --build  # postgres, migrations, web, worker, caddy, backups
docker compose run --rm migrate npx prisma db seed   # optional: demo data
```

- The site is served by Caddy on ports 80/443 with automatic HTTPS for `SITE_DOMAIN`.
- Database dumps are written daily to `./backups`.
- Uploaded photos live in the `media` Docker volume.

## Local development

Requires Node 22+ and Docker.

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev                   # http://localhost:3000
npm run worker                # optional, in a second terminal
```

Useful scripts: `npm test` · `npm run typecheck` · `npm run lint` · `npm run db:reset` (drops and re-seeds).

Demo sign-in accounts (used from Sprint 2): `mavzuna` (owner), `reception`, `content` — password from `SEED_OWNER_PASSWORD`.

## Demo data

`prisma/seed.ts` rebuilds the database around today's date in Dushanbe: the team, services and prices, guests with visit history, this week's calendar, 60 days of sales (the last 14 days follow the dashboard chart in the design), dresses, reminders, website texts, photos and reviews. Mondays are the day off. Prices are in somoni.

## Integrations

Telegram, WhatsApp, SMS and payments each run in `MOCK` or `LIVE` mode (table `Integration`). In mock mode messages are recorded in the outbox and marked as sent without leaving the server. API keys belong in `.env` only.
