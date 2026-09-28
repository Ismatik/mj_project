// Minimal WhatsApp Business Cloud API client (Meta Graph API, no SDK).
// No "server-only" import: the worker (plain Node) uses this file too.
import { createHmac, timingSafeEqual } from "node:crypto";

export type WaTemplate = { name: string; lang: string; params: string[]; auth?: boolean };

export const whatsappConfigured = () => !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;
/** Graph API address; WHATSAPP_API_BASE points tests at a local stand-in */
const apiBase = () => (process.env.WHATSAPP_API_BASE || "https://graph.facebook.com").replace(/\/$/, "");
const apiVersion = () => process.env.WHATSAPP_API_VERSION || "v22.0";

/** "+992 98 103-11-11" → "992981031111" */
export const waNumber = (phone: string) => phone.replace(/\D/g, "");

/** Template parameters may not contain line breaks, tabs or long runs of spaces. */
const param = (v: string) => ({ type: "text", text: v.replace(/\s+/g, " ").trim() || "—" });

/**
 * Message body for the API. With a template (required to write first, or 24 h after her last message) the approved
 * template is used with its parameters; authentication templates repeat the code for the "copy code" button.
 */
export function waPayload(to: string, body: string, template?: WaTemplate) {
  if (!template) return { messaging_product: "whatsapp", to: waNumber(to), type: "text", text: { body, preview_url: false } };
  const components: Record<string, unknown>[] = [];
  if (template.params.length) components.push({ type: "body", parameters: template.params.map(param) });
  if (template.auth && template.params[0]) components.push({ type: "button", sub_type: "url", index: "0", parameters: [param(template.params[0])] });
  return {
    messaging_product: "whatsapp",
    to: waNumber(to),
    type: "template",
    template: { name: template.name, language: { code: template.lang }, ...(components.length ? { components } : {}) },
  };
}

export async function waSend(to: string, body: string, template?: WaTemplate): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return { ok: false, error: "WHATSAPP_TOKEN / WHATSAPP_PHONE_ID are not set" };
  try {
    const res = await fetch(`${apiBase()}/${apiVersion()}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(waPayload(to, body, template)),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    const id = json.messages?.[0]?.id;
    if (res.ok && id) return { ok: true, id };
    return { ok: false, error: json.error ? `${json.error.code ?? res.status}: ${json.error.message ?? "WhatsApp error"}` : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

/** Meta signs every webhook with the app secret: X-Hub-Signature-256: sha256=<hmac of the raw body>. */
export function validSignature(rawBody: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = header.slice(7);
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export type WaStatus = { id: string; status: "sent" | "delivered" | "read" | "failed" | string; error?: string };
export type WaInbound = { id: string; from: string; name?: string; text: string };

type WebhookBody = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: { id: string; from: string; type: string; text?: { body: string }; button?: { text: string }; interactive?: { button_reply?: { title: string } } }[];
        statuses?: { id: string; status: string; errors?: { title?: string; message?: string; code?: number }[] }[];
      };
    }[];
  }[];
};

const KIND_LABEL: Record<string, string> = { image: "[фото]", audio: "[голосовое]", video: "[видео]", document: "[файл]", sticker: "[стикер]", location: "[геопозиция]", contacts: "[контакт]" };

/** Delivery statuses of our messages and messages from guests. */
export function parseWebhook(body: unknown): { statuses: WaStatus[]; messages: WaInbound[] } {
  const statuses: WaStatus[] = [];
  const messages: WaInbound[] = [];
  for (const entry of (body as WebhookBody)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (!v) continue;
      for (const s of v.statuses ?? []) {
        const err = s.errors?.[0];
        statuses.push({ id: s.id, status: s.status, ...(err ? { error: `${err.code ?? ""} ${err.title ?? err.message ?? ""}`.trim() } : {}) });
      }
      for (const m of v.messages ?? []) {
        const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? KIND_LABEL[m.type] ?? `[${m.type}]`;
        messages.push({ id: m.id, from: m.from, name, text: text.slice(0, 1000) });
      }
    }
  }
  return { statuses, messages };
}
