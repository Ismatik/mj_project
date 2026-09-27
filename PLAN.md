# MJ Platform — Project Plan

Platform for **Mavzunai Jovid — Gallery of Beauty MJ**, a beauty salon and wedding hall in Dushanbe, Tajikistan.

Three connected products in one application:

| Route | Product | Design source |
|---|---|---|
| `/` | Public website | `design/Mavzunai Jovid Website Main.dc.html` |
| `/admin` | Website admin (content manager) | `design/Site Admin.dc.html` |
| `/cms` | Salon CMS (owner, reception, masters) | `design/Salon CMS Dashboard Main.dc.html` |
| `/login` | Shared sign-in with roles | new |

The `design/*.dc.html` files are HTML prototypes (rendered by `design/support.js`). Recreate them pixel-perfectly in the real stack; do not port the prototype runtime. `design/mj-fx.js` holds the effects to port (loader, toasts, count-up, skeleton, sparkles, blur-up).

## Brand facts

- Name: Mavzunai Jovid — Gallery of Beauty MJ. Owner: Мавзуна.
- Address: ул. Бухоро, 23/25, 1–2 этаж, Шохмансур, Душанбе.
- Phone / WhatsApp: +992 98 103 11 11 (wa.me/992981031111).
- Instagram: @mavzunai.jovid.official, @mavzunai_jovid_gallery_beauty.
- Hours: Tue–Sun 09:00–18:00, Monday closed.
- Services: hair, nails, brows & lashes, makeup, skin care, spa, bridal looks, wedding hall, dress rental.
- Language: Russian first; Tajik and English added in R2.

## Design rules

- Colors: ink `#26221D`, cream `#F2EDE3`, gold `#B8A06A` (hover `#A68D55`), deep gold `#8F7A4B`, line `#DDD3BF`, surfaces `#F7F2E7` / `#EDE6D6` / `#E4DCC9`, muted text `#5C5344`, disabled `#B9B2A4`.
- Fonts: Zen Old Mincho (headings, numerals), Jost (body).
- Zero border radius, 2px gold rules under section headings, MJ square monogram.
- Photos in black and white.
- Loader: variant "mono" (MJ monogram, five nails painted in turn).
- Effects are subtle: fade-up, bar growth, count-up, skeleton shimmer, toasts. Everything respects `prefers-reduced-motion`.
- New screens with no prototype are designed in the same MJ style and reviewed screen by screen.

## Decisions

| Topic | Decision |
|---|---|
| Stack | Next.js (App Router) + TypeScript, Prisma, PostgreSQL |
| Hosting | Own VPS with Docker |
| Currency | Somoni (c., TJS) everywhere — the prototype's `$` amounts are converted |
| Integrations | Adapter per provider with `mock` and `live` drivers, switched in CMS → Настройки → Интеграции; secrets only in server env |
| Channels | Telegram first, then WhatsApp; SMS as optional fallback |
| Release order | R1 → R2 → R3 → R4 |

## Infrastructure (docker-compose)

- `web` — Next.js: website, admin, CMS, API routes, Telegram/WhatsApp webhooks.
- `worker` — scheduled reminders and outgoing messages (pg-boss queue on Postgres).
- `postgres` — with daily automated backup.
- `minio` — S3-compatible storage for photos and portfolio.
- `caddy` — reverse proxy with automatic HTTPS (required for bot webhooks).
- Two environments: staging and production.

## Integration layer (mock first)

Each integration has one interface and two drivers. In `mock` mode messages land in a CMS **Исходящие** (outbox) log and payments go through a test checkout page, so every flow works from day one.

| Feature | Usage | Mock | To go live |
|---|---|---|---|
| Telegram bot | Guests book (service → master → free slot), reschedule, cancel, check bonus balance, receive reminders; staff get new-booking alerts | Chat simulator in CMS using the same bot logic | Bot token from @BotFather, public HTTPS URL |
| WhatsApp / SMS reminders | Confirmation, 24 h and 2 h reminders, post-visit review request, birthday greeting; templates editable per language | Outbox | WhatsApp: Meta Business verification, WhatsApp Business API number, approved templates. SMS: local gateway contract and registered sender name |
| Guest sign-in by code | Phone number → 4-digit code | Code shown on screen and in outbox | Same channel as above (Telegram login as free alternative) |
| Bonus program | % of each receipt back as points, birthday gift, tiers; points spent at POS; balance visible in account and bot | Built in | Owner sets rules in CMS |
| Gift certificates | Sold on site or at POS; code, QR, branded PDF; full or partial redemption | Online sale via test checkout | Payment adapter |
| Promotions & promo codes | Offers with dates, services, discount; shown on site, bot, booking form; applied at POS | Built in | Nothing external |
| Deposits / prepayment | Required for weddings and long services; booking pending until paid; counted in final receipt | Test checkout | Bank acquiring contract (e.g. Alif, Dushanbe City, Korti Milli), API keys and status webhook |

## Releases

### R1 — Foundation and MVP (~5 weeks)

| Sprint | Deliverables | Done when |
|---|---|---|
| 1 | Docker setup, Prisma schema and seed (all data from the prototypes), design tokens, UI components, effects ported (loader, toasts, count-up, skeleton) | One command starts everything locally; seed contains every guest, master, service and dress from the design |
| 2 | Auth and roles (owner, reception, content manager, master); CMS shell (sidebar, header); working search; "+ Новая запись" modal | Each role sees only its pages; search finds guests and bookings |
| 3 | The 9 CMS pages on real data: dashboard, POS, guest book, calendar, services and prices, dress rental, staff and schedule, analytics, settings | Matches design at 1360 px; a POS sale persists and appears on the dashboard |
| 4 | Website and site admin; Publish updates the site; prices come from the CMS | Hiding a price in admin removes it from the site |
| 5 | Real-time slot booking, tablet and mobile layouts, integrations page and outbox, QA pass | A booking made on the site appears in the CMS calendar on another device |

Start Meta Business verification during R1 so WhatsApp is ready for R2.

### R2 — Guest channels (~3 weeks)

- Telegram bot live (booking, reschedule, cancel, bonus balance, reminders, staff alerts).
- WhatsApp live as second channel.
- Guest account: sign-in by code, visit history, one-tap rebook, cancel/reschedule, favourite master.
- Masters and portfolio pages on the website.
- Three languages: RU / TJ / EN for website, bot and message templates.

### R3 — Money (~3 weeks)

- Bonus program.
- Gift certificates (QR + PDF).
- Promotions and promo codes.
- Deposits (test checkout until the bank contract is signed).
- Master payroll / commissions, end-of-day shift close, Excel and PDF reports.

### R4 — Operations and content (~3 weeks)

- Rich guest card: visit history, allergies and notes, colour formulas, before/after photos, birthday.
- Waitlist and walk-ins, with auto-offer on cancellation.
- Stock and consumables with low-stock alerts and write-off per service.
- Bridal package builder (hair + makeup + nails + dress from rental catalog, total, fitting booking).
- Blog / beauty tips.
- Instagram feed and map (2GIS / Google) with click-to-call.

Total: about 14 weeks for one developer.

## Owner to-do (outside the code)

| When | Item |
|---|---|
| Now | VPS and domain; Telegram bot token from @BotFather |
| During R1 | Meta Business verification, WhatsApp Business number |
| Before R3 live | Bank acquiring contract; SMS sender name if SMS is used |

## Known gaps in the prototypes

- Mixed currency (`$` on dashboard and analytics) — convert to somoni.
- Some staff and guest names are placeholders (Инес, Петра, Дарио, Марта, Хлоя, Юки) — replace with real team data.
- Date is hardcoded ("Вс, 21 сентября 2026") — use the real date.
- "+ Новая запись", search, calendar week arrows and calendar item clicks are inert in the prototype — implement them.
- Desktop only (fixed 256 px sidebar) — responsive layouts to be designed.
- Only one real salon photo is available; the rest are black-and-white stock — replaceable from the admin.

## Risks

| Risk | Mitigation |
|---|---|
| WhatsApp template approval delays | Telegram covers all flows until approved |
| Bank payment APIs differ | Payment adapter is isolated; test checkout until contract |
| Missing real photos | Photo slots replaceable from admin |
| Scope growth | Demo and sign-off at the end of each release |
