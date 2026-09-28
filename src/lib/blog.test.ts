import { describe, expect, it } from "vitest";
import { isSlug, parseBody, parseInline, postIn, readingMinutes, safeHref, slugify } from "./blog";

describe("blog markup", () => {
  it("parses headings, paragraphs, lists and quotes", () => {
    const blocks = parseBody("Первый абзац\nпродолжение.\n\n## Шаг 1\n- раз\n- **два**\n\n> Цитата\nПоследний");
    expect(blocks.map((b) => b.t)).toEqual(["p", "h2", "ul", "quote", "p"]);
    expect(blocks[0]).toEqual({ t: "p", v: [{ t: "text", v: "Первый абзац продолжение." }] });
    expect(blocks[2]).toEqual({ t: "ul", items: [[{ t: "text", v: "раз" }], [{ t: "b", v: "два" }]] });
  });
  it("keeps only safe links", () => {
    expect(parseInline("см. [запись](/#zapis) и [x](javascript:alert(1))")).toEqual([
      { t: "text", v: "см. " },
      { t: "a", v: "запись", href: "/#zapis" },
      { t: "text", v: " и " },
      { t: "text", v: "x" },
      { t: "text", v: ")" },
    ]);
    expect(safeHref("https://instagram.com/mj")).toBe("https://instagram.com/mj");
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("tel:+992 98 103 11 11")).toBe("tel:+992981031111");
  });
  it("never produces HTML", () => {
    const out = JSON.stringify(parseBody("<script>alert(1)</script>"));
    expect(out).toContain("<script>"); // kept as text; rendered escaped by React
    expect(parseBody("<b>x</b>")[0]).toEqual({ t: "p", v: [{ t: "text", v: "<b>x</b>" }] });
  });
});

describe("slugs and languages", () => {
  it("transliterates Russian and Tajik", () => {
    expect(slugify("Уход за волосами осенью")).toBe("ukhod-za-volosami-osenyu");
    expect(slugify("Ҳуснӣ ва Ҷило!")).toBe("husni-va-jilo");
    expect(isSlug("ukhod-za-volosami")).toBe(true);
    expect(isSlug("Bad slug")).toBe(false);
  });
  it("falls back to Russian", () => {
    const p = { title: "Уход", excerpt: "Кратко", body: "Текст", i18n: { en: { title: "Care", body: " " } } };
    expect(postIn(p, "en")).toEqual({ title: "Care", excerpt: "Кратко", body: "Текст" });
    expect(postIn(p, "tg").title).toBe("Уход");
  });
  it("reading time", () => {
    expect(readingMinutes("слово ".repeat(400))).toBe(2);
    expect(readingMinutes("")).toBe(1);
  });
});
