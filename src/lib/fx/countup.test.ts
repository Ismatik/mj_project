import { describe, expect, it } from "vitest";
import { formatCountUp, parseCountUp } from "./countup";

describe("parseCountUp", () => {
  it("keeps somoni suffix and space grouping", () => {
    const p = parseCountUp("12 833 c.")!;
    expect(p).toMatchObject({ prefix: "", value: 12833, group: " ", suffix: " c." });
    expect(formatCountUp(p, 4200)).toBe("4 200 c.");
    expect(formatCountUp(p, 12833)).toBe("12 833 c.");
  });

  it("handles non-breaking space from Intl ru-RU", () => {
    const p = parseCountUp("4 860 c.")!;
    expect(p.value).toBe(4860);
    expect(formatCountUp(p, 4860)).toBe("4 860 c.");
  });

  it("handles prefixes, commas and percents", () => {
    expect(formatCountUp(parseCountUp("$12,833")!, 1000)).toBe("$1,000");
    expect(formatCountUp(parseCountUp("68%")!, 34)).toBe("34%");
    expect(parseCountUp("312")!.value).toBe(312);
  });

  it("returns null without digits", () => {
    expect(parseCountUp("нет данных")).toBeNull();
  });
});
