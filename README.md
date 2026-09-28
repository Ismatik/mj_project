# MJ Project

Website, website admin and salon CMS for **Mavzunai Jovid — Gallery of Beauty MJ** (Dushanbe).

- `PLAN.md` — scope, decisions, releases.
- `design/` — HTML prototypes the app implements (open them in a browser for reference).

## Stack

Next.js 16 (App Router, TypeScript) · PostgreSQL 16 + Prisma 7 · pg-boss worker · Caddy (HTTPS) · Docker Compose.

```
src/app/            routes: / · /mastera · /portfolio · /kabinet (also under /tj and /en) · /login · /cms/* · /admin · /styleguide (owner only)
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
- `/mastera`, `/mastera/<name>` and `/portfolio` — the team, each master's page (bio, prices, works, booking with that master) and all works with filters. Names, titles and services come from the CMS; portraits, bios, page addresses and portfolio photos are edited in `/admin` → «Мастера и портфолио» (a hidden master disappears from the site).

## Guest account (`/kabinet`)

Guests sign in with their phone number and a 4-digit code — no password. The code goes to the salon's Telegram bot if the guest has used it, otherwise to WhatsApp, otherwise SMS (`src/lib/guest-code.ts`). Codes live 10 minutes, allow 5 attempts, can be re-sent after 60 s and at most 4 times an hour per number; only a hash is stored.

In the account: upcoming bookings (move to another free time with the same master or cancel, up to 2 hours before), visit history with **Записаться снова** (opens the booking form with the service and master chosen and contacts filled in), and a favourite master (listed first when booking). A first-time number creates a guest card after the code is confirmed.

While the channel is in mock mode the code is shown on screen. That is always on in development; on a server it needs `DEMO_LOGIN_CODES=1` (demo/staging only — otherwise anyone could open any account). Without it, sign-in opens once a channel is live.

## Integrations

Telegram, WhatsApp, SMS and payments each run in `MOCK` or `LIVE` mode, managed on `/cms/integrations` (owner only). In mock mode messages are recorded in the outbox and marked as sent without leaving the server; the worker delivers the queue every minute, or use "Доставить сейчас". Live drivers: Telegram and WhatsApp (R2); SMS once a gateway is contracted; payments in R3. API keys belong in `.env` only — the page shows whether they are set, never their values.

## Telegram bot

Guests book, see, move and cancel their visits in Telegram; reception gets alerts; guests get reminders a day and 2 hours before.

- The conversation logic lives in `src/lib/bot/engine.ts` (tested without Telegram). The same engine answers real Telegram updates (`/api/telegram/webhook`) and the **simulator** in the CMS (`/cms/integrations/telegram`), where the owner can try every flow before the bot is connected.
- Staff link a chat for reception alerts by sending the bot `/staff CODE` (the code is on `/cms/integrations`).
- Going live: create the bot with @BotFather, put `TELEGRAM_BOT_TOKEN` and a long random `TELEGRAM_WEBHOOK_SECRET` in `.env`, restart, then CMS → Интеграции → Telegram → "Подключить webhook" and switch to "Живой". Requires the public HTTPS domain in `SITE_DOMAIN`.

- The bot speaks Russian, Tajik and English: the language comes from the Telegram app on first contact and can be changed with "🌐 Язык · Забон · Language" or `/lang`. It also becomes the language of that guest's reminders.

## Languages (RU / TJ / EN)

- The website is in Russian at `/`, Tajik at `/tj/…` and English at `/en/…` (the proxy rewrites the prefix and passes the language on; pages carry `hreflang` alternates and `<html lang>`). The switch in the header keeps the current page.
- Interface texts (buttons, forms, errors, the account) are in `src/lib/i18n/dict.ts`; bot phrases in `src/lib/bot/texts.ts`.
- Texts the salon edits are translated in `/admin` with the **Русский / Тоҷикӣ / English** tabs: section texts, service and category names, masters (name, specialty, bio, photo captions), review texts, address and hours, SEO. Only differences from Russian are stored; anything left untranslated shows in Russian.
- Messages to guests (booking confirmation, reminders, sign-in code, WhatsApp auto-reply) go in the guest's language — the one she last used on the website or in the bot, or set in her account. Their texts are edited per language in CMS → Интеграции → **Шаблоны сообщений**. Reception alerts stay in Russian and mention the guest's language.
- The Tajik and English texts are drafts: have a native speaker review them in the admin before launch.

## WhatsApp

Guests without Telegram get their confirmation, reminders and sign-in codes in WhatsApp (Cloud API, `src/server/integrations/whatsapp-api.ts`).

- Step-by-step setup in Meta (account, number, token, webhook, costs): **`docs/whatsapp-setup.md`**. The templates are prepared in `src/lib/whatsapp-templates.ts` and submitted for approval from CMS → Интеграции → Шаблоны сообщений → «Отправить шаблоны в Meta» (needs `WHATSAPP_WABA_ID`); their approval status shows there.
- WhatsApp only lets a business write first with templates approved by Meta. Create them in WhatsApp Manager with the names and parameter order shown on the templates page (`mj_booking_confirmation`, `mj_reminder_day`, `mj_reminder_hours`, `mj_login_code` — the last one in the *Authentication* category). Tajik guests get the Russian template on WhatsApp unless Meta accepts Tajik.
- Webhook `https://SITE_DOMAIN/api/whatsapp/webhook`: verified with `WHATSAPP_VERIFY_TOKEN`, every request checked against `WHATSAPP_APP_SECRET`. It records delivery failures in the outbox, forwards guests' WhatsApp messages to reception (Telegram) and sends her a short auto-reply at most every 12 hours.
- Going live: Meta Business verification and a Cloud API number; put `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` in `.env`; restart; set the webhook in Meta (field `messages`); CMS → Интеграции → WhatsApp → "Тест" (sends Meta's `hello_world` template) and "Живой".

## Prepayments and gift certificates

- **Prepayment:** a service with "предоплата онлайн N %" (CMS → Меню услуг, e.g. wedding looks at 30 %) asks for it when booked online or in the bot. The time is held for 30 minutes. Once paid, reception is told and the guest gets her confirmation. If it isn't paid in time, the worker releases the time (`releaseExpired`, every minute). The prepayment is subtracted at the till.
- **Gift certificates:** sold on the website (`/podarok`, in all three languages) or in CMS → **Сертификаты и оплаты**. Codes look like `MJ-XXXX-XXXX`, are valid 12 months and can be used in parts. At the till, type the code in the receipt: prepayment first, then the certificate, the rest with cash / card / QR. The certificate is an A5 PDF in MJ style with a QR code (`/api/gift/<token>/pdf`, fonts in `assets/fonts`). The QR opens `/sertifikat/<token>` with the balance.
- **Payments:** `Payment` records prepayments and certificate sales. Until a bank is connected, online payments go through the **test checkout** (`/oplata/<id>`, no money charged). A bank driver later only has to call `markPaid` / `cancelPayment` (`src/server/payments/core.ts`).

## Tests

- `npm test` — unit tests (booking rules, free slots, formatting, access, content, translations, bot, message templates, WhatsApp payloads and webhook parsing).
- `npm run e2e` — browser suites for the CMS, website, admin, online booking, Telegram bot, guest account, languages and WhatsApp, payments and certificates (see `e2e/README.md`).
