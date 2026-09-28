// Website texts for the waitlist (R4 Sprint 1).
import type { Lang } from "./locales";

const ru = {
  join: "Сообщить, если освободится",
  joinHint: "Запишем вас в лист ожидания на этот день. Если кто-то отменит запись, пришлём сообщение — время будет держаться за вами 30 минут.",
  window: "Удобное время",
  anyTime: "Любое",
  from: "с",
  to: "до",
  submit: "Встать в лист ожидания",
  joined: (day: string) => `Готово! Вы в листе ожидания на ${day}. Если время освободится, мы сразу напишем.`,
  already: "Вы уже в листе ожидания на этот день — мы напишем, когда время освободится.",
  offeredNow: "Хорошие новости: подходящее время уже есть! Мы отправили вам сообщение со ссылкой — подтвердите в течение 30 минут.",
  page: {
    title: "Освободилось время",
    intro: (name: string) => `${name}, для вас освободилось время:`,
    hold: (time: string) => `Мы держим его за вами до ${time}.`,
    accept: "Записаться",
    decline: "Не подходит",
    booked: "Вы записаны! Ждём вас в салоне.",
    declined: "Хорошо, предложим это время другой гостье. Спасибо, что ответили!",
    expired: "К сожалению, предложение уже не действует — время держится 30 минут. Выберите другое время онлайн.",
    gone: "Ссылка недействительна.",
    book: "Записаться онлайн",
  },
};

export type WaitlistDict = typeof ru;

const tg: WaitlistDict = {
  join: "Хабар диҳед, агар холӣ шавад",
  joinHint: "Шуморо ба рӯйхати интизорӣ барои ин рӯз менависем. Агар касе сабтро бекор кунад, паём мефиристем — вақт 30 дақиқа барои шумо нигоҳ дошта мешавад.",
  window: "Вақти қулай",
  anyTime: "Ҳар вақт",
  from: "аз",
  to: "то",
  submit: "Ба рӯйхати интизорӣ",
  joined: (day) => `Тайёр! Шумо дар рӯйхати интизорӣ барои ${day} ҳастед. Агар вақт холӣ шавад, фавран менависем.`,
  already: "Шумо аллакай дар рӯйхати интизорӣ барои ин рӯз ҳастед — вақте ки вақт холӣ шавад, менависем.",
  offeredNow: "Хабари хуш: вақти мувофиқ аллакай ҳаст! Ба шумо паём бо пайванд фиристодем — дар давоми 30 дақиқа тасдиқ кунед.",
  page: {
    title: "Вақт холӣ шуд",
    intro: (name) => `${name}, барои шумо вақт холӣ шуд:`,
    hold: (time) => `Онро то соати ${time} барои шумо нигоҳ медорем.`,
    accept: "Сабт шудан",
    decline: "Мувофиқ нест",
    booked: "Шумо сабт шудед! Шуморо дар салон интизорем.",
    declined: "Хуб, ин вақтро ба меҳмони дигар пешниҳод мекунем. Ташаккур барои ҷавоб!",
    expired: "Мутаассифона, пешниҳод дигар эътибор надорад — вақт 30 дақиқа нигоҳ дошта мешавад. Вақти дигарро онлайн интихоб кунед.",
    gone: "Пайванд нодуруст аст.",
    book: "Сабти онлайн",
  },
};

const en: WaitlistDict = {
  join: "Let me know if a time opens up",
  joinHint: "We'll put you on the waitlist for this day. If someone cancels, we'll message you and hold the time for you for 30 minutes.",
  window: "Preferred time",
  anyTime: "Any time",
  from: "from",
  to: "to",
  submit: "Join the waitlist",
  joined: (day) => `Done! You're on the waitlist for ${day}. We'll message you as soon as a time opens up.`,
  already: "You're already on the waitlist for this day — we'll message you when a time opens up.",
  offeredNow: "Good news: a suitable time is already free! We've sent you a message with a link — please confirm within 30 minutes.",
  page: {
    title: "A time has opened up",
    intro: (name) => `${name}, a time has opened up for you:`,
    hold: (time) => `We're holding it for you until ${time}.`,
    accept: "Book it",
    decline: "Doesn't suit me",
    booked: "You're booked! See you at the salon.",
    declined: "No problem — we'll offer this time to someone else. Thank you for letting us know!",
    expired: "Sorry, this offer has expired — times are held for 30 minutes. Please choose another time online.",
    gone: "This link is not valid.",
    book: "Book online",
  },
};

const DICTS: Record<Lang, WaitlistDict> = { ru, tg, en };
export const waitlistDict = (lang: Lang): WaitlistDict => DICTS[lang];
