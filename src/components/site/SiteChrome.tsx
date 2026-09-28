import Link from "next/link";
import { UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { dict } from "@/lib/i18n/dict";
import { moneyDict } from "@/lib/i18n/dict-money";
import { blogDict } from "@/lib/i18n/dict-blog";
import { MobileBar } from "./FindUs";
import { LANG_CODE, LANG_LABEL, LANG_NAME, LANGS, localePath, type Lang } from "@/lib/i18n/locales";
import { instagramLink, telLink, whatsappLink, type SiteContent } from "@/lib/site-content";
import { SiteEffects } from "./SiteEffects";
import s from "./site.module.css";

export function Mono({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ overflow: "visible", flexShrink: 0 }} aria-hidden="true">
      <rect x="7" y="4" width="34" height="30" fill="none" stroke={color} strokeWidth="2.3" />
      <text x="24" y="26.5" textAnchor="middle" fontFamily="var(--mj-serif)" fontSize="17" fontWeight="600" fill={color}>
        MJ
      </text>
      <text x="24" y="44" textAnchor="middle" fontFamily="var(--mj-sans)" fontSize="5.2" letterSpacing="1.6" fill={color}>
        MAVZUNAI JOVID
      </text>
    </svg>
  );
}

const LINKS = [
  { href: "/#uslugi", id: "services" },
  { href: "/mastera", id: "masters" },
  { href: "/portfolio", id: "portfolio" },
  { href: "/#nevesta", id: "bridal" },
  { href: "/#otzyvy", id: "reviews" },
  { href: "/#kontakty", id: "contacts" },
] as const;
export type NavId = (typeof LINKS)[number]["id"] | "account" | "home";

export type NavGuest = { name: string } | null;

/** Рус · Тоҷ · Eng — full page loads, so the whole page (and <html lang>) switches */
function LangSwitch({ lang, path, className, short }: { lang: Lang; path: string; className: string; short?: boolean }) {
  const t = dict(lang);
  return (
    <div className={className} role="group" aria-label={t.nav.language}>
      {LANGS.map((l) => (
        <a key={l} href={localePath(l, path)} hrefLang={l} lang={l} aria-current={l === lang ? "true" : undefined} title={LANG_NAME[l]}>
          {short ? LANG_CODE[l] : LANG_LABEL[l]}
        </a>
      ))}
    </div>
  );
}

export function SiteNav({ guest, lang, path, current = "home", bookHref }: { guest: NavGuest; lang: Lang; path: string; current?: NavId; bookHref?: string }) {
  const t = dict(lang);
  const g = moneyDict(lang).gift;
  const first = guest?.name.split(" ")[0];
  const href = (p: string) => localePath(lang, p);
  return (
    <nav className={s.nav} aria-label={t.nav.main} data-lang={lang}>
      <Link href={href("/")} className={s.brand} aria-label={t.nav.home}>
        <Mono size={40} color="var(--mj-ink)" />
        <div className={s.brandText}>
          <div className={s.brandName}>Mavzunai Jovid</div>
          <div className={s.brandTag}>gallery of beauty</div>
        </div>
      </Link>
      <div className={s.navLinks}>
        {LINKS.map((l) => (
          <Link key={l.id} href={href(l.href)} aria-current={current === l.id ? "page" : undefined}>
            {t.nav[l.id]}
          </Link>
        ))}
      </div>
      <LangSwitch lang={lang} path={path} className={s.langSwitch} short />
      <Link href={href("/kabinet")} className={s.navAccount} aria-current={current === "account" ? "page" : undefined} title={t.nav.account}>
        <UserRound size={17} strokeWidth={1.5} aria-hidden="true" />
        <span>{first ?? t.nav.signIn}</span>
      </Link>
      <a href={bookHref ?? href("/#zapis")} className={s.btnInk}>
        {t.nav.book}
      </a>
      <details className={s.menu}>
        <summary aria-label={t.nav.menu}>
          <span />
          <span />
          <span />
        </summary>
        <div className={s.menuPanel}>
          {LINKS.map((l) => (
            <Link key={l.id} href={href(l.href)} aria-current={current === l.id ? "page" : undefined}>
              {t.nav[l.id]}
            </Link>
          ))}
          <Link href={href("/podarok")}>{g.nav}</Link>
          <Link href={href("/kabinet")}>{guest ? t.nav.accountOf(first!) : t.nav.account}</Link>
          <LangSwitch lang={lang} path={path} className={s.menuLangs} />
        </div>
      </details>
    </nav>
  );
}

export function SiteFooter({ c, year, lang }: { c: SiteContent; year: string; lang: Lang }) {
  const t = dict(lang);
  return (
    <footer id="kontakty" className={s.footer}>
      <div className={s.footerGrid}>
        <div>
          <div className={s.footerBrand}>
            <Mono size={36} color="var(--mj-cream)" />
            <div className={s.footerName}>Mavzunai Jovid</div>
          </div>
          <p className={s.footerText}>
            Gallery of Beauty MJ.
            <br />
            {t.footer.about}
          </p>
        </div>
        <div className={s.footerCol}>
          <div className={s.footerLabel}>{t.footer.contacts}</div>
          <div>
            <a href={telLink(c.contacts)}>{c.contacts.phone}</a>
          </div>
          <div>
            <a href={whatsappLink(c.contacts)} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </div>
          <div>
            <Link href={localePath(lang, "/podarok")}>{moneyDict(lang).gift.nav} →</Link>
          </div>
          <div>
            <Link href={localePath(lang, "/blog")}>{blogDict(lang).blog.nav} →</Link>
          </div>
          {[c.contacts.instagram, c.contacts.instagramGallery].filter(Boolean).map((h) => (
            <div key={h}>
              <a href={instagramLink(h)} target="_blank" rel="noopener noreferrer">
                @{h.replace(/^@/, "")}
              </a>
            </div>
          ))}
        </div>
        <div className={s.footerCol}>
          <div className={s.footerLabel}>{t.footer.address}</div>
          <div>{c.contacts.address}</div>
          <div>{c.contacts.district}</div>
          <div>{c.contacts.hours}</div>
          <div>{c.contacts.dayOff}</div>
        </div>
      </div>
      <div className={s.footerBottom}>
        <span>© {year} Mavzunai Jovid</span>
        <span>{t.footer.city}</span>
      </div>
    </footer>
  );
}

/** Inner website pages (masters, portfolio, account): same nav and footer as the home page, no intro loader. */
export function SitePage({
  c,
  guest,
  lang,
  path,
  current,
  year,
  bookHref,
  children,
}: {
  c: SiteContent;
  guest: NavGuest;
  lang: Lang;
  path: string;
  current: NavId;
  year: string;
  bookHref?: string;
  children: ReactNode;
}) {
  return (
    <div className={s.site}>
      <SiteEffects intro={false} />
      <SiteNav guest={guest} lang={lang} path={path} current={current} bookHref={bookHref} />
      <main>{children}</main>
      <SiteFooter c={c} year={year} lang={lang} />
      <MobileBar contacts={c.contacts} lang={lang} />
    </div>
  );
}
