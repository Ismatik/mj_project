// What each connector is for and what it needs to go live (shown on /cms/integrations).

export type IntegrationInfo = {
  key: "telegram" | "whatsapp" | "sms" | "payments";
  title: string;
  purpose: string;
  envKeys: string[];
  goLive: string;
  /** Release in which the live driver is connected. */
  liveIn: string;
  /** Live driver exists in the code (switchable once the keys are set). */
  liveReady?: boolean;
};

export const INTEGRATIONS: IntegrationInfo[] = [
  {
    key: "telegram",
    title: "Telegram",
    purpose: "Бот для гостей: запись, «Мои записи» с отменой и переносом, цены, контакты. Уведомления ресепшену, напоминания и коды входа в личный кабинет гостям.",
    envKeys: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"],
    goLive: "Создайте бота у @BotFather, добавьте токен и любой длинный секрет в .env, перезапустите сервер, нажмите «Подключить webhook» и переключите в «Живой».",
    liveIn: "R2",
    liveReady: true,
  },
  {
    key: "whatsapp",
    title: "WhatsApp",
    purpose:
      "Подтверждение записи, напоминания за 24 и 2 часа и коды входа — гостьям без Telegram. Сообщения гостей в WhatsApp пересылаются ресепшену, гостья получает автоответ.",
    envKeys: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN"],
    goLive:
      "Верификация Meta Business и номер в WhatsApp Cloud API; одобренные шаблоны (см. «Шаблоны сообщений»); ключи в .env; в Meta указать webhook https://ДОМЕН/api/whatsapp/webhook с тем же WHATSAPP_VERIFY_TOKEN и подписаться на messages. Затем «Живой».",
    liveIn: "R2",
    liveReady: true,
  },
  {
    key: "sms",
    title: "SMS",
    purpose: "Запасной канал для кодов входа и напоминаний.",
    envKeys: ["SMS_API_KEY"],
    goLive: "Договор с SMS-шлюзом и регистрация имени отправителя «MJ».",
    liveIn: "R2",
  },
  {
    key: "payments",
    title: "Онлайн-оплата",
    purpose: "Предоплата за свадебные образы и долгие услуги, подарочные сертификаты.",
    envKeys: ["PAYMENTS_API_KEY"],
    goLive: "Договор эквайринга с банком (Алиф, Душанбе Сити или Корти Милли), ключи API и адрес для уведомлений.",
    liveIn: "R3",
  },
];

export const CHANNEL_LABEL: Record<string, string> = { telegram: "Telegram", whatsapp: "WhatsApp", sms: "SMS" };
