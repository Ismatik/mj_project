import { describe, expect, it } from "vitest";
import { dressSpan, normalizeBridalRules, overlaps, packagePrice } from "./bridal";

const rules = normalizeBridalRules({});

describe("bridal package", () => {
  it("discounts the services from three of them, not the dress", () => {
    const p = packagePrice([{ price: 550 }, { price: 1500 }, { price: 280 }], { pricePerDay: 900 }, rules);
    expect(p).toEqual({ servicesSum: 2330, discountPercent: 10, discount: 233, dressSum: 1800, subtotal: 4130, total: 3897 });
  });
  it("no discount below the minimum", () => {
    expect(packagePrice([{ price: 550 }, { price: 1500 }], null, rules)).toMatchObject({ discount: 0, total: 2050 });
  });
  it("sane rules", () => {
    expect(normalizeBridalRules({ discountPercent: 90, minServices: 0, dressDays: "3", trialServiceId: "" })).toEqual({ discountPercent: 50, minServices: 1, dressDays: 3, trialServiceId: null });
  });
  it("dress days and overlaps", () => {
    const span = dressSpan("2026-10-10", 2);
    expect(span).toEqual({ from: "2026-10-10", to: "2026-10-11" });
    expect(overlaps({ startsOn: "2026-10-11", endsOn: "2026-10-12" }, span)).toBe(true);
    expect(overlaps({ startsOn: "2026-10-08", endsOn: "2026-10-09" }, span)).toBe(false);
  });
});
