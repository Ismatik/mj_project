// Translations of the admin-edited site content. Russian is the full document; Tajik and English are overlays
// that hold only what was translated — anything missing falls back to Russian.
import type { Lang } from "./locales";

/** Names of CMS entities (services, categories, masters) in another language, by id */
export type Names = { services: Record<string, string>; categories: Record<string, string>; staff: Record<string, string> };
export type Overlay = { [key: string]: unknown; names?: Names };
export type Translations = { tg: Overlay; en: Overlay };

export const EMPTY_NAMES: Names = { services: {}, categories: {}, staff: {} };

/** Never translated: links, ids, switches, phone numbers, author names */
const SKIP = new Set([
  "i18n",
  "names",
  "photos",
  "photo",
  "url",
  "credit",
  "creditUrl",
  "id",
  "slug",
  "visible",
  "category",
  "serviceOverrides",
  "phone",
  "whatsapp",
  "instagram",
  "instagramGallery",
  "author",
  "icon",
]);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const hasId = (v: unknown): v is { id: string } => isObj(v) && typeof v.id === "string";
const stringArray = (v: unknown[]) => v.every((x) => typeof x === "string");

/** Base with the overlay's non-empty strings on top (arrays of objects matched by id, otherwise by position). */
export function applyOverlay<T>(base: T, ov: unknown): T {
  if (typeof base === "string") return (typeof ov === "string" && ov.trim() ? ov : base) as T;
  if (Array.isArray(base)) {
    if (!Array.isArray(ov)) return base;
    if (base.length && stringArray(base)) return (ov.length && stringArray(ov) ? ov : base) as T;
    return base.map((b, i) => {
      const o = hasId(b) ? ov.find((x) => hasId(x) && x.id === b.id) : ov[i];
      return o === undefined || o === null ? b : applyOverlay(b, o);
    }) as T;
  }
  if (isObj(base)) {
    if (!isObj(ov)) return base;
    const out: Record<string, unknown> = { ...base };
    for (const k of Object.keys(base)) if (!SKIP.has(k) && k in ov) out[k] = applyOverlay(base[k], ov[k]);
    return out as T;
  }
  return base;
}

/** What differs between an edited translation view and the Russian base — the new overlay. */
export function diffOverlay(view: unknown, base: unknown): unknown {
  if (typeof base === "string") return typeof view === "string" && view.trim() && view !== base ? view : undefined;
  if (Array.isArray(base)) {
    if (!Array.isArray(view)) return undefined;
    if (base.length && stringArray(base)) return stringArray(view) && JSON.stringify(view) !== JSON.stringify(base) ? view : undefined;
    const byId = base.some(hasId);
    const items = view.map((v, i) => {
      const b = byId ? base.find((x) => hasId(x) && hasId(v) && x.id === v.id) : base[i];
      const d = b === undefined ? undefined : diffOverlay(v, b);
      return d === undefined ? undefined : byId ? { ...(d as object), id: (v as { id: string }).id } : d;
    });
    if (!items.some((x) => x !== undefined)) return undefined;
    return byId ? items.filter((x) => x !== undefined) : items.map((x) => x ?? null);
  }
  if (isObj(base)) {
    if (!isObj(view)) return undefined;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(base)) {
      if (SKIP.has(k)) continue;
      const d = diffOverlay(view[k], base[k]);
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

/** Shape-checks a stored overlay: plain strings only (clipped), no links or switches, bounded size. */
export function normalizeOverlay(raw: unknown, depth = 0): Overlay {
  const clean = (v: unknown, d: number): unknown => {
    if (typeof v === "string") return v.slice(0, 2000);
    if (v === null) return null;
    if (d > 6) return undefined;
    if (Array.isArray(v)) return v.slice(0, 60).map((x) => clean(x, d + 1));
    if (isObj(v)) {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v).slice(0, 80)) {
        if (SKIP.has(k) && k !== "id") continue;
        if (k === "id" && typeof x !== "string") continue;
        const c = clean(x, d + 1);
        if (c !== undefined) out[k.slice(0, 40)] = c;
      }
      return out;
    }
    return undefined;
  };
  const out = (isObj(raw) ? clean(raw, depth) : {}) as Overlay;
  const names = isObj(raw) && isObj(raw.names) ? raw.names : {};
  const map = (v: unknown) =>
    Object.fromEntries(
      Object.entries(isObj(v) ? v : {})
        .filter(([, x]) => typeof x === "string" && x.trim())
        .slice(0, 300)
        .map(([k, x]) => [k.slice(0, 40), (x as string).slice(0, 120)]),
    );
  out.names = { services: map(names.services), categories: map(names.categories), staff: map(names.staff) };
  return out;
}

export function normalizeTranslations(raw: unknown, defaults: Translations): Translations {
  const r = isObj(raw) ? raw : {};
  return { tg: normalizeOverlay(r.tg ?? defaults.tg), en: normalizeOverlay(r.en ?? defaults.en) };
}

/** The content in a language: overlay texts on top of Russian. */
export function localize<T extends { i18n: Translations }>(c: T, lang: Lang): T {
  if (lang === "ru") return c;
  return applyOverlay(c, c.i18n[lang]);
}

/** Name of a service / category / master in a language (falls back to the CMS name). */
export function nameIn(c: { i18n: Translations }, lang: Lang, kind: keyof Names, id: string, fallback: string): string {
  if (lang === "ru") return fallback;
  return c.i18n[lang].names?.[kind][id] || fallback;
}
