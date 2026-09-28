import { describe, expect, it } from "vitest";
import { WHATSAPP_TEMPLATES } from "./messages";
import { metaTemplates } from "./whatsapp-templates";

describe("WhatsApp templates for Meta", () => {
  const all = metaTemplates();
  it("five messages in Russian and English", () => {
    expect(all).toHaveLength(10);
    expect(new Set(all.map((t) => `${t.name}/${t.language}`)).size).toBe(10);
  });
  it("placeholders match the parameters the driver sends, with examples", () => {
    for (const t of all.filter((x) => x.category !== "AUTHENTICATION")) {
      const body = t.components[0] as { text: string; example: { body_text: string[][] } };
      const kind = Object.values(WHATSAPP_TEMPLATES).find((w) => w?.name === t.name)!;
      const placeholders = [...body.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      expect(placeholders).toEqual(kind.params.map((_, i) => i + 1));
      expect(body.example.body_text[0]).toHaveLength(kind.params.length);
      // Meta rejects a body that starts or ends with a parameter
      expect(body.text.startsWith("{{")).toBe(false);
      expect(/\}\}\.?$/.test(body.text)).toBe(false);
    }
  });
  it("sign-in code uses Meta's authentication format", () => {
    const auth = all.filter((t) => t.category === "AUTHENTICATION");
    expect(auth).toHaveLength(2);
    expect(auth[0]!.components).toContainEqual({ type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Скопировать код" }] });
  });
});
