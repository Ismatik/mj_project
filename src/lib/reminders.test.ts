import { describe, expect, it } from "vitest";
import { dueReminders } from "./reminders";

const now = new Date("2026-09-29T05:00:00Z"); // 10:00 in Dushanbe
const at = (hours: number) => new Date(now.getTime() + hours * 3600_000);
const appt = (id: string, hours: number, extra: Partial<{ status: string; remindedDayAt: Date | null; remindedHoursAt: Date | null }> = {}) => ({
  id,
  startsAt: at(hours),
  status: "CONFIRMED",
  remindedDayAt: null,
  remindedHoursAt: null,
  ...extra,
});

describe("dueReminders", () => {
  it("sends the day-before and hours-before reminders once", () => {
    const due = dueReminders([appt("tomorrow", 24), appt("soon", 2), appt("later", 48), appt("now", 0.5)], now);
    expect(due).toEqual([
      { id: "tomorrow", kind: "day" },
      { id: "soon", kind: "hours" },
    ]);
  });

  it("skips what was already sent and cancelled bookings", () => {
    const due = dueReminders(
      [appt("a", 24, { remindedDayAt: now }), appt("b", 2, { remindedHoursAt: now }), appt("c", 24, { status: "CANCELLED" }), appt("d", 2, { remindedDayAt: now })],
      now,
    );
    expect(due).toEqual([{ id: "d", kind: "hours" }]);
  });
});
