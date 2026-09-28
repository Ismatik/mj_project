# Instagram feed — setup

The home page shows a strip of the salon's latest Instagram posts. The platform uses Meta's **Instagram API with Instagram Login**. It reads the salon's own posts; nothing is posted on its behalf. Until it is connected, the strip shows photos from the masters' portfolio with a link to the profile (mock mode).

## What you need

| | |
|---|---|
| Instagram account | @mavzunai.jovid.official switched to a **professional** account (Business or Creator): Instagram app → Settings → Account type and tools → Switch to professional account. Free. |
| Meta developer account | developers.facebook.com, signed in with the owner's Facebook account (the same one as for WhatsApp is fine). |

## Steps

1. **App.** developers.facebook.com → *My Apps* → *Create app* → type **Business**. You can reuse the WhatsApp app.
2. **Product.** In the app, *Add product* → **Instagram** → *API setup with Instagram login*.
3. **Add the account.** *Generate access tokens* → *Add account* → sign in to @mavzunai.jovid.official and allow access. The permission needed is **instagram_business_basic**.
4. **Token.** Press *Generate token* next to the account and copy it. It is a **long-lived token** (60 days). The platform refreshes it every week on its own and keeps the new one in the database, so you set it only once.
5. **Server.** Put it in `.env` as `INSTAGRAM_TOKEN=…` and restart (`docker compose up -d`).
6. **Switch on.** CMS → Интеграции → Instagram → **Живой** → **Обновить ленту**. The card shows when the feed was fetched and how many posts came. After that the worker refreshes it every hour.

App review is not needed: the app only reads the account that authorised it. Keep the app in *Live* mode so the token does not expire with a development app.

## When something goes wrong

| On the Instagram card | What to do |
|---|---|
| *Error validating access token* / *Session has expired* | The token was not refreshed for 60 days (the worker was stopped). Generate a new one (step 4), put it in `.env`, restart, press «Обновить ленту». |
| *(#10) Application does not have permission* | The account was not added in step 3, or it is a personal account — switch it to professional. |
| Feed loads but some posts are missing | Carousels show their first image; posts without an image are skipped. Only the latest 18 are fetched and 6 are shown. |
