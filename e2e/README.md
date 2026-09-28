# Browser tests

End-to-end checks of the CMS, the website and the site admin, driven by Playwright (Chromium).

```bash
npx playwright install chromium   # once per machine
npm run build && npm start        # app on http://localhost:3000
npm run e2e                       # re-seeds the demo data before each suite
```

| Suite | Covers |
|---|---|
| `01-access.mjs` | sign-in, roles and page access, header search, "+ Новая запись" with day-off and clash checks, mobile menu |
| `02-cms.mjs` | POS payment reaches the dashboard, paying a booking, calendar status, guest card, prices, dress rental, schedule, analytics, settings |
| `03-website-admin.mjs` | website loader and effects, callback request reaches the CMS, admin draft → preview → publish (price hidden on the site), photo upload checks |
| `04-online-booking.mjs` | a guest books a real time slot on a phone and reception sees it in the calendar on another device; integrations and outbox |
| `05-telegram-bot.mjs` | the Telegram bot in the CMS simulator: booking, calendar entry, reschedule, cancel, staff chat, webhook security |
| `06-guest-account.mjs` | masters and portfolio pages, sign-in by code (wrong code, resend limit, first-time guest), reschedule, cancel, rebook with pre-filled form, favourite master, mobile menu, hiding a master and adding works in the admin |
| `07-languages-whatsapp.mjs` | Tajik and English pages, hreflang and language switch, an English booking and account, translating texts and a service name in the admin, editing a message template, submitting the WhatsApp templates to Meta, the bot's language picker, WhatsApp live mode against a local stand-in for Meta's API (template message, parameters, token), webhook verification and signature, delivery failure, a guest's message forwarded with one auto-reply |
| `08-payments-certificates.mjs` | a certificate bought on the site (test checkout, PDF, balance page), a cancelled English purchase, a Tajik PDF, online booking with a prepayment (paid) and one left unpaid (released), reception alerts, selling at the till, a receipt with a prepayment, paying with a certificate, an already used certificate, the bot's prepayment link |
| `09-bonus-promotions.mjs` | offers on the site (RU/EN) and the reduced price in online booking, a promo code in the booking form and at the till, paying with points and earning them, the guest card (history, points added by the owner), creating an offer in the CMS, points in the account, offers and points in the bot, birthday points given once |
| `10-payroll-shifts-reports.mjs` | a cash receipt and cash taken out in the shift, changing a master's percent, a bonus and a transfer in payroll, a salary advance from the till, closing the shift with a shortfall (Z-report PDF, alert, no cash changes after), reports for today in Excel and PDF, what a master and reception may see |

Notes:

- `BASE_URL` points the suites at another address (for example the Docker stack behind Caddy); `OUT` sets the screenshot folder (`e2e-output`).
- The CMS suites expect a working day: on Mondays (the salon's day off) the "today" checks have nothing to show.
- Suite 06 reads the sign-in code from the screen: run the app in development or with `DEMO_LOGIN_CODES=1`.
- Suite 07 starts its own stand-in for Meta's Graph API on port 3999. Start the app with
  `WHATSAPP_TOKEN=test-token WHATSAPP_PHONE_ID=10001 WHATSAPP_APP_SECRET=test-app-secret WHATSAPP_VERIFY_TOKEN=test-verify WHATSAPP_API_BASE=http://127.0.0.1:3999 WHATSAPP_WABA_ID=20002 DEMO_LOGIN_CODES=1`.
- Suites 08, 09 and 10 need `DATABASE_URL` (08 moves one payment deadline into the past with `psql`; 09 reads balances and runs the birthday job with `npx tsx`).
- The website form is rate-limited per address; restart the app if you run the suites many times within an hour.
