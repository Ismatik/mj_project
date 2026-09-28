import { SALON_TZ } from "./time";

const group = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** 12833 → "12 833 c." (somoni, whole units). */
export function somoni(amount: number): string {
  return `${group.format(amount)} c.`;
}

/** "Марта Каримова" → "МК"; "Марта К." → "МК". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** 21 сен */
export function shortDate(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: SALON_TZ, day: "numeric", month: "short" })
    .format(d)
    .replace(".", "");
}

/** Вс, 21 сентября 2026 */
export function longDate(d: Date): string {
  const s = new Intl.DateTimeFormat("ru-RU", {
    timeZone: SALON_TZ,
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(" г.", "");
}

/** 09:00 */
export function clock(d: Date): string {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: SALON_TZ, hour: "2-digit", minute: "2-digit" }).format(d);
}

export function percent(part: number, total: number): string {
  return total ? `${Math.round((part / total) * 100)}%` : "0%";
}

/** Russian plural: plural(3, ["работа", "работы", "работ"]) → "работы". */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
