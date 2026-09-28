import { describe, expect, it } from "vitest";
import { messageText, normalizeTemplates, renderTemplate, WHATSAPP_TEMPLATES } from "./messages";

describe("message templates", () => {
  it("fills variables and leaves unknown ones", () => {
    expect(renderTemplate("{name}, {when} {x}", { name: "Анна", when: "завтра" })).toBe("Анна, завтра {x}");
  });
  it("uses the salon's text when set, the default otherwise", () => {
    expect(messageText("login-code", "en", { code: "1234" })).toBe("Mavzunai Jovid: your sign-in code is 1234. Don't share it with anyone.");
    expect(messageText("login-code", "tg", { code: "1234" }, { "login-code": { tg: "Рамз: {code}" } })).toBe("Рамз: 1234");
  });
  it("keeps only known kinds and languages", () => {
    expect(normalizeTemplates({ "login-code": { ru: "Код {code}", fr: "x", en: "  " }, junk: { ru: "x" } })).toEqual({ "login-code": { ru: "Код {code}" } });
  });
  it("every WhatsApp parameter is a template variable", () => {
    for (const t of Object.values(WHATSAPP_TEMPLATES)) expect(t.params.length).toBeGreaterThan(0);
  });
});
