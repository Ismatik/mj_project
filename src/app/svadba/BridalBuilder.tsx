"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { packagePrice } from "@/lib/bridal";
import { bridalDict } from "@/lib/i18n/dict-bridal";
import { MONTHS, somoni, WEEKDAYS } from "@/lib/i18n/format";
import type { Lang } from "@/lib/i18n/locales";
import { weekdayOf } from "@/lib/time";
import type { BridalOptions, BridalResult } from "@/server/bridal";
import { dressesTaken, sendBridal, trialSlots } from "../bridal-actions";
import b from "@/components/site/booking.module.css";
import s from "./bridal.module.css";

const localPhone = (e164: string) => e164.replace(/^\+992(\d{2})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4");

export function BridalBuilder({ options, lang, minDate, trialDates, guest }: { options: BridalOptions; lang: Lang; minDate: string; trialDates: string[]; guest: { name: string; phone: string } | null }) {
  const t = bridalDict(lang);
  const [wedding, setWedding] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [dressId, setDressId] = useState<string | null>(null);
  const [taken, setTaken] = useState<string[] | null>(null);
  const [wantTrial, setWantTrial] = useState(false);
  const [trialDate, setTrialDate] = useState("");
  const [trialTimes, setTrialTimes] = useState<string[] | null>(null);
  const [trialTime, setTrialTime] = useState("");
  const [name, setName] = useState(guest?.name ?? "");
  const [phone, setPhone] = useState(guest ? localPhone(guest.phone) : "");
  const [note, setNote] = useState("");
  const [company, setCompany] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Extract<BridalResult, { ok: true }> | null>(null);

  useEffect(() => {
    if (!wedding) return;
    let alive = true;
    dressesTaken(wedding).then((ids) => {
      if (!alive) return;
      setTaken(ids);
      setDressId((cur) => (cur && ids.includes(cur) ? null : cur));
    });
    return () => {
      alive = false;
    };
  }, [wedding]);
  useEffect(() => {
    if (!trialDate) return;
    let alive = true;
    trialSlots(trialDate).then((list) => alive && setTrialTimes(list));
    return () => {
      alive = false;
    };
  }, [trialDate]);

  const services = options.groups.flatMap((g) => g.services).filter((x) => picked.includes(x.id));
  const dress = options.dresses.find((x) => x.id === dressId) ?? null;
  const price = useMemo(() => packagePrice(services, dress, { ...options.rules, trialServiceId: null }), [services, dress, options.rules]);
  const money = (n: number) => somoni(n, lang);
  const trialDays = trialDates.filter((x) => !wedding || x < wedding);

  if (done)
    return (
      <div className={s.doneBox} role="status">
        <div className={s.kicker}>{t.kicker}</div>
        <h2 className={s.doneTitle}>{t.done(done.number)}</h2>
        <p className={s.lead}>{t.doneText}</p>
        {done.trial?.ok && <p className={s.lead}>{t.trialBooked(done.trial.when)}</p>}
        {done.trial && !done.trial.ok && <p className={b.error}>{done.trial.error}</p>}
        {done.trial?.ok && done.trial.payment && (
          <>
            <p className={s.lead}>{t.trialPay(money(done.trial.payment.amount), done.trial.payment.payBy)}</p>
            <Link href={done.trial.payment.url} className={b.submit}>
              {t.payTrial(money(done.trial.payment.amount))}
            </Link>
          </>
        )}
      </div>
    );

  return (
    <form
      className={s.layout}
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setSending(true);
        try {
          const res = await sendBridal({ weddingDate: wedding, serviceIds: picked, dressId, trial: wantTrial && trialDate && trialTime ? { date: trialDate, time: trialTime } : null, name, phone, note, company });
          if (!res.ok) return setError(res.error);
          setDone(res);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } finally {
          setSending(false);
        }
      }}
    >
      <div className={s.main}>
        <input className={b.honeypot} tabIndex={-1} autoComplete="off" name="company" value={company} onChange={(e) => setCompany(e.target.value)} aria-hidden="true" />

        <fieldset className={b.step}>
          <legend className={b.stepLabel}>
            <span>1</span> {t.steps.date}
          </legend>
          <input type="date" name="wedding" className={s.dateInput} min={minDate} value={wedding} onChange={(e) => setWedding(e.target.value)} aria-label={t.steps.date} />
        </fieldset>

        <fieldset className={b.step}>
          <legend className={b.stepLabel}>
            <span>2</span> {t.steps.services}
          </legend>
          <div className={b.hint}>{t.discountHint(options.rules.discountPercent, options.rules.minServices)}</div>
          {options.groups.map((g) => (
            <div key={g.id} className={s.group}>
              <div className={s.groupName}>{g.name}</div>
              <div className={b.services}>
                {g.services.map((x) => {
                  const on = picked.includes(x.id);
                  return (
                    <button key={x.id} type="button" aria-pressed={on} className={`${b.service} ${on ? b.serviceOn : ""}`} onClick={() => setPicked(on ? picked.filter((p) => p !== x.id) : [...picked, x.id])}>
                      <span className={b.serviceName}>{x.name}</span>
                      <span className={b.serviceMeta}>
                        <b>{money(x.price)}</b>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </fieldset>

        <fieldset className={b.step}>
          <legend className={b.stepLabel}>
            <span>3</span> {t.steps.dress}
          </legend>
          {!wedding && <div className={b.hint}>{t.dressPickDate}</div>}
          <div className={s.dresses}>
            <button type="button" aria-pressed={!dressId} className={`${b.service} ${!dressId ? b.serviceOn : ""}`} onClick={() => setDressId(null)}>
              <span className={b.serviceName}>{t.noDress}</span>
            </button>
            {options.dresses.map((x) => {
              const busy = !wedding || taken === null || taken.includes(x.id);
              const on = x.id === dressId;
              return (
                <button key={x.id} type="button" disabled={busy} aria-pressed={on} className={`${b.service} ${on ? b.serviceOn : ""} ${busy ? s.taken : ""}`} onClick={() => setDressId(x.id)}>
                  <span className={b.serviceName}>{x.name}</span>
                  <span className={b.serviceMeta}>
                    {t.dressTypes[x.type]} · {t.size} {x.size}
                  </span>
                  <span className={b.serviceMeta}>{wedding && taken?.includes(x.id) ? t.dressTaken : <b>{t.perDay(money(x.pricePerDay))}</b>}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {options.trial && (
          <fieldset className={b.step}>
            <legend className={b.stepLabel}>
              <span>4</span> {t.steps.trial}
            </legend>
            <label className={s.check}>
              <input type="checkbox" name="trial" checked={wantTrial} onChange={(e) => setWantTrial(e.target.checked)} /> {t.trialWant}
            </label>
            {wantTrial && (
              <>
                <div className={b.hint}>{t.trialHint(money(options.trial.price), options.trial.depositPercent)}</div>
                <div className={b.dates}>
                  {trialDays.map((x) => (
                    <button
                      key={x}
                      type="button"
                      aria-pressed={x === trialDate}
                      className={`${b.date} ${x === trialDate ? b.dateOn : ""}`}
                      onClick={() => {
                        setTrialDate(x);
                        setTrialTimes(null);
                        setTrialTime("");
                      }}
                    >
                      <small>{WEEKDAYS[lang][weekdayOf(x)]}</small>
                      <b>{Number(x.slice(8))}</b>
                      <small>{MONTHS[lang][Number(x.slice(5, 7)) - 1]}</small>
                    </button>
                  ))}
                </div>
                {trialDate && trialTimes && trialTimes.length === 0 && <div className={b.hint}>{t.trialNoTimes}</div>}
                {trialDate && trialTimes && trialTimes.length > 0 && (
                  <div className={b.times} aria-label={t.steps.trial}>
                    {trialTimes.map((x) => (
                      <button key={x} type="button" aria-pressed={x === trialTime} className={`${b.time} ${x === trialTime ? b.timeOn : ""}`} onClick={() => setTrialTime(x)}>
                        {x}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </fieldset>
        )}

        <fieldset className={b.step}>
          <legend className={b.stepLabel}>
            <span>{options.trial ? 5 : 4}</span> {t.steps.contacts}
          </legend>
          <div className={b.fields}>
            <input className={b.input} style={{ padding: "14px 15px" }} name="name" placeholder={t.name} aria-label={t.name} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            <input className={b.input} style={{ padding: "14px 15px" }} name="phone" placeholder={`${t.phone} · 98 103 11 11`} aria-label={t.phone} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </div>
          <textarea className={s.textarea} name="note" rows={2} placeholder={t.note} aria-label={t.note} value={note} onChange={(e) => setNote(e.target.value)} />
        </fieldset>
        {error && (
          <div role="alert" className={b.error}>
            {error}
          </div>
        )}
      </div>

      <aside className={s.summary} aria-label={t.summary}>
        <div className={s.summaryTitle}>{t.summary}</div>
        {services.map((x) => (
          <div key={x.id} className={s.line}>
            <span>{x.name}</span>
            <b>{money(x.price)}</b>
          </div>
        ))}
        {price.discount > 0 && (
          <div className={`${s.line} ${s.discount}`}>
            <span>{t.discount(price.discountPercent)}</span>
            <b>−{money(price.discount)}</b>
          </div>
        )}
        {dress && (
          <div className={s.line}>
            <span>
              {t.dressLine(options.rules.dressDays)}: {dress.name}
            </span>
            <b>{money(price.dressSum)}</b>
          </div>
        )}
        <div className={s.totalLine}>
          <span>{t.total}</span>
          <b data-testid="total">{money(price.total)}</b>
        </div>
        {wantTrial && options.trial && trialTime && (
          <div className={s.line}>
            <span>
              {t.trialLine}, {trialDate.split("-").reverse().slice(0, 2).join(".")} {trialTime}
              <br />
              <small className={s.note}>{t.trialSeparate}</small>
            </span>
            <b>{money(options.trial.price)}</b>
          </div>
        )}
        <div className={s.note}>{t.totalNote}</div>
        <button type="submit" className={b.submit} style={{ background: "var(--mj-gold)", color: "var(--mj-ink)" }} disabled={sending || !wedding || !picked.length}>
          {sending ? t.sending : t.submit}
        </button>
      </aside>
    </form>
  );
}
