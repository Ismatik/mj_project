"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { normalizePhone } from "@/lib/phone";
import { confirmCode, requestCode } from "./actions";
import s from "./kabinet.module.css";

type Sent = { where: string; demoCode?: string };

/** Phone → 4-digit code (→ name, for a first visit). */
export function SignIn() {
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
    if (!normalizePhone(phone)) return setError("Нужно 9 цифр, например 98 103 11 11");
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
    if (!/^\d{4}$/.test(code)) return setError("Код — 4 цифры");
    start(async () => {
      const res = await confirmCode(phone, code, needName ? name : undefined);
      if (!res.ok) {
        if (res.needName) setNeedName(true);
        return setError(needName || !res.needName ? res.error : "");
      }
      fx.toast("Добро пожаловать в личный кабинет", "MJ");
      router.refresh();
    });
  };

  return (
    <section className={s.signIn} aria-labelledby="signin-title">
      <div className={s.signInCard}>
        <div className={s.kicker}>Личный кабинет</div>
        <h1 id="signin-title" className={s.title}>
          Ваши записи — в одном месте
        </h1>
        <div className={s.rule} />
        <p className={s.lead}>Смотрите и переносите записи, записывайтесь снова в одно касание и отмечайте любимого мастера. Вход — по коду, без пароля.</p>

        {!sent ? (
          <form onSubmit={send} noValidate className={s.form}>
            <label className={s.label}>
              Номер телефона
              <span className={s.phoneRow}>
                <span className={s.prefix}>+992</span>
                <input name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98 103 11 11" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
              </span>
            </label>
            <button type="submit" className={s.primary} disabled={pending}>
              {pending ? "Отправляем…" : "Получить код"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} noValidate className={s.form}>
            <p className={s.sentNote} role="status">
              Код отправлен {sent.where} на номер +992 {phone.replace(/^\+?992/, "").trim()}.{" "}
              <button type="button" className={s.linkBtn} onClick={() => (setSent(null), setNeedName(false), setError(""))}>
                Изменить номер
              </button>
            </p>
            {sent.demoCode && (
              <div className={s.demo}>
                Демо-режим: сообщения пока не уходят гостям. Ваш код — <b>{sent.demoCode}</b>
              </div>
            )}
            <label className={s.label}>
              Код из сообщения
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
                Как к вам обращаться?
                <input name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                <span className={s.hint}>Вы у нас впервые — создадим карточку гостьи.</span>
              </label>
            )}
            <button type="submit" className={s.primary} disabled={pending || code.length !== 4}>
              {pending ? "Проверяем…" : "Войти"}
            </button>
            <button type="button" className={s.linkBtn} disabled={pending || wait > 0} onClick={() => send()}>
              {wait > 0 ? `Отправить код ещё раз через ${wait} с` : "Отправить код ещё раз"}
            </button>
          </form>
        )}
        {error && (
          <div role="alert" className={s.error}>
            {error}
          </div>
        )}
        <p className={s.small}>
          Код приходит в Telegram-бот салона, если вы им пользуетесь, иначе — в WhatsApp или по SMS.
        </p>
      </div>
    </section>
  );
}
