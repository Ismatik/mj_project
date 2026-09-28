import Link from "next/link";
import { UserRound } from "lucide-react";
import type { ReactNode } from "react";
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
  { href: "/#uslugi", label: "Услуги", id: "services" },
  { href: "/mastera", label: "Мастера", id: "masters" },
  { href: "/portfolio", label: "Портфолио", id: "portfolio" },
  { href: "/#nevesta", label: "Невестам", id: "bridal" },
  { href: "/#otzyvy", label: "Отзывы", id: "reviews" },
  { href: "/#kontakty", label: "Контакты", id: "contacts" },
] as const;
export type NavId = (typeof LINKS)[number]["id"] | "account" | "home";

export type NavGuest = { name: string } | null;

export function SiteNav({ guest, current = "home", bookHref = "/#zapis" }: { guest: NavGuest; current?: NavId; bookHref?: string }) {
  const first = guest?.name.split(" ")[0];
  return (
    <nav className={s.nav} aria-label="Главное меню">
      <Link href="/" className={s.brand} aria-label="Mavzunai Jovid — на главную">
        <Mono size={40} color="var(--mj-ink)" />
        <div className={s.brandText}>
          <div className={s.brandName}>Mavzunai Jovid</div>
          <div className={s.brandTag}>gallery of beauty</div>
        </div>
      </Link>
      <div className={s.navLinks}>
        {LINKS.map((l) => (
          <Link key={l.id} href={l.href} aria-current={current === l.id ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </div>
      <Link href="/kabinet" className={s.navAccount} aria-current={current === "account" ? "page" : undefined} title={guest ? "Личный кабинет" : "Войти в личный кабинет"}>
        <UserRound size={17} strokeWidth={1.5} aria-hidden="true" />
        <span>{first ?? "Войти"}</span>
      </Link>
      <a href={bookHref} className={s.btnInk}>
        Записаться
      </a>
      <details className={s.menu}>
        <summary aria-label="Меню">
          <span />
          <span />
          <span />
        </summary>
        <div className={s.menuPanel}>
          {LINKS.map((l) => (
            <Link key={l.id} href={l.href} aria-current={current === l.id ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
          <Link href="/kabinet">{guest ? `Кабинет · ${first}` : "Личный кабинет"}</Link>
        </div>
      </details>
    </nav>
  );
}

export function SiteFooter({ c, year }: { c: SiteContent; year: string }) {
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
            Салон красоты и свадебный зал.
          </p>
        </div>
        <div className={s.footerCol}>
          <div className={s.footerLabel}>Контакты</div>
          <div>
            <a href={telLink(c.contacts)}>{c.contacts.phone}</a>
          </div>
          <div>
            <a href={whatsappLink(c.contacts)} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
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
          <div className={s.footerLabel}>Адрес и часы</div>
          <div>{c.contacts.address}</div>
          <div>{c.contacts.district}</div>
          <div>{c.contacts.hours}</div>
          <div>{c.contacts.dayOff}</div>
        </div>
      </div>
      <div className={s.footerBottom}>
        <span>© {year} Mavzunai Jovid</span>
        <span>Душанбе · Таджикистан</span>
      </div>
    </footer>
  );
}

/** Inner website pages (masters, portfolio, account): same nav and footer as the home page, no intro loader. */
export function SitePage({ c, guest, current, year, bookHref, children }: { c: SiteContent; guest: NavGuest; current: NavId; year: string; bookHref?: string; children: ReactNode }) {
  return (
    <div className={s.site}>
      <SiteEffects intro={false} />
      <SiteNav guest={guest} current={current} bookHref={bookHref} />
      <main>{children}</main>
      <SiteFooter c={c} year={year} />
    </div>
  );
}
