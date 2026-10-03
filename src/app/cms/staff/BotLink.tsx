"use client";

import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { masterBotCode, newMasterBotCode, unlinkMasterBot } from "./actions";
import s from "./staff.module.css";

/**
 * Whether this master gets her bookings in Telegram, and the code that connects her.
 * The code is fetched on click rather than rendered with the page: it is a credential for one
 * person's notifications, and the staff page is open to reception and to the other masters.
 */
export function BotLink({ staffId, name, chats, editable }: { staffId: string; name: string; chats: number; editable: boolean }) {
  const fx = useFx();
  const [pending, start] = useTransition();
  const [code, setCode] = useState<string | null>(null);

  if (!editable) {
    return <div className={s.bot}>Telegram: {chats ? "подключена" : "не подключена"}</div>;
  }

  const show = (res: { ok: true; code: string } | { ok: false; error: string }, toast: string) => {
    if (!res.ok) return fx.toast(res.error, "Telegram");
    setCode(res.code);
    fx.toast(toast, "Telegram");
  };

  return (
    <div className={s.bot}>
      <div className={s.botRow}>
        <span>Telegram: {chats ? `подключена · чатов ${chats}` : "не подключена"}</span>
        {chats > 0 && (
          <button
            type="button"
            className={s.botBtn}
            disabled={pending}
            onClick={() => start(async () => fx.toast((await unlinkMasterBot(staffId)).ok ? `${name} отвязана` : "Не получилось", "Telegram"))}
          >
            Отвязать
          </button>
        )}
      </div>
      {code ? (
        <p className={s.botCode}>
          <code>/master {code}</code>
          <span> — {name} отправляет это боту один раз</span>
        </p>
      ) : null}
      <div className={s.botRow}>
        <button type="button" className={s.botBtn} disabled={pending} onClick={() => start(async () => show(await masterBotCode(staffId), "Код показан"))}>
          {chats ? "Показать код" : "Код для подключения"}
        </button>
        <button
          type="button"
          className={s.botBtn}
          disabled={pending}
          onClick={() => start(async () => show(await newMasterBotCode(staffId), "Новый код: старый больше не работает"))}
        >
          Новый код
        </button>
      </div>
    </div>
  );
}
