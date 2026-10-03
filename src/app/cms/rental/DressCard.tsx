"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { somoni } from "@/lib/format";
import type { DressData } from "@/server/rental";
import { bookDress, cancelDressBooking, setDressStatus } from "./actions";
import s from "./rental.module.css";

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const short = (ymd: string) => `${Number(ymd.slice(8))} ${MONTHS[Number(ymd.slice(5, 7)) - 1]}`;

export function DressCard({ dress, today }: { dress: DressData; today: string }) {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [booking, setBooking] = useState(false);
  const [form, setForm] = useState({ startsOn: today, days: "1", guestName: "", guestPhone: "" });
  const [error, setError] = useState("");

  const current = dress.bookings.find((b) => b.startsOn <= today && b.endsOn >= today);
  const next = dress.bookings[0];
  const status =
    dress.status === "CLEANING"
      ? { label: "В химчистке", tone: "pending" as const }
      : current
        ? { label: `У гостьи до ${short(current.endsOn)}`, tone: "chair" as const }
        : next
          ? { label: `Бронь ${short(next.startsOn)}`, tone: "chair" as const }
          : { label: "Свободно", tone: "done" as const };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, note: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Не получилось");
      setError("");
      after?.();
      fx.toast(note, "Прокат");
      router.refresh();
    });

  return (
    <article className={s.card}>
      <div className={s.cover}>
        <svg width="44" height="44" viewBox="0 0 48 48" style={{ overflow: "visible" }} aria-hidden="true">
          <rect x="7" y="4" width="34" height="30" fill="none" stroke="var(--mj-gold)" strokeWidth="2" />
          <text x="24" y="26" textAnchor="middle" fontFamily="var(--mj-serif)" fontSize="15" fontWeight="600" fill="var(--mj-gold)">
            MJ
          </text>
          <text x="24" y="43" textAnchor="middle" fontFamily="var(--mj-sans)" fontSize="4.6" letterSpacing="1.3" fill="var(--mj-gold)">
            {dress.type === "WEDDING" ? "СВАДЕБНОЕ" : "ВЕЧЕРНЕЕ"}
          </text>
        </svg>
      </div>
      <div className={s.body}>
        <div className={s.name}>{dress.name}</div>
        <div className={s.meta}>
          Размер {dress.size} · {somoni(dress.pricePerDay)}/день
        </div>
        <div className={s.status}>
          <Tag tone={status.tone}>{status.label}</Tag>
        </div>

        {dress.bookings.length > 0 && (
          <ul className={s.bookings}>
            {dress.bookings.map((b) => (
              <li key={b.id}>
                <span>
                  {short(b.startsOn)}
                  {b.endsOn !== b.startsOn && `-${short(b.endsOn)}`}
                  {b.guest && ` · ${b.guest}`}
                </span>
                <button type="button" disabled={pending} onClick={() => run(() => cancelDressBooking(b.id), "Бронь снята")} aria-label="Снять бронь">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {booking ? (
          <div className={s.form}>
            <label>
              <span>С</span>
              <input type="date" value={form.startsOn} min={today} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} />
            </label>
            <label>
              <span>Дней</span>
              <input inputMode="numeric" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value.replace(/\D/g, "") })} />
            </label>
            <label className={s.wide}>
              <span>Телефон гостьи</span>
              <input inputMode="tel" placeholder="необязательно" value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} />
            </label>
            <label className={s.wide}>
              <span>Имя (если новая)</span>
              <input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
            </label>
            <div className={s.formActions}>
              <Button size="sm" variant="outline" onClick={() => setBooking(false)}>
                Отмена
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => bookDress({ dressId: dress.id, startsOn: form.startsOn, days: Number(form.days), guestName: form.guestName, guestPhone: form.guestPhone }),
                    `${dress.name}: бронь с ${short(form.startsOn)}`,
                    () => setBooking(false),
                  )
                }
              >
                Забронировать
              </Button>
            </div>
          </div>
        ) : (
          <div className={s.actions}>
            <button type="button" onClick={() => setBooking(true)}>
              Забронировать
            </button>
            {dress.status === "CLEANING" ? (
              <button type="button" disabled={pending} onClick={() => run(() => setDressStatus(dress.id, "AVAILABLE"), `${dress.name} вернулось из химчистки`)}>
                Вернулось
              </button>
            ) : (
              <button type="button" disabled={pending} onClick={() => run(() => setDressStatus(dress.id, "CLEANING"), `${dress.name} - в химчистке`)}>
                В химчистку
              </button>
            )}
          </div>
        )}
        {error && (
          <div className={s.error} role="alert">
            {error}
          </div>
        )}
      </div>
    </article>
  );
}
