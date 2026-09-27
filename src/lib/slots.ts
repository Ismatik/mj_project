// Free time slots for online booking. Pure: the server passes schedules and busy intervals in.
import { isClosed, weekdayOf, type Ymd } from "./time";

export const SLOT_STEP = 30; // minutes between offered start times
export const DAY_START = 9 * 60; // 09:00
export const DAY_END = 18 * 60; // bookings must finish by 18:00
export const LEAD_MINUTES = 60; // today: earliest slot is at least an hour from now
export const BOOKING_HORIZON_DAYS = 30;

export type SlotStaff = { id: string; workDays: number[] };
export type BusyInterval = { staffId: string; start: number; end: number };
export type Slot = { time: string; start: number; staffIds: string[] };

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * Start times on `date` when at least one of `staff` is working and free for `durationMin`.
 * Each slot lists which masters could take it (first = suggested).
 */
export function freeSlots(opts: {
  date: Ymd;
  today: Ymd;
  nowMinutes: number;
  durationMin: number;
  staff: SlotStaff[];
  busy: BusyInterval[];
}): Slot[] {
  const { date, today, nowMinutes, durationMin, staff, busy } = opts;
  if (date < today || isClosed(date)) return [];
  const wd = weekdayOf(date);
  const working = staff.filter((m) => m.workDays.includes(wd));
  if (!working.length || durationMin <= 0) return [];

  const earliest = date === today ? Math.ceil((nowMinutes + LEAD_MINUTES) / SLOT_STEP) * SLOT_STEP : DAY_START;
  const slots: Slot[] = [];
  for (let start = Math.max(DAY_START, earliest); start + durationMin <= DAY_END; start += SLOT_STEP) {
    const end = start + durationMin;
    const free = working.filter((m) => !busy.some((b) => b.staffId === m.id && b.start < end && start < b.end));
    if (free.length) slots.push({ time: clock(start), start, staffIds: free.map((m) => m.id) });
  }
  return slots;
}

/** The next `days` bookable dates (Mondays skipped), starting today. */
export function bookableDates(today: Ymd, days: number, addDays: (d: Ymd, n: number) => Ymd): Ymd[] {
  const out: Ymd[] = [];
  for (let i = 0; out.length < days && i < days * 2; i++) {
    const d = addDays(today, i);
    if (!isClosed(d)) out.push(d);
  }
  return out;
}
