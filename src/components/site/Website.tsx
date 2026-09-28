import Link from "next/link";
import { Brush, Crown, Droplet, Eye, Hand, Scissors, Sparkles, type LucideIcon } from "lucide-react";
import { dict } from "@/lib/i18n/dict";
import { duration, somoni } from "@/lib/i18n/format";
import { localePath, type Lang } from "@/lib/i18n/locales";
import { whatsappLink, type SiteContent } from "@/lib/site-content";
import type { SiteMaster } from "@/server/masters";
import type { OnlineMenu } from "@/server/online-booking";
import { MasterCard } from "./MasterCard";
import { OnlineBooking, type BookingPreset } from "./OnlineBooking";
import { Photo } from "./Photo";
import { SiteFooter, SiteNav, type NavGuest } from "./SiteChrome";
import { SiteEffects } from "./SiteEffects";
import s from "./site.module.css";

const ICONS: Record<string, LucideIcon> = { scissors: Scissors, hand: Hand, brush: Brush, crown: Crown, eye: Eye, sparkles: Sparkles, droplet: Droplet };

type PriceList = { id: string; name: string; services: { id: string; name: string; durationMin: number; price: number }[] }[];

const DUST = [
  { left: "12%", bottom: "8%", size: 5, dur: 9, delay: 0 },
  { left: "28%", bottom: "16%", size: 3, dur: 12, delay: 2.5 },
  { left: "45%", bottom: "5%", size: 6, dur: 10, delay: 1.2 },
  { left: "61%", bottom: "20%", size: 4, dur: 13, delay: 4 },
  { left: "74%", bottom: "10%", size: 3, dur: 11, delay: 0.8 },
  { left: "86%", bottom: "24%", size: 5, dur: 14, delay: 3.2 },
  { left: "35%", bottom: "30%", size: 3, dur: 12, delay: 5.5 },
];

export function Website({
  c,
  prices,
  today,
  menu,
  dates,
  preview,
  masters,
  guest,
  preset,
  lang,
}: {
  c: SiteContent;
  prices: PriceList;
  today: string;
  menu: OnlineMenu;
  dates: string[];
  preview?: { publishedAt?: string };
  masters: SiteMaster[];
  guest: (NavGuest & { phone: string; favouriteStaffId: string | null }) | null;
  preset?: BookingPreset;
  lang: Lang;
}) {
  const t = dict(lang);
  const reviews = c.reviews.items.filter((r) => r.visible);
  const marquee = [...c.marquee, ...c.marquee];

  return (
    <div className={s.site}>
      <SiteEffects intro={!preview} />
      {preview && (
        <div className={s.preview}>
          <span>{t.home.previewBanner}</span>
          <Link href="/admin">{t.home.previewBack}</Link>
        </div>
      )}

      <SiteNav guest={guest} lang={lang} path="/" />

      <header id="top" className={s.hero}>
        <div className={s.heroText}>
          <div className={s.dust} aria-hidden="true">
            {DUST.map((d, i) => (
              <span key={i} style={{ left: d.left, bottom: d.bottom, width: d.size, height: d.size, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }} />
            ))}
          </div>
          <div data-reveal className={s.kickerLight}>
            {c.hero.kicker}
          </div>
          <h1 data-reveal data-blur className={s.heroTitle}>
            {c.hero.title}
          </h1>
          <p data-reveal className={s.heroSub}>
            {c.hero.subtitle}
          </p>
          <div data-reveal className={s.heroCtas}>
            <a href="#zapis" className={s.btnCream}>
              {t.home.bookVisit}
            </a>
            <a href="#uslugi" className={s.btnGhost}>
              {t.home.services}
            </a>
          </div>
          <div data-reveal className={s.badges}>
            {c.hero.badges.map((b, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i > 0 && <span className={s.badgeSep}>|</span>}
                <span>{b}</span>
              </span>
            ))}
          </div>
        </div>
        <div className={`${s.photoBox} ${s.heroPhoto}`} style={{ minHeight: 540 }}>
          <Photo photo={c.photos.hero} alt={t.home.heroAlt} eager />
        </div>
      </header>

      <section className={s.dark} aria-labelledby="philosophy">
        <div data-spotlight className={s.spotlight} />
        <svg data-reveal width="76" height="76" viewBox="0 0 48 48" style={{ margin: "0 auto", display: "block", overflow: "visible" }} aria-hidden="true">
          <circle cx="24" cy="24" r="23" fill="var(--mj-cream)" />
          <rect x="12" y="10" width="24" height="21" fill="none" stroke="var(--mj-ink)" strokeWidth="1.7" />
          <text x="24" y="26" textAnchor="middle" fontFamily="var(--mj-serif)" fontSize="12" fontWeight="600" fill="var(--mj-ink)">
            MJ
          </text>
          <text x="24" y="37.5" textAnchor="middle" fontFamily="var(--mj-sans)" fontSize="3.4" letterSpacing="1" fill="var(--mj-ink)">
            MAVZUNAI JOVID
          </text>
        </svg>
        <h2 id="philosophy" data-reveal data-blur className={s.h2} style={{ marginTop: 26 }}>
          {c.philosophy.title}
        </h2>
        <div className={s.ruleLight} />
        <p data-reveal data-blur className={s.philosophyText}>
          {c.philosophy.body}
        </p>
      </section>

      <section id="uslugi" className={s.light} aria-labelledby="services-title">
        <h2 id="services-title" data-reveal className={`${s.h2} ${s.center}`}>
          {c.services.title}
        </h2>
        <div className={s.rule} />
        <div className={s.cards}>
          {c.services.cards.map((card) => {
            const Icon = ICONS[card.icon] ?? Sparkles;
            return (
              <div key={card.name} data-reveal className={s.card}>
                <div className={s.cardIcon}>
                  <Icon size={38} strokeWidth={1.2} color="var(--mj-ink)" aria-hidden="true" />
                </div>
                <div className={s.cardName}>{card.name}</div>
                <div className={s.cardDesc}>{card.desc}</div>
              </div>
            );
          })}
        </div>
        {prices.length > 0 && (
          <>
            <div className={s.prices}>
              {prices.map((cat) => (
                <div key={cat.id} data-reveal className={s.priceGroup}>
                  <h3>{cat.name}</h3>
                  {cat.services.map((sv) => (
                    <div key={sv.id} className={s.priceRow}>
                      <span>{sv.name}</span>
                      <small>{duration(sv.durationMin, lang)}</small>
                      <span className={s.dots} aria-hidden="true" />
                      <span className={s.priceValue}>{somoni(sv.price, lang)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className={s.priceNote}>{t.home.priceNote}</p>
          </>
        )}
      </section>

      <div className={s.marquee} aria-hidden="true">
        <div className={s.marqueeTrack}>
          {marquee.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      </div>

      <section id="nevesta" className={s.bridal} aria-labelledby="bridal-title">
        <div className={s.photoBox} style={{ minHeight: 440 }}>
          <Photo photo={c.photos.bridal} alt={t.home.bridalAlt} />
        </div>
        <div data-reveal className={s.bridalText}>
          <div className={s.kickerLight}>{c.bridal.kicker}</div>
          <h2 id="bridal-title" className={s.bridalTitle}>
            {c.bridal.title}
          </h2>
          <div className={`${s.ruleLight} ${s.ruleLeft}`} style={{ marginTop: 20 }} />
          <p className={s.bridalBody}>{c.bridal.body}</p>
          <a href={whatsappLink(c.contacts, t.home.bridalWhatsapp)} className={s.btnCream} style={{ alignSelf: "flex-start", marginTop: 32 }} target="_blank" rel="noopener noreferrer">
            {c.bridal.cta}
          </a>
        </div>
      </section>

      {masters.length > 0 && (
        <section id="mastera" className={s.light} aria-labelledby="team-title">
          <h2 id="team-title" data-reveal className={`${s.h2} ${s.center}`}>
            {c.team.title}
          </h2>
          <div className={s.rule} />
          <div className={s.teamGrid}>
            {masters.map((m) => (
              <MasterCard key={m.id} m={m} lang={lang} favourite={m.id === guest?.favouriteStaffId} />
            ))}
          </div>
          <div className={s.teamLinks}>
            <Link href={localePath(lang, "/mastera")} className={s.textLink}>
              {t.home.allMasters}
            </Link>
            <Link href={localePath(lang, "/portfolio")} className={s.textLink}>
              {t.home.portfolioLink}
            </Link>
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section id="otzyvy" className={s.dark} aria-labelledby="reviews-title">
          <h2 id="reviews-title" data-reveal data-blur className={s.h2}>
            {c.reviews.title}
          </h2>
          <div className={s.ruleLight} />
          <div className={s.reviews}>
            {reviews.map((r) => (
              <blockquote key={r.id} data-reveal className={s.review}>
                {r.photo?.url ? (
                  <div className={s.avatar}>
                    <Photo photo={{ url: r.photo.url }} alt="" parallax={false} />
                  </div>
                ) : (
                  <div className={s.avatarMono} aria-hidden="true">
                    {r.author.trim()[0]}
                  </div>
                )}
                <div className={s.stars} aria-label={t.home.rating}>
                  ★★★★★
                </div>
                <p className={s.reviewText}>{r.text}</p>
                <footer className={s.reviewAuthor}>— {r.author}</footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      <section className={s.light} style={{ padding: 0 }} aria-labelledby="about-title">
        <div className={s.about}>
          <div className={s.photoBox} style={{ minHeight: 360 }}>
            <Photo photo={c.photos.interior} alt={t.home.interiorAlt} />
          </div>
          <div data-reveal>
            <h2 id="about-title" className={s.h2}>
              {c.about.title}
            </h2>
            <div className={`${s.rule} ${s.ruleLeft}`} />
            <p className={s.aboutBody}>{c.about.body}</p>
            <div className={s.facts}>
              {c.about.facts.map((f) => (
                <div key={f.label}>
                  <div className={s.factValue}>{f.value}</div>
                  <div className={s.factLabel}>{f.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="zapis" className={s.booking} aria-labelledby="booking-title">
        <div className={s.bookingInner}>
          <h2 id="booking-title" data-reveal className={`${s.h2} ${s.center}`}>
            {c.booking.title}
          </h2>
          <div className={s.rule} />
          <p data-reveal className={s.bookingIntro}>
            {c.booking.intro}
          </p>
          <OnlineBooking menu={menu} dates={dates} preview={!!preview} preset={preset} guest={guest} lang={lang} />
        </div>
      </section>

      <SiteFooter c={c} year={today.slice(0, 4)} lang={lang} />
    </div>
  );
}
