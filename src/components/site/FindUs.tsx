"use client";

import Link from "next/link";
import { useState } from "react";
import { blogDict } from "@/lib/i18n/dict-blog";
import { localePath, type Lang } from "@/lib/i18n/locales";
import { mapLinks, telLink, whatsappLink, type SiteContent } from "@/lib/site-content";
import s from "./findus.module.css";

/** Only the contacts come in: this is a client component, anything passed here is sent to the browser.
 * Address, hours, one-tap call / WhatsApp / routes, and a map loaded only when asked (no third-party requests before that). */
export function FindUs({ contacts, lang }: { contacts: SiteContent["contacts"]; lang: Lang }) {
  const c = { contacts };
  const t = blogDict(lang).find;
  const links = mapLinks(c.contacts);
  const [map, setMap] = useState(false);
  return (
    <section id="kak-dobratsya" className={s.section} aria-labelledby="find-title">
      <div className={s.inner}>
        <div className={s.text} data-reveal>
          <h2 id="find-title" className={s.title}>
            {t.title}
          </h2>
          <div className={s.rule} />
          <p className={s.address}>
            {c.contacts.address}
            <br />
            {c.contacts.district}
          </p>
          <p className={s.hours}>
            {c.contacts.hours}
            <br />
            {c.contacts.dayOff}
          </p>
          <div className={s.actions}>
            <a href={telLink(c.contacts)} className={s.primary}>
              {t.call} · {c.contacts.phone}
            </a>
            <a href={whatsappLink(c.contacts)} className={s.ghost} target="_blank" rel="noopener noreferrer">
              {t.whatsapp}
            </a>
            {links && (
              <>
                <a href={links.twoGis} className={s.ghost} target="_blank" rel="noopener noreferrer">
                  {t.route2gis}
                </a>
                <a href={links.google} className={s.ghost} target="_blank" rel="noopener noreferrer">
                  {t.google}
                </a>
              </>
            )}
            <Link href={`${localePath(lang, "/")}#zapis`} className={s.ghost}>
              {t.book}
            </Link>
          </div>
        </div>
        {links && (
          <div className={s.map}>
            {map ? (
              <iframe title={t.title} src={links.embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
            ) : (
              <button type="button" className={s.mapButton} onClick={() => setMap(true)}>
                <span className={s.pin} aria-hidden="true">
                  MJ
                </span>
                <span>{t.showMap}</span>
                <small>{t.mapNote}</small>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Phones: a bar at the bottom with call, WhatsApp and booking always one tap away */
export function MobileBar({ contacts, lang }: { contacts: SiteContent["contacts"]; lang: Lang }) {
  const c = { contacts };
  const t = blogDict(lang).find;
  return (
    <nav className={s.bar} aria-label={t.call}>
      <a href={telLink(c.contacts)}>{t.call}</a>
      <a href={whatsappLink(c.contacts)} target="_blank" rel="noopener noreferrer">
        {t.whatsapp}
      </a>
      <Link href={`${localePath(lang, "/")}#zapis`} className={s.barBook}>
        {t.book}
      </Link>
    </nav>
  );
}
