import Link from "next/link";
import type { Metadata } from "next";
import { MasterCard } from "@/components/site/MasterCard";
import { SitePage } from "@/components/site/SiteChrome";
import s from "@/components/site/site.module.css";
import { localize } from "@/lib/i18n/content";
import { dict } from "@/lib/i18n/dict";
import { localePath } from "@/lib/i18n/locales";
import { todayYmd } from "@/lib/time";
import { getCurrentGuest } from "@/server/guest-auth";
import { alternates, getLang } from "@/server/lang";
import { getSiteMasters } from "@/server/masters";
import { getSiteContent } from "@/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const c = localize(await getSiteContent("published"), lang);
  return { title: `${c.team.title} - Mavzunai Jovid`, description: c.team.intro, alternates: alternates(lang, "/mastera") };
}

export default async function MastersPage() {
  const lang = await getLang();
  const t = dict(lang);
  const c = localize(await getSiteContent("published"), lang);
  const [masters, guest] = await Promise.all([getSiteMasters(c, lang), getCurrentGuest()]);
  const favourite = guest?.favouriteStaffId ?? null;

  return (
    <SitePage c={c} guest={guest} lang={lang} path="/mastera" current="masters" year={todayYmd().slice(0, 4)}>
      <section className={s.light} aria-labelledby="page-title">
        <h1 id="page-title" data-reveal className={`${s.h2} ${s.center}`}>
          {c.team.title}
        </h1>
        <div className={s.rule} />
        <p data-reveal className={s.pageIntro}>
          {c.team.intro}
        </p>
        <div className={s.teamGrid}>
          {masters.map((m) => (
            <MasterCard key={m.id} m={m} lang={lang} favourite={m.id === favourite} />
          ))}
        </div>
        <div className={s.teamLinks}>
          <Link href={localePath(lang, "/portfolio")} className={s.textLink}>
            {t.home.portfolioLink}
          </Link>
          <Link href={localePath(lang, "/#zapis")} className={s.textLink}>
            {t.masters.onlineBooking}
          </Link>
        </div>
      </section>
    </SitePage>
  );
}
