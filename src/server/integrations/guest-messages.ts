// Builds outgoing messages to guests in their language, from the editable templates.
// No "server-only" import: the worker (plain Node) uses this file too.
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { clock } from "../../lib/format";
import { localize, nameIn } from "../../lib/i18n/content";
import { when as whenIn } from "../../lib/i18n/format";
import { asLang, type Lang } from "../../lib/i18n/locales";
import { messageText, normalizeTemplates, WHATSAPP_LANG, WHATSAPP_TEMPLATES, type MessageKind, type MessageVars, type Templates } from "../../lib/messages";
import { selfServiceLink } from "../../lib/site-url";
import { DEFAULT_CONTENT, normalizeContent, type SiteContent } from "../../lib/site-content";

type Db = PrismaClient | Prisma.TransactionClient;

export const TEMPLATES_SETTING = "messageTemplates";

export type MessageContext = { templates: Templates; content: SiteContent };

/** Templates edited in the CMS and the published site content (translated names, address). */
export async function messageContext(db: Db): Promise<MessageContext> {
  const [setting, doc] = await Promise.all([db.setting.findUnique({ where: { key: TEMPLATES_SETTING } }), db.siteDocument.findUnique({ where: { id: "published" } })]);
  return { templates: normalizeTemplates(setting?.value), content: normalizeContent(doc?.data ?? DEFAULT_CONTENT) };
}

type ApptLike = { startsAt: Date; serviceId: string | null; serviceLabel: string; staff: { id: string; name: string }[] };

/** Template variables for a booking, with names translated for the guest. */
export function appointmentVars(ctx: MessageContext, lang: Lang, a: ApptLike, guestName: string): MessageVars {
  const c = localize(ctx.content, lang);
  return {
    name: guestName.split(" ")[0],
    service: a.serviceId ? nameIn(ctx.content, lang, "services", a.serviceId, a.serviceLabel) : a.serviceLabel,
    when: whenIn(a.startsAt, lang),
    time: clock(a.startsAt),
    master: a.staff.map((m) => nameIn(ctx.content, lang, "staff", m.id, m.name)).join(" + "),
    address: c.contacts.address,
    link: selfServiceLink(lang),
  };
}

/**
 * One message to a guest: into her Telegram chat with the bot if she has one, otherwise WhatsApp to her phone.
 * The WhatsApp template and its parameters travel in meta for the live driver.
 */
export async function guestMessage(
  db: Db,
  ctx: MessageContext,
  input: {
    guest: { id: string; phone: string; lang: string };
    kind: MessageKind;
    /** Variables in a language (the WhatsApp template may be in another language than the guest's) */
    vars: (lang: Lang) => MessageVars;
    meta?: Record<string, unknown>;
    secret?: string;
  },
): Promise<Prisma.OutboxMessageCreateManyInput> {
  const lang = asLang(input.guest.lang);
  const chat = await db.telegramChat.findFirst({ where: { guestId: input.guest.id, isStaff: false }, orderBy: { updatedAt: "desc" } });
  const body = messageText(input.kind, lang, input.vars(lang), ctx.templates);
  const wa = WHATSAPP_TEMPLATES[input.kind];
  const waLang = WHATSAPP_LANG[lang];
  const waVars = input.vars(asLang(waLang));
  return {
    channel: chat ? "telegram" : "whatsapp",
    to: chat ? chat.id : input.guest.phone,
    body,
    meta: {
      kind: input.kind,
      lang,
      ...input.meta,
      ...(input.secret ? { secret: input.secret } : {}),
      ...(chat || !wa ? {} : { template: { name: wa.name, lang: waLang, params: wa.params.map((p) => waVars[p] ?? ""), auth: wa.category === "AUTHENTICATION" } }),
    },
  };
}
