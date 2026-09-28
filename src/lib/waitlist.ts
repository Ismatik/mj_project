// Waitlist and walk-ins: which freed time to offer, how long to hold it, who can take a walk-in now. Pure.
import { DAY_END, DAY_START, type BusyInterval, type Slot, type SlotStaff } from "./slots";
import { isClosed, weekdayOf, type Ymd } from "./time";

/** How long a freed time is held for the guest it is offered to */
export const OFFER_HOLD_MIN = 30;
/** She must be able to answer and get to the salon: no offer for a time starting sooner than this */
export const OFFER_MIN_LEAD_MIN = 45;

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * The slot to offer from the free ones: inside her preferred window (if any) and,
 * when a particular booking was cancelled, starting within the freed time.
 */
export function pickOffer(slots: Slot[], o: { timeFrom?: string | null; timeTo?: string | null; freed?: { start: number; end: number } | null }): Slot | null {
  const from = o.timeFrom ? toMinutes(o.timeFrom) : 0;
  const to = o.timeTo ? toMinutes(o.timeTo) : 24 * 60;
  return slots.find((s) => s.start >= from && s.start <= to && (!o.freed || (s.start >= o.freed.start && s.start < o.freed.end))) ?? null;
}

/** Until when the offer is held; null when the time is too close to offer at all. */
export function offerExpiry(now: Date, startsAt: Date): Date | null {
  const latest = startsAt.getTime() - OFFER_MIN_LEAD_MIN * 60_000;
  if (latest - now.getTime() < 10 * 60_000) return null;
  return new Date(Math.min(now.getTime() + OFFER_HOLD_MIN * 60_000, latest));
}

/**
 * Masters who can take a walk-in right now: working today, free from `start` for the whole service,
 * finishing by closing time. `start` is now rounded up to 5 minutes.
 */
export function freeNow(o: { date: Ymd; nowMinutes: number; durationMin: number; staff: SlotStaff[]; busy: BusyInterval[] }): { start: number; time: string; staffIds: string[] } | null {
  if (isClosed(o.date)) return null;
  const start = Math.max(DAY_START, Math.ceil(o.nowMinutes / 5) * 5);
  const end = start + o.durationMin;
  if (end > DAY_END) return null;
  const wd = weekdayOf(o.date);
  const staffIds = o.staff.filter((m) => m.workDays.includes(wd) && !o.busy.some((b) => b.staffId === m.id && b.start < end && start < b.end)).map((m) => m.id);
  return staffIds.length ? { start, time: hhmm(start), staffIds } : null;
}

/** "12 мин" / "1 ч 05 мин" for how long a walk-in has been waiting */
export function waited(from: Date, now = new Date()): string {
  const m = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
  return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${String(m % 60).padStart(2, "0")} мин`;
}

export const isHhmm = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
