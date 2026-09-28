// Messages to guests (confirmation, reminders, sign-in code) in three languages.
// The texts are editable in CMS → Интеграции → Шаблоны сообщений; empty = the default below.
// WhatsApp can only start a conversation with a template approved by Meta, so each kind also has
// a WhatsApp template name and the order of its {{1}}, {{2}}… parameters.
import type { Lang } from "./i18n/locales";

export type MessageKind = "booking-confirmation" | "reminder-day" | "reminder-hours" | "login-code" | "whatsapp-reply";
export type MessageVars = Partial<Record<"name" | "service" | "when" | "time" | "master" | "address" | "code" | "link", string>>;
export type Templates = Partial<Record<MessageKind, Partial<Record<Lang, string>>>>;

export const MESSAGE_KINDS: { kind: MessageKind; title: string; hint: string; vars: (keyof MessageVars)[] }[] = [
  { kind: "booking-confirmation", title: "Подтверждение онлайн-записи", hint: "Сразу после записи на сайте", vars: ["name", "service", "when", "master", "address"] },
  { kind: "reminder-day", title: "Напоминание за день", hint: "За 20–26 часов до визита", vars: ["name", "service", "when", "time", "master", "address"] },
  { kind: "reminder-hours", title: "Напоминание в день визита", hint: "За 1–3 часа до визита", vars: ["name", "service", "time", "master", "address"] },
  { kind: "login-code", title: "Код входа в личный кабинет", hint: "Вход на сайте по номеру телефона", vars: ["code"] },
  { kind: "whatsapp-reply", title: "Автоответ в WhatsApp", hint: "Когда гостья пишет в WhatsApp (не чаще раза в 12 часов); её сообщение уходит ресепшену", vars: ["name", "link"] },
];

export const DEFAULT_TEMPLATES: Record<MessageKind, Record<Lang, string>> = {
  "booking-confirmation": {
    ru: "Mavzunai Jovid: {name}, вы записаны — {service}, {when}, мастер {master}. {address}. Если планы изменятся, напишите нам.",
    tg: "Mavzunai Jovid: {name}, шумо сабт шудед — {service}, {when}, усто {master}. {address}. Агар нақшаҳо тағйир ёбанд, ба мо нависед.",
    en: "Mavzunai Jovid: {name}, you're booked — {service}, {when}, with {master}. {address}. If your plans change, just message us.",
  },
  "reminder-day": {
    ru: "Mavzunai Jovid ✦ Напоминаем: {when} — {service}, мастер {master}. {address}. Если планы изменились, перенесите или отмените запись в боте («Мои записи») или напишите нам.",
    tg: "Mavzunai Jovid ✦ Ёдрас мекунем: {when} — {service}, усто {master}. {address}. Агар нақшаҳо тағйир ёфтанд, сабтро дар бот («Сабтҳои ман») гузаронед ё бекор кунед, ё ба мо нависед.",
    en: "Mavzunai Jovid ✦ A reminder: {when} — {service} with {master}. {address}. If your plans have changed, reschedule or cancel in the bot (“My bookings”) or message us.",
  },
  "reminder-hours": {
    ru: "Mavzunai Jovid ✦ Ждём вас сегодня в {time} — {service}, мастер {master}. {address}.",
    tg: "Mavzunai Jovid ✦ Имрӯз соати {time} шуморо интизорем — {service}, усто {master}. {address}.",
    en: "Mavzunai Jovid ✦ See you today at {time} — {service} with {master}. {address}.",
  },
  "login-code": {
    ru: "Mavzunai Jovid: код для входа в личный кабинет — {code}. Никому его не сообщайте.",
    tg: "Mavzunai Jovid: рамзи воридшавӣ ба кабинети шахсӣ — {code}. Онро ба касе нагӯед.",
    en: "Mavzunai Jovid: your sign-in code is {code}. Don't share it with anyone.",
  },
  "whatsapp-reply": {
    ru: "Mavzunai Jovid: спасибо за сообщение! Администратор ответит в рабочее время (Вт–Вс, 09:00–18:00). Запись: {link}",
    tg: "Mavzunai Jovid: ташаккур барои паём! Маъмур дар вақти корӣ (Сш–Яш, 09:00–18:00) ҷавоб медиҳад. Сабт: {link}",
    en: "Mavzunai Jovid: thank you for your message! Our receptionist will reply during opening hours (Tue–Sun, 09:00–18:00). Bookings: {link}",
  },
};

/** WhatsApp templates to create in Meta Business Manager (same names in every language). The auto-reply needs none:
 * it answers within 24 hours of her message, when free text is allowed. */
export const WHATSAPP_TEMPLATES: Partial<Record<MessageKind, { name: string; category: "UTILITY" | "AUTHENTICATION"; params: (keyof MessageVars)[] }>> = {
  "booking-confirmation": { name: "mj_booking_confirmation", category: "UTILITY", params: ["name", "service", "when", "master"] },
  "reminder-day": { name: "mj_reminder_day", category: "UTILITY", params: ["when", "service", "master"] },
  "reminder-hours": { name: "mj_reminder_hours", category: "UTILITY", params: ["time", "service", "master"] },
  "login-code": { name: "mj_login_code", category: "AUTHENTICATION", params: ["code"] },
};

/** Language code of the approved WhatsApp template. Meta may not accept Tajik; then Tajik guests get the Russian template. */
export const WHATSAPP_LANG: Record<Lang, string> = { ru: "ru", tg: "ru", en: "en" };

export function renderTemplate(text: string, vars: MessageVars): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? (vars[k as keyof MessageVars] ?? "") : m)).trim();
}

export function messageText(kind: MessageKind, lang: Lang, vars: MessageVars, overrides: Templates = {}): string {
  const tpl = overrides[kind]?.[lang]?.trim() || DEFAULT_TEMPLATES[kind][lang];
  return renderTemplate(tpl, vars);
}

/** Keeps only known kinds and languages, strings up to 1000 characters. */
export function normalizeTemplates(raw: unknown): Templates {
  const out: Templates = {};
  if (!raw || typeof raw !== "object") return out;
  for (const { kind } of MESSAGE_KINDS) {
    const v = (raw as Record<string, unknown>)[kind];
    if (!v || typeof v !== "object") continue;
    const langs: Partial<Record<Lang, string>> = {};
    for (const lang of ["ru", "tg", "en"] as const) {
      const t = (v as Record<string, unknown>)[lang];
      if (typeof t === "string" && t.trim()) langs[lang] = t.slice(0, 1000);
    }
    if (Object.keys(langs).length) out[kind] = langs;
  }
  return out;
}
