import type { Metadata } from "next";
import Link from "next/link";
import { BlogCards } from "@/components/site/BlogCards";
import { SitePage } from "@/components/site/SiteChrome";
import s from "@/components/site/blog.module.css";
import { localize } from "@/lib/i18n/content";
import { blogDict } from "@/lib/i18n/dict-blog";
import { localePath } from "@/lib/i18n/locales";
import { todayYmd } from "@/lib/time";
import { blogTags, publishedPosts } from "@/server/blog";
import { getCurrentGuest } from "@/server/guest-auth";
import { alternates, getLang } from "@/server/lang";
import { getSiteContent } from "@/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const t = blogDict(lang).blog;
  return { title: `${t.title} - Mavzunai Jovid`, description: t.intro, alternates: alternates(lang, "/blog") };
}

// Beauty tips and articles written in the site admin.
export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const lang = await getLang();
  const t = blogDict(lang).blog;
  const sp = await searchParams;
  const tag = typeof sp.tag === "string" ? sp.tag : null;
  const [raw, guest, posts, tags] = await Promise.all([getSiteContent("published"), getCurrentGuest(), publishedPosts(lang, { tag }), blogTags()]);
  return (
    <SitePage c={localize(raw, lang)} guest={guest} lang={lang} path="/blog" current="home" year={todayYmd().slice(0, 4)}>
      <section className={s.section} aria-labelledby="blog-title">
        <div className={s.head}>
          <div className={s.kicker}>Mavzunai Jovid</div>
          <h1 id="blog-title" className={s.title}>
            {t.title}
          </h1>
          <div className={s.rule} />
          <p className={s.lead}>{t.intro}</p>
          {tags.length > 1 && (
            <nav className={s.tags} aria-label="Темы">
              <Link href={localePath(lang, "/blog")} aria-current={!tag ? "true" : undefined}>
                {t.all}
              </Link>
              {tags.map((x) => (
                <Link key={x} href={`${localePath(lang, "/blog")}?tag=${encodeURIComponent(x)}`} aria-current={tag === x ? "true" : undefined}>
                  {x}
                </Link>
              ))}
            </nav>
          )}
        </div>
        {posts.length ? <BlogCards posts={posts} lang={lang} /> : <p className={s.lead} style={{ textAlign: "center" }}>{t.empty}</p>}
      </section>
    </SitePage>
  );
}
