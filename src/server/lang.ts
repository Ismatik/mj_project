import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { asLang, LANG_HEADER, LANGS, localePath, type Lang } from "@/lib/i18n/locales";

/** Language of the current website request (set by the proxy for /tj and /en). */
export const getLang = cache(async (): Promise<Lang> => asLang((await headers()).get(LANG_HEADER)));

/** hreflang alternates for a website path, for page metadata */
export function alternates(lang: Lang, path: string) {
  return {
    canonical: localePath(lang, path),
    languages: Object.fromEntries([...LANGS.map((l) => [l, localePath(l, path)]), ["x-default", path]]),
  };
}
