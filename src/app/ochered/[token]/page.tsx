import type { Metadata } from "next";
import Link from "next/link";
import { SitePage } from "@/components/site/SiteChrome";
import { localize } from "@/lib/i18n/content";
import { waitlistDict } from "@/lib/i18n/dict-waitlist";
import { when } from "@/lib/i18n/format";
import { localePath } from "@/lib/i18n/locales";
import { clock } from "@/lib/format";
import { db } from "@/lib/db";
import { todayYmd } from "@/lib/time";
import { getCurrentGuest } from "@/server/guest-auth";
import { getLang } from "@/server/lang";
import { namerFor } from "@/server/names";
import { getSiteContent } from "@/server/site";
import { offerByToken } from "@/server/waitlist/core";
import { OfferButtons } from "./OfferButtons";
import s from "../../money.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Лист ожидания — Mavzunai Jovid", robots: { index: false } };

// Opened from the "a time has opened up" message: confirm or decline the held time.
export default async function WaitlistOfferPage({ params }: PageProps<"/ochered/[token]">) {
  const { token } = await params;
  const lang = await getLang();
  const t = waitlistDict(lang).page;
  const [raw, guest, offer, name] = await Promise.all([getSiteContent("published"), getCurrentGuest(), offerByToken(db, token), namerFor(lang)]);
  const view = offer.state === "offered" || offer.state === "booked" ? offer.entry : null;
  return (
    <SitePage c={localize(raw, lang)} guest={guest} lang={lang} path={`/ochered/${token}`} current="home" year={todayYmd().slice(0, 4)}>
      <section className={s.section} aria-labelledby="wl-title">
        <div className={s.card}>
          <h1 id="wl-title" className={s.title}>
            {t.title}
          </h1>
          <div className={s.rule} />
          {view && (
            <>
              <p className={s.lead}>{t.intro(view.name.split(" ")[0]!)}</p>
              <div className={s.what}>
                <b>{name("services", view.serviceId, view.service)}</b>
                <div>{when(view.startsAt, lang)}</div>
                <div>{name("staff", view.staffId, view.master)}</div>
              </div>
            </>
          )}
          {offer.state === "offered" && (
            <>
              {offer.entry.expiresAt && <p className={s.small}>{t.hold(clock(offer.entry.expiresAt))}</p>}
              <OfferButtons token={token} lang={lang} />
            </>
          )}
          {offer.state === "booked" && (
            <div className={s.status} role="status">
              {t.booked}
            </div>
          )}
          {offer.state !== "offered" && offer.state !== "booked" && (
            <>
              <div className={s.status} role="status">
                {offer.state === "declined" ? t.declined : offer.state === "expired" ? t.expired : t.gone}
              </div>
              <div className={s.actions}>
                <Link href={localePath(lang, "/#zapis")} className={s.primary}>
                  {t.book}
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </SitePage>
  );
}
