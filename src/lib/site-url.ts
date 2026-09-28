/** Absolute site address for links in messages (the bot, WhatsApp) */
export function siteUrl(): string {
  const d = (process.env.SITE_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return d && d !== "localhost" ? `https://${d}` : "http://localhost:3000";
}

/** Link to a page in the guest's language (/tj/…, /en/…) */
export function siteLink(path: string, lang: string): string {
  return `${siteUrl()}${lang === "tg" ? "/tj" : lang === "en" ? "/en" : ""}${path}`;
}
