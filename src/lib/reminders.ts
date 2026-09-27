// Which bookings are due a reminder: the day before (≈24 h) and a couple of hours before (≈2 h).

export type ReminderKind = "day" | "hours";
export type ReminderCandidate = { id: string; startsAt: Date; status: string; remindedDayAt: Date | null; remindedHoursAt: Date | null };

const H = 3600_000;
/** Windows are wide enough that a worker running every 10 minutes never misses one. */
export const WINDOWS: Record<ReminderKind, [number, number]> = {
  day: [20 * H, 26 * H],
  hours: [1 * H, 3 * H],
};

export function dueReminders(list: ReminderCandidate[], now: Date): { id: string; kind: ReminderKind }[] {
  const out: { id: string; kind: ReminderKind }[] = [];
  for (const a of list) {
    if (a.status !== "PENDING" && a.status !== "CONFIRMED") continue;
    const ahead = a.startsAt.getTime() - now.getTime();
    // The closer reminder wins; a booking made 2 hours ahead doesn't also get a "tomorrow" message
    if (!a.remindedHoursAt && ahead > WINDOWS.hours[0] && ahead <= WINDOWS.hours[1]) out.push({ id: a.id, kind: "hours" });
    else if (!a.remindedDayAt && !a.remindedHoursAt && ahead > WINDOWS.day[0] && ahead <= WINDOWS.day[1]) out.push({ id: a.id, kind: "day" });
  }
  return out;
}
