import Link from "next/link";
import { PageHead } from "@/components/ui/Headings";
import { db } from "@/lib/db";
import { DEFAULT_TEMPLATES, MESSAGE_KINDS, normalizeTemplates } from "@/lib/messages";
import { metaTemplates, templatePreview } from "@/lib/whatsapp-templates";
import { requirePage } from "@/server/auth";
import { TEMPLATES_SETTING } from "@/server/integrations/guest-messages";
import { waListTemplates } from "@/server/integrations/whatsapp-api";
import { SubmitTemplates } from "./SubmitTemplates";
import { TemplatesEditor } from "./TemplatesEditor";
import s from "./templates.module.css";

const STATUS_LABEL: Record<string, string> = { NONE: "не отправлен", PENDING: "на проверке", APPROVED: "одобрен ✓", REJECTED: "отклонён", PAUSED: "приостановлен", DISABLED: "отключён" };

// Texts of messages to guests in Russian, Tajik and English.
export default async function TemplatesPage() {
  await requirePage("integrations", "/cms/integrations/templates");
  const row = await db.setting.findUnique({ where: { key: TEMPLATES_SETTING } });
  const configured = !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_WABA_ID;
  const listed = configured ? await waListTemplates() : null;
  const statuses = listed?.ok ? listed.templates : [];
  const listError = listed && !listed.ok ? listed.error : null;
  return (
    <div>
      <PageHead title="Шаблоны сообщений" meta="Подтверждения, напоминания и коды входа - на языке гостьи" />
      <p className={s.back}>
        <Link href="/cms/integrations">← Интеграции</Link>
      </p>
      <TemplatesEditor kinds={MESSAGE_KINDS} defaults={DEFAULT_TEMPLATES} initial={normalizeTemplates(row?.value)} />

      <section className={s.wa} aria-labelledby="wa-title">
        <h2 id="wa-title">Шаблоны WhatsApp для Meta</h2>
        <p>
          WhatsApp разрешает первым писать гостье только по шаблонам, одобренным Meta. Тексты ниже уже подготовлены в формате Meta (русский и английский;
          таджикским гостьям в WhatsApp уходит русский вариант). Кнопка отправляет их на проверку - обычно она занимает от нескольких минут до суток. Пошаговая
          инструкция - в <code>docs/whatsapp-setup.md</code>.
        </p>
        <SubmitTemplates configured={configured} />
        {listError && <p className={s.small}>Статус из Meta не получен: {listError}</p>}
        <div className={s.scroll}>
          <table>
            <thead>
              <tr>
                <th>Шаблон</th>
                <th>Язык</th>
                <th>Текст</th>
                <th>Статус в Meta</th>
              </tr>
            </thead>
            <tbody>
              {metaTemplates().map((t) => {
                const st = statuses.find((x) => x.name === t.name && x.language === t.language);
                return (
                  <tr key={`${t.name}-${t.language}`}>
                    <td>
                      <code>{t.name}</code>
                      <div className={s.small}>{t.category === "AUTHENTICATION" ? "Authentication" : t.category === "MARKETING" ? "Marketing" : "Utility"}</div>
                    </td>
                    <td>{t.language}</td>
                    <td className={s.waText}>{templatePreview(t)}</td>
                    <td>
                      <span className={s[`st${st?.status ?? "NONE"}`] ?? s.stNONE}>{STATUS_LABEL[st?.status ?? "NONE"] ?? st?.status}</span>
                      {st?.reason && <div className={s.small}>{st.reason}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
