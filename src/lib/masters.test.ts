import { describe, expect, it } from "vitest";
import { masterSlugs, normalizeMasters, slugify } from "./masters";

describe("slugify", () => {
  it("transliterates Russian and Tajik names", () => {
    expect(slugify("Мавзуна")).toBe("mavzuna");
    expect(slugify("Мира Юсупова")).toBe("mira-yusupova");
    expect(slugify("Ҷамшед Қодирӣ")).toBe("jamshed-qodiri");
  });
  it("keeps latin, drops symbols", () => {
    expect(slugify("  Anna & Co.  ")).toBe("anna-co");
    expect(slugify("★")).toBe("");
  });
});

describe("masterSlugs", () => {
  it("makes duplicates unique and honours custom slugs", () => {
    const staff = [
      { id: "a", name: "Мира" },
      { id: "b", name: "Мира" },
      { id: "c", name: "Инес" },
    ];
    const slugs = masterSlugs(staff, { c: { visible: true, slug: "Ines-Color", specialty: "", bio: "", portfolio: [] } });
    expect([...slugs.values()]).toEqual(["mira", "mira-2", "ines-color"]);
  });
});

describe("normalizeMasters", () => {
  it("drops junk and fills defaults", () => {
    const out = normalizeMasters({
      a: { bio: "x".repeat(2000), portfolio: [{ url: "/media/x.jpg" }, { caption: "no url" }, "junk"] },
      b: "junk",
    });
    expect(Object.keys(out)).toEqual(["a"]);
    expect(out.a!.visible).toBe(true);
    expect(out.a!.bio).toHaveLength(1500);
    expect(out.a!.portfolio).toEqual([{ id: "p0", url: "/media/x.jpg", caption: "", category: "" }]);
    expect(normalizeMasters(null)).toEqual({});
  });
});
