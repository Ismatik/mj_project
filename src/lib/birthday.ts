// Birthdays in the guest book: how soon, and how old she turns.
import type { Ymd } from "./time";

/** Days until her next birthday (0 = today) and the age she turns. 29 February counts as 28 February in other years. */
export function nextBirthday(birthday: Ymd, today: Ymd): { days: number; turns: number; date: Ymd } {
  const [by, bm, bd] = birthday.split("-").map(Number) as [number, number, number];
  const [ty] = today.split("-").map(Number) as [number];
  const on = (y: number) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const d = bm === 2 && bd === 29 && !leap ? 28 : bd;
    return `${y}-${String(bm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  let year = ty;
  if (on(year) < today) year++;
  const date = on(year);
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 864e5);
  return { days, turns: year - by, date };
}

/** "сегодня", "завтра", "через 5 дн." */
export const inDays = (n: number) => (n === 0 ? "сегодня" : n === 1 ? "завтра" : `через ${n} дн.`);
