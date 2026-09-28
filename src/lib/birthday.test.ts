import { describe, expect, it } from "vitest";
import { inDays, nextBirthday } from "./birthday";

describe("nextBirthday", () => {
  it("counts days and the age she turns", () => {
    expect(nextBirthday("1994-10-02", "2026-09-29")).toEqual({ days: 3, turns: 32, date: "2026-10-02" });
    expect(nextBirthday("1994-09-29", "2026-09-29")).toEqual({ days: 0, turns: 32, date: "2026-09-29" });
    expect(nextBirthday("1994-09-01", "2026-09-29")).toEqual({ days: 337, turns: 33, date: "2027-09-01" });
  });
  it("moves 29 February to the 28th in ordinary years", () => {
    expect(nextBirthday("1996-02-29", "2027-01-10").date).toBe("2027-02-28");
    expect(nextBirthday("1996-02-29", "2028-01-10").date).toBe("2028-02-29");
  });
  it("says when", () => {
    expect([inDays(0), inDays(1), inDays(5)]).toEqual(["сегодня", "завтра", "через 5 дн."]);
  });
});
