import { describe, expect, it } from "vitest";
import { depositFor, giftCode, normalizeGiftCode, settle, validGiftAmount } from "./money";

describe("prepayments", () => {
  it("percent of the price, rounded up to 10 somoni", () => {
    expect(depositFor(1500, 30)).toBe(450);
    expect(depositFor(950, 30)).toBe(290);
    expect(depositFor(500, 0)).toBe(0);
    expect(depositFor(40, 100)).toBe(40);
  });
});

describe("gift certificates", () => {
  it("codes are readable and normalised", () => {
    const code = giftCode(() => [0, 1, 2, 3, 30, 29, 28, 27]);
    expect(code).toMatch(/^MJ-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(normalizeGiftCode(" mj 7k2p qx4m ")).toBe("MJ-7K2P-QX4M");
    expect(normalizeGiftCode("7K2PQX4M")).toBe("MJ-7K2P-QX4M");
    expect(normalizeGiftCode("MJ-7K2P-QX40")).toBeNull(); // 0 is not used
    expect(normalizeGiftCode("hello")).toBeNull();
  });
  it("amount limits", () => {
    expect(validGiftAmount(1000)).toBe(true);
    expect(validGiftAmount(100)).toBe(false);
    expect(validGiftAmount(1000.5)).toBe(false);
  });
});

describe("settling a receipt", () => {
  it("prepayment first, then the certificate, the rest with the method", () => {
    expect(settle(1500, 450, 1000, 1000)).toEqual({ deposit: 450, gift: 1000, paid: 50 });
    expect(settle(300, 0, 1000, 1000)).toEqual({ deposit: 0, gift: 300, paid: 0 });
    expect(settle(300, 0, 1000, 100)).toEqual({ deposit: 0, gift: 100, paid: 200 });
    expect(settle(200, 450, 0, 0)).toEqual({ deposit: 200, gift: 0, paid: 0 });
  });
});
