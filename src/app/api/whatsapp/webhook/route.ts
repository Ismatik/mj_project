import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { localize } from "@/lib/i18n/content";
import { asLang, localePath } from "@/lib/i18n/locales";
import { messageText } from "@/lib/messages";
import { formatPhone } from "@/lib/phone";
import { messageContext } from "@/server/integrations/guest-messages";
import { deliverNow } from "@/server/integrations/outbox";
import { parseWebhook, validSignature } from "@/server/integrations/whatsapp-api";

// WhatsApp Cloud API → salon. Meta first checks the address (GET with the verify token),
// then posts delivery statuses of our messages and messages from guests, signed with the app secret.

const AUTO_REPLY_EVERY_MS = 12 * 3600_000;
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (p.get("hub.mode") === "subscribe" && token && safeEqual(p.get("hub.verify_token") ?? "", token)) {
    return new NextResponse(p.get("hub.challenge") ?? "", { headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ ok: false }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const integration = await db.integration.findUnique({ where: { key: "whatsapp" } });
  if (!integration?.enabled || integration.mode !== "LIVE") return NextResponse.json({ ok: true, ignored: "whatsapp is not live" });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const { statuses, messages } = parseWebhook(body);

  // Delivery statuses: "failed" marks the outbox message, delivered / read are noted on it
  for (const st of statuses) {
    const msg = await db.outboxMessage.findFirst({ where: { channel: "whatsapp", meta: { path: ["wamid"], equals: st.id } } });
    if (!msg) continue;
    const meta = { ...((msg.meta ?? {}) as object), delivery: st.status };
    await db.outboxMessage.update({
      where: { id: msg.id },
      data: st.status === "failed" ? { status: "FAILED", error: st.error ?? "WhatsApp: не доставлено", meta } : { meta },
    });
  }

  // Messages from guests go to reception; the guest gets a short auto-reply (at most every 12 hours)
  if (messages.length) {
    const ctx = await messageContext(db);
    for (const m of messages) {
      const phone = `+${m.from}`;
      const guest = await db.guest.findUnique({ where: { phone } });
      const who = guest ? `${guest.name}, ${formatPhone(phone)}` : `${m.name ? `${m.name}, ` : ""}${formatPhone(phone)}`;
      await db.outboxMessage.create({
        data: { channel: "telegram", to: "reception", body: `WhatsApp от ${who}: ${m.text}`, meta: { kind: "whatsapp-in", from: phone, waMessageId: m.id } },
      });
      const recent = await db.outboxMessage.findFirst({
        where: { channel: "whatsapp", to: phone, createdAt: { gte: new Date(Date.now() - AUTO_REPLY_EVERY_MS) }, meta: { path: ["kind"], equals: "whatsapp-reply" } },
      });
      if (recent) continue;
      const lang = asLang(guest?.lang);
      const domain = process.env.SITE_DOMAIN && process.env.SITE_DOMAIN !== "localhost" ? process.env.SITE_DOMAIN.replace(/^https?:\/\//, "") : null;
      const link = domain ? `https://${domain}${localePath(lang, "/#zapis")}` : localize(ctx.content, lang).contacts.phone;
      const reply = await db.outboxMessage.create({
        data: {
          channel: "whatsapp",
          to: phone,
          body: messageText("whatsapp-reply", lang, { name: (guest?.name ?? m.name ?? "").split(" ")[0], link }, ctx.templates),
          meta: { kind: "whatsapp-reply", lang },
        },
      });
      await deliverNow(db, reply.id);
    }
  }
  revalidatePath("/cms", "layout");
  return NextResponse.json({ ok: true });
}
