import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SitePage } from "@/components/site/SiteChrome";
import { db } from "@/lib/db";
import { clock } from "@/lib/format";
import { localize } from "@/lib/i18n/content";
import { moneyDict } from "@/lib/i18n/dict-money";
import { todayYmd } from "@/lib/time";
import { getCurrentGuest } from "@/server/guest-auth";
import { getLang } from "@/server/lang";
import { getSiteContent } from "@/server/site";
import s from "../../money.module.css";
import { Checkout } from "./Checkout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Оплата - Mavzunai Jovid", robots: { index: false } };

// Test checkout: stands in for the bank's payment page until an acquiring contract is signed.
export default async function PaymentPage({ params }: PageProps<"/oplata/[id]">) {
  const { id } = await params;
  const lang = await getLang();
  const p = moneyDict(lang).pay;
  const payment = await db.payment.findUnique({ where: { id }, include: { giftCard: true, appointment: true } });
  if (!payment || payment.provider !== "test") notFound();
  const [raw, guest] = await Promise.all([getSiteContent("published"), getCurrentGuest()]);
  const expired = payment.status === "PENDING" && payment.expiresAt < new Date();
  return (
    <SitePage c={localize(raw, lang)} guest={guest} lang={lang} path={`/oplata/${id}`} current="home" year={todayYmd().slice(0, 4)}>
      <section className={s.section} aria-labelledby="pay-title">
        <div className={s.card}>
          <div className={s.kicker}>{p.kicker}</div>
          <Checkout
            lang={lang}
            payment={{
              id: payment.id,
              amount: payment.amount,
              status: expired ? "EXPIRED" : payment.status,
              purpose: payment.purpose,
              description: payment.description,
              payBy: payment.purpose === "DEPOSIT" ? clock(payment.expiresAt) : null,
              giftToken: payment.giftCard?.token ?? null,
            }}
          />
        </div>
      </section>
    </SitePage>
  );
}
