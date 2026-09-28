import Link from "next/link";
import type { Metadata } from "next";
import { MasterCard } from "@/components/site/MasterCard";
import { SitePage } from "@/components/site/SiteChrome";
import s from "@/components/site/site.module.css";
import { todayYmd } from "@/lib/time";
import { getCurrentGuest } from "@/server/guest-auth";
import { getSiteMasters } from "@/server/masters";
import { getSiteContent } from "@/server/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteContent("published");
  return { title: `${c.team.title} — Mavzunai Jovid`, description: c.team.intro };
}

export default async function MastersPage() {
  const c = await getSiteContent("published");
  const [masters, guest] = await Promise.all([getSiteMasters(c), getCurrentGuest()]);
  const favourite = guest?.favouriteStaffId ?? null;

  return (
    <SitePage c={c} guest={guest} current="masters" year={todayYmd().slice(0, 4)}>
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
            <MasterCard key={m.id} m={m} favourite={m.id === favourite} />
          ))}
        </div>
        <div className={s.teamLinks}>
          <Link href="/portfolio" className={s.textLink}>
            Портфолио работ →
          </Link>
          <Link href="/#zapis" className={s.textLink}>
            Онлайн-запись →
          </Link>
        </div>
      </section>
    </SitePage>
  );
}
