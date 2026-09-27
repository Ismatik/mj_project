"use client";

import { useOptimistic, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { WEEKDAYS_SHORT } from "@/lib/time";
import { toggleWorkDay } from "./actions";
import s from "./staff.module.css";

/** Seven day chips; the owner can click them to change the schedule. */
export function WorkDays({ staffId, name, days, editable }: { staffId: string; name: string; days: number[]; editable: boolean }) {
  const fx = useFx();
  const [, start] = useTransition();
  const [shown, flip] = useOptimistic(days, (cur, d: number) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <div className={s.days} role="group" aria-label={`График: ${name}`}>
      {WEEKDAYS_SHORT.map((label, i) => {
        const on = shown.includes(i);
        const content = <span className={`${s.day} ${on ? s.dayOn : ""}`}>{label}</span>;
        if (!editable) return <span key={i}>{content}</span>;
        return (
          <button
            key={i}
            type="button"
            className={s.dayBtn}
            aria-pressed={on}
            title={on ? "Сделать выходным" : "Сделать рабочим"}
            onClick={() =>
              start(async () => {
                flip(i);
                const res = await toggleWorkDay(staffId, i);
                if (!res.ok) fx.toast(res.error ?? "Не получилось", "График");
                else fx.toast(`${name}: ${label} — ${on ? "выходной" : "рабочий день"}`, "График");
              })
            }
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
