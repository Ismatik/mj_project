"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Monogram } from "@/components/ui/Monogram";
import type { BotReply } from "@/lib/bot/engine";
import { resetSimulator, simulate } from "./actions";
import s from "./simulator.module.css";

type Msg = { from: "bot"; reply: BotReply } | { from: "me"; text: string };

export function BotSimulator() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [phone, setPhone] = useState("+992 93 111 22 33");
  const [pending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const send = (input: { text?: string; data?: string; contactPhone?: string }, shown: string) =>
    start(async () => {
      setMsgs((m) => [...m, { from: "me", text: shown }]);
      try {
        const replies = await simulate(input);
        setMsgs((m) => [...m, ...replies.map((reply) => ({ from: "bot" as const, reply }))]);
      } catch {
        setMsgs((m) => [...m, { from: "bot", reply: { text: "⚠ Не удалось связаться с сервером" } }]);
      }
    });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    send({ text: "/start" }, "/start");
  });

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const lastBot = [...msgs].reverse().find((m) => m.from === "bot") as { reply: BotReply } | undefined;
  const askContact = !!lastBot?.reply.askContact;

  return (
    <div className={s.phone}>
      <div className={s.top}>
        <span className={s.avatar}>
          <Monogram size={26} color="var(--mj-cream)" caption="" />
        </span>
        <div>
          <div className={s.botName}>Mavzunai Jovid</div>
          <div className={s.botSub}>{pending ? "печатает…" : "бот · симулятор"}</div>
        </div>
        <button
          type="button"
          className={s.reset}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await resetSimulator();
              setMsgs([]);
              const replies = await simulate({ text: "/start" });
              setMsgs([{ from: "me", text: "/start" }, ...replies.map((reply) => ({ from: "bot" as const, reply }))]);
            })
          }
        >
          Сбросить
        </button>
      </div>

      <div className={s.messages} ref={list} aria-live="polite">
        {msgs.map((m, i) =>
          m.from === "me" ? (
            <div key={i} className={s.me}>
              {m.text}
            </div>
          ) : (
            <div key={i} className={s.botWrap}>
              <div className={s.bot}>{m.reply.text}</div>
              {m.reply.buttons && (
                <div className={s.keyboard}>
                  {m.reply.buttons.map((row, r) => (
                    <div key={r} className={s.kbRow}>
                      {row.map((b) => (
                        <button key={b.data + b.text} type="button" data-cb={b.data} disabled={pending} onClick={() => send({ data: b.data }, b.text)}>
                          {b.text}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {askContact && (
        <div className={s.contact}>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Номер, которым поделиться" />
          <button type="button" disabled={pending} onClick={() => send({ contactPhone: phone }, `📱 ${phone}`)}>
            📱 Поделиться номером
          </button>
        </div>
      )}
      <form
        className={s.input}
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const t = text.trim();
          setText("");
          send({ text: t }, t);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение" aria-label="Сообщение боту" />
        <button type="submit" disabled={pending || !text.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
}
