"use client";

import { useState, useTransition, type FormEvent } from "react";
import { moneyDict } from "@/lib/i18n/dict-money";
import { somoni } from "@/lib/i18n/format";
import type { Lang } from "@/lib/i18n/locales";
import { GIFT_PRESETS } from "@/lib/money";
import { buyGiftCard } from "../pay-actions";
import s from "../money.module.css";

const localPhone = (e164: string) => e164.replace(/^\+992(\d{2})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4");

export function GiftForm({ lang, buyer }: { lang: Lang; buyer: { name: string; phone: string } | null }) {
  const g = moneyDict(lang).gift;
  const [amount, setAmount] = useState<number>(1000);
  const [custom, setCustom] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState(buyer?.name ?? "");
  const [phone, setPhone] = useState(buyer ? localPhone(buyer.phone) : "");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [pending, start] = useTransition();
  const value = custom ? Number(custom.replace(/\D/g, "")) : amount;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await buyGiftCard({ amount: value, recipientName: recipient, message, buyerName: name, buyerPhone: phone, company });
      if (!res.ok) return setError({ field: res.field, text: res.error });
      window.location.href = res.url;
    });
  };
  const err = (field: string) =>
    error?.field === field && (
      <span role="alert" className={s.error}>
        {error.text}
      </span>
    );

  return (
    <form onSubmit={submit} noValidate className={s.form}>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -10000 }} value={company} onChange={(e) => setCompany(e.target.value)} />
      <div className={s.label}>
        {g.amount}
        <div className={s.amounts} role="group" aria-label={g.amount}>
          {GIFT_PRESETS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={!custom && amount === a}
              onClick={() => {
                setAmount(a);
                setCustom("");
              }}
            >
              {somoni(a, lang)}
            </button>
          ))}
        </div>
        <input name="custom" inputMode="numeric" placeholder={g.custom} value={custom} onChange={(e) => setCustom(e.target.value)} aria-label={g.custom} />
        {err("amount")}
      </div>
      <label className={s.label}>
        {g.recipient} <small>{g.recipientHint}</small>
        <input name="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        {err("recipient")}
      </label>
      <label className={s.label}>
        {g.message} <small>{g.messageHint}</small>
        <textarea name="message" rows={3} maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <div className={s.two}>
        <label className={s.label}>
          {g.buyer}
          <input name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          {err("buyer")}
        </label>
        <label className={s.label}>
          {g.phone}
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98 103 11 11" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {err("phone")}
        </label>
      </div>
      <button type="submit" className={s.primary} disabled={pending}>
        {pending ? g.creating : g.pay(somoni(value || 0, lang))}
      </button>
      {error && !error.field && (
        <span role="alert" className={s.error}>
          {error.text}
        </span>
      )}
    </form>
  );
}
