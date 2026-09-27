# MJ Project

Website, website admin and salon CMS for **Mavzunai Jovid — Gallery of Beauty MJ** (Dushanbe).

- `PLAN.md` — scope, decisions, releases.
- `design/` — HTML prototypes the app implements (open them in a browser for reference).

## Stack

Next.js 16 (App Router, TypeScript) · PostgreSQL 16 + Prisma 7 · pg-boss worker · Caddy (HTTPS) · Docker Compose.

```
src/app/            routes: / · /login · /cms/* · /admin · /styleguide (owner only)
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

Demo sign-in accounts — password from `SEED_OWNER_PASSWORD`:

| Login | Role | Sees |
|---|---|---|
| `mavzuna` | owner | all 9 CMS sections, site admin |
| `reception` | reception | everything except analytics and settings; can book |
| `mira` | master | calendar (own bookings), services, staff schedule |
| `content` | content manager | site admin only |

## Demo data

`prisma/seed.ts` rebuilds the database around today's date in Dushanbe: the team, services and prices, guests with visit history, this week's calendar, 60 days of sales (the last 14 days follow the dashboard chart in the design), dresses, reminders, website texts, photos and reviews. Mondays are the day off. Prices are in somoni.

## Website and site admin

- `/` — the public website. It shows the **published** content; `/?preview=1` shows the draft to signed-in editors.
- `/admin` — texts, prices on the site, photos, reviews, contacts, SEO. Edits autosave to a draft; **Опубликовать** makes them live.
- Prices and durations come from the CMS menu (`/cms/services`). The admin only chooses which services appear on the site.
- Uploaded photos (JPG/PNG/WebP up to 8 MB) are stored in `MEDIA_DIR` and served from `/media/…`.
- **Онлайн-запись**: guests pick a service, a master (or "любой"), a day and a free time. Free times come from the masters' schedules and existing bookings (`src/lib/slots.ts`); each booking is re-checked under a per-date lock, so two guests can't take the same slot. The booking appears in the CMS calendar as "Ожидание" (source: сайт) for reception to confirm.
- "Не нашли удобное время?" leaves a callback request, shown on the CMS dashboard ("Заявки с сайта").

## Integrations

Telegram, WhatsApp, SMS and payments each run in `MOCK` or `LIVE` mode, managed on `/cms/integrations` (owner only). In mock mode messages are recorded in the outbox and marked as sent without leaving the server; the worker delivers the queue every minute, or use "Доставить сейчас". Live drivers arrive with R2 (Telegram, WhatsApp, SMS) and R3 (payments). API keys belong in `.env` only — the page shows whether they are set, never their values.

## Tests

- `npm test` — unit tests (booking rules, free slots, formatting, access, content).
- `npm run e2e` — browser suites for the CMS, website, admin and online booking (see `e2e/README.md`).
