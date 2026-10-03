// Blog articles: a small, safe markup (no HTML), slugs, reading time. Pure.
import type { Lang } from "./i18n/locales";

export type Inline = { t: "text"; v: string } | { t: "b"; v: string } | { t: "a"; v: string; href: string };
export type Block = { t: "h2"; v: string } | { t: "p"; v: Inline[] } | { t: "ul"; items: Inline[][] } | { t: "quote"; v: Inline[] };

/** Only web links and site paths - nothing that could run script */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\/[^\s]+$/i.test(h)) return h;
  if (/^\/(?!\/)[^\s]*$/.test(h)) return h;
  if (/^(tel:\+?[\d\s-]+|mailto:[^\s@]+@[^\s@]+)$/i.test(h)) return h.replace(/\s/g, "");
  return null;
}

/** **bold** and [text](link); everything else is plain text */
export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: "b", v: m[1] });
    else {
      const href = safeHref(m[3]!);
      out.push(href ? { t: "a", v: m[2]!, href } : { t: "text", v: m[2]! });
    }
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

export function parseBody(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  let list: Inline[][] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: "p", v: parseInline(para.join(" ")) });
    if (list.length) blocks.push({ t: "ul", items: list });
    para = [];
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^#{2,3}\s+/.test(line)) {
      flush();
      blocks.push({ t: "h2", v: line.replace(/^#{2,3}\s+/, "") });
    } else if (/^[-•*]\s+/.test(line)) {
      if (para.length) {
        blocks.push({ t: "p", v: parseInline(para.join(" ")) });
        para = [];
      }
      list.push(parseInline(line.replace(/^[-•*]\s+/, "")));
    } else if (line.startsWith("> ")) {
      flush();
      blocks.push({ t: "quote", v: parseInline(line.slice(2)) });
    } else {
      if (list.length) {
        blocks.push({ t: "ul", items: list });
        list = [];
      }
      para.push(line);
    }
  }
  flush();
  return blocks;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "gh", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", ӣ: "i", й: "y", к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ӯ: "u", ф: "f", х: "kh", ҳ: "h", ц: "ts", ч: "ch", ҷ: "j", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** "Уход за волосами осенью" → "ukhod-za-volosami-osenyu" */
export function slugify(title: string): string {
  const s = [...title.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("");
  return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "post";
}

export const isSlug = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 80;

/** Minutes to read, at about 180 words a minute */
export const readingMinutes = (body: string) => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 180));

export type PostText = { title: string; excerpt: string; body: string };
export type PostI18n = Partial<Record<Exclude<Lang, "ru">, Partial<PostText>>>;

/** The post in a language; empty translations fall back to Russian */
export function postIn(p: PostText & { i18n: unknown }, lang: Lang): PostText {
  if (lang === "ru") return { title: p.title, excerpt: p.excerpt, body: p.body };
  const tr = ((p.i18n ?? {}) as PostI18n)[lang] ?? {};
  const pick = (k: keyof PostText) => (typeof tr[k] === "string" && tr[k]!.trim() ? tr[k]! : p[k]);
  return { title: pick("title"), excerpt: pick("excerpt"), body: pick("body") };
}
