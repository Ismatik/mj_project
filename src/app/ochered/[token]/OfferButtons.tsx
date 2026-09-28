"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { waitlistDict } from "@/lib/i18n/dict-waitlist";
import type { Lang } from "@/lib/i18n/locales";
import { acceptWaitlist, declineWaitlist } from "../../waitlist-actions";
import s from "../../money.module.css";

export function OfferButtons({ token, lang }: { token: string; lang: Lang }) {
  const t = waitlistDict(lang).page;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(t.expired);
      router.refresh();
    });
  return (
    <>
      <div className={s.actions}>
        <button type="button" className={s.primary} disabled={pending} onClick={() => run(() => acceptWaitlist(token))}>
          {t.accept}
        </button>
        <button type="button" className={s.ghost} disabled={pending} onClick={() => run(() => declineWaitlist(token))}>
          {t.decline}
        </button>
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
