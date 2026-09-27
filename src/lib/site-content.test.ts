import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT, normalizeContent, whatsappLink } from "./site-content";

describe("normalizeContent", () => {
  it("fills missing fields from defaults", () => {
    const c = normalizeContent({ hero: { title: "Новый заголовок" } });
    expect(c.hero.title).toBe("Новый заголовок");
    expect(c.hero.subtitle).toBe(DEFAULT_CONTENT.hero.subtitle);
    expect(c.seo.title).toBe(DEFAULT_CONTENT.seo.title);
  });

  it("ignores values of the wrong type", () => {
    const c = normalizeContent({ hero: { title: 42 }, reviews: { items: "nope" } });
    expect(c.hero.title).toBe(DEFAULT_CONTENT.hero.title);
    expect(c.reviews.items).toHaveLength(3);
  });

  it("keeps service overrides as a map of booleans", () => {
    const c = normalizeContent({ serviceOverrides: { a: false, b: true, c: "x" } });
    expect(c.serviceOverrides).toEqual({ a: false, b: true });
  });

  it("builds WhatsApp links from any phone format", () => {
    expect(whatsappLink({ ...DEFAULT_CONTENT.contacts, whatsapp: "+992 98 103-11-11" })).toBe("https://wa.me/992981031111");
  });
});
