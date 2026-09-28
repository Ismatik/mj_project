import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/site/Gallery";
import { OnlineBooking } from "@/components/site/OnlineBooking";
import { Photo } from "@/components/site/Photo";
import { SitePage } from "@/components/site/SiteChrome";
import s from "@/components/site/site.module.css";
import { duration } from "@/lib/duration";
import { somoni } from "@/lib/format";
import { bookableDates } from "@/lib/slots";
import { addDays, todayYmd } from "@/lib/time";
import { getCurrentGuest } from "@/server/guest-auth";
import { getSiteMasters } from "@/server/masters";
import { getOnlineMenu } from "@/server/online-booking";
import { getSiteContent } from "@/server/site";
import { FavouriteButton } from "./FavouriteButton";

export const dynamic = "force-dynamic";

async function findMaster(slug: string) {
  const c = await getSiteContent("published");
  const masters = await getSiteMasters(c);
  return { c, master: masters.find((m) => m.slug === slug) };
}

export async function generateMetadata({ params }: PageProps<"/mastera/[slug]">): Promise<Metadata> {
  const { master } = await findMaster((await params).slug);
  if (!master) return { title: "Мастер не найден — Mavzunai Jovid" };
  return {
    title: `${master.name} — ${master.title} · Mavzunai Jovid`,
    description: master.bio.slice(0, 160) || `${master.name}, ${master.title}. Запись онлайн в салон Mavzunai Jovid, Душанбе.`,
    openGraph: master.photo?.url ? { images: [master.photo.url] } : undefined,
  };
}

export default async function MasterPage({ params }: PageProps<"/mastera/[slug]">) {
  const { c, master } = await findMaster((await params).slug);
  if (!master) notFound();
  const [menu, guest] = await Promise.all([getOnlineMenu(), getCurrentGuest()]);
  const favourite = guest?.favouriteStaffId === master.id;
  // Booking with this master only
  const ownMenu = menu
    .map((cat) => ({
      ...cat,
      services: cat.services.filter((sv) => sv.staff.some((m) => m.id === master.id)).map((sv) => ({ ...sv, staff: sv.staff.filter((m) => m.id === master.id) })),
    }))
    .filter((cat) => cat.services.length);
  const today = todayYmd();
  const byCategory = new Map<string, typeof master.services>();
  for (const sv of master.services) byCategory.set(sv.category, [...(byCategory.get(sv.category) ?? []), sv]);

  return (
    <SitePage c={c} guest={guest} current="masters" year={today.slice(0, 4)} bookHref="#zapis">
      <section className={s.masterHero} aria-labelledby="master-name">
        <div className={`${s.photoBox} ${s.masterHeroPhoto}`}>
          {master.photo?.url ? (
            <Photo photo={master.photo} alt={master.name} eager />
          ) : (
            <div className={s.masterMono} aria-hidden="true">
              <span>{master.name.trim()[0]}</span>
            </div>
          )}
        </div>
        <div className={s.masterHeroText}>
          <Link href="/mastera" className={s.backLink}>
            ← Все мастера
          </Link>
          <div data-reveal className={s.kickerLight}>
            {master.title}
          </div>
          <h1 id="master-name" data-reveal data-blur className={s.masterHeroName}>
            {master.name}
          </h1>
          <div className={`${s.ruleLight} ${s.ruleLeft}`} style={{ marginTop: 20 }} />
          {master.bio && (
            <p data-reveal className={s.masterBio}>
              {master.bio}
            </p>
          )}
          <div className={s.heroCtas}>
            {ownMenu.length > 0 && (
              <a href="#zapis" className={s.btnCream}>
                Записаться к мастеру
              </a>
            )}
            {guest && <FavouriteButton staffId={master.id} initial={favourite} />}
          </div>
        </div>
      </section>

      {master.services.length > 0 && (
        <section className={s.light} aria-labelledby="master-services">
          <h2 id="master-services" data-reveal className={`${s.h2} ${s.center}`}>
            Услуги и цены
          </h2>
          <div className={s.rule} />
          <div className={s.prices}>
            {[...byCategory].map(([cat, list]) => (
              <div key={cat} className={s.priceGroup}>
                <h3>{cat}</h3>
                {list.map((sv) => (
                  <div key={sv.id} className={s.priceRow}>
                    <span>{sv.name}</span>
                    <small>{duration(sv.durationMin)}</small>
                    <span className={s.dots} aria-hidden="true" />
                    <span className={s.priceValue}>{somoni(sv.price)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={s.portfolioSection} aria-labelledby="master-works">
        <h2 id="master-works" data-reveal className={`${s.h2} ${s.center}`}>
          Работы мастера
        </h2>
        <div className={s.rule} />
        <div className={s.galleryWrap}>
          <Gallery works={master.portfolio} />
        </div>
      </section>

      {ownMenu.length > 0 && (
        <section id="zapis" className={s.booking} aria-labelledby="booking-title">
          <div className={s.bookingInner}>
            <h2 id="booking-title" data-reveal className={`${s.h2} ${s.center}`}>
              Запись к мастеру {master.name}
            </h2>
            <div className={s.rule} />
            <p className={s.bookingIntro}>Выберите услугу и свободное время — запись сразу попадёт в наш календарь.</p>
            <OnlineBooking menu={ownMenu} dates={bookableDates(today, 14, addDays)} preset={{ staffId: master.id }} guest={guest} />
          </div>
        </section>
      )}
    </SitePage>
  );
}
