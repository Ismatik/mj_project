// Website texts for the blog, the Instagram feed and "how to find us" (R4 Sprint 3).
import type { Lang } from "./locales";

const ru = {
  blog: {
    title: "Советы и статьи",
    intro: "Уход, тренды и подготовка к особым дням - от мастеров Mavzunai Jovid.",
    nav: "Блог",
    all: "Все",
    read: "Читать",
    minutes: (n: number) => `${n} мин чтения`,
    book: "Записаться",
    bookService: (s: string) => `Записаться: ${s}`,
    more: "Ещё статьи",
    back: "← Все статьи",
    empty: "Скоро здесь появятся советы наших мастеров.",
    homeTitle: "Советы мастеров",
    homeAll: "Все статьи →",
    draft: "Черновик - видят только редакторы",
  },
  insta: {
    title: "Мы в Instagram",
    follow: (h: string) => `Подписаться @${h}`,
  },
  find: {
    title: "Как нас найти",
    call: "Позвонить",
    whatsapp: "WhatsApp",
    route2gis: "Маршрут в 2ГИС",
    google: "Google Maps",
    showMap: "Показать карту",
    mapNote: "Карта загрузится с сайта Google",
    book: "Записаться",
  },
};

export type BlogDict = typeof ru;

const tg: BlogDict = {
  blog: {
    title: "Маслиҳатҳо ва мақолаҳо",
    intro: "Нигоҳубин, тамоюлҳо ва омодагӣ ба рӯзҳои махсус - аз устоҳои Mavzunai Jovid.",
    nav: "Блог",
    all: "Ҳама",
    read: "Хондан",
    minutes: (n) => `${n} дақ. хондан`,
    book: "Сабт шудан",
    bookService: (s) => `Сабт шудан: ${s}`,
    more: "Мақолаҳои дигар",
    back: "← Ҳамаи мақолаҳо",
    empty: "Ба наздикӣ дар ин ҷо маслиҳатҳои устоҳои мо пайдо мешаванд.",
    homeTitle: "Маслиҳатҳои устоҳо",
    homeAll: "Ҳамаи мақолаҳо →",
    draft: "Лоиҳа - танҳо муҳаррирон мебинанд",
  },
  insta: {
    title: "Мо дар Instagram",
    follow: (h) => `Обуна шудан @${h}`,
  },
  find: {
    title: "Моро чӣ тавр ёфтан мумкин",
    call: "Занг задан",
    whatsapp: "WhatsApp",
    route2gis: "Масир дар 2ГИС",
    google: "Google Maps",
    showMap: "Харитаро нишон додан",
    mapNote: "Харита аз сайти Google бор мешавад",
    book: "Сабт шудан",
  },
};

const en: BlogDict = {
  blog: {
    title: "Tips & articles",
    intro: "Care, trends and getting ready for special days - from the Mavzunai Jovid team.",
    nav: "Blog",
    all: "All",
    read: "Read",
    minutes: (n) => `${n} min read`,
    book: "Book",
    bookService: (s) => `Book: ${s}`,
    more: "More articles",
    back: "← All articles",
    empty: "Tips from our masters are coming soon.",
    homeTitle: "Tips from our masters",
    homeAll: "All articles →",
    draft: "Draft - only editors can see it",
  },
  insta: {
    title: "Find us on Instagram",
    follow: (h) => `Follow @${h}`,
  },
  find: {
    title: "How to find us",
    call: "Call",
    whatsapp: "WhatsApp",
    route2gis: "Route in 2GIS",
    google: "Google Maps",
    showMap: "Show map",
    mapNote: "The map loads from Google",
    book: "Book",
  },
};

const DICTS: Record<Lang, BlogDict> = { ru, tg, en };
export const blogDict = (lang: Lang): BlogDict => DICTS[lang];
