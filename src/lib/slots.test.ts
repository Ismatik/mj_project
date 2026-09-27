import { describe, expect, it } from "vitest";
import { bookableDates, freeSlots } from "./slots";
import { addDays } from "./time";

const staff = [
  { id: "mira", workDays: [1, 2, 4, 5, 6] },
  { id: "petra", workDays: [1, 2, 3, 4, 5] },
];
// 2026-09-29 is a Tuesday, 2026-10-01 a Thursday (Mira off), 2026-09-28 a Monday
const base = { today: "2026-09-27", nowMinutes: 10 * 60, durationMin: 60, staff, busy: [] };

describe("freeSlots", () => {
  it("offers 30-minute steps from 09:00, finishing by 18:00", () => {
    const slots = freeSlots({ ...base, date: "2026-09-29" });
    expect(slots[0]!.time).toBe("09:00");
    expect(slots.at(-1)!.time).toBe("17:00");
    expect(slots).toHaveLength(17);
    expect(slots[0]!.staffIds).toEqual(["mira", "petra"]);
  });

  it("has nothing on Mondays or past dates", () => {
    expect(freeSlots({ ...base, date: "2026-09-28" })).toEqual([]);
    expect(freeSlots({ ...base, date: "2026-09-26" })).toEqual([]);
  });

  it("only lists masters who work that day", () => {
    const thu = freeSlots({ ...base, date: "2026-10-01" });
    expect(thu[0]!.staffIds).toEqual(["petra"]);
  });

  it("skips times that overlap existing bookings", () => {
    const busy = [
      { staffId: "mira", start: 12 * 60, end: 13 * 60 },
      { staffId: "petra", start: 11 * 60 + 30, end: 13 * 60 },
    ];
    const slots = freeSlots({ ...base, date: "2026-09-29", busy });
    const times = slots.map((s) => s.time);
    expect(times).not.toContain("12:00");
    expect(times).not.toContain("11:30");
    expect(slots.find((s) => s.time === "11:00")!.staffIds).toEqual(["mira"]);
    expect(times).toContain("13:00");
  });

  it("keeps an hour's notice for today", () => {
    const slots = freeSlots({ ...base, today: "2026-09-29", date: "2026-09-29", nowMinutes: 10 * 60 + 10 });
    expect(slots[0]!.time).toBe("11:30");
  });

  it("fits long services before closing", () => {
    const slots = freeSlots({ ...base, date: "2026-09-29", durationMin: 180 });
    expect(slots.at(-1)!.time).toBe("15:00");
  });
});

describe("bookableDates", () => {
  it("skips Mondays", () => {
    const d = bookableDates("2026-09-27", 3, addDays);
    expect(d).toEqual(["2026-09-27", "2026-09-29", "2026-09-30"]);
  });
});
