// The WhatsApp message templates, written in Meta's format, ready to be submitted for approval
// (CMS → Интеграции → Шаблоны сообщений → «Отправить в Meta», or by hand in WhatsApp Manager).
// Parameter order matches WHATSAPP_TEMPLATES in ./messages, which the live driver fills in.
import { WHATSAPP_TEMPLATES, type MessageKind } from "./messages";

export type MetaTemplate = {
  name: string;
  language: string;
  category: "UTILITY" | "AUTHENTICATION" | "MARKETING";
  components: Record<string, unknown>[];
};

/** Languages submitted to Meta. Tajik guests get the Russian one (Meta's template languages don't include Tajik). */
export const META_TEMPLATE_LANGS = ["ru", "en"] as const;
type MetaLang = (typeof META_TEMPLATE_LANGS)[number];

const BODIES: Record<Exclude<MessageKind, "login-code" | "whatsapp-reply">, Record<MetaLang, { text: string; example: string[] }>> = {
  birthday: {
    ru: {
      text: "Mavzunai Jovid: {{1}}, с днём рождения! Дарим вам {{2}} бонусов — ими можно оплатить до {{3}}% визита. Ждём вас в салоне на ул. Бухоро, 23/25.",
      example: ["Марта", "100", "30"],
    },
    en: {
      text: "Mavzunai Jovid: happy birthday, {{1}}! Here are {{2}} bonus points from us — use them for up to {{3}}% of a visit. See you at 23/25 Bukhoro St.",
      example: ["Marta", "100", "30"],
    },
  },
  "booking-confirmation": {
    ru: {
      text: "Mavzunai Jovid: {{1}}, вы записаны — {{2}}, {{3}}, мастер {{4}}. Ждём вас по адресу: ул. Бухоро, 23/25, Душанбе. Если планы изменятся, просто ответьте на это сообщение.",
      example: ["Марта", "Ламинирование ресниц", "Ср, 30 сентября 2026, 12:00", "Мира"],
    },
    en: {
      text: "Mavzunai Jovid: {{1}}, you're booked — {{2}}, {{3}}, with {{4}}. We're at 23/25 Bukhoro St, Dushanbe. If your plans change, just reply to this message.",
      example: ["Marta", "Lash lamination", "Wednesday, 30 September 2026, 12:00", "Mira"],
    },
  },
  "reminder-day": {
    ru: {
      text: "Mavzunai Jovid: напоминаем о записи — {{1}}, {{2}}, мастер {{3}}. ул. Бухоро, 23/25. Если планы изменились, ответьте на это сообщение, и мы перенесём визит.",
      example: ["Чт, 1 октября 2026, 11:00", "Окрашивание", "Инес"],
    },
    en: {
      text: "Mavzunai Jovid: a reminder of your booking — {{1}}, {{2}} with {{3}}. 23/25 Bukhoro St. If your plans have changed, reply to this message and we'll move your visit.",
      example: ["Thursday, 1 October 2026, 11:00", "Single-tone colour", "Ines"],
    },
  },
  "reminder-hours": {
    ru: { text: "Mavzunai Jovid: ждём вас сегодня в {{1}} — {{2}}, мастер {{3}}. ул. Бухоро, 23/25, Душанбе.", example: ["12:00", "Маникюр, гель-лак", "Петра"] },
    en: { text: "Mavzunai Jovid: see you today at {{1}} — {{2}} with {{3}}. 23/25 Bukhoro St, Dushanbe.", example: ["12:00", "Manicure, gel polish", "Petra"] },
  },
};

const COPY_CODE: Record<MetaLang, string> = { ru: "Скопировать код", en: "Copy code" };

/** Every template × language, in the body of POST /{WABA_ID}/message_templates. */
export function metaTemplates(): MetaTemplate[] {
  const out: MetaTemplate[] = [];
  for (const lang of META_TEMPLATE_LANGS) {
    for (const kind of Object.keys(BODIES) as (keyof typeof BODIES)[]) {
      const t = WHATSAPP_TEMPLATES[kind]!;
      const b = BODIES[kind][lang];
      out.push({ name: t.name, language: lang, category: t.category === "MARKETING" ? "MARKETING" : "UTILITY", components: [{ type: "BODY", text: b.text, example: { body_text: [b.example] } }] });
    }
    // Authentication templates have a text fixed by Meta ("{{1}} is your verification code") with a "copy code" button
    out.push({
      name: WHATSAPP_TEMPLATES["login-code"]!.name,
      language: lang,
      category: "AUTHENTICATION",
      components: [
        { type: "BODY", add_security_recommendation: true },
        { type: "FOOTER", code_expiration_minutes: 10 },
        { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: COPY_CODE[lang] }] },
      ],
    });
  }
  return out;
}

/** Plain text of a template for the CMS preview */
export function templatePreview(t: MetaTemplate): string {
  const body = t.components.find((c) => c.type === "BODY") as { text?: string; example?: { body_text: string[][] } } | undefined;
  if (!body?.text) return t.language === "ru" ? "{{1}} — ваш код подтверждения. В целях безопасности не сообщайте этот код. [Скопировать код]" : "{{1}} is your verification code. For your security, do not share this code. [Copy code]";
  return body.text;
}
