import type { Metadata } from "next";
import { SitePage } from "@/components/site/SiteChrome";
import { localize } from "@/lib/i18n/content";
import { moneyDict } from "@/lib/i18n/dict-money";
import { todayYmd } from "@/lib/time";
import { getCurrentGuest } from "@/server/guest-auth";
import { alternates, getLang } from "@/server/lang";
import { getSiteContent } from "@/server/site";
import s from "../money.module.css";
import { GiftForm } from "./GiftForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const g = moneyDict(lang).gift;
  return { title: `${g.title} — Mavzunai Jovid`, description: g.lead, alternates: alternates(lang, "/podarok") };
}

// Gift certificate bought online: amount, recipient, message → checkout → PDF with a QR code.
export default async function GiftPage() {
  const lang = await getLang();
  const g = moneyDict(lang).gift;
  const [raw, guest] = await Promise.all([getSiteContent("published"), getCurrentGuest()]);
  const c = localize(raw, lang);
  return (
    <SitePage c={c} guest={guest} lang={lang} path="/podarok" current="home" year={todayYmd().slice(0, 4)}>
      <section className={s.section} aria-labelledby="gift-title">
        <div className={s.card}>
          <div className={s.kicker}>{g.kicker}</div>
          <h1 id="gift-title" className={s.title}>
            {g.title}
          </h1>
          <div className={s.rule} />
          <p className={s.lead}>{g.lead}</p>
          <GiftForm lang={lang} buyer={guest ? { name: guest.name, phone: guest.phone } : null} />
          <p className={s.small}>{g.terms}</p>
        </div>
      </section>
    </SitePage>
  );
}
