"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import type { WaitlistPage } from "@/server/waitlist/admin";
import { closeEntry, findTime, newEntry, newWalkIn, seat } from "./actions";
import s from "../money.module.css";

type Services = WaitlistPage["services"];
type Staff = WaitlistPage["staff"];
const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const dayLabel = (ymd: string) => new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));

function useRun() {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: (res: never) => string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return fx.toast(res.error ?? "Не получилось", "Лист ожидания");
      fx.toast(ok(res as never), "Лист ожидания");
      after?.();
      router.refresh();
    });
  return { pending, run };
}

function ServiceMaster({ services, staff, serviceId, setServiceId, staffId, setStaffId }: { services: Services; staff: Staff; serviceId: string; setServiceId: (v: string) => void; staffId: string; setStaffId: (v: string) => void }) {
  const svc = services.find((x) => x.id === serviceId);
  return (
    <div className={s.two}>
      <label>
        Услуга
        <select name="service" value={serviceId} onChange={(e) => (setServiceId(e.target.value), setStaffId(""))}>
          <option value="">-</option>
          {services.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Мастер
        <select name="staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="">любой</option>
          {staff
            .filter((m) => !svc || svc.staffIds.includes(m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
}

/** A guest who came in without a booking */
export function WalkInForm({ services, staff }: { services: Services; staff: Staff }) {
  const { pending, run } = useRun();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [note, setNote] = useState("");
  return (
    <form
      className={s.form}
      aria-label="Живая очередь"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => newWalkIn({ name, phone, serviceId, staffId: staffId || null, note }), () => `${name} в очереди`, () => (setName(""), setPhone(""), setNote("")));
      }}
    >
      <div className={s.two}>
        <label>
          Имя
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Телефон <small>необязательно</small>
          <input name="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>
      <ServiceMaster services={services} staff={staff} serviceId={serviceId} setServiceId={setServiceId} staffId={staffId} setStaffId={setStaffId} />
      <label>
        Комментарий <small>необязательно</small>
        <input name="note" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button type="submit" size="sm" disabled={pending || !name.trim() || !serviceId}>
        Поставить в очередь
      </Button>
    </form>
  );
}

/** Waitlist for a day that is full */
export function EntryForm({ services, staff, dates }: { services: Services; staff: Staff; dates: string[] }) {
  const { pending, run } = useRun();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(dates[0] ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  return (
    <form
      className={s.form}
      aria-label="Лист ожидания"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => newEntry({ name, phone, serviceId, staffId: staffId || null, date, timeFrom: from, timeTo: to, note }),
          (res: { offered: boolean }) => (res.offered ? "Время уже свободно - предложили гостье" : `${name} в листе ожидания`),
          () => (setName(""), setPhone(""), setNote("")),
        );
      }}
    >
      <div className={s.two}>
        <label>
          Имя
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Телефон <small>для сообщения со ссылкой</small>
          <input name="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>
      <ServiceMaster services={services} staff={staff} serviceId={serviceId} setServiceId={setServiceId} staffId={staffId} setStaffId={setStaffId} />
      <div className={s.two} style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
        <label>
          День
          <select name="date" value={date} onChange={(e) => setDate(e.target.value)}>
            {dates.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Удобно с
          <select aria-label="С" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">09:00</option>
            {HOURS.slice(1, -1).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label>
          Удобно до
          <select aria-label="До" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">18:00</option>
            {HOURS.slice(1, -1).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Комментарий <small>необязательно</small>
        <input name="note" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending || !name.trim() || !serviceId}>
        Добавить в лист ожидания
      </Button>
    </form>
  );
}

export function WalkInActions({ id, name, freeNow }: { id: string; name: string; freeNow: { time: string; staff: { id: string; name: string }[] } | null }) {
  const { pending, run } = useRun();
  const [staffId, setStaffId] = useState(freeNow?.staff[0]?.id ?? "");
  return (
    <div className={s.inline}>
      {freeNow ? (
        <>
          <select aria-label={`Мастер для ${name}`} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {freeNow.staff.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="button" disabled={pending} onClick={() => run(() => seat(id, staffId || null), (res: { master: string; time: string }) => `${name} - к мастеру ${res.master}, ${res.time}`)}>
            Посадить
          </button>
        </>
      ) : (
        <span className={s.muted} style={{ margin: 0 }}>
          все заняты
        </span>
      )}
      <button type="button" className={s.linkBtn} style={{ background: "none", color: "var(--mj-gold-deep)", border: "none" }} disabled={pending} onClick={() => run(() => closeEntry(id, "LEFT"), () => `${name} ушла`)}>
        Ушла
      </button>
    </div>
  );
}

export function EntryActions({ id, name, status }: { id: string; name: string; status: string }) {
  const { pending, run } = useRun();
  return (
    <div className={s.inline} style={{ justifyContent: "flex-end", marginTop: 0 }}>
      {status === "WAITING" && (
        <button type="button" disabled={pending} onClick={() => run(() => findTime(id), (res: { when: string }) => `Предложено: ${res.when}`)}>
          Найти время
        </button>
      )}
      <button type="button" className={s.linkBtn} style={{ background: "none", color: "var(--mj-gold-deep)", border: "none" }} disabled={pending} onClick={() => run(() => closeEntry(id, "CANCELLED"), () => `${name} убрана из листа`)}>
        Убрать
      </button>
    </div>
  );
}
