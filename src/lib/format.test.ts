import { describe, expect, it } from "vitest";
import { clock, initials, longDate, somoni } from "./format";
import { addDays, atSalonTime, isClosed, mondayOf, todayYmd, weekdayOf } from "./time";

describe("format", () => {
  it("formats somoni with ru grouping", () => {
    expect(somoni(12833).replace(/\s/g, " ")).toBe("12 833 c.");
    expect(somoni(280)).toBe("280 c.");
  });

  it("builds initials", () => {
    expect(initials("Марта Каримова")).toBe("МК");
    expect(initials("Марта К.")).toBe("МК");
    expect(initials("Мира")).toBe("М");
  });

  it("formats dates in Dushanbe time", () => {
    const d = atSalonTime("2026-09-27", "09:00");
    expect(d.toISOString()).toBe("2026-09-27T04:00:00.000Z");
    expect(clock(d)).toBe("09:00");
    expect(longDate(d)).toBe("Вс, 27 сентября 2026");
  });
});

describe("time", () => {
  it("knows weekdays and the day off", () => {
    expect(weekdayOf("2026-09-27")).toBe(6);
    expect(weekdayOf("2026-09-21")).toBe(0);
    expect(isClosed("2026-09-21")).toBe(true);
    expect(mondayOf("2026-09-27")).toBe("2026-09-21");
    expect(addDays("2026-09-30", 2)).toBe("2026-10-02");
  });

  it("takes today in Dushanbe, not UTC", () => {
    expect(todayYmd(new Date("2026-09-21T20:30:00Z"))).toBe("2026-09-22");
  });
});
