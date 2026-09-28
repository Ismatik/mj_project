// Dates, money and durations for guests in their language. Staff screens keep using ../format (Russian).
import { duration as durationRu } from "../duration";
import { clock, longDate as longDateRu, somoni as somoniRu } from "../format";
import { SALON_TZ, weekdayOf, WEEKDAYS_SHORT, type Ymd } from "../time";
import type { Lang } from "./locales";

export const WEEKDAYS: Record<Lang, readonly string[]> = {
  ru: WEEKDAYS_SHORT,
  tg: ["Дш", "Сш", "Чш", "Пш", "Ҷм", "Шб", "Яш"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};
const WEEKDAYS_LONG: Record<Exclude<Lang, "ru">, readonly string[]> = {
  tg: ["Душанбе", "Сешанбе", "Чоршанбе", "Панҷшанбе", "Ҷумъа", "Шанбе", "Якшанбе"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};
export const MONTHS: Record<Lang, readonly string[]> = {
  ru: ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
  tg: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
const MONTHS_LONG: Record<Exclude<Lang, "ru">, readonly string[]> = {
  tg: ["январ", "феврал", "март", "апрел", "май", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** "2026-09-29" → "Вт 29 сен" / "Сш 29 сен" / "Tue 29 Sep" */
export function dateLabel(ymd: Ymd, lang: Lang): string {
  return `${WEEKDAYS[lang][weekdayOf(ymd)]} ${Number(ymd.slice(8))} ${MONTHS[lang][Number(ymd.slice(5, 7)) - 1]}`;
}

const ymdOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: SALON_TZ }).format(d);

/** "Вт, 29 сентября 2026" / "Сешанбе, 29 сентябр 2026" / "Tuesday, 29 September 2026" */
export function longDate(d: Date, lang: Lang): string {
  if (lang === "ru") return longDateRu(d);
  const ymd = ymdOf(d);
  const wd = WEEKDAYS_LONG[lang][weekdayOf(ymd)];
  return `${wd}, ${Number(ymd.slice(8))} ${MONTHS_LONG[lang][Number(ymd.slice(5, 7)) - 1]} ${ymd.slice(0, 4)}`;
}

/** "Вт, 29 сентября 2026, 14:00" in the guest's language */
export const when = (d: Date, lang: Lang) => `${longDate(d, lang)}, ${clock(d)}`;

/** 1500 → "1 500 c." (ru, tg) / "1,500 TJS" (en) */
export function somoni(n: number, lang: Lang): string {
  if (lang === "en") return `${new Intl.NumberFormat("en-US").format(n)} TJS`;
  return somoniRu(n);
}

/** 90 → "90 мин" / "90 дақ" / "90 min"; 180 → "3 часа" / "3 соат" / "3 h" */
export function duration(min: number, lang: Lang): string {
  if (lang === "ru") return durationRu(min);
  const hours = min >= 120 && min % 60 === 0 ? min / 60 : 0;
  if (lang === "tg") return hours ? `${hours} соат` : `${min} дақ`;
  return hours ? `${hours} h` : `${min} min`;
}

/** "29 сентября 2027" / "29 сентябр 2027" / "29 September 2027" */
export function dayMonthYear(d: Date, lang: Lang): string {
  const ymd = ymdOf(d);
  const day = Number(ymd.slice(8));
  const m = Number(ymd.slice(5, 7)) - 1;
  if (lang === "ru") return `${day} ${["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"][m]} ${ymd.slice(0, 4)}`;
  return `${day} ${MONTHS_LONG[lang][m]} ${ymd.slice(0, 4)}`;
}
