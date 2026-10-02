/** Absolute site address for links in messages (the bot, WhatsApp) */
export function siteUrl(): string {
  const d = (process.env.SITE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return d && d !== "localhost" ? `https://${d}` : "http://localhost:3000";
}

/** Link to a page in the guest's language (/tj/…, /en/…) */
export function siteLink(path: string, lang: string): string {
  return `${siteUrl()}${lang === "tg" ? "/tj" : lang === "en" ? "/en" : ""}${path}`;
}

/** t.me address of the bot, once TELEGRAM_BOT_USERNAME is set (step 1 of the rollout). */
export function botLink(): string | null {
  const name = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
  return name && /^\w{5,}$/.test(name) ? `https://t.me/${name}` : null;
}

/**
 * Where a guest manages her own bookings. The bot when it is live — a guest who opens it
 * becomes reachable in Telegram for free, which is the whole point of putting this link in
 * the confirmation she gets over paid WhatsApp. Her account on the site until then.
 * Never returns an empty string: Meta rejects a template parameter with no value.
 */
export function selfServiceLink(lang: string): string {
  return botLink() ?? siteLink("/kabinet", lang);
}
