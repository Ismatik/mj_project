import Link from "next/link";
import type { Metadata } from "next";
import { Gallery } from "@/components/site/Gallery";
import { SitePage } from "@/components/site/SiteChrome";
import s from "@/components/site/site.module.css";
import { todayYmd } from "@/lib/time";
import { getCurrentGuest } from "@/server/guest-auth";
import { getPortfolio } from "@/server/masters";
import { getSiteContent } from "@/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteContent("published");
  return { title: `${c.team.portfolioTitle} — Mavzunai Jovid`, description: c.team.portfolioIntro };
}

export default async function PortfolioPage() {
  const c = await getSiteContent("published");
  const [{ works, categories, masters }, guest] = await Promise.all([getPortfolio(c), getCurrentGuest()]);
  const withWorks = masters.filter((m) => m.portfolio.length).map((m) => ({ slug: m.slug, name: m.name }));

  return (
    <SitePage c={c} guest={guest} current="portfolio" year={todayYmd().slice(0, 4)}>
      <section className={s.portfolioSection} aria-labelledby="page-title">
        <h1 id="page-title" data-reveal className={`${s.h2} ${s.center}`}>
          {c.team.portfolioTitle}
        </h1>
        <div className={s.rule} />
        <p data-reveal className={s.pageIntro}>
          {c.team.portfolioIntro}
        </p>
        <div className={s.galleryWrap}>
          <Gallery works={works} categories={categories} masters={withWorks} />
        </div>
        <div className={s.teamLinks}>
          <Link href="/mastera" className={s.textLink}>
            Наши мастера →
          </Link>
          <Link href="/#zapis" className={s.textLink}>
            Онлайн-запись →
          </Link>
        </div>
      </section>
    </SitePage>
  );
}
