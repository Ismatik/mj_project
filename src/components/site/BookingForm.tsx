"use client";

import { useRef, useState, type FormEvent } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { validateSiteBooking, type SiteBookingInput } from "@/lib/site-booking";
import { requestBooking } from "@/app/site-actions";
import s from "./booking.module.css";

type FieldId = "name" | "phone" | "date";
const FIELDS: { id: FieldId; label: string; type: string; auto: string }[] = [
  { id: "name", label: "Ваше имя", type: "text", auto: "given-name" },
  { id: "phone", label: "Телефон", type: "tel", auto: "tel" },
  { id: "date", label: "Дата визита", type: "date", auto: "off" },
];

const EMPTY: SiteBookingInput = { name: "", phone: "", date: "", service: "" };

export function BookingForm({ services, today, preview }: { services: string[]; today: string; preview?: boolean }) {
  const fx = useFx();
  const submitRef = useRef<HTMLButtonElement>(null);
  const [v, setV] = useState<SiteBookingInput>(EMPTY);
  const [company, setCompany] = useState("");
  const [touched, setTouched] = useState<Partial<Record<FieldId, boolean>>>({});
  const [focus, setFocus] = useState<FieldId | null>(null);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<SiteBookingInput | null>(null);
  const [serverError, setServerError] = useState("");

  const errors = validateSiteBooking(v, today, services);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setServerError("");
    if (Object.keys(errors).length) return;
    if (preview) return setServerError("Это предпросмотр — заявки отсюда не отправляются.");
    setSending(true);
    try {
      const res = await requestBooking({ ...v, company });
      if (!res.ok) {
        setServerError(res.message ?? Object.values(res.errors)[0] ?? "Проверьте поля формы");
        return;
      }
      if (submitRef.current) fx.sparkle(submitRef.current);
      await new Promise((r) => setTimeout(r, 250));
      setDone(v);
    } catch {
      setServerError("Не получилось отправить. Позвоните нам или напишите в WhatsApp.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    const dateText = new Date(`${done.date}T12:00:00`).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
    return (
      <div className={s.done} role="status">
        <div className={s.doneKicker}>Заявка принята</div>
        <div className={s.doneTitle}>Спасибо, {done.name.trim()}!</div>
        <p className={s.doneText}>
          Ждём вас {dateText} · {done.service.toLowerCase()}. Администратор позвонит на {done.phone} и подтвердит время.
        </p>
        <button
          type="button"
          className={s.again}
          onClick={() => {
            setV(EMPTY);
            setTouched({});
            setTried(false);
            setDone(null);
          }}
        >
          Новая запись
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={s.form}>
      {/* Honeypot for bots — hidden from people and screen readers */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className={s.honeypot}
        value={company}
        onChange={(e) => setCompany(e.target.value)}
      />
      <div className={s.fields}>
        {FIELDS.map((f) => {
          const value = v[f.id];
          const err = errors[f.id];
          const shown = !!err && (touched[f.id] || tried);
          const focused = focus === f.id;
          const up = focused || !!value || f.type === "date";
          return (
            <div key={f.id} className={s.field}>
              <label className={s.floating}>
                <input
                  type={f.type}
                  name={f.id}
                  value={value}
                  min={f.type === "date" ? today : undefined}
                  autoComplete={f.auto}
                  inputMode={f.type === "tel" ? "tel" : undefined}
                  aria-invalid={shown}
                  aria-describedby={shown ? `err-${f.id}` : undefined}
                  onChange={(e) => setV({ ...v, [f.id]: e.target.value })}
                  onFocus={() => setFocus(f.id)}
                  onBlur={() => {
                    setFocus(null);
                    setTouched((t) => ({ ...t, [f.id]: true }));
                  }}
                  className={`${s.input} ${shown ? s.inputError : focused ? s.inputFocus : ""}`}
                />
                <span className={`${s.label} ${up ? s.labelUp : ""} ${shown ? s.labelError : focused ? s.labelFocus : ""}`}>{f.label}</span>
                {!!value && !err && !focused && (
                  <span className={s.ok} aria-hidden="true">
                    ✓
                  </span>
                )}
              </label>
              {shown && (
                <div id={`err-${f.id}`} role="alert" className={s.error}>
                  {err}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <fieldset className={s.services}>
        <legend className={`${s.servicesLabel} ${tried && errors.service ? s.labelError : ""}`}>Услуга</legend>
        <div className={s.chips}>
          {services.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={v.service === name}
              className={`${s.chip} ${v.service === name ? s.chipOn : ""}`}
              onClick={() => setV({ ...v, service: name })}
            >
              {name}
            </button>
          ))}
        </div>
        {tried && errors.service && (
          <div role="alert" className={s.error}>
            Выберите услугу
          </div>
        )}
      </fieldset>

      <div className={s.submitRow}>
        <button ref={submitRef} type="submit" disabled={sending} className={s.submit}>
          {sending ? "Отправляем…" : "Записаться"}
        </button>
        <span className={s.hours}>Вт–Вс, 09:00–18:00 · понедельник — выходной</span>
      </div>
      {serverError && (
        <div role="alert" className={s.error}>
          {serverError}
        </div>
      )}
    </form>
  );
}
