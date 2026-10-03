import Link from "next/link";
import { PageHead } from "@/components/ui/Headings";
import { requirePage } from "@/server/auth";
import { telegramConfigured } from "@/server/integrations/telegram-api";
import { getStaffCode } from "@/server/telegram/deps";
import { BotSimulator } from "./BotSimulator";
import s from "./simulator.module.css";

// Telegram bot simulator: the real bot logic, answered here instead of in Telegram.
export default async function TelegramSimulatorPage() {
  await requirePage("integrations", "/cms/integrations/telegram");
  const code = await getStaffCode();
  return (
    <div>
      <PageHead title="Telegram-бот" meta={telegramConfigured() ? "Ключи заданы - бот может работать и в Telegram" : "Работает в симуляторе, пока не добавлен токен"} />
      <div className={s.layout}>
        <BotSimulator />
        <aside className={s.notes}>
          <h2>Как это работает</h2>
          <p>Слева - тот же бот, что будет в Telegram: те же кнопки, тексты и правила записи. Записи из симулятора настоящие - они появятся в календаре с источником «Telegram».</p>
          <h3>Что умеет бот</h3>
          <ul>
            <li>Записать: категория → услуга → мастер → день → свободное время → номер телефона → подтверждение</li>
            <li>«Мои записи»: посмотреть, перенести или отменить (не позже чем за 2 часа)</li>
            <li>Цены и контакты</li>
            <li>Напоминания за день и за 2 часа до визита</li>
          </ul>
          <h3>Уведомления ресепшену</h3>
          <p>
            Сотрудник пишет боту <code>/staff {code}</code> - и этот чат получает сообщения о новых записях, переносах и отменах.
          </p>
          <h3>Уведомления мастеру</h3>
          <p>
            У каждой мастерицы свой код, он выдаётся на её карточке в <Link href="/cms/staff">Мастерах</Link>. Она пишет его боту как <code>/master КОД</code> - и
            получает только свои записи, а в 8:30 план на день.
          </p>
          <h3>Подключение к Telegram</h3>
          <ol>
            <li>Создать бота у @BotFather (имя, например, MavzunaiJovidBot) и получить токен</li>
            <li>Добавить в .env на сервере TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET (любая длинная строка)</li>
            <li>Перезапустить: docker compose up -d</li>
            <li>CMS → Интеграции → Telegram: «Подключить webhook», затем «Живой»</li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
