// The salon runs on Dushanbe time (UTC+5, no daylight saving).
// Dates without a time are handled as "YYYY-MM-DD" strings to avoid timezone drift.

export const SALON_TZ = "Asia/Dushanbe";
const OFFSET = "+05:00";

export type Ymd = string;

/** Today's calendar date in Dushanbe. */
export function todayYmd(now: Date = new Date()): Ymd {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SALON_TZ }).format(now);
}

/** A UTC instant for a Dushanbe wall-clock time. */
export function atSalonTime(ymd: Ymd, hhmm = "00:00"): Date {
  return new Date(`${ymd}T${hhmm}:00${OFFSET}`);
}

export function addDays(ymd: Ymd, days: number): Ymd {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(ymd: Ymd): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function mondayOf(ymd: Ymd): Ymd {
  return addDays(ymd, -weekdayOf(ymd));
}

/** Monday is the salon's day off. */
export function isClosed(ymd: Ymd): boolean {
  return weekdayOf(ymd) === 0;
}

export const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
