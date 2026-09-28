import { describe, expect, it } from "vitest";
import { countCash, daysBetween, isMonth, monthSpan, monthTitle, payFor, shiftMonth, shiftTotals } from "./payroll";

describe("months", () => {
  it("spans a month and moves across years", () => {
    expect(monthSpan("2026-09")).toEqual({ from: "2026-09-01", to: "2026-10-01" });
    expect(monthSpan("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthTitle("2026-09")).toBe("Сентябрь 2026");
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-09")).toBe(true);
    expect(daysBetween("2026-02-27", "2026-03-02")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
  });
});

describe("payFor", () => {
  it("adds the commission, salary, bonuses and fines, minus what was paid", () => {
    const p = payFor({ revenue: 10_000, commission: 40, salary: 1000, adjustments: [300, -100], payouts: [2000] });
    expect(p).toEqual({ commission: 4000, bonuses: 300, fines: 100, earned: 5200, paid: 2000, due: 3200 });
  });
  it("rounds the commission to whole somoni and clamps odd rates", () => {
    expect(payFor({ revenue: 333, commission: 45, salary: 0, adjustments: [], payouts: [] }).commission).toBe(150);
    expect(payFor({ revenue: 100, commission: 140, salary: 0, adjustments: [], payouts: [] }).commission).toBe(100);
  });
  it("never gives a negative zero", () => {
    expect(Object.is(payFor({ revenue: 0, commission: 40, salary: 0, adjustments: [300], payouts: [] }).fines, 0)).toBe(true);
    expect(Object.is(shiftTotals({ opening: 0, sales: [], giftSales: [], movements: [100] }).cashOut, 0)).toBe(true);
  });
  it("shows an overpayment as a negative balance", () => {
    expect(payFor({ revenue: 1000, commission: 40, salary: 0, adjustments: [], payouts: [500] }).due).toBe(-100);
  });
});

describe("shift", () => {
  it("counts cash, card and QR and the cash expected in the drawer", () => {
    const t = shiftTotals({
      opening: 500,
      sales: [
        { method: "CASH", paid: 1000 },
        { method: "CARD", paid: 700 },
        { method: "QR", paid: 300 },
        { method: "CASH", paid: 0 },
      ],
      giftSales: [{ method: "CASH", amount: 500 }],
      movements: [200, -150, -1000],
    });
    expect(t).toEqual({ cashSales: 1500, cardSales: 700, qrSales: 300, cashIn: 200, cashOut: 1150, expectedCash: 1050 });
  });
  it("checks the cash count", () => {
    expect(countCash(1050, 1000, 800)).toEqual({ ok: true, difference: -50, leftCash: 200 });
    expect(countCash(1050, 1000, 1200).ok).toBe(false);
    expect(countCash(1050, -1, 0).ok).toBe(false);
  });
});
