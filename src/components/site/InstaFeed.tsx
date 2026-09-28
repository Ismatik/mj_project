/* eslint-disable @next/next/no-img-element -- Instagram CDN / portfolio images */
import { blogDict } from "@/lib/i18n/dict-blog";
import type { Lang } from "@/lib/i18n/locales";
import { shortCaption, type InstaPost } from "@/lib/instagram";
import { instagramLink } from "@/lib/site-content";
import s from "./insta.module.css";

export function InstaFeed({ posts, handle, lang }: { posts: InstaPost[]; handle: string; lang: Lang }) {
  const t = blogDict(lang).insta;
  if (!posts.length) return null;
  const h = handle.replace(/^@/, "");
  return (
    <section id="instagram" className={s.section} aria-labelledby="insta-title">
      <h2 id="insta-title" className={s.title} data-reveal>
        {t.title}
      </h2>
      <div className={s.rule} />
      <div className={s.grid}>
        {posts.map((p) => (
          <a key={p.id} href={p.permalink} target="_blank" rel="noopener noreferrer" className={s.tile} data-reveal>
            <img src={p.image} alt={shortCaption(p.caption) || `@${h}`} loading="lazy" referrerPolicy="no-referrer" />
            {p.caption && <span className={s.caption}>{shortCaption(p.caption)}</span>}
          </a>
        ))}
      </div>
      <a href={instagramLink(h)} target="_blank" rel="noopener noreferrer" className={s.follow}>
        {t.follow(h)}
      </a>
    </section>
  );
}
