"use client";

import { useState } from "react";
import { joinWaitlistOnline } from "@/app/waitlist-actions";
import { dict } from "@/lib/i18n/dict";
import { waitlistDict } from "@/lib/i18n/dict-waitlist";
import type { Lang } from "@/lib/i18n/locales";
import s from "./booking.module.css";

const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

/** "Let me know if a time opens up": the waitlist for a full (or unsuitable) day. Not a <form>: it sits inside the booking form. */
export function WaitlistJoin({ serviceId, staffId, date, name: initialName, phone: initialPhone, lang, open: startOpen, preview }: { serviceId: string; staffId: string | null; date: string; name: string; phone: string; lang: Lang; open?: boolean; preview?: boolean }) {
  const w = waitlistDict(lang);
  const b = dict(lang).booking;
  const [open, setOpen] = useState(!!startOpen);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  if (done) return <div className={s.promoApplied} role="status">{done}</div>;
  if (!open)
    return (
      <button type="button" className={s.linkBtn} onClick={() => setOpen(true)}>
        {w.join}
      </button>
    );
  return (
    <div className={s.waitlist} role="group" aria-label={w.join}>
      <p className={s.hint}>{w.joinHint}</p>
      <div className={s.promo}>
        <input aria-label={b.name} placeholder={b.name} name="wl-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        <input aria-label={b.phone} placeholder={b.phone} name="wl-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
      </div>
      <div className={s.promo}>
        <label className={s.hint}>
          {w.window}{" "}
          <select aria-label={w.from} value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">{w.anyTime}</option>
            {HOURS.slice(0, -1).map((h) => (
              <option key={h} value={h}>
                {w.from} {h}
              </option>
            ))}
          </select>{" "}
          <select aria-label={w.to} value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">-</option>
            {HOURS.slice(1).map((h) => (
              <option key={h} value={h}>
                {w.to} {h}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={sending || preview}
          onClick={async () => {
            setError("");
            setSending(true);
            try {
              const res = await joinWaitlistOnline({ serviceId, staffId, date, timeFrom: from || null, timeTo: to || null, name, phone });
              if (!res.ok) return setError(res.error);
              setDone(res.message);
            } finally {
              setSending(false);
            }
          }}
        >
          {w.submit}
        </button>
        {error && (
          <div role="alert" className={s.error}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
