// Mavzunai Jovid Telegram bot — conversation logic, independent of Telegram itself.
// The same engine answers real Telegram updates (webhook) and the CMS chat simulator.
import { normalizePhone } from "../phone";
import { weekdayOf, WEEKDAYS_SHORT, type Ymd } from "../time";

export type BotButton = { text: string; data: string };
export type BotReply = {
  text: string;
  /** Inline buttons, row by row */
  buttons?: BotButton[][];
  /** Show the "share my phone number" keyboard */
  askContact?: boolean;
  /** Remove the contact keyboard */
  removeKeyboard?: boolean;
};
export type BotUpdate = { chatId: string; firstName?: string; username?: string; text?: string; data?: string; contactPhone?: string };

type Step = "idle" | "phone" | "name";
export type BotState = {
  step?: Step;
  serviceId?: string;
  staffId?: string | null;
  date?: Ymd;
  time?: string;
  /** Booking being rescheduled */
  apptId?: string;
  /** What to do once the phone is known */
  after?: "confirm" | "my";
  name?: string;
  phone?: string;
};

export type BotGuest = { id: string; name: string; phone: string };
export type BotService = { id: string; name: string; durationMin: number; price: number; staff: { id: string; name: string }[] };
export type BotCategory = { id: string; name: string; services: BotService[] };
export type BotBooking = { id: string; service: string; serviceId: string | null; startsAt: Date; master: string; staffId: string | null; status: string };
type Result = { ok: true; summary: { service: string; master: string; when: string } } | { ok: false; error: string };

export interface BotDeps {
  getChat(chatId: string): Promise<{ state: BotState; guest: BotGuest | null; isStaff: boolean }>;
  saveChat(chatId: string, patch: { state?: BotState; firstName?: string; username?: string; guestId?: string; isStaff?: boolean }): Promise<void>;
  menu(): Promise<BotCategory[]>;
  dates(): Ymd[];
  slots(serviceId: string, date: Ymd, staffId: string | null, excludeAppointmentId?: string): Promise<{ time: string }[]>;
  book(input: { serviceId: string; staffId: string | null; date: Ymd; time: string; name: string; phone: string; guestId?: string; chatId: string }): Promise<Result>;
  upcoming(guestId: string): Promise<BotBooking[]>;
  cancel(appointmentId: string, guestId: string): Promise<{ ok: boolean; error?: string }>;
  reschedule(appointmentId: string, guestId: string, date: Ymd, time: string): Promise<Result>;
  findGuestByPhone(phone: string): Promise<BotGuest | null>;
  contacts(): Promise<{ phone: string; whatsapp: string; address: string; district: string; hours: string; dayOff: string }>;
  /** Code that links a chat as a reception chat (shown on /cms/integrations) */
  staffCode(): Promise<string>;
  formatWhen(d: Date): string;
}

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const dateLabel = (d: Ymd) => `${WEEKDAYS_SHORT[weekdayOf(d)]} ${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const money = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n).replace(/\s/g, " ")} c.`;
const rows = <T>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

const MAIN_MENU: BotButton[][] = [
  [{ text: "✦ Записаться", data: "book" }],
  [
    { text: "Мои записи", data: "my" },
    { text: "Цены", data: "prices" },
  ],
  [{ text: "Контакты и адрес", data: "contacts" }],
];
const BACK_TO_MENU: BotButton[] = [{ text: "← В меню", data: "menu" }];

/** Handles one incoming message or button press and returns the bot's replies. */
export async function handleUpdate(u: BotUpdate, deps: BotDeps): Promise<BotReply[]> {
  const chat = await deps.getChat(u.chatId);
  let state: BotState = chat.state ?? {};
  const out: BotReply[] = [];
  const save = (s: BotState) => {
    state = s;
    return deps.saveChat(u.chatId, { state: s, firstName: u.firstName, username: u.username });
  };
  const menu = async (text = "Чем могу помочь?") => {
    await save({ step: "idle" });
    out.push({ text, buttons: MAIN_MENU });
  };

  const bail = async (text?: string) => {
    await menu(text);
    return out;
  };

  const findService = async (id?: string) => (await deps.menu()).flatMap((c) => c.services).find((s) => s.id === id);

  const showDates = async (prefix: "d" | "rd", title: string) => {
    const dates = deps.dates();
    out.push({
      text: title,
      buttons: [...rows(dates.map((d) => ({ text: dateLabel(d), data: `${prefix}:${d}` })), 3), BACK_TO_MENU],
    });
  };

  const showTimes = async (date: Ymd, prefix: "t" | "rt") => {
    const list = await deps.slots(state.serviceId!, date, state.staffId ?? null, prefix === "rt" ? state.apptId : undefined);
    if (!list.length) {
      out.push({ text: `${dateLabel(date)} — свободного времени нет. Выберите другой день:` });
      await showDates(prefix === "t" ? "d" : "rd", "Другие дни:");
      return;
    }
    out.push({
      text: `Свободное время, ${dateLabel(date)}:`,
      buttons: [...rows(list.slice(0, 20).map((s) => ({ text: s.time, data: `${prefix}:${s.time}` })), 4), [{ text: "← Другой день", data: prefix === "t" ? "dates" : "rdates" }]],
    });
  };

  const confirm = async () => {
    const svc = await findService(state.serviceId);
    if (!svc || !state.date || !state.time) return menu("Давайте начнём сначала.");
    const master = state.staffId ? svc.staff.find((m) => m.id === state.staffId)?.name : "любой свободный мастер";
    await save({ ...state, step: "idle" });
    out.push({
      text: `Проверьте, пожалуйста:\n\n${svc.name}\n${dateLabel(state.date)}, ${state.time}\nМастер: ${master}\nСтоимость: ${money(svc.price)}\n\nИмя: ${state.name}\nТелефон: ${state.phone}`,
      buttons: [
        [{ text: "✓ Записаться", data: "ok" }],
        [
          { text: "Другое время", data: `d:${state.date}` },
          { text: "Отмена", data: "menu" },
        ],
      ],
    });
  };

  const askPhone = async (after: "confirm" | "my") => {
    await save({ ...state, step: "phone", after });
    out.push({
      text: "Поделитесь, пожалуйста, номером телефона — кнопкой ниже или напишите его сообщением (например, 98 103 11 11).",
      askContact: true,
    });
  };

  const showMy = async (guestId: string) => {
    const list = await deps.upcoming(guestId);
    if (!list.length) {
      out.push({ text: "У вас нет предстоящих записей.", buttons: [[{ text: "✦ Записаться", data: "book" }], BACK_TO_MENU] });
      return;
    }
    for (const b of list) {
      out.push({
        text: `${b.service}\n${deps.formatWhen(b.startsAt)} · мастер ${b.master}\n${b.status === "CONFIRMED" ? "Подтверждено ✓" : "Ждёт подтверждения администратора"}`,
        buttons: [
          [
            { text: "Перенести", data: `r:${b.id}` },
            { text: "Отменить", data: `x:${b.id}` },
          ],
        ],
      });
    }
    out.push({ text: "Что-нибудь ещё?", buttons: MAIN_MENU });
  };

  // ── Phone / name input ──────────────────────────────────
  if (state.step === "phone" && (u.contactPhone || u.text) && !u.data) {
    const phone = normalizePhone(u.contactPhone ?? u.text ?? "");
    if (!phone) {
      out.push({ text: "Не получилось распознать номер. Нужно 9 цифр, например 98 103 11 11.", askContact: true });
      return out;
    }
    const guest = await deps.findGuestByPhone(phone);
    if (guest) await deps.saveChat(u.chatId, { guestId: guest.id });
    out.push({ text: guest ? `Спасибо, ${guest.name.split(" ")[0]}! Узнала вас ✦` : "Спасибо!", removeKeyboard: true });
    if (state.after === "my") {
      await save({ step: "idle" });
      if (guest) await showMy(guest.id);
      else out.push({ text: "По этому номеру записей пока нет.", buttons: MAIN_MENU });
      return out;
    }
    const name = guest?.name ?? state.name ?? u.firstName;
    await save({ ...state, phone, name, step: name ? "idle" : "name" });
    if (!name) {
      out.push({ text: "Как к вам обращаться?" });
      return out;
    }
    await confirm();
    return out;
  }
  if (state.step === "name" && u.text && !u.data) {
    const name = u.text.trim().slice(0, 60);
    if (name.length < 2) {
      out.push({ text: "Напишите, пожалуйста, ваше имя." });
      return out;
    }
    await save({ ...state, name, step: "idle" });
    await confirm();
    return out;
  }

  // ── Commands and free text ──────────────────────────────
  const text = (u.text ?? "").trim();
  if (!u.data && text) {
    if (text.startsWith("/staff")) {
      const code = text.split(/\s+/)[1] ?? "";
      if (code && code === (await deps.staffCode())) {
        await deps.saveChat(u.chatId, { isStaff: true });
        out.push({ text: "Готово: этот чат будет получать уведомления ресепшена о новых записях, отменах и переносах." });
      } else {
        out.push({ text: "Код не подошёл. Возьмите актуальный код в CMS → Интеграции." });
      }
      return out;
    }
    if (text === "/start") {
      await menu(
        `Здравствуйте${u.firstName ? `, ${u.firstName}` : ""}! ✦\nЭто Mavzunai Jovid — Gallery of Beauty MJ, салон красоты и свадебный зал в Душанбе.\n\nЗдесь можно записаться к мастеру, посмотреть и перенести свои записи.`,
      );
      return out;
    }
    const map: Record<string, string> = { "/book": "book", "/my": "my", "/prices": "prices", "/contacts": "contacts", "/menu": "menu" };
    if (map[text]) u = { ...u, data: map[text] };
    else {
      await menu("Я понимаю кнопки ниже ✦ Если нужен живой ответ — напишите нам в WhatsApp или позвоните.");
      return out;
    }
  }
  if (!u.data) {
    await menu();
    return out;
  }

  // ── Buttons ─────────────────────────────────────────────
  const [cmd, ...rest] = u.data.split(":");
  const arg = rest.join(":");

  switch (cmd) {
    case "menu":
      await menu();
      break;

    case "book": {
      await save({ step: "idle" });
      const cats = await deps.menu();
      out.push({ text: "Что будем делать?", buttons: [...rows(cats.map((c) => ({ text: c.name, data: `c:${c.id}` })), 2), BACK_TO_MENU] });
      break;
    }

    case "c": {
      const cat = (await deps.menu()).find((c) => c.id === arg);
      if (!cat) return bail();
      out.push({
        text: cat.name,
        buttons: [...cat.services.map((s) => [{ text: `${s.name} · ${money(s.price)}`, data: `s:${s.id}` }]), [{ text: "← Назад", data: "book" }]],
      });
      break;
    }

    case "s": {
      const svc = await findService(arg);
      if (!svc) return bail("Эта услуга сейчас недоступна для записи.");
      await save({ step: "idle", serviceId: svc.id, staffId: null });
      out.push({
        text: `${svc.name} · ${money(svc.price)} · ${svc.durationMin} мин\nК какому мастеру?`,
        buttons: [[{ text: "Любой мастер", data: "m:any" }], ...rows(svc.staff.map((m) => ({ text: m.name, data: `m:${m.id}` })), 3), BACK_TO_MENU],
      });
      break;
    }

    case "m":
      if (!state.serviceId) return bail();
      await save({ ...state, staffId: arg === "any" ? null : arg });
      await showDates("d", "Выберите день (понедельник — выходной):");
      break;

    case "dates":
      await showDates("d", "Выберите день:");
      break;

    case "d":
      if (!state.serviceId) return bail();
      await save({ ...state, date: arg, time: undefined });
      await showTimes(arg, "t");
      break;

    case "t": {
      if (!state.serviceId || !state.date) return bail();
      const guest = chat.guest;
      await save({ ...state, time: arg, ...(guest ? { phone: guest.phone, name: guest.name } : {}) });
      if (!guest && !state.phone) await askPhone("confirm");
      else await confirm();
      break;
    }

    case "ok": {
      if (!state.serviceId || !state.date || !state.time || !state.phone || !state.name) return bail("Давайте начнём сначала.");
      const res = await deps.book({
        serviceId: state.serviceId,
        staffId: state.staffId ?? null,
        date: state.date,
        time: state.time,
        name: state.name,
        phone: state.phone,
        guestId: chat.guest?.id,
        chatId: u.chatId,
      });
      if (!res.ok) {
        out.push({ text: res.error });
        await showTimes(state.date, "t");
        break;
      }
      await save({ step: "idle" });
      out.push({
        text: `Вы записаны ✦\n\n${res.summary.service}\n${res.summary.when}\nМастер: ${res.summary.master}\n\nАдминистратор подтвердит запись. Напомним за день и за 2 часа до визита.`,
        buttons: MAIN_MENU,
      });
      break;
    }

    case "my":
      if (!chat.guest) await askPhone("my");
      else await showMy(chat.guest.id);
      break;

    case "x":
      out.push({ text: "Точно отменить эту запись?", buttons: [[{ text: "Да, отменить", data: `xx:${arg}` }, { text: "Нет", data: "my" }]] });
      break;

    case "xx": {
      if (!chat.guest) return bail();
      const res = await deps.cancel(arg, chat.guest.id);
      out.push({ text: res.ok ? "Запись отменена. Будем рады видеть вас в другой день ✦" : (res.error ?? "Не получилось отменить"), buttons: MAIN_MENU });
      break;
    }

    case "r": {
      if (!chat.guest) return bail();
      const b = (await deps.upcoming(chat.guest.id)).find((x) => x.id === arg);
      if (!b || !b.serviceId) return bail("Эту запись нельзя перенести — напишите нам.");
      await save({ step: "idle", apptId: b.id, serviceId: b.serviceId, staffId: b.staffId });
      await showDates("rd", `Перенос: ${b.service}, мастер ${b.master}.\nВыберите новый день:`);
      break;
    }

    case "rdates":
      await showDates("rd", "Выберите новый день:");
      break;

    case "rd":
      if (!state.apptId) return bail();
      await save({ ...state, date: arg });
      await showTimes(arg, "rt");
      break;

    case "rt": {
      if (!state.apptId || !state.date || !chat.guest) return bail();
      const res = await deps.reschedule(state.apptId, chat.guest.id, state.date, arg);
      if (!res.ok) {
        out.push({ text: res.error });
        await showTimes(state.date, "rt");
        break;
      }
      await save({ step: "idle" });
      out.push({ text: `Перенесли ✦\n${res.summary.service}\n${res.summary.when}\nМастер: ${res.summary.master}`, buttons: MAIN_MENU });
      break;
    }

    case "prices": {
      const cats = await deps.menu();
      const lines = cats.map((c) => `${c.name.toUpperCase()}\n${c.services.map((s) => `• ${s.name} — ${money(s.price)}`).join("\n")}`);
      out.push({ text: `Цены, сомони:\n\n${lines.join("\n\n")}`, buttons: [[{ text: "✦ Записаться", data: "book" }], BACK_TO_MENU] });
      break;
    }

    case "contacts": {
      const c = await deps.contacts();
      out.push({
        text: `Mavzunai Jovid\n${c.address}\n${c.district}\n\n${c.hours}\n${c.dayOff}\n\nТелефон: ${c.phone}\nWhatsApp: wa.me/${c.whatsapp.replace(/\D/g, "")}`,
        buttons: [[{ text: "✦ Записаться", data: "book" }], BACK_TO_MENU],
      });
      break;
    }

    default:
      await menu();
  }
  return out;
}

export { dateLabel as botDateLabel };
