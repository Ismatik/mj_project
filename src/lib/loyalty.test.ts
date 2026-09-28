import { describe, expect, it } from "vitest";
import { bestOffer, DEFAULT_RULES, earnPoints, normalizePromoCode, normalizeRules, promoApplies, promoPrice, settleReceipt, tierFor, type PromoLike } from "./loyalty";

describe("bonus tiers", () => {
  it("by what she paid in a year", () => {
    expect(tierFor(0, DEFAULT_RULES).tier.key).toBe("classic");
    expect(tierFor(4999, DEFAULT_RULES).next).toEqual({ tier: DEFAULT_RULES.tiers[1], remaining: 1 });
    expect(tierFor(5000, DEFAULT_RULES).tier.percent).toBe(7);
    expect(tierFor(20000, DEFAULT_RULES)).toEqual({ tier: DEFAULT_RULES.tiers[2], next: null });
  });
  it("points round down", () => {
    expect(earnPoints(430, 5)).toBe(21);
    expect(earnPoints(0, 10)).toBe(0);
  });
  it("rules are cleaned", () => {
    const r = normalizeRules({ tiers: [{ key: "silver", from: 100, percent: 90 }, { key: "gold", from: 50 }], maxSpendPercent: 500, enabled: false });
    expect(r.tiers.map((t) => [t.from, t.percent])).toEqual([[0, 5], [100, 50], [101, 10]]);
    expect(r.maxSpendPercent).toBe(100);
    expect(r.enabled).toBe(false);
    expect(normalizeRules(null)).toEqual(DEFAULT_RULES);
  });
});

describe("settling a receipt", () => {
  it("prepayment, certificate, points (capped), the rest", () => {
    expect(settleReceipt(1000, { deposit: 300, giftBalance: 200, giftWanted: 200, points: 900, pointsWanted: 900, maxPointsPercent: 30 })).toEqual({ deposit: 300, gift: 200, bonus: 210, paid: 290 });
    expect(settleReceipt(500, { points: 50, pointsWanted: 100, maxPointsPercent: 30 })).toEqual({ deposit: 0, gift: 0, bonus: 50, paid: 450 });
    expect(settleReceipt(300, {})).toEqual({ deposit: 0, gift: 0, bonus: 0, paid: 300 });
  });
});

describe("promotions", () => {
  const base: PromoLike = { id: "p", kind: "PERCENT", value: 20, serviceIds: [], startsOn: "2026-10-01", endsOn: "2026-10-31", code: null, active: true, usageLimit: null, usedCount: 0 };
  it("dates, services and limits", () => {
    expect(promoApplies(base, "s1", "2026-10-15")).toBe(true);
    expect(promoApplies(base, "s1", "2026-09-30")).toBe(false);
    expect(promoApplies({ ...base, serviceIds: ["s2"] }, "s1", "2026-10-15")).toBe(false);
    expect(promoApplies({ ...base, usageLimit: 3, usedCount: 3 }, "s1", "2026-10-15")).toBe(false);
  });
  it("prices", () => {
    expect(promoPrice(450, base)).toEqual({ price: 360, discount: 90 });
    expect(promoPrice(100, { kind: "FIXED", value: 150 })).toEqual({ price: 0, discount: 100 });
  });
  it("best automatic offer, codes excluded", () => {
    const fixed = { ...base, id: "f", kind: "FIXED" as const, value: 50 };
    const coded = { ...base, id: "c", value: 50, code: "VIP50" };
    expect(bestOffer([base, fixed, coded], "s1", 450, "2026-10-15")?.id).toBe("p");
    expect(bestOffer([base, fixed], "s1", 200, "2026-10-15")?.id).toBe("f");
  });
  it("codes are normalised", () => {
    expect(normalizePromoCode(" spring 20 ")).toBe("SPRING20");
    expect(normalizePromoCode("Весна-2026")).toBe("ВЕСНА-2026");
  });
});
