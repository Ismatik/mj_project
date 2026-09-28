"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { somoni } from "@/lib/format";
import { closeDay, removeMovement, saveMovement } from "./actions";
import s from "../../money.module.css";

const digits = (v: string) => Number(v.replace(/\D/g, "")) || 0;

/** Put cash into the till (change) or take it out (supplies, delivery…) */
export function MovementForm() {
  const fx = useFx();
  const router = useRouter();
  const [dir, setDir] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className={s.form}
      aria-label="Внесение или изъятие"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const res = await saveMovement(dir === "in" ? digits(amount) : -digits(amount), note);
          if (!res.ok) return setError(res.error);
          fx.toast(`${dir === "in" ? "Внесено" : "Изъято"} ${somoni(digits(amount))}`, "Касса");
          setAmount("");
          setNote("");
          router.refresh();
        });
      }}
    >
      <div className={s.toggle} role="group" aria-label="Что сделать">
        <button type="button" aria-pressed={dir === "out"} onClick={() => setDir("out")}>
          Изъять из кассы
        </button>
        <button type="button" aria-pressed={dir === "in"} onClick={() => setDir("in")}>
          Внести в кассу
        </button>
      </div>
      <div className={s.two}>
        <label>
          Сумма, c.
          <input name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label>
          За что
          <input name="note" value={note} placeholder={dir === "out" ? "Покупка расходников" : "Размен"} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      {error && (
        <div role="alert" className={s.error}>
          {error}
        </div>
      )}
      <Button type="submit" variant="outline" size="sm" disabled={pending || !digits(amount) || !note.trim()}>
        {dir === "in" ? "Внести" : "Изъять"}
      </Button>
    </form>
  );
}

export function RemoveMovement({ id }: { id: string }) {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={s.remove}
      aria-label="Удалить"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await removeMovement(id);
          if (!res.ok) return fx.toast(res.error, "Касса");
          router.refresh();
        })
      }
    >
      ×
    </button>
  );
}

/** Count the cash, say how much is handed over, close the day */
export function CloseForm({ day, expected, opening }: { day: string; expected: number; opening: number }) {
  const fx = useFx();
  const router = useRouter();
  const [counted, setCounted] = useState("");
  const [handed, setHanded] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const c = counted === "" ? null : digits(counted);
  const diff = c === null ? null : c - expected;
  // By default the drawer keeps what it started the day with
  const suggestion = c === null ? 0 : Math.max(0, c - opening);
  const h = handed === "" ? suggestion : digits(handed);
  return (
    <form
      className={s.form}
      aria-label="Закрыть смену"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        if (c === null) return setError("Посчитайте наличные в кассе");
        start(async () => {
          const res = await closeDay(day, c, h, note);
          if (!res.ok) return setError(res.error);
          fx.toast(res.difference === 0 ? "Смена закрыта, касса сошлась" : `Смена закрыта, ${res.difference > 0 ? "излишек" : "недостача"} ${somoni(Math.abs(res.difference))}`, "Касса");
          router.refresh();
        });
      }}
    >
      <label>
        Наличных в кассе по факту, c.
        <input name="counted" inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ""))} />
      </label>
      {diff !== null && (
        <div className={s.line} role="status">
          <span>{diff === 0 ? "Касса сходится" : diff > 0 ? "Излишек" : "Недостача"}</span>
          <b className={diff > 0 ? s.diffPlus : diff < 0 ? s.diffMinus : ""}>{diff > 0 ? `+${somoni(diff)}` : diff < 0 ? `−${somoni(-diff)}` : "0 c."}</b>
        </div>
      )}
      <div className={s.two}>
        <label>
          Сдать владелице, c.
          <input name="handed" inputMode="numeric" value={handed} placeholder={String(suggestion)} onChange={(e) => setHanded(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label>
          Останется на завтра
          <input readOnly tabIndex={-1} value={c === null ? "" : somoni(Math.max(0, c - h))} />
        </label>
      </div>
      <label>
        Комментарий <small>необязательно</small>
        <input name="note" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && (
        <div role="alert" className={s.error}>
          {error}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Закрываем…" : "Закрыть смену"}
      </Button>
    </form>
  );
}
