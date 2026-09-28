/* eslint-disable @next/next/no-img-element -- cover is an upload or an external link */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogBody } from "@/components/site/BlogBody";
import { BlogCards } from "@/components/site/BlogCards";
import { SitePage } from "@/components/site/SiteChrome";
import s from "@/components/site/blog.module.css";
import { canUseSiteAdmin } from "@/lib/access";
import { localize, nameIn } from "@/lib/i18n/content";
import { blogDict } from "@/lib/i18n/dict-blog";
import { dayMonthYear } from "@/lib/i18n/format";
import { localePath } from "@/lib/i18n/locales";
import { todayYmd } from "@/lib/time";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";
import { postBySlug } from "@/server/blog";
import { getCurrentGuest } from "@/server/guest-auth";
import { alternates, getLang } from "@/server/lang";
import { getSiteContent } from "@/server/site";

export const dynamic = "force-dynamic";

async function load(slug: string, preview: boolean) {
  const lang = await getLang();
  const user = preview ? await getCurrentUser() : null;
  return { lang, found: await postBySlug(slug, lang, !!user && canUseSiteAdmin(user.role)) };
}

export async function generateMetadata({ params, searchParams }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { lang, found } = await load(slug, (await searchParams).preview === "1");
  if (!found) return {};
  const p = found.post;
  return {
    title: `${p.title} — Mavzunai Jovid`,
    description: p.excerpt || undefined,
    alternates: alternates(lang, `/blog/${p.slug}`),
    openGraph: { title: p.title, description: p.excerpt || undefined, type: "article", images: p.coverUrl ? [p.coverUrl] : undefined },
    ...(p.status !== "PUBLISHED" ? { robots: { index: false } } : {}),
  };
}

export default async function BlogPostPage({ params, searchParams }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const { lang, found } = await load(slug, (await searchParams).preview === "1");
  if (!found) notFound();
  const { post: p, more } = found;
  const t = blogDict(lang).blog;
  const [raw, guest, service] = await Promise.all([getSiteContent("published"), getCurrentGuest(), p.serviceId ? db.service.findFirst({ where: { id: p.serviceId, active: true, showOnSite: true } }) : null]);
  const bookHref = service ? `${localePath(lang, "/")}?service=${service.id}#zapis` : `${localePath(lang, "/")}#zapis`;
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.excerpt, datePublished: p.publishedAt.toISOString(), inLanguage: lang === "tg" ? "tg" : lang, author: { "@type": "Organization", name: "Mavzunai Jovid" }, ...(p.coverUrl ? { image: p.coverUrl } : {}) };
  return (
    <SitePage c={localize(raw, lang)} guest={guest} lang={lang} path={`/blog/${p.slug}`} current="home" year={todayYmd().slice(0, 4)}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className={s.section}>
        {p.status !== "PUBLISHED" && <div className={s.draft}>{t.draft}</div>}
        <article className={s.article} aria-labelledby="post-title">
          <div className={s.head}>
            <div className={s.kicker}>
              {dayMonthYear(p.publishedAt, lang)} · {t.minutes(p.minutes)}
            </div>
            <h1 id="post-title" className={s.title}>
              {p.title}
            </h1>
            <div className={s.rule} />
            {p.excerpt && <p className={s.lead}>{p.excerpt}</p>}
          </div>
          {p.coverUrl && (
            <figure className={s.articleCover}>
              <img src={p.coverUrl} alt="" />
            </figure>
          )}
          <BlogBody text={p.body} />
          <div className={s.cta}>
            <Link href={bookHref} className={s.btn}>
              {service ? t.bookService(nameIn(raw, lang, "services", service.id, service.name)) : t.book}
            </Link>
            <Link href={localePath(lang, "/blog")} className={s.ghost}>
              {t.back}
            </Link>
          </div>
        </article>
        {more.length > 0 && (
          <>
            <h2 className={s.moreTitle}>{t.more}</h2>
            <BlogCards posts={more} lang={lang} />
          </>
        )}
      </section>
    </SitePage>
  );
}
