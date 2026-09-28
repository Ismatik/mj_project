"use client";

import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { LANG_NAME, LANGS, type Lang } from "@/lib/i18n/locales";
import { renderTemplate, type MessageKind, type MessageVars, type Templates } from "@/lib/messages";
import { saveTemplates } from "./actions";
import s from "./templates.module.css";

/** Example values for the preview */
const SAMPLE: Record<Lang, MessageVars> = {
  ru: { name: "Марта", service: "Ламинирование ресниц", when: "Ср, 30 сентября 2026, 12:00", time: "12:00", master: "Мира", address: "ул. Бухоро, 23/25, 1–2 этаж", code: "4821", link: "mavzunai-jovid.tj" },
  tg: { name: "Марта", service: "Ламинатсияи мижгон", when: "Чоршанбе, 30 сентябр 2026, 12:00", time: "12:00", master: "Мира", address: "кӯчаи Бухоро, 23/25, ошёнаҳои 1–2", code: "4821", link: "mavzunai-jovid.tj/tj" },
  en: { name: "Marta", service: "Lash lamination", when: "Wednesday, 30 September 2026, 12:00", time: "12:00", master: "Mira", address: "23/25 Bukhoro St, 1st–2nd floor", code: "4821", link: "mavzunai-jovid.tj/en" },
};

type Kind = { kind: MessageKind; title: string; hint: string; vars: (keyof MessageVars)[] };

export function TemplatesEditor({ kinds, defaults, initial }: { kinds: Kind[]; defaults: Record<MessageKind, Record<Lang, string>>; initial: Templates }) {
  const fx = useFx();
  const [value, setValue] = useState<Templates>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(value) !== saved;

  const set = (kind: MessageKind, lang: Lang, text: string) =>
    setValue((v) => {
      const next = structuredClone(v);
      const k = (next[kind] ??= {});
      if (text.trim()) k[lang] = text;
      else delete k[lang];
      if (!Object.keys(k).length) delete next[kind];
      return next;
    });

  return (
    <div className={s.list}>
      {kinds.map(({ kind, title, hint, vars }) => (
        <section key={kind} className={s.card} aria-label={title}>
          <header className={s.head}>
            <h2>{title}</h2>
            <span>{hint}</span>
            <span className={s.vars}>{vars.map((v) => `{${v}}`).join(" ")}</span>
          </header>
          <div className={s.langs}>
            {LANGS.map((lang) => {
              const text = value[kind]?.[lang] ?? "";
              const shown = text.trim() || defaults[kind][lang];
              return (
                <label key={lang} className={s.field}>
                  <span className={s.lang}>
                    {LANG_NAME[lang]}
                    {text.trim() ? <em> · изменён</em> : <em> · стандартный</em>}
                  </span>
                  <textarea
                    aria-label={`${title} — ${LANG_NAME[lang]}`}
                    lang={lang}
                    rows={4}
                    value={text}
                    placeholder={defaults[kind][lang]}
                    onChange={(e) => set(kind, lang, e.target.value)}
                  />
                  <span className={s.preview}>{renderTemplate(shown, SAMPLE[lang])}</span>
                </label>
              );
            })}
          </div>
        </section>
      ))}
      <div className={s.actions}>
        <Button
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const res = await saveTemplates(value);
              if (!res.ok) return fx.toast(res.error ?? "Не сохранилось", "Шаблоны");
              setSaved(JSON.stringify(res.templates));
              setValue(res.templates);
              fx.toast("Шаблоны сохранены", "Шаблоны");
            })
          }
        >
          {pending ? "Сохраняем…" : "Сохранить шаблоны"}
        </Button>
        <span className={s.small}>Пустое поле — стандартный текст (серым в поле). Переменные в фигурных скобках подставляются автоматически.</span>
      </div>
    </div>
  );
}
