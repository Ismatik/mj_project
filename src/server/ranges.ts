import { addDays, atSalonTime, type Ymd } from "@/lib/time";

/** [start, end) of a Dushanbe calendar day as UTC instants. */
export const dayRange = (ymd: Ymd) => ({ gte: atSalonTime(ymd), lt: atSalonTime(addDays(ymd, 1)) });

/** From the 1st of the month of `ymd` up to the end of `ymd` (month to date). */
export const monthToDate = (ymd: Ymd) => ({ gte: atSalonTime(`${ymd.slice(0, 8)}01`), lt: atSalonTime(addDays(ymd, 1)) });

/** The same span one month earlier (1st … same day, clamped to month length). */
export function previousMonthToDate(ymd: Ymd) {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const start = `${py}-${String(pm).padStart(2, "0")}-01`;
  const end = `${py}-${String(pm).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
  return { gte: atSalonTime(start), lt: atSalonTime(addDays(end, 1)) };
}

const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_DATIVE = ["январю", "февралю", "марту", "апрелю", "маю", "июню", "июлю", "августу", "сентябрю", "октябрю", "ноябрю", "декабрю"];
const MONTHS_PREP = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];

export const monthName = (ymd: Ymd) => MONTHS[Number(ymd.slice(5, 7)) - 1]!;
/** "к августу" - the month before `ymd`, in the dative. */
export const previousMonthDative = (ymd: Ymd) => MONTHS_DATIVE[(Number(ymd.slice(5, 7)) + 10) % 12]!;
/** "в сентябре" */
export const monthPrepositional = (ymd: Ymd) => MONTHS_PREP[Number(ymd.slice(5, 7)) - 1]!;

/** +18% / −4% / 0% */
export function changeLabel(now: number, before: number): string {
  if (!before) return now ? "+100%" : "0%";
  const p = Math.round(((now - before) / before) * 100);
  return p > 0 ? `+${p}%` : p < 0 ? `−${Math.abs(p)}%` : "0%";
}
