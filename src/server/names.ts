import "server-only";
import { nameIn, type Names } from "@/lib/i18n/content";
import type { Lang } from "@/lib/i18n/locales";
import { getSiteContent } from "./site";

export type Namer = (kind: keyof Names, id: string | null | undefined, fallback: string) => string;

/** Translates CMS names (services, categories, masters) using the published site content. */
export async function namerFor(lang: Lang): Promise<Namer> {
  if (lang === "ru") return (_k, _id, fallback) => fallback;
  const c = await getSiteContent("published");
  return (kind, id, fallback) => (id ? nameIn(c, lang, kind, id, fallback) : fallback);
}
