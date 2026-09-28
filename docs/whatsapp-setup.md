# WhatsApp for Mavzunai Jovid — setup guide

The platform sends WhatsApp messages through Meta's **WhatsApp Business Platform — Cloud API**. It is hosted by Meta: no provider (BSP) or extra server is needed, and there is no monthly fee. Meta charges per delivered *template* message (see "Costs"). Everything on the platform side is ready. The steps below are what the salon does once in Meta.

## What you need before starting

| | |
|---|---|
| Facebook account | The owner's personal account; it becomes the admin of the business portfolio. |
| Business documents | For **Business verification**: registration certificate (свидетельство о регистрации / ИНН) and a document with the address (utility bill or bank statement). The business name and address must match what you enter. |
| A phone number for the API | It receives one SMS or call for verification. **A number connected to the Cloud API stops working in the regular WhatsApp / WhatsApp Business app.** Either use a new number, or move +992 98 103 11 11 knowing the salon will then answer guests from the CMS/Telegram (the platform forwards every guest message to reception) instead of the phone app. |
| Website domain | `SITE_DOMAIN` with HTTPS (Caddy does this automatically) — Meta sends webhooks there. |
| Bank card | Added in WhatsApp Manager to pay for template messages. |

## Steps

1. **Business portfolio.** Go to <https://business.facebook.com> → create a portfolio named *Mavzunai Jovid* (legal name as in the documents).
2. **App with WhatsApp.** Go to <https://developers.facebook.com> → *My Apps* → *Create app* → use case *Other* → type *Business* → attach the portfolio. In the app, *Add product* → **WhatsApp** → *Set up*. Meta creates a **WhatsApp Business Account (WABA)** with a free test number.
3. **Salon number.** Open *WhatsApp → API Setup* → *Add phone number*. Enter the display name **Mavzunai Jovid** (Meta reviews it), category *Beauty, cosmetic & personal care*, then confirm the number by SMS or call. Remove it from the WhatsApp app beforehand if it was used there.
4. **IDs.** On the same page, copy:
   - *Phone number ID* → `WHATSAPP_PHONE_ID`
   - *WhatsApp Business Account ID* → `WHATSAPP_WABA_ID`
5. **Permanent token.** Go to business.facebook.com → *Settings → Users → System users* → *Add* (role *Admin*).
   - *Assign assets*: the app (full control) and the WhatsApp account (full control).
   - *Generate new token* for the app, expiry **Never**, permissions `whatsapp_business_messaging` and `whatsapp_business_management`.
   - Copy it → `WHATSAPP_TOKEN`.
6. **App secret.** Go to the app → *App settings → Basic* → *App secret* → `WHATSAPP_APP_SECRET`.
7. **Verify token.** Invent any long random string → `WHATSAPP_VERIFY_TOKEN`.
8. **Server.** Add the five values to `.env` on the VPS. Optionally add `WHATSAPP_TEST_TO`, the number that receives test messages. Then run `docker compose up -d`.
9. **Webhook.** Go to the app → *WhatsApp → Configuration* → *Callback URL* `https://<SITE_DOMAIN>/api/whatsapp/webhook`, *Verify token* = `WHATSAPP_VERIFY_TOKEN` → *Verify and save*. Under *Webhook fields*, subscribe to **messages**.
10. **Templates.** In the CMS go to *Интеграции → Шаблоны сообщений → **Отправить шаблоны в Meta***. This submits all ten templates below (5 messages × Russian and English). Their status shows in the same table. Review usually takes minutes to a day. Nothing needs to be typed in Meta by hand.
11. **Payment.** In WhatsApp Manager → *Payment settings*, add the card.
12. **Business verification.** Go to business.facebook.com → *Security center* → *Start verification* and upload the documents. Until verified, Meta limits how many guests you can message first per day (a few hundred), and the display name may not show.
13. **Go live.** In the CMS go to *Интеграции → WhatsApp* → **Тест**. This sends Meta's built-in `hello_world` to `WHATSAPP_TEST_TO`. Press *Доставить сейчас* and check the phone. Then switch to **Живой**.

## Templates the platform uses

Parameters `{{1}}`, `{{2}}`… are filled in automatically. Guests who speak Tajik receive the Russian version in WhatsApp. In Telegram and on the website everything is in Tajik.

| Name | Category | Russian | English |
|---|---|---|---|
| `mj_booking_confirmation` | Utility | Mavzunai Jovid: {{1}}, вы записаны — {{2}}, {{3}}, мастер {{4}}. Ждём вас по адресу: ул. Бухоро, 23/25, Душанбе. Если планы изменятся, просто ответьте на это сообщение. | Mavzunai Jovid: {{1}}, you're booked — {{2}}, {{3}}, with {{4}}. We're at 23/25 Bukhoro St, Dushanbe. If your plans change, just reply to this message. |
| `mj_reminder_day` | Utility | Mavzunai Jovid: напоминаем о записи — {{1}}, {{2}}, мастер {{3}}. ул. Бухоро, 23/25. Если планы изменились, ответьте на это сообщение, и мы перенесём визит. | Mavzunai Jovid: a reminder of your booking — {{1}}, {{2}} with {{3}}. 23/25 Bukhoro St. If your plans have changed, reply to this message and we'll move your visit. |
| `mj_reminder_hours` | Utility | Mavzunai Jovid: ждём вас сегодня в {{1}} — {{2}}, мастер {{3}}. ул. Бухоро, 23/25, Душанбе. | Mavzunai Jovid: see you today at {{1}} — {{2}} with {{3}}. 23/25 Bukhoro St, Dushanbe. |
| `mj_birthday` | Marketing | Mavzunai Jovid: {{1}}, с днём рождения! Дарим вам {{2}} бонусов — ими можно оплатить до {{3}}% визита. Ждём вас в салоне на ул. Бухоро, 23/25. | Mavzunai Jovid: happy birthday, {{1}}! Here are {{2}} bonus points from us — use them for up to {{3}}% of a visit. See you at 23/25 Bukhoro St. |
| `mj_login_code` | Authentication | Text fixed by Meta: «{{1}} — ваш код подтверждения…» + button «Скопировать код» | “{{1}} is your verification code…” + “Copy code” button |

The texts live in `src/lib/whatsapp-templates.ts`. If Meta rejects one, change its text there, keeping the name and the order of the parameters, and press the button again. You can also edit it in WhatsApp Manager.

## Costs

- Meta charges per delivered template message. The price depends on the category (authentication and utility are the cheapest; marketing is the most expensive) and on the guest's country. Check the current rate card: <https://developers.facebook.com/docs/whatsapp/pricing>.
- `mj_birthday` is a *Marketing* template (Meta's rules: a greeting with a gift is promotional). It costs more than the others and a guest can mute marketing messages from the salon in WhatsApp. If you'd rather not pay for it, set «Подарок ко дню рождения» to 0 in CMS → Бонусы и акции — the points and greeting are then skipped.
- Replies to a guest within 24 hours of her last message are free-form and free.
- The platform uses WhatsApp only for guests without the Telegram bot. Telegram is free, so the more guests use the bot, the lower the bill.

## When something goes wrong

| Symptom | Cause |
|---|---|
| Outbox: *131047 Re-engagement message* | More than 24 h since the guest wrote, and the message was not a template. Templates must be approved. |
| Outbox: *132001 Template name does not exist* | The template is not approved yet (see the status table). |
| Outbox: *190 / OAuthException* | The token expired or lacks permissions — generate a permanent system-user token (step 5). |
| Guest messages don't reach reception | Webhook not verified or not subscribed to **messages** (step 9); `WHATSAPP_APP_SECRET` wrong (the server answers 401). |
