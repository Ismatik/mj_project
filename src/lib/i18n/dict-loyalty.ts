// Website texts for the bonus program and promotions (R3 Sprint 2).
import type { Lang } from "./locales";

const ru = {
  offers: {
    title: "Акции",
    until: (d: string) => `до ${d}`,
    dates: (a: string, b: string) => `${a} — ${b}`,
    allServices: "на все услуги",
    code: "Промокод",
    book: "Записаться",
    badge: (v: string) => `−${v}`,
    inBooking: (v: string) => `акция ${v}`,
  },
  promo: {
    have: "Есть промокод?",
    label: "Промокод",
    apply: "Применить",
    applied: (title: string, price: string, full: string) => `${title}: ${price} вместо ${full}`,
    invalid: "Промокод не подходит к этой услуге или дате",
    unknown: "Такого промокода нет",
    remove: "Убрать",
  },
  bonus: {
    title: "Бонусы",
    balance: "На счёте",
    points: (n: number) => `${n} ${plural(n, ["бонус", "бонуса", "бонусов"])}`,
    tier: (name: string, pct: number) => `Уровень «${name}» — ${pct}% бонусами с каждого визита`,
    next: (name: string, left: string, pct: number) => `До уровня «${name}» (${pct}%) осталось ${left}`,
    top: "У вас высший уровень ✦",
    how: (pct: number) => `1 бонус = 1 сомони. Бонусами можно оплатить до ${pct}% визита — скажите администратору.`,
    history: "История",
    kinds: { EARN: "Начислено за визит", SPEND: "Оплачено бонусами", BIRTHDAY: "Подарок ко дню рождения", WELCOME: "Приветственные бонусы", MANUAL: "Корректировка" } as Record<string, string>,
    receipt: (n: number) => `чек №${n}`,
    none: "Бонусы начисляются после оплаты визита в салоне.",
  },
};

export type LoyaltyDict = typeof ru;

const tg: LoyaltyDict = {
  offers: {
    title: "Аксияҳо",
    until: (d) => `то ${d}`,
    dates: (a, b) => `${a} — ${b}`,
    allServices: "ба ҳамаи хизматрасониҳо",
    code: "Промокод",
    book: "Сабт шудан",
    badge: (v) => `−${v}`,
    inBooking: (v) => `аксия ${v}`,
  },
  promo: {
    have: "Промокод доред?",
    label: "Промокод",
    apply: "Татбиқ кардан",
    applied: (title, price, full) => `${title}: ${price} ба ҷои ${full}`,
    invalid: "Промокод ба ин хизматрасонӣ ё сана мувофиқ нест",
    unknown: "Чунин промокод нест",
    remove: "Хориҷ кардан",
  },
  bonus: {
    title: "Бонусҳо",
    balance: "Дар ҳисоб",
    points: (n) => `${n} бонус`,
    tier: (name, pct) => `Сатҳи «${name}» — ${pct}% бо бонус аз ҳар ташриф`,
    next: (name, left, pct) => `То сатҳи «${name}» (${pct}%) ${left} монд`,
    top: "Шумо дар сатҳи олӣ ҳастед ✦",
    how: (pct) => `1 бонус = 1 сомонӣ. Бо бонусҳо то ${pct}% ташрифро пардохт кардан мумкин аст — ба маъмур гӯед.`,
    history: "Таърих",
    kinds: { EARN: "Барои ташриф", SPEND: "Бо бонус пардохт шуд", BIRTHDAY: "Тӯҳфа барои зодрӯз", WELCOME: "Бонуси хушомад", MANUAL: "Ислоҳ" },
    receipt: (n) => `чек №${n}`,
    none: "Бонусҳо пас аз пардохти ташриф дар салон ҳисоб мешаванд.",
  },
};

const en: LoyaltyDict = {
  offers: {
    title: "Offers",
    until: (d) => `until ${d}`,
    dates: (a, b) => `${a} — ${b}`,
    allServices: "on all services",
    code: "Promo code",
    book: "Book",
    badge: (v) => `−${v}`,
    inBooking: (v) => `offer ${v}`,
  },
  promo: {
    have: "Have a promo code?",
    label: "Promo code",
    apply: "Apply",
    applied: (title, price, full) => `${title}: ${price} instead of ${full}`,
    invalid: "This promo code doesn't apply to this service or date",
    unknown: "No such promo code",
    remove: "Remove",
  },
  bonus: {
    title: "Bonus points",
    balance: "Balance",
    points: (n) => `${n} ${n === 1 ? "point" : "points"}`,
    tier: (name, pct) => `${name} level — ${pct}% back in points on every visit`,
    next: (name, left, pct) => `${left} more to reach ${name} (${pct}%)`,
    top: "You're at the top level ✦",
    how: (pct) => `1 point = 1 somoni. Points can pay for up to ${pct}% of a visit — just tell reception.`,
    history: "History",
    kinds: { EARN: "Earned for a visit", SPEND: "Paid with points", BIRTHDAY: "Birthday gift", WELCOME: "Welcome points", MANUAL: "Adjustment" },
    receipt: (n) => `receipt #${n}`,
    none: "Points are added after you pay for a visit at the salon.",
  },
};

const DICTS: Record<Lang, LoyaltyDict> = { ru, tg, en };
export const loyaltyDict = (lang: Lang): LoyaltyDict => DICTS[lang];

function plural(n: number, [one, few, many]: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
