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
    purpose: "Подтверждение записи гостье, напоминания за 24 и 2 часа, коды входа в личный кабинет, просьба об отзыве.",
    envKeys: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"],
    goLive: "Верификация Meta Business, номер WhatsApp Business API и одобренные шаблоны сообщений.",
    liveIn: "R2",
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
