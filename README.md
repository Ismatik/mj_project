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
- **No public IP (a laptop or computer at home)?** Use a Cloudflare Tunnel instead of Caddy: `docker-compose.tunnel.yml`, step by step in **`docs/home-server.md`** (Arch Linux, keeping the laptop awake, off-site backups).

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
| `mavzuna` | owner | all 17 CMS sections, site admin |
| `reception` | reception | day-to-day pages (till with shift close, guests, waitlist, calendar, services, rental, bridal packages, stock, certificates, staff); no analytics, reports, payroll, bonus rules or settings; can book |
| `mira` | master | calendar (own bookings), services, staff schedule, her own pay |
| `content` | content manager | site admin only |

## Demo data

`prisma/seed.ts` rebuilds the database around today's date in Dushanbe: the team, services and prices, guests with visit history, this week's calendar, 60 days of sales (the last 14 days follow the dashboard chart in the design), dresses, reminders, website texts, photos and reviews, two promotions and guests' bonus points, closed shifts for the last five weeks, last month's payroll paid out and this month's advances. Mondays are the day off. Prices are in somoni.

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
- WhatsApp only lets a business write first with templates approved by Meta. Create them in WhatsApp Manager with the names and parameter order shown on the templates page (`mj_booking_confirmation`, `mj_reminder_day`, `mj_reminder_hours`, `mj_birthday` — *Marketing*, `mj_waitlist_offer`, `mj_login_code` — *Authentication*). Tajik guests get the Russian template on WhatsApp unless Meta accepts Tajik.
- Webhook `https://SITE_DOMAIN/api/whatsapp/webhook`: verified with `WHATSAPP_VERIFY_TOKEN`, every request checked against `WHATSAPP_APP_SECRET`. It records delivery failures in the outbox, forwards guests' WhatsApp messages to reception (Telegram) and sends her a short auto-reply at most every 12 hours.
- Going live: Meta Business verification and a Cloud API number; put `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` in `.env`; restart; set the webhook in Meta (field `messages`); CMS → Интеграции → WhatsApp → "Тест" (sends Meta's `hello_world` template) and "Живой".

## Prepayments and gift certificates

- **Prepayment:** a service with "предоплата онлайн N %" (CMS → Меню услуг, e.g. wedding looks at 30 %) asks for it when booked online or in the bot. The time is held for 30 minutes. Once paid, reception is told and the guest gets her confirmation. If it isn't paid in time, the worker releases the time (`releaseExpired`, every minute). The prepayment is subtracted at the till.
- **Gift certificates:** sold on the website (`/podarok`, in all three languages) or in CMS → **Сертификаты и оплаты**. Codes look like `MJ-XXXX-XXXX`, are valid 12 months and can be used in parts. At the till, type the code in the receipt: prepayment first, then the certificate, the rest with cash / card / QR. The certificate is an A5 PDF in MJ style with a QR code (`/api/gift/<token>/pdf`, fonts in `assets/fonts`). The QR opens `/sertifikat/<token>` with the balance.
- **Payments:** `Payment` records prepayments and certificate sales. Until a bank is connected, online payments go through the **test checkout** (`/oplata/<id>`, no money charged). A bank driver later only has to call `markPaid` / `cancelPayment` (`src/server/payments/core.ts`).

## Bonus points and promotions

- **Points:** 1 point = 1 somoni. A guest earns a share of what she actually paid (cash, card, QR, online prepayment — not points or certificates) by her level over the last 12 months: Классика 5 %, Серебро 7 % from 5 000 c., Золото 10 % from 15 000 c. Points can pay up to 30 % of a receipt. On her birthday the worker adds 100 points and sends a greeting (`npm run birthdays` runs it by hand). All of this is set in CMS → **Бонусы и акции** (owner only). Every change is a line in the `BonusTx` ledger.
- **At the till:** pick the guest from a booking or find her by phone; the receipt shows her points and "списать" up to the limit. Order: prepayment, certificate, points, then cash / card / QR. The owner can add or take points by hand in the guest card, with a reason.
- **Promotions:** an offer without a code applies by itself to its services and dates — in online booking (old price struck through), in the bot and at the till. A promo code (e.g. `MJ10`) applies when typed in the booking form or at the till; it can have a usage limit. Offers marked "на сайте" appear in the website's «Акции» section and in the bot (✦ Акции), in all three languages.
- Guests see their points, level and history in `/kabinet` and in the bot (🎁 Бонусы).

## Guest card, waitlist and walk-ins

- **Guest card** (Книга гостей): allergies and contraindications (a red note on the card, a «!» in the guest book, and in the calendar for the master of each visit), colour formulas per visit (the master can record them from her booking in the calendar), before/after photos (stored in `MEDIA_DIR/private`, shown only to staff through `/api/cms/guest-photos/<id>`, never under `/media`), the whole visit history and a «Дни рождения · 2 недели» filter with how old she turns.
- **Лист ожидания** (`/cms/waitlist`, owner and reception):
  - *Живая очередь* — guests who came in without a booking, with how long they've been waiting; «Посадить» books them "в кресле" with a master who is free right now.
  - *Лист ожидания* — guests waiting for a full day (added by reception, on the website — «Сообщить, если освободится» under the times — or in the bot). Whenever a booking is cancelled or moved (by reception, by the guest in her account or the bot, or because a prepayment wasn't made), the freed time is offered to the first guest it suits (service, master, preferred hours). The time is held for 30 minutes and she gets a message with a link (`/ochered/<token>`, in her language) to confirm or decline. If she declines or doesn't answer (the worker checks every minute), it goes to the next guest.

## Stock and bridal packages

- **Склад** (`/cms/stock`, owner and reception): products and consumables counted in ml, g or pieces, with package size and price (for the stock value) and a minimum. Deliveries (in units or packages), waste with a reason and stocktakes are recorded as moves. «Расход на услуги» sets what one service uses; when a receipt is paid at the till, those amounts are written off automatically (the move shows the receipt number). When an item drops below its minimum, the staff Telegram chat gets one message, and the sidebar shows how many items are low. The period report has a «Склад» sheet: received, used by services, wasted and what was used cost.
- **Свадебный пакет** (`/svadba`, three languages, linked from the «Невестам» section): the bride picks her wedding date, the wedding-day services (a package discount — 10 % from 3 services by default — applies to the services), a dress from the rental catalog (only dresses free for the rental days around that date can be chosen; the dress is booked straight away) and optionally a trial look before the wedding (a normal online booking with its prepayment link). Reception gets the package in Telegram and in CMS → **Свадебные пакеты**, confirms it and books the wedding-day times; cancelling a package frees the dress. The owner sets the discount, the minimum number of services, the rental days and the trial service there.

## Blog, Instagram and «Как нас найти»

- **Блог** (`/blog`, `/blog/<address>`, three languages): articles written in the site admin → «Блог и советы». Each article is saved and published on its own. Tajik and English are edited on those language tabs; an empty translation shows the Russian text. The text uses a small markup that can't carry HTML: an empty line for a new paragraph, `## ` for a heading, `- ` for a list, `> ` for a quote, `**bold**` and `[link](/#zapis)` (only web, site, phone and e-mail links). An article can point its «Записаться» button to a service. The home page shows the latest three under «Советы мастеров». Drafts are visible only to site editors with `?preview=1`. `/sitemap.xml` lists the public pages in all languages, articles and masters; `/robots.txt` keeps the CMS, admin and private pages out of search.
- **Instagram**: a strip of the latest posts on the home page. In mock mode it shows portfolio photos linking to the profile. In live mode (CMS → Интеграции → Instagram, needs `INSTAGRAM_TOKEN`) the worker fetches the latest posts every hour and refreshes the token weekly; the site reads the stored copy, so Instagram being slow never slows the site. Setup: **`docs/instagram-setup.md`**.
- **Как нас найти**: address, hours, one-tap call, WhatsApp, route in 2GIS and Google Maps, and a Google map that loads only when the visitor asks for it. The pin (latitude, longitude) and an optional 2GIS link are set in the site admin → «Контакты и часы» — check the default pin. On phones a bar at the bottom keeps «Позвонить», WhatsApp and «Записаться» one tap away.

## Payroll, shift close and reports

- **Закрытие смены** (Ресепшен и касса → «Закрытие смены», `/cms/pos/shift`): the day's money by cash / card / QR, prepayments, certificates and points used, cash put in or taken out (with a reason), and the cash expected in the drawer: what the previous shift left + cash taken today + put in − taken out (salary paid from the till included). Reception counts the drawer, says how much goes to the owner, and closes the day. The difference (shortfall or surplus) is kept, and the staff Telegram chat is told about it. The Z-report is a PDF. Once a day is closed, its cash can't change; the till warns if an earlier day with receipts wasn't closed (`?day=YYYY-MM-DD` closes it).
- **Зарплата** (`/cms/payroll`, owner; a master sees only her own row): per month, for each master, the services she did and their value after discounts, her commission (percent set per master), fixed monthly pay, bonuses and fines with a reason, and payments. Pay = fixed pay + commission + bonuses − fines; the balance is what's left to pay. A payment is either cash from the till (it shows in that day's shift) or a transfer. Excel and PDF.
- **Отчёты** (`/cms/reports`, owner): any period (presets: today, yesterday, this week, this month, last month, this year). The Excel workbook has a sheet each for the summary, every receipt, services, masters, revenue by day, payments outside receipts (online prepayments, certificates) and shifts. The PDF has the same in print form, with page numbers. Excel files are written by `src/server/reports/xlsx.ts` (no extra dependency); PDFs use the MJ fonts (`src/server/pdf/report.ts`).

## Tests

- `npm test` — unit tests (booking rules, free slots, formatting, access, content, translations, bot, message templates, bonus points and promotions, payroll and the till's cash count, the Excel writer, WhatsApp payloads and webhook parsing).
- `npm run e2e` — browser suites for the CMS, website, admin, online booking, Telegram bot, guest account, languages and WhatsApp, payments and certificates, bonus points and promotions, payroll, shift close and reports, guest card and waitlist, stock and bridal packages, blog, Instagram and map (see `e2e/README.md`).
