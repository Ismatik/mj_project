import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SitePage } from "@/components/site/SiteChrome";
import { localize } from "@/lib/i18n/content";
import { moneyDict } from "@/lib/i18n/dict-money";
import { dayMonthYear, somoni } from "@/lib/i18n/format";
import { localePath } from "@/lib/i18n/locales";
import { todayYmd } from "@/lib/time";
import { giftCardByToken } from "@/server/gift-cards";
import { getCurrentGuest } from "@/server/guest-auth";
import { getLang } from "@/server/lang";
import { getSiteContent } from "@/server/site";
import s from "../../money.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Подарочный сертификат — Mavzunai Jovid", robots: { index: false } };

// Opened from the QR code: the certificate, its balance and a PDF download.
export default async function CertificatePage({ params }: PageProps<"/sertifikat/[token]">) {
  const { token } = await params;
  const card = await giftCardByToken(token);
  if (!card) notFound();
  const lang = await getLang();
  const t = moneyDict(lang).cert;
  const [raw, guest] = await Promise.all([getSiteContent("published"), getCurrentGuest()]);
  const expired = card.expiresAt < new Date();
  const problem =
    card.status === "PENDING" ? t.pending : card.status === "CANCELLED" ? t.cancelled : card.status === "USED" || card.balance <= 0 ? t.used : expired ? t.expired : null;
  return (
    <SitePage c={localize(raw, lang)} guest={guest} lang={lang} path={`/sertifikat/${token}`} current="home" year={todayYmd().slice(0, 4)}>
      <section className={s.section} aria-labelledby="cert-title">
        <div className={`${s.card} ${s.wide}`}>
          <h1 id="cert-title" className={s.title}>
            {t.title}
          </h1>
          <div className={s.rule} />
          <div className={s.cert}>
            <div className={s.certBand}>
              <div className={s.certMono}>MJ</div>
              <small>Mavzunai Jovid</small>
            </div>
            <div className={s.certBody}>
              <span className={s.kicker}>{t.balance}</span>
              <span className={s.certSum}>{somoni(card.balance, lang)}</span>
              <span className={s.certOf}>{t.of(somoni(card.amount, lang))}</span>
              <span className={s.certFor}>
                {t.for}: {card.recipientName}
              </span>
              {card.message && <span className={s.certMsg}>«{card.message}»</span>}
              <span className={s.certCode}>{card.code}</span>
              <span className={s.certOf}>{t.valid(dayMonthYear(card.expiresAt, lang))}</span>
            </div>
          </div>
          {problem && <div className={s.status}>{problem}</div>}
          <p className={s.small}>{t.how}</p>
          <div className={s.actions}>
            {card.status !== "PENDING" && card.status !== "CANCELLED" && (
              <a href={`/api/gift/${card.token}/pdf`} className={s.primary}>
                {t.download}
              </a>
            )}
            <Link href={localePath(lang, "/#zapis")} className={s.ghost}>
              {t.book}
            </Link>
          </div>
        </div>
      </section>
    </SitePage>
  );
}
