import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseWebhook, validSignature, waPayload } from "./whatsapp-api";

describe("WhatsApp payloads", () => {
  it("free text within the 24-hour window", () => {
    expect(waPayload("+992 98 103-11-11", "Привет")).toEqual({ messaging_product: "whatsapp", to: "992981031111", type: "text", text: { body: "Привет", preview_url: false } });
  });
  it("approved template with cleaned parameters", () => {
    const p = waPayload("+992981031111", "…", { name: "mj_reminder_day", lang: "ru", params: ["Ср, 30 сентября\n12:00", ""] });
    expect(p).toMatchObject({
      type: "template",
      template: { name: "mj_reminder_day", language: { code: "ru" }, components: [{ type: "body", parameters: [{ type: "text", text: "Ср, 30 сентября 12:00" }, { type: "text", text: "-" }] }] },
    });
  });
  it("authentication template repeats the code for the copy button", () => {
    const p = waPayload("992900000000", "…", { name: "mj_login_code", lang: "en", params: ["4821"], auth: true }) as { template: { components: unknown[] } };
    expect(p.template.components[1]).toEqual({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "4821" }] });
  });
});

describe("WhatsApp webhook", () => {
  it("checks Meta's signature", () => {
    const body = '{"a":1}';
    const sig = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
    expect(validSignature(body, sig, "s3cret")).toBe(true);
    expect(validSignature(body + " ", sig, "s3cret")).toBe(false);
    expect(validSignature(body, sig, undefined)).toBe(false);
    expect(validSignature(body, null, "s3cret")).toBe(false);
  });
  it("reads statuses and guest messages", () => {
    const parsed = parseWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "992935012214", profile: { name: "Marta" } }],
                messages: [
                  { id: "m1", from: "992935012214", type: "text", text: { body: "Можно на завтра?" } },
                  { id: "m2", from: "992935012214", type: "image" },
                ],
                statuses: [{ id: "w1", status: "failed", errors: [{ code: 131026, title: "Message undeliverable" }] }],
              },
            },
          ],
        },
      ],
    });
    expect(parsed.messages).toEqual([
      { id: "m1", from: "992935012214", name: "Marta", text: "Можно на завтра?" },
      { id: "m2", from: "992935012214", name: "Marta", text: "[фото]" },
    ]);
    expect(parsed.statuses).toEqual([{ id: "w1", status: "failed", error: "131026 Message undeliverable" }]);
    expect(parseWebhook(null)).toEqual({ statuses: [], messages: [] });
  });
});
