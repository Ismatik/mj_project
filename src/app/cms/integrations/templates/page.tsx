import Link from "next/link";
import { PageHead } from "@/components/ui/Headings";
import { db } from "@/lib/db";
import { DEFAULT_TEMPLATES, MESSAGE_KINDS, normalizeTemplates, WHATSAPP_LANG, WHATSAPP_TEMPLATES } from "@/lib/messages";
import { requirePage } from "@/server/auth";
import { TEMPLATES_SETTING } from "@/server/integrations/guest-messages";
import { TemplatesEditor } from "./TemplatesEditor";
import s from "./templates.module.css";

// Texts of messages to guests in Russian, Tajik and English.
export default async function TemplatesPage() {
  await requirePage("integrations", "/cms/integrations/templates");
  const row = await db.setting.findUnique({ where: { key: TEMPLATES_SETTING } });
  return (
    <div>
      <PageHead title="Шаблоны сообщений" meta="Подтверждения, напоминания и коды входа — на языке гостьи" />
      <p className={s.back}>
        <Link href="/cms/integrations">← Интеграции</Link>
      </p>
      <TemplatesEditor kinds={MESSAGE_KINDS} defaults={DEFAULT_TEMPLATES} initial={normalizeTemplates(row?.value)} />

      <section className={s.wa} aria-labelledby="wa-title">
        <h2 id="wa-title">Шаблоны для WhatsApp Business</h2>
        <p>
          WhatsApp разрешает первым писать гостье только по шаблонам, одобренным Meta. Создайте их в WhatsApp Manager с этими названиями и тем же текстом, что выше,
          заменив переменные на {"{{1}}"}, {"{{2}}"}… в указанном порядке. Пока шаблон не одобрен, сообщения в WhatsApp не уйдут — Telegram работает без шаблонов.
        </p>
        <table>
          <thead>
            <tr>
              <th>Сообщение</th>
              <th>Название шаблона</th>
              <th>Категория</th>
              <th>Параметры</th>
            </tr>
          </thead>
          <tbody>
            {MESSAGE_KINDS.map(({ kind, title }) => {
              const t = WHATSAPP_TEMPLATES[kind];
              if (!t) return null;
              return (
                <tr key={kind}>
                  <td>{title}</td>
                  <td>
                    <code>{t.name}</code>
                  </td>
                  <td>{t.category === "AUTHENTICATION" ? "Authentication (кнопка «Скопировать код»)" : "Utility"}</td>
                  <td>{t.params.map((p, i) => `{{${i + 1}}} = {${p}}`).join(", ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={s.small}>
          Языки шаблонов: русский ({WHATSAPP_LANG.ru}), английский ({WHATSAPP_LANG.en}). Таджикский в WhatsApp пока отправляется русским шаблоном; в Telegram, на сайте и в SMS —
          по-таджикски.
        </p>
      </section>
    </div>
  );
}
