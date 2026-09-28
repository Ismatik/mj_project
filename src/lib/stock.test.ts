import { describe, expect, it } from "vitest";
import { consumptionFor, crossedLow, inPacks, qty, stockStatus, stockValue } from "./stock";

describe("stock", () => {
  it("status against the minimum", () => {
    expect(stockStatus(0, 100)).toBe("out");
    expect(stockStatus(-5, 0)).toBe("out");
    expect(stockStatus(80, 100)).toBe("low");
    expect(stockStatus(100, 100)).toBe("ok");
    expect(stockStatus(3, 0)).toBe("ok");
  });
  it("alerts only when crossing the minimum", () => {
    expect(crossedLow(120, 90, 100)).toBe(true);
    expect(crossedLow(90, 60, 100)).toBe(false);
    expect(crossedLow(500, 400, 0)).toBe(false);
  });
  it("values stock at the package price", () => {
    expect(stockValue(250, 1000, 480)).toBe(120);
    expect(stockValue(-10, 100, 50)).toBe(0);
  });
  it("adds up norms for a receipt", () => {
    const norms = [
      { serviceId: "color", itemId: "dye", amount: 60 },
      { serviceId: "color", itemId: "oxide", amount: 90 },
      { serviceId: "gel", itemId: "gloves", amount: 2 },
      { serviceId: "cut", itemId: "gloves", amount: 2 },
    ];
    expect([...consumptionFor(["color", "gel", "cut", null], norms)]).toEqual([
      ["dye", 60],
      ["oxide", 90],
      ["gloves", 4],
    ]);
  });
  it("formats quantities", () => {
    expect(qty(1250, "мл").replace(/ /g, " ")).toBe("1 250 мл");
    expect(inPacks(2120, 1000, "мл")).toBe("2 уп. + 120 мл");
    expect(inPacks(40, 100, "шт")).toBe("40 шт");
  });
});
