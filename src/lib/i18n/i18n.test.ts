import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../site-content";
import { applyOverlay, diffOverlay, localize, nameIn, normalizeOverlay } from "./content";
import { dateLabel, duration, longDate, somoni } from "./format";
import { langFromTelegram, localePath, splitLocalePath } from "./locales";

describe("locale paths", () => {
  it("splits and builds prefixed paths", () => {
    expect(splitLocalePath("/tj/mastera/mira")).toEqual({ lang: "tg", path: "/mastera/mira" });
    expect(splitLocalePath("/en")).toEqual({ lang: "en", path: "/" });
    expect(splitLocalePath("/english")).toEqual({ lang: "ru", path: "/english" });
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("tg", "/#zapis")).toBe("/tj#zapis");
    expect(localePath("en", "/?service=1#zapis")).toBe("/en?service=1#zapis");
    expect(localePath("ru", "/mastera")).toBe("/mastera");
  });
  it("maps Telegram language codes", () => {
    expect(langFromTelegram("tg")).toBe("tg");
    expect(langFromTelegram("ru")).toBe("ru");
    expect(langFromTelegram("uz")).toBe("ru");
    expect(langFromTelegram("de")).toBe("en");
    expect(langFromTelegram(undefined)).toBe("ru");
  });
});

describe("guest-facing formatting", () => {
  const d = new Date("2026-09-30T07:00:00Z"); // Wed 12:00 in Dushanbe
  it("dates in three languages", () => {
    expect(longDate(d, "en")).toBe("Wednesday, 30 September 2026");
    expect(longDate(d, "tg")).toBe("Чоршанбе, 30 сентябр 2026");
    expect(dateLabel("2026-09-30", "en")).toBe("Wed 30 Sep");
  });
  it("money and durations", () => {
    expect(somoni(1500, "en")).toBe("1,500 TJS");
    expect(duration(180, "tg")).toBe("3 соат");
    expect(duration(45, "en")).toBe("45 min");
  });
});

describe("content translations", () => {
  const base = { a: "Привет", list: ["один", "два"], cards: [{ name: "Волосы", icon: "scissors" }], items: [{ id: "x", text: "Отзыв" }], photo: { url: "https://a" } };
  it("applies non-empty strings, never links or icons", () => {
    const out = applyOverlay(base, { a: "Hello", list: ["one"], cards: [{ name: "Hair", icon: "evil" }], items: [{ id: "x", text: "Review" }], photo: { url: "https://evil" } });
    expect(out).toEqual({ a: "Hello", list: ["one"], cards: [{ name: "Hair", icon: "scissors" }], items: [{ id: "x", text: "Review" }], photo: { url: "https://a" } });
    expect(applyOverlay(base, { a: "  " }).a).toBe("Привет");
  });
  it("stores only what differs from Russian", () => {
    const view = applyOverlay(base, {});
    const edited = { ...view, a: "Hello", items: [{ id: "x", text: "Review" }] };
    expect(diffOverlay(edited, base)).toEqual({ a: "Hello", items: [{ text: "Review", id: "x" }] });
    expect(diffOverlay(view, base)).toBeUndefined();
  });
  it("round-trips the default English texts", () => {
    const en = localize(DEFAULT_CONTENT, "en");
    expect(en.hero.title).toBe("Beauty\nthat inspires");
    expect(en.contacts.phone).toBe(DEFAULT_CONTENT.contacts.phone);
    expect(localize(DEFAULT_CONTENT, "ru")).toBe(DEFAULT_CONTENT);
  });
  it("sanitizes stored overlays and names", () => {
    const ov = normalizeOverlay({ hero: { title: "x".repeat(3000) }, photos: { hero: { url: "https://evil" } }, names: { services: { s1: "Cut", s2: 5 } } });
    expect((ov.hero as { title: string }).title).toHaveLength(2000);
    expect(ov.photos).toBeUndefined();
    expect(ov.names).toEqual({ services: { s1: "Cut" }, categories: {}, staff: {} });
    const c = { i18n: { tg: {}, en: ov } };
    expect(nameIn(c, "en", "services", "s1", "Стрижка")).toBe("Cut");
    expect(nameIn(c, "en", "services", "s9", "Стрижка")).toBe("Стрижка");
  });
});
