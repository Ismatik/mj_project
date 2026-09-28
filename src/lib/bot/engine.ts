// Mavzunai Jovid Telegram bot — conversation logic, independent of Telegram itself.
// The same engine answers real Telegram updates (webhook) and the CMS chat simulator.
import { dateLabel as dateLabelIn, somoni } from "../i18n/format";
import { LANG_NAME, LANGS, isLang, langFromTelegram, type Lang } from "../i18n/locales";
import { normalizePhone } from "../phone";
import type { Ymd } from "../time";
import { botTexts } from "./texts";

export type BotButton = { text: string; data: string };
export type BotReply = {
  text: string;
  /** Inline buttons, row by row */
  buttons?: BotButton[][];
  /** Show the "share my phone number" keyboard */
  askContact?: boolean;
  /** Text of that keyboard button */
  contactLabel?: string;
  /** Remove the contact keyboard */
  removeKeyboard?: boolean;
};
export type BotUpdate = { chatId: string; firstName?: string; username?: string; text?: string; data?: string; contactPhone?: string; languageCode?: string };

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
  getChat(chatId: string): Promise<{ state: BotState; guest: BotGuest | null; isStaff: boolean; lang: Lang | null }>;
  saveChat(chatId: string, patch: { state?: BotState; firstName?: string; username?: string; guestId?: string; isStaff?: boolean; lang?: Lang }): Promise<void>;
  menu(lang: Lang): Promise<BotCategory[]>;
  dates(): Ymd[];
  slots(serviceId: string, date: Ymd, staffId: string | null, excludeAppointmentId?: string): Promise<{ time: string }[]>;
  book(input: { serviceId: string; staffId: string | null; date: Ymd; time: string; name: string; phone: string; guestId?: string; chatId: string; lang: Lang }): Promise<Result>;
  upcoming(guestId: string, lang: Lang): Promise<BotBooking[]>;
  cancel(appointmentId: string, guestId: string, lang: Lang): Promise<{ ok: boolean; error?: string }>;
  reschedule(appointmentId: string, guestId: string, date: Ymd, time: string, lang: Lang): Promise<Result>;
  findGuestByPhone(phone: string): Promise<BotGuest | null>;
  contacts(lang: Lang): Promise<{ phone: string; whatsapp: string; address: string; district: string; hours: string; dayOff: string }>;
  /** Code that links a chat as a reception chat (shown on /cms/integrations) */
  staffCode(): Promise<string>;
  formatWhen(d: Date, lang: Lang): string;
}

const rows = <T>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Handles one incoming message or button press and returns the bot's replies. */
export async function handleUpdate(u: BotUpdate, deps: BotDeps): Promise<BotReply[]> {
  const chat = await deps.getChat(u.chatId);
  // Language: chosen in the bot, otherwise from the Telegram app (remembered on first contact)
  let lang: Lang = chat.lang ?? langFromTelegram(u.languageCode);
  if (!chat.lang && u.languageCode) await deps.saveChat(u.chatId, { lang });
  let t = botTexts(lang);
  const dateLabel = (d: Ymd) => dateLabelIn(d, lang);
  const money = (n: number) => somoni(n, lang).replace(/\s/g, " ");
  const mainMenu = (): BotButton[][] => [
    [{ text: t.book, data: "book" }],
    [
      { text: t.my, data: "my" },
      { text: t.prices, data: "prices" },
    ],
    [{ text: t.contacts, data: "contacts" }],
    [{ text: t.language, data: "lang" }],
  ];
  const backToMenu = (): BotButton[] => [{ text: t.backToMenu, data: "menu" }];

  let state: BotState = chat.state ?? {};
  const out: BotReply[] = [];
  const save = (s: BotState) => {
    state = s;
    return deps.saveChat(u.chatId, { state: s, firstName: u.firstName, username: u.username });
  };
  const menu = async (text = t.help) => {
    await save({ step: "idle" });
    out.push({ text, buttons: mainMenu() });
  };

  const bail = async (text?: string) => {
    await menu(text);
    return out;
  };

  const findService = async (id?: string) => (await deps.menu(lang)).flatMap((c) => c.services).find((s) => s.id === id);

  const showDates = async (prefix: "d" | "rd", title: string) => {
    const dates = deps.dates();
    out.push({
      text: title,
      buttons: [...rows(dates.map((d) => ({ text: dateLabel(d), data: `${prefix}:${d}` })), 3), backToMenu()],
    });
  };

  const showTimes = async (date: Ymd, prefix: "t" | "rt") => {
    const list = await deps.slots(state.serviceId!, date, state.staffId ?? null, prefix === "rt" ? state.apptId : undefined);
    if (!list.length) {
      out.push({ text: t.noTimeThatDay(dateLabel(date)) });
      await showDates(prefix === "t" ? "d" : "rd", t.otherDays);
      return;
    }
    out.push({
      text: t.freeTimes(dateLabel(date)),
      buttons: [...rows(list.slice(0, 20).map((s) => ({ text: s.time, data: `${prefix}:${s.time}` })), 4), [{ text: t.otherDay, data: prefix === "t" ? "dates" : "rdates" }]],
    });
  };

  const confirm = async () => {
    const svc = await findService(state.serviceId);
    if (!svc || !state.date || !state.time) return menu(t.startOver);
    const master = (state.staffId ? svc.staff.find((m) => m.id === state.staffId)?.name : null) ?? t.anyFreeMaster;
    await save({ ...state, step: "idle" });
    out.push({
      text: t.check({ service: svc.name, when: `${dateLabel(state.date)}, ${state.time}`, master, price: money(svc.price), name: state.name ?? "", phone: state.phone ?? "" }),
      buttons: [
        [{ text: t.confirm, data: "ok" }],
        [
          { text: t.otherTime, data: `d:${state.date}` },
          { text: t.cancelFlow, data: "menu" },
        ],
      ],
    });
  };

  const askPhone = async (after: "confirm" | "my") => {
    await save({ ...state, step: "phone", after });
    out.push({ text: t.askPhone, askContact: true, contactLabel: t.sharePhone });
  };

  const showMy = async (guestId: string) => {
    const list = await deps.upcoming(guestId, lang);
    if (!list.length) {
      out.push({ text: t.noUpcoming, buttons: [[{ text: t.book, data: "book" }], backToMenu()] });
      return;
    }
    for (const b of list) {
      out.push({
        text: t.booking({ service: b.service, when: deps.formatWhen(b.startsAt, lang), master: b.master, confirmed: b.status === "CONFIRMED" }),
        buttons: [
          [
            { text: t.move, data: `r:${b.id}` },
            { text: t.cancel, data: `x:${b.id}` },
          ],
        ],
      });
    }
    out.push({ text: t.anythingElse, buttons: mainMenu() });
  };

  // ── Phone / name input ──────────────────────────────────
  if (state.step === "phone" && (u.contactPhone || u.text) && !u.data) {
    const phone = normalizePhone(u.contactPhone ?? u.text ?? "");
    if (!phone) {
      out.push({ text: t.badPhone, askContact: true, contactLabel: t.sharePhone });
      return out;
    }
    const guest = await deps.findGuestByPhone(phone);
    if (guest) await deps.saveChat(u.chatId, { guestId: guest.id, lang });
    out.push({ text: guest ? t.thanksKnown(guest.name.split(" ")[0]!) : t.thanks, removeKeyboard: true });
    if (state.after === "my") {
      await save({ step: "idle" });
      if (guest) await showMy(guest.id);
      else out.push({ text: t.noBookingsForPhone, buttons: mainMenu() });
      return out;
    }
    const name = guest?.name ?? state.name ?? u.firstName;
    await save({ ...state, phone, name, step: name ? "idle" : "name" });
    if (!name) {
      out.push({ text: t.askName });
      return out;
    }
    await confirm();
    return out;
  }
  if (state.step === "name" && u.text && !u.data) {
    const name = u.text.trim().slice(0, 60);
    if (name.length < 2) {
      out.push({ text: t.nameAgain });
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
        out.push({ text: t.staffOk });
      } else {
        out.push({ text: t.staffBad });
      }
      return out;
    }
    if (text === "/start") {
      await menu(t.welcome(u.firstName));
      return out;
    }
    const map: Record<string, string> = { "/book": "book", "/my": "my", "/prices": "prices", "/contacts": "contacts", "/menu": "menu", "/lang": "lang" };
    if (map[text]) u = { ...u, data: map[text] };
    else {
      await menu(t.onlyButtons);
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

    case "lang":
      if (isLang(arg)) {
        lang = arg;
        t = botTexts(lang);
        await deps.saveChat(u.chatId, { lang });
        await menu(t.languageSet);
        break;
      }
      out.push({ text: t.chooseLanguage, buttons: [LANGS.map((l) => ({ text: `${l === lang ? "✓ " : ""}${LANG_NAME[l]}`, data: `lang:${l}` })), backToMenu()] });
      break;

    case "book": {
      await save({ step: "idle" });
      const cats = await deps.menu(lang);
      out.push({ text: t.whatToDo, buttons: [...rows(cats.map((c) => ({ text: c.name, data: `c:${c.id}` })), 2), backToMenu()] });
      break;
    }

    case "c": {
      const cat = (await deps.menu(lang)).find((c) => c.id === arg);
      if (!cat) return bail();
      out.push({
        text: cat.name,
        buttons: [...cat.services.map((s) => [{ text: `${s.name} · ${money(s.price)}`, data: `s:${s.id}` }]), [{ text: t.back, data: "book" }]],
      });
      break;
    }

    case "s": {
      const svc = await findService(arg);
      if (!svc) return bail(t.unavailable);
      await save({ step: "idle", serviceId: svc.id, staffId: null });
      out.push({
        text: t.whichMaster(svc.name, money(svc.price), svc.durationMin),
        buttons: [[{ text: t.anyMaster, data: "m:any" }], ...rows(svc.staff.map((m) => ({ text: m.name, data: `m:${m.id}` })), 3), backToMenu()],
      });
      break;
    }

    case "m":
      if (!state.serviceId) return bail();
      await save({ ...state, staffId: arg === "any" ? null : arg });
      await showDates("d", t.pickDayOff);
      break;

    case "dates":
      await showDates("d", t.pickDay);
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
      if (!state.serviceId || !state.date || !state.time || !state.phone || !state.name) return bail(t.startOver);
      const res = await deps.book({
        serviceId: state.serviceId,
        staffId: state.staffId ?? null,
        date: state.date,
        time: state.time,
        name: state.name,
        phone: state.phone,
        guestId: chat.guest?.id,
        chatId: u.chatId,
        lang,
      });
      if (!res.ok) {
        out.push({ text: res.error });
        await showTimes(state.date, "t");
        break;
      }
      await save({ step: "idle" });
      out.push({ text: t.booked(res.summary), buttons: mainMenu() });
      break;
    }

    case "my":
      if (!chat.guest) await askPhone("my");
      else await showMy(chat.guest.id);
      break;

    case "x":
      out.push({ text: t.cancelAsk, buttons: [[{ text: t.yesCancel, data: `xx:${arg}` }, { text: t.no, data: "my" }]] });
      break;

    case "xx": {
      if (!chat.guest) return bail();
      const res = await deps.cancel(arg, chat.guest.id, lang);
      out.push({ text: res.ok ? t.cancelled : (res.error ?? t.cancelFailed), buttons: mainMenu() });
      break;
    }

    case "r": {
      if (!chat.guest) return bail();
      const b = (await deps.upcoming(chat.guest.id, lang)).find((x) => x.id === arg);
      if (!b || !b.serviceId) return bail(t.cantMove);
      await save({ step: "idle", apptId: b.id, serviceId: b.serviceId, staffId: b.staffId });
      await showDates("rd", t.moveTitle(b.service, b.master));
      break;
    }

    case "rdates":
      await showDates("rd", t.pickNewDay);
      break;

    case "rd":
      if (!state.apptId) return bail();
      await save({ ...state, date: arg });
      await showTimes(arg, "rt");
      break;

    case "rt": {
      if (!state.apptId || !state.date || !chat.guest) return bail();
      const res = await deps.reschedule(state.apptId, chat.guest.id, state.date, arg, lang);
      if (!res.ok) {
        out.push({ text: res.error });
        await showTimes(state.date, "rt");
        break;
      }
      await save({ step: "idle" });
      out.push({ text: t.moved(res.summary), buttons: mainMenu() });
      break;
    }

    case "prices": {
      const cats = await deps.menu(lang);
      const lines = cats.map((c) => `${c.name.toUpperCase()}\n${c.services.map((s) => `• ${s.name} — ${money(s.price)}`).join("\n")}`);
      out.push({ text: `${t.pricesTitle}\n\n${lines.join("\n\n")}`, buttons: [[{ text: t.book, data: "book" }], backToMenu()] });
      break;
    }

    case "contacts": {
      const c = await deps.contacts(lang);
      out.push({
        text: `Mavzunai Jovid\n${c.address}\n${c.district}\n\n${c.hours}\n${c.dayOff}\n\n${t.phone}: ${c.phone}\nWhatsApp: wa.me/${c.whatsapp.replace(/\D/g, "")}`,
        buttons: [[{ text: t.book, data: "book" }], backToMenu()],
      });
      break;
    }

    default:
      await menu();
  }
  return out;
}


