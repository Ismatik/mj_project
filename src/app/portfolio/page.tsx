import Link from "next/link";
import type { Metadata } from "next";
import { Gallery } from "@/components/site/Gallery";
import { SitePage } from "@/components/site/SiteChrome";
import s from "@/components/site/site.module.css";
import { localize } from "@/lib/i18n/content";
import { dict } from "@/lib/i18n/dict";
import { localePath } from "@/lib/i18n/locales";
import { todayYmd } from "@/lib/time";
import { getCurrentGuest } from "@/server/guest-auth";
import { alternates, getLang } from "@/server/lang";
import { getPortfolio } from "@/server/masters";
import { getSiteContent } from "@/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const c = localize(await getSiteContent("published"), lang);
  return { title: `${c.team.portfolioTitle} — Mavzunai Jovid`, description: c.team.portfolioIntro, alternates: alternates(lang, "/portfolio") };
}

export default async function PortfolioPage() {
  const lang = await getLang();
  const t = dict(lang);
  const c = localize(await getSiteContent("published"), lang);
  const [{ works, categories, masters }, guest] = await Promise.all([getPortfolio(c, lang), getCurrentGuest()]);
  const withWorks = masters.filter((m) => m.portfolio.length).map((m) => ({ slug: m.slug, name: m.name }));

  return (
    <SitePage c={c} guest={guest} lang={lang} path="/portfolio" current="portfolio" year={todayYmd().slice(0, 4)}>
      <section className={s.portfolioSection} aria-labelledby="page-title">
        <h1 id="page-title" data-reveal className={`${s.h2} ${s.center}`}>
          {c.team.portfolioTitle}
        </h1>
        <div className={s.rule} />
        <p data-reveal className={s.pageIntro}>
          {c.team.portfolioIntro}
        </p>
        <div className={s.galleryWrap}>
          <Gallery works={works} categories={categories} masters={withWorks} lang={lang} />
        </div>
        <div className={s.teamLinks}>
          <Link href={localePath(lang, "/mastera")} className={s.textLink}>
            {t.masters.ourMasters}
          </Link>
          <Link href={localePath(lang, "/#zapis")} className={s.textLink}>
            {t.masters.onlineBooking}
          </Link>
        </div>
      </section>
    </SitePage>
  );
}
