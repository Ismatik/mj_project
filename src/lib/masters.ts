// Masters on the website: profile texts and portfolio live in the site content (edited in /admin),
// names, titles and services come from the CMS.
import type { SitePhoto } from "./site-content";

export type PortfolioItem = {
  id: string;
  url: string;
  caption: string;
  /** ServiceCategory slug (hair, nails, brows, makeup…) for the portfolio filter */
  category: string;
};

export type MasterProfile = {
  visible: boolean;
  /** Custom URL part; empty = from the name ("Мира" → "mira") */
  slug: string;
  /** Short line under the name; empty = the title from the CMS */
  specialty: string;
  bio: string;
  photo?: SitePhoto;
  portfolio: PortfolioItem[];
};

export const EMPTY_PROFILE: MasterProfile = { visible: true, slug: "", specialty: "", bio: "", portfolio: [] };

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "gh", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", ӣ: "i", й: "y", к: "k", қ: "q",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ӯ: "u", ф: "f", х: "kh", ҳ: "h", ц: "ts", ч: "ch",
  ҷ: "j", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** "Мавзуна Джовид" → "mavzuna-dzhovid". Latin letters and digits pass through. */
export function slugify(text: string): string {
  return [...text.toLowerCase()]
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Unique URL slugs for every master, in the given order (a duplicate gets "-2", "-3"). */
export function masterSlugs(staff: { id: string; name: string }[], profiles: Record<string, MasterProfile>): Map<string, string> {
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const m of staff) {
    const base = slugify(profiles[m.id]?.slug || m.name) || "master";
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    out.set(m.id, slug);
  }
  return out;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Shape-checks stored profiles (unknown fields dropped, strings clipped). Photo URLs are checked by the admin action. */
export function normalizeMasters(raw: unknown): Record<string, MasterProfile> {
  if (!isObj(raw)) return {};
  const out: Record<string, MasterProfile> = {};
  for (const [id, v] of Object.entries(raw).slice(0, 60)) {
    if (!isObj(v)) continue;
    const photo = isObj(v.photo) && typeof v.photo.url === "string" ? { url: v.photo.url, credit: str(v.photo.credit, 200) || undefined } : undefined;
    out[id.slice(0, 40)] = {
      visible: v.visible !== false,
      slug: slugify(str(v.slug, 40)),
      specialty: str(v.specialty, 120),
      bio: str(v.bio, 1500),
      photo,
      portfolio: (Array.isArray(v.portfolio) ? v.portfolio : [])
        .filter((p): p is Record<string, unknown> => isObj(p) && typeof p.url === "string")
        .slice(0, 60)
        .map((p, i) => ({ id: str(p.id, 40) || `p${i}`, url: str(p.url, 500), caption: str(p.caption, 160), category: str(p.category, 40) })),
    };
  }
  return out;
}
