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

Notes:

- `BASE_URL` points the suites at another address (for example the Docker stack behind Caddy); `OUT` sets the screenshot folder (`e2e-output`).
- The CMS suites expect a working day: on Mondays (the salon's day off) the "today" checks have nothing to show.
- The website form is rate-limited per address; restart the app if you run the suites many times within an hour.
