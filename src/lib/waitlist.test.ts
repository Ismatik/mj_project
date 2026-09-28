import { describe, expect, it } from "vitest";
import type { Slot } from "./slots";
import { freeNow, offerExpiry, pickOffer, waited } from "./waitlist";

const slot = (time: string, staffIds = ["a"]): Slot => {
  const [h, m] = time.split(":").map(Number);
  return { time, start: h! * 60 + m!, staffIds };
};

describe("pickOffer", () => {
  const slots = [slot("09:00"), slot("11:00"), slot("11:30"), slot("15:00")];
  it("takes the first free time in her window", () => {
    expect(pickOffer(slots, { timeFrom: "10:00", timeTo: "16:00" })?.time).toBe("11:00");
    expect(pickOffer(slots, { timeFrom: "16:00" })).toBeNull();
    expect(pickOffer(slots, {})?.time).toBe("09:00");
  });
  it("offers the time that was just freed", () => {
    expect(pickOffer(slots, { freed: { start: 11 * 60 + 15, end: 12 * 60 } })?.time).toBe("11:30");
    expect(pickOffer(slots, { freed: { start: 13 * 60, end: 14 * 60 } })).toBeNull();
  });
});

describe("offerExpiry", () => {
  const now = new Date("2026-09-29T05:00:00Z");
  it("holds 30 minutes, but not past 45 minutes before the visit", () => {
    expect(offerExpiry(now, new Date("2026-09-29T09:00:00Z"))!.toISOString()).toBe("2026-09-29T05:30:00.000Z");
    expect(offerExpiry(now, new Date("2026-09-29T06:05:00Z"))!.toISOString()).toBe("2026-09-29T05:20:00.000Z");
  });
  it("doesn't offer a time that is too close", () => {
    expect(offerExpiry(now, new Date("2026-09-29T05:50:00Z"))).toBeNull();
  });
});

describe("freeNow", () => {
  // 2026-09-29 is a Tuesday (weekday 1)
  const staff = [
    { id: "a", workDays: [1, 2] },
    { id: "b", workDays: [1] },
    { id: "c", workDays: [3] },
  ];
  it("finds masters working today and free for the whole service", () => {
    const r = freeNow({ date: "2026-09-29", nowMinutes: 10 * 60 + 2, durationMin: 60, staff, busy: [{ staffId: "a", start: 10 * 60 + 30, end: 11 * 60 }] });
    expect(r).toEqual({ start: 605, time: "10:05", staffIds: ["b"] });
  });
  it("nobody after closing time or on Monday", () => {
    expect(freeNow({ date: "2026-09-29", nowMinutes: 17 * 60 + 30, durationMin: 60, staff, busy: [] })).toBeNull();
    expect(freeNow({ date: "2026-09-28", nowMinutes: 600, durationMin: 30, staff, busy: [] })).toBeNull();
  });
});

describe("waited", () => {
  it("formats minutes and hours", () => {
    const now = new Date("2026-09-29T06:00:00Z");
    expect(waited(new Date("2026-09-29T05:48:00Z"), now)).toBe("12 мин");
    expect(waited(new Date("2026-09-29T04:55:00Z"), now)).toBe("1 ч 05 мин");
  });
});
