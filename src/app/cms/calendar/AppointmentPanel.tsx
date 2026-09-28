"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { Tag } from "@/components/ui/Tag";
import { clock, longDate, somoni } from "@/lib/format";
import { appointmentStatus } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import type { AppointmentDetail } from "@/server/calendar";
import { rescheduleAppointment, setAppointmentStatus } from "./actions";
import s from "./calendar.module.css";

const SOURCE: Record<string, string> = { CMS: "CMS", WEBSITE: "сайт", TELEGRAM: "Telegram", WHATSAPP: "WhatsApp", WALK_IN: "без записи" };

export function AppointmentPanel({ a, closeHref, role }: { a: AppointmentDetail; closeHref: string; role: string }) {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(a.ymd);
  const [time, setTime] = useState(clock(a.startsAt));
  const [error, setError] = useState("");
  const st = appointmentStatus[a.status]!;
  const open = !["DONE", "CANCELLED", "NO_SHOW"].includes(a.status);
  const manager = role === "OWNER" || role === "RECEPTION";

  const setStatus = (status: "CONFIRMED" | "IN_CHAIR" | "CANCELLED" | "NO_SHOW", note: string) =>
    start(async () => {
      const res = await setAppointmentStatus(a.id, status);
      if (!res.ok) return setError(res.error ?? "Не получилось");
      setError("");
      fx.toast(note, "Календарь");
      router.refresh();
    });

  const move = () =>
    start(async () => {
      const res = await rescheduleAppointment(a.id, date, time);
      if (!res.ok) return setError(res.error ?? "Не получилось");
      setError("");
      setMoving(false);
      fx.toast(`Перенесли на ${date.split("-").reverse().join(".")}, ${time}`, "Календарь");
      router.push(`/cms/calendar?week=${date}&appt=${a.id}`, { scroll: false });
    });

  return (
    <section className={s.panel} aria-label="Запись">
      <div className={s.panelHead}>
        <div>
          <div className={s.kicker}>
            {longDate(a.startsAt)} · {clock(a.startsAt)}–{clock(new Date(a.startsAt.getTime() + a.durationMin * 60_000))}
          </div>
          <div className={s.panelTitle}>
            {a.guestName} · {a.service}
          </div>
          <div className={s.panelSub}>
            мастер {a.staff.map((m) => m.name).join(" + ")} · {somoni(a.price)} · источник: {SOURCE[a.source] ?? a.source}
            {a.depositRequired > 0 &&
              (a.depositPaid >= a.depositRequired
                ? ` · предоплата ${somoni(a.depositPaid)} внесена`
                : a.holdUntil
                  ? ` · ждёт предоплату ${somoni(a.depositRequired)} до ${clock(a.holdUntil)}`
                  : ` · предоплата ${somoni(a.depositRequired)} не внесена`)}
            {a.guestPhone && <> · {formatPhone(a.guestPhone)}</>}
          </div>
          {a.note && <div className={s.panelNote}>«{a.note}»</div>}
        </div>
        <Tag tone={st.tone} wide>
          {st.label}
        </Tag>
        <Link href={closeHref} scroll={false} className={s.close} aria-label="Закрыть">
          ×
        </Link>
      </div>

      {open && (
        <div className={s.panelActions}>
          {a.status !== "IN_CHAIR" && (
            <Button size="sm" variant="ink" disabled={pending} onClick={() => setStatus("IN_CHAIR", `${a.guestName} в кресле`)}>
              В кресле
            </Button>
          )}
          {manager && a.status === "PENDING" && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("CONFIRMED", "Запись подтверждена")}>
              Подтвердить
            </Button>
          )}
          {manager && (
            <>
              <ButtonLink size="sm" href={`/cms/pos?appt=${a.id}`}>
                Оплатить в кассе
              </ButtonLink>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setMoving((v) => !v)}>
                Перенести
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("NO_SHOW", "Отмечено: не пришла")}>
                Не пришла
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus("CANCELLED", "Запись отменена")}>
                Отменить
              </Button>
            </>
          )}
          {a.guestId && manager && (
            <Link href={`/cms/guests?guest=${a.guestId}`} className={s.link}>
              Карточка гостьи →
            </Link>
          )}
        </div>
      )}

      {moving && (
        <div className={s.move}>
          <label>
            <span>Новая дата</span>
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span>Время</span>
            <input type="time" className={inputClass} step={900} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <Button disabled={pending} onClick={move}>
            Перенести
          </Button>
        </div>
      )}
      {error && (
        <div className={s.error} role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
