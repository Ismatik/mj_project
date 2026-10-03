"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { toClock, validateBooking, type BookingErrors, type Busy } from "@/lib/booking";
import { somoni } from "@/lib/format";
import { addDays, isClosed, weekdayOf, WEEKDAYS_SHORT } from "@/lib/time";
import type { SearchHit } from "@/server/search";
import { createBooking, getBookingOptions, getBusy, type BookingOptions } from "./booking-actions";
import s from "./booking.module.css";

type Guest = { id: string; name: string; phone: string } | null;

const nowMinutes = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dushanbe" }));
  return d.getHours() * 60 + d.getMinutes();
};

export function NewBooking({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const fx = useFx();

  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [guest, setGuest] = useState<Guest>(null);
  const [newGuest, setNewGuest] = useState(false);
  const [guestQuery, setGuestQuery] = useState("");
  const [guestHits, setGuestHits] = useState<SearchHit[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Busy[]>([]);
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState<BookingErrors>({});
  const [saving, setSaving] = useState(false);

  // Open/close the native dialog (focus trap + Esc come with it)
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Load services and masters the first time the dialog opens
  useEffect(() => {
    if (!open || options) return;
    getBookingOptions()
      .then((o) => {
        setOptions(o);
        setDate(isClosed(o.today) ? addDays(o.today, 1) : o.today);
      })
      .catch(() => setLoadError("Не удалось загрузить услуги. Обновите страницу."));
  }, [open, options]);

  // Guest typeahead
  useEffect(() => {
    const term = guestQuery.trim();
    if (term.length < 2 || guest || newGuest) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cms/search?only=guests&q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setGuestHits((await res.json()).guests);
      } catch {
        /* aborted */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [guestQuery, guest, newGuest]);

  // Existing bookings of the chosen masters that day
  useEffect(() => {
    if (!staffIds.length || !date) return;
    let alive = true;
    getBusy(staffIds, date).then((b) => alive && setBusy(b)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [staffIds, date]);

  const services = useMemo(() => options?.categories.flatMap((c) => c.services) ?? [], [options]);
  const service = services.find((x) => x.id === serviceId);
  const staffById = useMemo(() => new Map(options?.staff.map((m) => [m.id, m]) ?? []), [options]);
  const qualified = options?.staff.filter((m) => service?.staffIds.includes(m.id)) ?? [];
  const wd = date ? weekdayOf(date) : -1;

  const input = {
    guestId: guest?.id ?? null,
    guestName: name,
    guestPhone: phone,
    serviceId,
    staffIds,
    date,
    time,
    durationMin: service?.durationMin ?? 60,
    price: Number(price),
  };
  const visibleBusy = staffIds.length && date ? busy : [];
  const clientErrors =
    options && tried
      ? validateBooking(
          { ...input, guestId: guest?.id ?? (newGuest ? null : "pending"), guestName: newGuest ? name : "", guestPhone: phone },
          {
            today: options.today,
            nowMinutes: nowMinutes(),
            workDays: Object.fromEntries(options.staff.map((m) => [m.id, m.workDays])),
            staffNames: Object.fromEntries(options.staff.map((m) => [m.id, m.name])),
            busy: visibleBusy,
          },
        )
      : {};
  const guestMissing = tried && !guest && !newGuest ? "Найдите гостью или добавьте новую" : undefined;
  const errors: BookingErrors = { ...clientErrors, ...serverErrors, ...(guestMissing ? { guest: guestMissing } : {}) };

  function reset() {
    setGuest(null);
    setNewGuest(false);
    setGuestQuery("");
    setGuestHits([]);
    setName("");
    setPhone("");
    setServiceId("");
    setStaffIds([]);
    setTime("");
    setPrice("");
    setNote("");
    setBusy([]);
    setTried(false);
    setServerErrors({});
    if (options) setDate(isClosed(options.today) ? addDays(options.today, 1) : options.today);
  }

  function close() {
    onClose();
  }

  function pickService(id: string) {
    setServiceId(id);
    setServerErrors({});
    const svc = services.find((x) => x.id === id);
    if (!svc) return;
    setPrice(String(svc.price));
    // Keep chosen masters who can do it; otherwise preselect the only qualified one
    setStaffIds((ids) => {
      const keep = ids.filter((m) => svc.staffIds.includes(m));
      return keep.length ? keep : svc.staffIds.length === 1 ? [svc.staffIds[0]!] : [];
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    setServerErrors({});
    if (!options) return;
    const local = validateBooking(
      { ...input, guestId: guest?.id ?? (newGuest ? null : "pending"), guestName: newGuest ? name : "" },
      {
        today: options.today,
        nowMinutes: nowMinutes(),
        workDays: Object.fromEntries(options.staff.map((m) => [m.id, m.workDays])),
        staffNames: Object.fromEntries(options.staff.map((m) => [m.id, m.name])),
        busy: visibleBusy,
      },
    );
    if (Object.keys(local).length || (!guest && !newGuest)) return;

    setSaving(true);
    try {
      const res = await createBooking({ ...input, guestName: newGuest ? name : "", note });
      if (!res.ok) {
        setServerErrors(res.errors);
        return;
      }
      if (submitRef.current) fx.sparkle(submitRef.current);
      fx.toast(`Записали: ${res.message}`, "Запись");
      reset();
      close();
      router.refresh();
    } catch {
      setServerErrors({ guest: "Не получилось сохранить. Проверьте соединение и попробуйте ещё раз." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className={s.dialog} aria-labelledby="nb-title" onClose={close} onCancel={close}>
      <form onSubmit={submit} noValidate className={s.form}>
        <div className={s.head}>
          <h2 id="nb-title" className={s.title}>
            Новая запись
          </h2>
          <button type="button" className={s.close} aria-label="Закрыть" onClick={close}>
            <X size={18} />
          </button>
        </div>

        {loadError && <div className={s.error}>{loadError}</div>}
        {!options && !loadError && <div className={s.muted}>Загружаем услуги…</div>}

        {options && (
          <div className={s.body}>
            {/* Guest */}
            <fieldset className={s.fieldset}>
              <legend className={s.label}>Гостья</legend>
              {guest ? (
                <div className={s.chosen}>
                  <div>
                    <div className={s.chosenName}>{guest.name}</div>
                    <div className={s.muted}>{guest.phone}</div>
                  </div>
                  <button type="button" className={s.link} onClick={() => setGuest(null)}>
                    Сменить
                  </button>
                </div>
              ) : newGuest ? (
                <div className={s.row2}>
                  <label className={s.sub}>
                    <span>Имя и фамилия</span>
                    <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-invalid={!!errors.guest} />
                  </label>
                  <label className={s.sub}>
                    <span>Телефон</span>
                    <input
                      className={inputClass}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      inputMode="tel"
                      placeholder="+992 98 103 11 11"
                      aria-invalid={!!errors.phone}
                    />
                  </label>
                  <button type="button" className={s.link} onClick={() => setNewGuest(false)}>
                    ← Найти в книге гостей
                  </button>
                </div>
              ) : (
                <div className={s.typeahead}>
                  <input
                    className={inputClass}
                    placeholder="Имя или телефон"
                    value={guestQuery}
                    onChange={(e) => {
                      setGuestQuery(e.target.value);
                      if (e.target.value.trim().length < 2) setGuestHits([]);
                    }}
                    aria-invalid={!!errors.guest}
                    autoComplete="off"
                  />
                  {guestQuery.trim().length >= 2 && (
                    <div className={s.hits}>
                      {guestHits.map((h) => (
                        <button
                          type="button"
                          key={h.id}
                          className={s.hit}
                          onClick={() => {
                            setGuest({ id: h.id, name: h.title, phone: h.sub });
                            setGuestHits([]);
                            setServerErrors({});
                          }}
                        >
                          <span className={s.chosenName}>{h.title}</span>
                          <span className={s.muted}>{h.sub}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className={s.hit}
                        onClick={() => {
                          setNewGuest(true);
                          const digits = guestQuery.replace(/\D/g, "");
                          if (digits.length >= 6) setPhone(guestQuery);
                          else setName(guestQuery);
                        }}
                      >
                        <span className={s.chosenName}>+ Новая гостья «{guestQuery.trim()}»</span>
                      </button>
                    </div>
                  )}
                  {guestQuery.trim().length < 2 && (
                    <button type="button" className={s.link} onClick={() => setNewGuest(true)}>
                      + Новая гостья
                    </button>
                  )}
                </div>
              )}
              {(errors.guest || errors.phone) && <div className={s.error}>{errors.guest ?? errors.phone}</div>}
            </fieldset>

            {/* Service */}
            <label className={s.fieldset}>
              <span className={s.label}>Услуга</span>
              <select className={inputClass} value={serviceId} onChange={(e) => pickService(e.target.value)} aria-invalid={!!errors.service}>
                <option value="">Выберите услугу</option>
                {options.categories.map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    {c.services.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} · {x.durationMin} мин · {somoni(x.price)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {errors.service && <div className={s.error}>{errors.service}</div>}
            </label>

            {/* Masters */}
            <fieldset className={s.fieldset}>
              <legend className={s.label}>Мастер</legend>
              {!service && <div className={s.muted}>Сначала выберите услугу</div>}
              <div className={s.chips}>
                {qualified.map((m) => {
                  const on = staffIds.includes(m.id);
                  const off = wd >= 0 && !m.workDays.includes(wd);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      className={`${s.chip} ${on ? s.chipOn : ""} ${off ? s.chipOff : ""}`}
                      aria-pressed={on}
                      onClick={() => {
                        setServerErrors({});
                        setStaffIds((ids) => (on ? ids.filter((x) => x !== m.id) : [...ids, m.id]));
                      }}
                    >
                      {m.name}
                      <small>{off ? `выходной (${WEEKDAYS_SHORT[wd]})` : m.title}</small>
                    </button>
                  );
                })}
              </div>
              {errors.staff && <div className={s.error}>{errors.staff}</div>}
            </fieldset>

            {/* Date & time */}
            <div className={s.row2}>
              <label className={s.fieldset}>
                <span className={s.label}>Дата</span>
                <input
                  type="date"
                  className={inputClass}
                  value={date}
                  min={options.today}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setServerErrors({});
                  }}
                  aria-invalid={!!errors.date}
                />
                {errors.date && <div className={s.error}>{errors.date}</div>}
              </label>
              <label className={s.fieldset}>
                <span className={s.label}>Время</span>
                <input
                  type="time"
                  className={inputClass}
                  value={time}
                  step={900}
                  min="08:00"
                  max="18:00"
                  onChange={(e) => {
                    setTime(e.target.value);
                    setServerErrors({});
                  }}
                  aria-invalid={!!errors.time}
                />
                {errors.time && <div className={s.error}>{errors.time}</div>}
              </label>
            </div>
            {visibleBusy.length > 0 && (
              <div className={s.busy}>
                <span className={s.label}>Уже занято</span>
                {visibleBusy.map((b, i) => (
                  <div key={i}>
                    {staffById.get(b.staffId)?.name}: {toClock(b.start)}-{toClock(b.end)} · {b.label}
                  </div>
                ))}
              </div>
            )}

            {/* Price & note */}
            <div className={s.row2}>
              <label className={s.fieldset}>
                <span className={s.label}>Цена, сомони</span>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
                  aria-invalid={!!errors.price}
                />
                {errors.price && <div className={s.error}>{errors.price}</div>}
              </label>
              <div className={s.fieldset}>
                <span className={s.label}>Длительность</span>
                <div className={s.static}>{service ? `${service.durationMin} мин` : "-"}</div>
              </div>
            </div>
            <label className={s.fieldset}>
              <span className={s.label}>Комментарий</span>
              <textarea className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Пожелания, аллергии, повод" />
            </label>
          </div>
        )}

        <div className={s.actions}>
          <Button type="button" variant="outline" onClick={close}>
            Отмена
          </Button>
          <Button type="submit" ref={submitRef} disabled={!options || saving}>
            {saving ? "Записываем…" : "Записать"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
