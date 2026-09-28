"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { dict } from "@/lib/i18n/dict";
import type { Lang } from "@/lib/i18n/locales";
import { normalizePhone } from "@/lib/phone";
import { confirmCode, requestCode } from "./actions";
import s from "./kabinet.module.css";

type Sent = { where: string; demoCode?: string };

/** Phone → 4-digit code (→ name, for a first visit). */
export function SignIn({ lang }: { lang: Lang }) {
  const t = dict(lang).signIn;
  const err = dict(lang).errors;
  const fx = useFx();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [needName, setNeedName] = useState(false);
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const [pending, start] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);

  // Resend countdown
  useEffect(() => {
    if (!resendAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resendAt]);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    setError("");
    if (!normalizePhone(phone)) return setError(err.phone);
    start(async () => {
      const res = await requestCode(phone);
      if (!res.ok) {
        setError(res.error);
        if (res.resendIn) setResendAt(Date.now() + res.resendIn * 1000);
        return;
      }
      setSent({ where: res.where, demoCode: res.demoCode });
      setCode("");
      setNow(Date.now());
      setResendAt(Date.now() + res.resendIn * 1000);
      setTimeout(() => codeRef.current?.focus(), 50);
    });
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{4}$/.test(code)) return setError(err.codeFormat);
    start(async () => {
      const res = await confirmCode(phone, code, needName ? name : undefined);
      if (!res.ok) {
        if (res.needName) setNeedName(true);
        return setError(needName || !res.needName ? res.error : "");
      }
      fx.toast(t.welcome, "MJ");
      router.refresh();
    });
  };

  return (
    <section className={s.signIn} aria-labelledby="signin-title">
      <div className={s.signInCard}>
        <div className={s.kicker}>{t.kicker}</div>
        <h1 id="signin-title" className={s.title}>
          {t.title}
        </h1>
        <div className={s.rule} />
        <p className={s.lead}>{t.lead}</p>

        {!sent ? (
          <form onSubmit={send} noValidate className={s.form}>
            <label className={s.label}>
              {t.phone}
              <span className={s.phoneRow}>
                <span className={s.prefix}>+992</span>
                <input name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98 103 11 11" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
              </span>
            </label>
            <button type="submit" className={s.primary} disabled={pending}>
              {pending ? t.sending : t.getCode}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} noValidate className={s.form}>
            <p className={s.sentNote} role="status">
              {t.sent(sent.where, phone.replace(/^\+?992/, "").trim())}{" "}
              <button type="button" className={s.linkBtn} onClick={() => (setSent(null), setNeedName(false), setError(""))}>
                {t.changePhone}
              </button>
            </p>
            {sent.demoCode && (
              <div className={s.demo}>
                {t.demo} <b>{sent.demoCode}</b>
              </div>
            )}
            <label className={s.label}>
              {t.code}
              <input
                ref={codeRef}
                name="code"
                className={s.codeInput}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </label>
            {needName && (
              <label className={s.label}>
                {t.askName}
                <input name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                <span className={s.hint}>{t.newGuest}</span>
              </label>
            )}
            <button type="submit" className={s.primary} disabled={pending || code.length !== 4}>
              {pending ? t.checking : t.enter}
            </button>
            <button type="button" className={s.linkBtn} disabled={pending || wait > 0} onClick={() => send()}>
              {wait > 0 ? t.resendIn(wait) : t.resend}
            </button>
          </form>
        )}
        {error && (
          <div role="alert" className={s.error}>
            {error}
          </div>
        )}
        <p className={s.small}>
          {t.note}
        </p>
      </div>
    </section>
  );
}
