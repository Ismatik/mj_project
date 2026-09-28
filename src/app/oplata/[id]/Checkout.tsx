"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { moneyDict } from "@/lib/i18n/dict-money";
import { somoni } from "@/lib/i18n/format";
import { localePath, type Lang } from "@/lib/i18n/locales";
import { cancelTest, payTest } from "../../pay-actions";
import s from "../../money.module.css";

type P = { id: string; amount: number; status: string; purpose: "DEPOSIT" | "GIFT_CARD"; description: string; payBy: string | null; giftToken: string | null };

export function Checkout({ payment, lang }: { payment: P; lang: Lang }) {
  const t = moneyDict(lang).pay;
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const sum = somoni(payment.amount, lang);

  if (payment.status === "PAID") {
    return (
      <div className={s.done} role="status">
        <div className={s.doneMark}>✓</div>
        <h1 id="pay-title" className={s.title}>
          {t.paidTitle}
        </h1>
        <div className={s.rule} />
        <p className={s.lead}>{payment.purpose === "DEPOSIT" ? t.paidDeposit : t.paidGift}</p>
        <div className={s.actions}>
          {payment.purpose === "DEPOSIT" && (
            <Link href={localePath(lang, "/kabinet")} className={s.primary}>
              {t.myBookings}
            </Link>
          )}
          {payment.giftToken && (
            <>
              <a href={`/api/gift/${payment.giftToken}/pdf`} className={s.primary}>
                {t.downloadPdf}
              </a>
              <Link href={localePath(lang, `/sertifikat/${payment.giftToken}`)} className={s.ghost}>
                {t.openCert}
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }
  if (payment.status !== "PENDING") {
    return (
      <div role="status">
        <h1 id="pay-title" className={s.title}>
          {payment.status === "EXPIRED" ? t.expiredTitle : t.cancelledTitle}
        </h1>
        <div className={s.rule} />
        <p className={s.lead}>{payment.purpose === "DEPOSIT" ? t.cancelledDeposit : t.cancelledGift}</p>
        <div className={s.actions}>
          <Link href={localePath(lang, payment.purpose === "DEPOSIT" ? "/#zapis" : "/podarok")} className={s.primary}>
            {t.again}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 id="pay-title" className={s.sum}>
        {sum}
      </h1>
      <div className={s.what}>{payment.description}</div>
      <div className={s.testBadge}>{t.test}</div>
      <p className={s.small}>{t.testNote}</p>
      {payment.payBy && <p className={s.small}>{t.payBy(payment.payBy)}</p>}
      <div className={s.fakeCard} aria-hidden="true">
        <label className={s.label}>
          {t.card}
          <input readOnly value="4242 4242 4242 4242" tabIndex={-1} />
        </label>
        <label className={s.label}>
          {t.expiry}
          <input readOnly value="12/29" tabIndex={-1} />
        </label>
        <label className={s.label}>
          {t.cvc}
          <input readOnly value="•••" tabIndex={-1} />
        </label>
      </div>
      <div className={s.actions}>
        <button
          type="button"
          className={s.primary}
          disabled={pending}
          onClick={(e) => {
            const btn = e.currentTarget;
            start(async () => {
              const res = await payTest(payment.id);
              if (res.ok) fx.sparkle(btn);
              router.refresh();
            });
          }}
        >
          {pending ? t.paying : t.payNow(sum)}
        </button>
        <button type="button" className={s.linkBtn} disabled={pending} onClick={() => start(async () => (await cancelTest(payment.id), router.refresh()))}>
          {t.cancel}
        </button>
      </div>
    </>
  );
}
