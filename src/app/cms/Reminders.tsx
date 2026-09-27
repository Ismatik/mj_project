"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addReminder, deleteDoneReminders, toggleReminder } from "./actions";
import s from "./dashboard.module.css";

type Item = { id: string; text: string; done: boolean };

export function Reminders({ items }: { items: Item[] }) {
  const [optimistic, setOptimistic] = useOptimistic(items, (list, change: { id: string; done: boolean }) =>
    list.map((i) => (i.id === change.id ? { ...i, done: change.done } : i)),
  );
  const [text, setText] = useState("");
  const [, start] = useTransition();
  const hasDone = optimistic.some((i) => i.done);

  return (
    <div className={s.reminders}>
      {optimistic.length === 0 && <div className={s.muted}>Напоминаний нет.</div>}
      {optimistic.map((r) => (
        <label key={r.id} className={`${s.reminder} ${r.done ? s.reminderDone : ""}`}>
          <input
            type="checkbox"
            checked={r.done}
            onChange={(e) => {
              const done = e.target.checked;
              start(async () => {
                setOptimistic({ id: r.id, done });
                await toggleReminder(r.id, done);
              });
            }}
          />
          <span className={s.star} aria-hidden="true">
            ✦
          </span>
          <span>{r.text}</span>
        </label>
      ))}
      <form
        className={s.reminderForm}
        onSubmit={(e) => {
          e.preventDefault();
          const value = text;
          setText("");
          start(() => addReminder(value));
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Новое напоминание…" aria-label="Новое напоминание" maxLength={200} />
        {hasDone && (
          <button type="button" onClick={() => start(() => deleteDoneReminders())}>
            Убрать выполненные
          </button>
        )}
      </form>
    </div>
  );
}
