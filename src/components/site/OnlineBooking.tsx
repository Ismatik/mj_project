"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { bookOnline, getSlots, requestCallback, type OnlineBookingResult } from "@/app/site-actions";
import { dict } from "@/lib/i18n/dict";
import { duration, MONTHS, somoni, WEEKDAYS } from "@/lib/i18n/format";
import { localePath, type Lang } from "@/lib/i18n/locales";
import { normalizePhone } from "@/lib/phone";
import { weekdayOf } from "@/lib/time";
import type { OnlineMenu } from "@/server/online-booking";
import s from "./booking.module.css";

type Summary = Extract<OnlineBookingResult, { ok: true }>["summary"];
/** Pre-selected service and master ("Записаться снова", a master's page) */
export type BookingPreset = { serviceId?: string; staffId?: string | null };

/** "+992981031111" → "98 103 11 11" for the phone field */
const localPhone = (e164: string) => e164.replace(/^\+992(\d{2})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4");

/** Online booking with real free times: service → master → date → time → contacts. */
export function OnlineBooking({
  menu,
  dates,
  preview,
  preset,
  guest,
  lang,
}: {
  menu: OnlineMenu;
  dates: string[];
  preview?: boolean;
  preset?: BookingPreset;
  guest?: { name: string; phone: string; favouriteStaffId?: string | null } | null;
  lang: Lang;
}) {
  const t = dict(lang);
  const b = t.booking;
  const fx = useFx();
  const submitRef = useRef<HTMLButtonElement>(null);
  const presetCat = preset?.serviceId ? menu.find((c) => c.services.some((x) => x.id === preset.serviceId)) : undefined;
  const [catId, setCatId] = useState(presetCat?.id ?? menu[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(presetCat ? preset!.serviceId! : "");
  const [staffId, setStaffId] = useState<string | null>(preset?.staffId ?? null);
  const [date, setDate] = useState(dates[0] ?? "");
  const [slots, setSlots] = useState<{ time: string; staffIds: string[] }[] | null>(null);
  const [time, setTime] = useState("");
  const [name, setName] = useState(guest?.name ?? "");
  const [phone, setPhone] = useState(guest ? localPhone(guest.phone) : "");
  const [company, setCompany] = useState("");
  const [focus, setFocus] = useState<"name" | "phone" | null>(null);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [done, setDone] = useState<Summary | null>(null);
  const [callback, setCallback] = useState<"closed" | "open" | "sent">("closed");

  const service = menu.flatMap((c) => c.services).find((x) => x.id === serviceId);
  const category = menu.find((c) => c.id === catId);

  // Load free times whenever service, master or date change
  useEffect(() => {
    if (!serviceId || !date) return;
    let alive = true;
    getSlots(serviceId, date, staffId)
      .then((list) => alive && setSlots(list))
      .catch(() => alive && setSlots([]));
    return () => {
      alive = false;
    };
  }, [serviceId, staffId, date]);

  const reset = (patch: () => void) => {
    patch();
    setSlots(null);
    setTime("");
    setError(null);
  };

  const nameError = name.trim().length < 2 ? t.errors.name : "";
  const phoneError = normalizePhone(phone) ? "" : t.errors.phone;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (!service || !time) return setError({ field: "slot", text: b.pickServiceTime });
    if (nameError || phoneError) return;
    if (preview) return setError({ text: b.preview });
    setSending(true);
    try {
      const res = await bookOnline({ serviceId, staffId, date, time, name, phone, company });
      if (!res.ok) {
        setError({ field: res.field, text: res.error });
        if (res.field === "slot") {
          setTime("");
          setSlots(await getSlots(serviceId, date, staffId));
        }
        return;
      }
      if (submitRef.current) fx.sparkle(submitRef.current);
      await new Promise((r) => setTimeout(r, 250));
      setDone(res.summary);
    } catch {
      setError({ text: b.failed });
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className={s.done} role="status">
        <div className={s.doneKicker}>{b.doneKicker}</div>
        <div className={s.doneTitle}>{b.doneTitle(done.name)}</div>
        <p className={s.doneText}>{b.doneText(done)}</p>
        {guest && (
          <a href={localePath(lang, "/kabinet")} className={s.again} style={{ marginRight: 12 }}>
            {b.myBookings}
          </a>
        )}
        <button
          type="button"
          className={s.again}
          onClick={() => {
            setDone(null);
            setServiceId("");
            setStaffId(preset?.staffId ?? null);
            setTime("");
            setSlots(null);
            setTried(false);
          }}
        >
          {b.again}
        </button>
      </div>
    );
  }

  const floating = (id: "name" | "phone", label: string, value: string, set: (v: string) => void, err: string, type: string, auto: string) => {
    const shown = !!err && tried;
    const up = focus === id || !!value;
    return (
      <div className={s.field}>
        <label className={s.floating}>
          <input
            type={type}
            name={id}
            value={value}
            autoComplete={auto}
            inputMode={type === "tel" ? "tel" : undefined}
            aria-invalid={shown}
            onChange={(e) => set(e.target.value)}
            onFocus={() => setFocus(id)}
            onBlur={() => setFocus(null)}
            className={`${s.input} ${shown ? s.inputError : focus === id ? s.inputFocus : ""}`}
          />
          <span className={`${s.label} ${up ? s.labelUp : ""} ${shown ? s.labelError : focus === id ? s.labelFocus : ""}`}>{label}</span>
          {!!value && !err && focus !== id && (
            <span className={s.ok} aria-hidden="true">
              ✓
            </span>
          )}
        </label>
        {shown && (
          <div role="alert" className={s.error}>
            {err}
          </div>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={submit} noValidate className={s.form}>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className={s.honeypot} value={company} onChange={(e) => setCompany(e.target.value)} />

      {/* 1. Service */}
      <fieldset className={s.step}>
        <legend className={s.stepLabel}>
          <span>1</span> {b.service}
        </legend>
        <div className={s.chips} role="tablist" aria-label={b.category}>
          {menu.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === catId} className={`${s.chip} ${c.id === catId ? s.chipOn : ""}`} onClick={() => setCatId(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        <div className={s.services}>
          {category?.services.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === serviceId}
              className={`${s.service} ${x.id === serviceId ? s.serviceOn : ""}`}
              onClick={() =>
                reset(() => {
                  setServiceId(x.id);
                  setStaffId(null);
                })
              }
            >
              <span className={s.serviceName}>{x.name}</span>
              <span className={s.serviceMeta}>
                {duration(x.durationMin, lang)} · <b>{somoni(x.price, lang)}</b>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {service && (
        <>
          {/* 2. Master */}
          <fieldset className={s.step}>
            <legend className={s.stepLabel}>
              <span>2</span> {b.master}
            </legend>
            <div className={s.chips}>
              <button type="button" aria-pressed={!staffId} className={`${s.chip} ${!staffId ? s.chipOn : ""}`} onClick={() => reset(() => setStaffId(null))}>
                {b.anyMaster}
              </button>
              {[...service.staff]
                .sort((a, b) => Number(b.id === guest?.favouriteStaffId) - Number(a.id === guest?.favouriteStaffId))
                .map((m) => (
                  <button key={m.id} type="button" aria-pressed={staffId === m.id} className={`${s.chip} ${staffId === m.id ? s.chipOn : ""}`} onClick={() => reset(() => setStaffId(m.id))} title={m.title}>
                    {m.id === guest?.favouriteStaffId ? `★ ${m.name}` : m.name}
                  </button>
                ))}
            </div>
          </fieldset>

          {/* 3. Date */}
          <fieldset className={s.step}>
            <legend className={s.stepLabel}>
              <span>3</span> {b.day}
            </legend>
            <div className={s.dates}>
              {dates.map((d) => (
                <button key={d} type="button" aria-pressed={d === date} className={`${s.date} ${d === date ? s.dateOn : ""}`} onClick={() => reset(() => setDate(d))}>
                  <small>{WEEKDAYS[lang][weekdayOf(d)]}</small>
                  <b>{Number(d.slice(8))}</b>
                  <small>{MONTHS[lang][Number(d.slice(5, 7)) - 1]}</small>
                </button>
              ))}
            </div>
            <div className={s.hint}>{b.dayOff}</div>
          </fieldset>

          {/* 4. Time */}
          <fieldset className={s.step}>
            <legend className={s.stepLabel}>
              <span>4</span> {b.time}
            </legend>
            {slots === null ? (
              <div className={s.times} aria-busy="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className={s.timeSkeleton} />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <div className={s.hint}>
                {date === dates[0] ? b.noneToday : b.noneThatDay}
              </div>
            ) : (
              <div className={s.times}>
                {slots.map((sl) => (
                  <button key={sl.time} type="button" aria-pressed={sl.time === time} className={`${s.time} ${sl.time === time ? s.timeOn : ""}`} onClick={() => setTime(sl.time)}>
                    {sl.time}
                  </button>
                ))}
              </div>
            )}
            {error?.field === "slot" && (
              <div role="alert" className={s.error}>
                {error.text}
              </div>
            )}
          </fieldset>

          {/* 5. Contacts */}
          {time && (
            <fieldset className={s.step}>
              <legend className={s.stepLabel}>
                <span>5</span> {b.yourDetails}
              </legend>
              <div className={s.fields}>
                {floating("name", b.name, name, setName, nameError, "text", "given-name")}
                {floating("phone", b.phone, phone, setPhone, phoneError, "tel", "tel")}
              </div>
            </fieldset>
          )}
        </>
      )}

      <div className={s.submitRow}>
        <button ref={submitRef} type="submit" disabled={sending || !time} className={s.submit}>
          {sending ? b.sending : time ? b.submitAt(time) : b.submit}
        </button>
        <span className={s.hours}>{b.hours}</span>
      </div>
      {error && error.field !== "slot" && (
        <div role="alert" className={s.error}>
          {error.text}
        </div>
      )}

      <Callback
        state={callback}
        setState={setCallback}
        service={service?.name ?? "Консультация"}
        date={date}
        preview={preview}
        onSent={() => fx.toast(b.callbackToast, "MJ")}
        lang={lang}
      />
    </form>
  );
}

function Callback({
  state,
  setState,
  service,
  date,
  preview,
  onSent,
  lang,
}: {
  state: "closed" | "open" | "sent";
  setState: (s: "closed" | "open" | "sent") => void;
  service: string;
  date: string;
  preview?: boolean;
  onSent: () => void;
  lang: Lang;
}) {
  const b = dict(lang).booking;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  if (state === "sent") return <div className={s.hint}>{b.callbackSent}</div>;
  if (state === "closed")
    return (
      <button type="button" className={s.linkBtn} onClick={() => setState("open")}>
        {b.callbackOpen}
      </button>
    );
  return (
    <div className={s.callback}>
      <input aria-label={b.callbackName} placeholder={b.callbackName} value={name} onChange={(e) => setName(e.target.value)} />
      <input aria-label={b.phone} placeholder={b.phone} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button
        type="button"
        onClick={async () => {
          if (preview) return setErr(b.previewShort);
          const res = await requestCallback({ name, phone, service, date });
          if (!res.ok) return setErr(res.error ?? b.failedShort);
          setState("sent");
          onSent();
        }}
      >
        {b.callbackSend}
      </button>
      {err && <div className={s.error}>{err}</div>}
    </div>
  );
}
