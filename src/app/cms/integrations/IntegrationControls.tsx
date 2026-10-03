"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { connectTelegramWebhook, deliverNow, newStaffCode, refreshInstagramNow, runRemindersNow, sendTestMessage, setIntegrationEnabled, setIntegrationMode } from "./actions";
import s from "./integrations.module.css";

export function IntegrationControls({ k, title, mode, enabled, channel }: { k: string; title: string; mode: string; enabled: boolean; channel: boolean }) {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, note?: string) =>
    start(async () => {
      const res = (await fn()) as { ok?: boolean; error?: string } | undefined;
      if (res && res.ok === false) fx.toast(res.error ?? "Не получилось", title);
      else if (note) fx.toast(note, title);
      router.refresh();
    });

  return (
    <div className={s.controls}>
      <div className={s.seg} role="group" aria-label={`${title}: режим`}>
        <button type="button" aria-pressed={mode === "MOCK"} className={mode === "MOCK" ? s.segOn : ""} disabled={pending} onClick={() => run(() => setIntegrationMode(k, "MOCK"), "Режим: мок")}>
          Мок
        </button>
        <button type="button" aria-pressed={mode === "LIVE"} className={mode === "LIVE" ? s.segOn : ""} disabled={pending} onClick={() => run(() => setIntegrationMode(k, "LIVE"))}>
          Живой
        </button>
      </div>
      <label className={s.switch}>
        <input type="checkbox" checked={enabled} disabled={pending} onChange={(e) => run(() => setIntegrationEnabled(k, e.target.checked), e.target.checked ? "Канал включён" : "Канал выключен - сообщения ждут в очереди")} />
        {enabled ? "Включено" : "Выключено"}
      </label>
      {channel && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => sendTestMessage(k as "telegram"), "Тестовое сообщение в очереди")}>
          Тест
        </Button>
      )}
    </div>
  );
}

export function DeliverNow() {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ink"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const n = await deliverNow();
          fx.toast(n ? `Обработано сообщений: ${n}` : "Очередь пуста", "Исходящие");
          router.refresh();
        })
      }
    >
      Доставить сейчас
    </Button>
  );
}

/** Telegram-specific tools: staff code, webhook, reminders, simulator link. */
export function TelegramTools({ staffCode, staffChats, configured }: { staffCode: string; staffChats: number; configured: boolean }) {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={s.tg}>
      <div className={s.tgRow}>
        <span>
          Чат ресепшена: отправьте боту <code>/staff {staffCode}</code> · привязано чатов: {staffChats}
        </span>
        <button
          type="button"
          className={s.linkBtn}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const code = await newStaffCode();
              fx.toast(`Новый код: ${code}`, "Telegram");
              router.refresh();
            })
          }
        >
          Новый код
        </button>
      </div>
      <div className={s.tgRow}>
        <a href="/cms/integrations/telegram" className={s.linkBtn}>
          Открыть симулятор бота →
        </a>
        <button
          type="button"
          className={s.linkBtn}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const n = await runRemindersNow();
              fx.toast(n ? `Напоминаний в очереди: ${n}` : "Сейчас напоминать некому", "Напоминания");
              router.refresh();
            })
          }
        >
          Проверить напоминания
        </button>
        {configured && (
          <button
            type="button"
            className={s.linkBtn}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await connectTelegramWebhook();
                fx.toast(res.message, "Telegram");
              })
            }
          >
            Подключить webhook
          </button>
        )}
      </div>
    </div>
  );
}

/** Instagram: when the feed was last fetched, and a button to fetch it now. */
export function InstagramTools({ status, mode }: { status: { updatedAt: string | null; count: number; error: string | null }; mode: string }) {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const when = status.updatedAt && status.updatedAt > "2000" ? new Date(status.updatedAt).toLocaleString("ru-RU", { timeZone: "Asia/Dushanbe", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className={s.tg}>
      <div className={s.tgRow}>
        <span>
          {mode === "LIVE" ? (when ? `Лента обновлена ${when} · публикаций: ${status.count}` : "Лента ещё не загружалась") : "На сайте - фото из портфолио со ссылкой на профиль"}
          {status.error && mode === "LIVE" && <b className={s.msgError}> · ошибка: {status.error}</b>}
        </span>
        {mode === "LIVE" && (
          <button
            type="button"
            className={s.linkBtn}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await refreshInstagramNow();
                fx.toast(res.ok ? `Загружено публикаций: ${res.count}` : res.error, "Instagram");
                router.refresh();
              })
            }
          >
            Обновить ленту
          </button>
        )}
      </div>
    </div>
  );
}
