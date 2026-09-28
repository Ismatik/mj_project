import Link from "next/link";
import { PageHead, SectionHead } from "@/components/ui/Headings";
import { Tag } from "@/components/ui/Tag";
import { db } from "@/lib/db";
import { clock, shortDate } from "@/lib/format";
import { CHANNEL_LABEL, INTEGRATIONS } from "@/lib/integrations";
import { requirePage } from "@/server/auth";
import { telegramConfigured } from "@/server/integrations/telegram-api";
import { getStaffCode } from "@/server/telegram/deps";
import { DeliverNow, IntegrationControls, TelegramTools } from "./IntegrationControls";
import s from "./integrations.module.css";

const STATUS = {
  SENT: { label: "Отправлено", tone: "done" },
  QUEUED: { label: "В очереди", tone: "pending" },
  FAILED: { label: "Ошибка", tone: "chair" },
} as const;

const metaOf = (v: unknown) => (v && typeof v === "object" ? (v as { lang?: string; template?: { name: string } }) : {});

// "Интеграции" — connectors in mock or live mode, and the outbox of every message the system sends.
export default async function IntegrationsPage({ searchParams }: PageProps<"/cms/integrations">) {
  await requirePage("integrations", "/cms/integrations");
  const sp = await searchParams;
  const channel = typeof sp.channel === "string" && ["telegram", "whatsapp", "sms"].includes(sp.channel) ? sp.channel : null;
  const [rows, messages, queued, staffCode, staffChats] = await Promise.all([
    db.integration.findMany(),
    db.outboxMessage.findMany({ where: channel ? { channel } : {}, orderBy: { createdAt: "desc" }, take: 60 }),
    db.outboxMessage.count({ where: { status: "QUEUED" } }),
    getStaffCode(),
    db.telegramChat.count({ where: { isStaff: true, NOT: { id: { startsWith: "sim-" } } } }),
  ]);

  return (
    <div>
      <PageHead title="Интеграции" meta="Каждый канал работает в режиме «мок» до подключения — всё видно в «Исходящих»" />
      <p className={s.notice}>
        <b>Вход гостей в личный кабинет.</b> Код уходит в Telegram-бот, если гостья им пользуется, иначе — в WhatsApp или по SMS. Пока канал в режиме «мок», код
        показывается гостье прямо на экране: на сервере это включается переменной DEMO_LOGIN_CODES=1 (для демо и staging). Без неё вход откроется, когда канал
        станет «Живым». Отправленные коды в «Исходящих» скрываются.
        <br />
        <b>Языки.</b> Гостьи получают сообщения на своём языке (русский, таджикский, английский) — тексты правятся в{" "}
        <Link href="/cms/integrations/templates">шаблонах сообщений</Link>.
      </p>
      <div className={s.grid}>
        {INTEGRATIONS.map((info) => {
          const row = rows.find((r) => r.key === info.key);
          const mode = row?.mode ?? "MOCK";
          const enabled = row?.enabled ?? true;
          const keysSet = info.envKeys.every((k) => !!process.env[k]);
          return (
            <article key={info.key} className={s.card}>
              <div className={s.cardHead}>
                <h2 className={s.cardTitle}>{info.title}</h2>
                <Tag tone={mode === "LIVE" ? "chair" : "confirmed"}>{mode === "LIVE" ? "Живой" : "Мок"}</Tag>
              </div>
              <p className={s.purpose}>{info.purpose}</p>
              <dl className={s.facts}>
                <div>
                  <dt>Ключи</dt>
                  <dd>
                    {info.envKeys.join(", ")} — {keysSet ? "заданы" : "не заданы"}
                  </dd>
                </div>
                <div>
                  <dt>Чтобы включить</dt>
                  <dd>{info.goLive}</dd>
                </div>
                <div>
                  <dt>Живой режим</dt>
                  <dd>{info.liveReady ? (keysSet ? "готов — можно включать" : "готов, нужны ключи") : `в ${info.liveIn}`}</dd>
                </div>
              </dl>
              {info.key === "telegram" && <TelegramTools staffCode={staffCode} staffChats={staffChats} configured={telegramConfigured()} />}
              <IntegrationControls k={info.key} title={info.title} mode={mode} enabled={enabled} channel={info.key !== "payments"} />
            </article>
          );
        })}
      </div>

      <div className={s.outbox}>
        <SectionHead title={`Исходящие · в очереди ${queued}`} action={<DeliverNow />} />
        <div className={s.filters}>
          <a href="/cms/integrations" className={!channel ? s.filterOn : ""}>
            Все
          </a>
          {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
            <a key={k} href={`/cms/integrations?channel=${k}`} className={channel === k ? s.filterOn : ""}>
              {v}
            </a>
          ))}
        </div>
        {messages.length === 0 && <p className={s.muted}>Сообщений пока нет. Они появятся после онлайн-записи или заявки с сайта.</p>}
        {messages.map((m) => {
          const st = STATUS[m.status];
          return (
            <div key={m.id} className={s.msg}>
              <span className={s.msgTime}>
                {shortDate(m.createdAt)}
                <br />
                {clock(m.createdAt)}
              </span>
              <span className={s.msgMain}>
                <span className={s.msgTo}>
                  {CHANNEL_LABEL[m.channel] ?? m.channel} → {m.to === "reception" ? "ресепшен" : m.to}
                  {metaOf(m.meta).lang && metaOf(m.meta).lang !== "ru" ? ` · ${String(metaOf(m.meta).lang).toUpperCase()}` : ""}
                  {metaOf(m.meta).template ? ` · шаблон ${metaOf(m.meta).template!.name}` : ""}
                </span>
                <span className={s.msgBody}>{m.body}</span>
                {m.error && <span className={s.msgError}>{m.error}</span>}
              </span>
              <Tag tone={st.tone}>
                {st.label}
                {m.status === "SENT" && m.mock ? " · мок" : ""}
              </Tag>
            </div>
          );
        })}
      </div>
    </div>
  );
}
