/* eslint-disable @next/next/no-img-element -- covers are uploads or external links */
import Link from "next/link";
import { blogDict } from "@/lib/i18n/dict-blog";
import { dayMonthYear } from "@/lib/i18n/format";
import { localePath, type Lang } from "@/lib/i18n/locales";
import type { PostView } from "@/server/blog";
import s from "./blog.module.css";

export function BlogCards({ posts, lang }: { posts: PostView[]; lang: Lang }) {
  const t = blogDict(lang).blog;
  return (
    <div className={s.grid}>
      {posts.map((p) => (
        <Link key={p.id} href={localePath(lang, `/blog/${p.slug}`)} className={s.card} data-reveal>
          <div className={s.cover}>{p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" />}</div>
          <div className={s.cardBody}>
            <div className={s.meta}>
              {dayMonthYear(p.publishedAt, lang)} · {t.minutes(p.minutes)}
            </div>
            <h3 className={s.cardTitle}>{p.title}</h3>
            {p.excerpt && <p className={s.excerpt}>{p.excerpt}</p>}
            <span className={s.readMore}>{t.read} →</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
