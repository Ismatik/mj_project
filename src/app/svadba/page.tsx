import type { Metadata } from "next";
import { SitePage } from "@/components/site/SiteChrome";
import { localize } from "@/lib/i18n/content";
import { bridalDict } from "@/lib/i18n/dict-bridal";
import { bookableDates } from "@/lib/slots";
import { addDays, todayYmd } from "@/lib/time";
import { getBridalOptions } from "@/server/bridal";
import { getCurrentGuest } from "@/server/guest-auth";
import { alternates, getLang } from "@/server/lang";
import { getSiteContent } from "@/server/site";
import { BridalBuilder } from "./BridalBuilder";
import s from "./bridal.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const t = bridalDict(lang);
  return { title: t.meta, description: t.lead, alternates: alternates(lang, "/svadba") };
}

// Bridal package builder: wedding-day services with a package discount, a rental dress and a trial look.
export default async function BridalPage() {
  const lang = await getLang();
  const t = bridalDict(lang);
  const today = todayYmd();
  const [raw, guest, options] = await Promise.all([getSiteContent("published"), getCurrentGuest(), getBridalOptions(lang)]);
  return (
    <SitePage c={localize(raw, lang)} guest={guest} lang={lang} path="/svadba" current="home" year={today.slice(0, 4)}>
      <section className={s.section} aria-labelledby="bridal-title">
        <div className={s.head}>
          <div className={s.kicker}>{t.kicker}</div>
          <h1 id="bridal-title" className={s.title}>
            {t.title}
          </h1>
          <div className={s.rule} />
          <p className={s.lead}>{t.lead}</p>
        </div>
        <BridalBuilder options={options} lang={lang} minDate={addDays(today, 1)} trialDates={bookableDates(today, 30, addDays)} guest={guest ? { name: guest.name, phone: guest.phone } : null} />
      </section>
    </SitePage>
  );
}
