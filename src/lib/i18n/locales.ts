// Website languages. Russian lives at the root, Tajik under /tj, English under /en.
// "tg" is the ISO code for Tajik (html lang, hreflang); "tj" is the address people recognise.

export const LANGS = ["ru", "tg", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "ru";

export const PREFIX: Record<Lang, string> = { ru: "", tg: "/tj", en: "/en" };
export const LANG_LABEL: Record<Lang, string> = { ru: "Рус", tg: "Тоҷ", en: "Eng" };
export const LANG_CODE: Record<Lang, string> = { ru: "RU", tg: "TJ", en: "EN" };
export const LANG_NAME: Record<Lang, string> = { ru: "Русский", tg: "Тоҷикӣ", en: "English" };
/** Header set by the proxy for /tj/… and /en/… requests */
export const LANG_HEADER = "x-mj-lang";

export const isLang = (v: unknown): v is Lang => typeof v === "string" && (LANGS as readonly string[]).includes(v);
export const asLang = (v: unknown): Lang => (isLang(v) ? v : DEFAULT_LANG);

/** "/tj/mastera/mira" → { lang: "tg", path: "/mastera/mira" } */
export function splitLocalePath(pathname: string): { lang: Lang; path: string } {
  for (const lang of LANGS) {
    const p = PREFIX[lang];
    if (p && (pathname === p || pathname.startsWith(`${p}/`))) return { lang, path: pathname.slice(p.length) || "/" };
  }
  return { lang: DEFAULT_LANG, path: pathname };
}

/** ("en", "/mastera") → "/en/mastera"; ("en", "/#zapis") → "/en#zapis"; ("ru", "/") → "/" */
export function localePath(lang: Lang, path: string): string {
  const p = PREFIX[lang];
  if (!p) return path;
  if (path === "/") return p;
  if (path.startsWith("/#") || path.startsWith("/?")) return p + path.slice(1);
  return p + path;
}

/** Telegram's language_code → bot language */
export function langFromTelegram(code?: string): Lang {
  if (!code) return DEFAULT_LANG;
  if (code.startsWith("tg")) return "tg";
  if (code.startsWith("ru") || code.startsWith("uk") || code.startsWith("be") || code.startsWith("kk") || code.startsWith("uz") || code.startsWith("ky")) return "ru";
  return "en";
}
