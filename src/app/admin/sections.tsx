"use client";
/* eslint-disable @next/next/no-img-element -- previews of admin photos (uploads or external links) */

import { useState, type ReactNode } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { duration } from "@/lib/duration";
import { somoni } from "@/lib/format";
import type { SiteContent, SitePhoto } from "@/lib/site-content";
import s from "./admin.module.css";

type Props = { c: SiteContent; onChange: (c: SiteContent) => void };
export type AdminService = { id: string; name: string; price: number; durationMin: number; showOnSite: boolean; category: string };

/** Immutable edit helper: clone, mutate, hand back. */
const editor = (c: SiteContent, onChange: Props["onChange"]) => (fn: (d: SiteContent) => void) => {
  const next = structuredClone(c);
  fn(next);
  onChange(next);
};

function Head({ title, lead }: { title: string; lead: string }) {
  return (
    <>
      <h1 className={s.h1}>{title}</h1>
      <p className={s.lead}>{lead}</p>
    </>
  );
}

function Box({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.box}>
      <div className={s.boxLabel}>{label}</div>
      {children}
    </div>
  );
}

function Text({ value, onChange, title, label, rows }: { value: string; onChange: (v: string) => void; title?: boolean; label: string; rows?: number }) {
  if (rows)
    return <textarea aria-label={label} className={s.textarea} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />;
  return <input aria-label={label} className={title ? s.inputTitle : s.input} value={value} onChange={(e) => onChange(e.target.value)} />;
}

// ── Тексты секций ──────────────────────────────────────────
export function TextsSection({ c, onChange }: Props) {
  const edit = editor(c, onChange);
  return (
    <>
      <Head title="Тексты секций" lead="Заголовки и описания, которые видят гостьи на сайте. Перенос строки в заголовке сохраняется." />
      <div className={s.stack}>
        <Box label="Hero — главный экран">
          <Text label="Надпись над заголовком" value={c.hero.kicker} onChange={(v) => edit((d) => void (d.hero.kicker = v))} />
          <Text label="Заголовок" title rows={2} value={c.hero.title} onChange={(v) => edit((d) => void (d.hero.title = v))} />
          <Text label="Подзаголовок" rows={2} value={c.hero.subtitle} onChange={(v) => edit((d) => void (d.hero.subtitle = v))} />
          <div className={s.two}>
            {c.hero.badges.map((b, i) => (
              <Text key={i} label={`Отметка ${i + 1}`} value={b} onChange={(v) => edit((d) => void (d.hero.badges[i] = v))} />
            ))}
          </div>
        </Box>
        <Box label="Наша философия">
          <Text label="Заголовок" title value={c.philosophy.title} onChange={(v) => edit((d) => void (d.philosophy.title = v))} />
          <Text label="Текст" rows={4} value={c.philosophy.body} onChange={(v) => edit((d) => void (d.philosophy.body = v))} />
        </Box>
        <Box label="Наши услуги — карточки">
          <Text label="Заголовок секции" title value={c.services.title} onChange={(v) => edit((d) => void (d.services.title = v))} />
          {c.services.cards.map((card, i) => (
            <div key={i} className={s.two}>
              <Text label={`Карточка ${i + 1}: название`} value={card.name} onChange={(v) => edit((d) => void (d.services.cards[i]!.name = v))} />
              <Text label={`Карточка ${i + 1}: описание`} value={card.desc} onChange={(v) => edit((d) => void (d.services.cards[i]!.desc = v))} />
            </div>
          ))}
          <span className={s.small}>Цены под карточками берутся из CMS — раздел «Услуги и цены».</span>
        </Box>
        <Box label="Бегущая строка">
          <Text
            label="Слова через запятую"
            value={c.marquee.join(", ")}
            onChange={(v) => edit((d) => void (d.marquee = v.split(",").map((x) => x.trim()).filter(Boolean)))}
          />
        </Box>
        <Box label="Свадебный зал">
          <Text label="Надпись" value={c.bridal.kicker} onChange={(v) => edit((d) => void (d.bridal.kicker = v))} />
          <Text label="Заголовок" title rows={2} value={c.bridal.title} onChange={(v) => edit((d) => void (d.bridal.title = v))} />
          <Text label="Текст" rows={4} value={c.bridal.body} onChange={(v) => edit((d) => void (d.bridal.body = v))} />
          <Text label="Кнопка" value={c.bridal.cta} onChange={(v) => edit((d) => void (d.bridal.cta = v))} />
        </Box>
        <Box label="О салоне">
          <Text label="Заголовок" title value={c.about.title} onChange={(v) => edit((d) => void (d.about.title = v))} />
          <Text label="Текст" rows={4} value={c.about.body} onChange={(v) => edit((d) => void (d.about.body = v))} />
          <div className={s.three}>
            {c.about.facts.map((f, i) => (
              <div key={i} className={s.stack} style={{ gap: 6 }}>
                <Text label={`Факт ${i + 1}: число`} title value={f.value} onChange={(v) => edit((d) => void (d.about.facts[i]!.value = v))} />
                <Text label={`Факт ${i + 1}: подпись`} value={f.label} onChange={(v) => edit((d) => void (d.about.facts[i]!.label = v))} />
              </div>
            ))}
          </div>
        </Box>
        <Box label="Онлайн-запись">
          <Text label="Заголовок" title value={c.booking.title} onChange={(v) => edit((d) => void (d.booking.title = v))} />
          <Text label="Текст" rows={2} value={c.booking.intro} onChange={(v) => edit((d) => void (d.booking.intro = v))} />
          <span className={s.small}>Услуги, мастера и свободное время для записи берутся из CMS автоматически.</span>
        </Box>
      </div>
    </>
  );
}

// ── Услуги и цены ──────────────────────────────────────────
export function ServicesSection({ c, services, onChange }: Props & { services: AdminService[] }) {
  const edit = editor(c, onChange);
  return (
    <>
      <Head
        title="Услуги и цены на сайте"
        lead="Что показывать в прайсе под секцией «Наши услуги». Цены и длительность меняет владелица в CMS — здесь только видимость на сайте."
      />
      <div>
        {services.map((sv, i) => {
          const override = c.serviceOverrides[sv.id];
          const on = override ?? sv.showOnSite;
          const changed = override !== undefined && override !== sv.showOnSite;
          const cat = i === 0 || services[i - 1]!.category !== sv.category ? sv.category : null;
          return (
            <div key={sv.id}>
              {cat && <div className={s.svcCat}>{cat}</div>}
              <div className={s.svcRow}>
                <span className={s.svcName}>
                  {sv.name}
                  {changed && <span className={s.changed}>· изменено</span>}
                </span>
                <span className={s.svcPrice}>{somoni(sv.price)}</span>
                <span className={s.svcDur}>{duration(sv.durationMin)}</span>
                <button
                  type="button"
                  aria-pressed={on}
                  className={`${s.toggle} ${on ? s.toggleOn : ""}`}
                  onClick={() =>
                    edit((d) => {
                      const next = !on;
                      if (next === sv.showOnSite) delete d.serviceOverrides[sv.id];
                      else d.serviceOverrides[sv.id] = next;
                    })
                  }
                >
                  {on ? "На сайте ✓" : "Скрыто"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Фотографии ─────────────────────────────────────────────
async function upload(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  try {
    return await res.json();
  } catch {
    return { ok: false, error: "Не удалось загрузить" };
  }
}

function PhotoCard({ label, place, photo, onChange }: { label: string; place: string; photo?: SitePhoto; onChange: (p: SitePhoto) => void }) {
  const fx = useFx();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className={s.photoCard}>
      {photo?.url ? <img src={photo.url} alt={label} /> : <img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />}
      <div className={s.photoBody}>
        <div className={s.photoLabel}>{label}</div>
        <div className={s.photoPlace}>{place}</div>
        <input
          aria-label={`${label}: подпись автора`}
          className={s.input}
          placeholder="Подпись (автор фото)"
          value={photo?.credit ?? ""}
          onChange={(e) => photo && onChange({ ...photo, credit: e.target.value })}
        />
        <label className={s.fileBtn}>
          {busy ? "Загружаем…" : "Заменить"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setError("");
              const res = await upload(file);
              setBusy(false);
              if (!res.ok) return setError(res.error);
              onChange({ url: res.url, credit: "Фото: Mavzunai Jovid" });
              fx.toast(`Фото загружено: ${label}`, "Сайт");
            }}
          />
        </label>
        {error && <div className={s.error}>{error}</div>}
      </div>
    </div>
  );
}

export function PhotosSection({ c, onChange }: Props) {
  const edit = editor(c, onChange);
  return (
    <>
      <Head title="Фотографии" lead="JPG, PNG или WebP до 8 МБ. На сайте фото показываются в чёрно-белом стиле MJ. Сейчас часть снимков — временные стоковые." />
      <div className={s.photos}>
        <PhotoCard label="Hero — главный экран" place="верх страницы" photo={c.photos.hero} onChange={(p) => edit((d) => void (d.photos.hero = p))} />
        <PhotoCard label="Свадебный зал" place="секция «Невестам»" photo={c.photos.bridal} onChange={(p) => edit((d) => void (d.photos.bridal = p))} />
        <PhotoCard label="Интерьер" place="секция «О салоне»" photo={c.photos.interior} onChange={(p) => edit((d) => void (d.photos.interior = p))} />
        {c.reviews.items.map((r, i) => (
          <PhotoCard key={r.id} label={`Отзыв — ${r.author}`} place="аватар" photo={r.photo} onChange={(p) => edit((d) => void (d.reviews.items[i]!.photo = p))} />
        ))}
      </div>
    </>
  );
}

// ── Отзывы ─────────────────────────────────────────────────
export function ReviewsSection({ c, onChange }: Props) {
  const edit = editor(c, onChange);
  const [draft, setDraft] = useState({ author: "", text: "", source: "" });
  return (
    <>
      <Head title="Отзывы" lead="Что показывается в секции «Нас любят гости». Скрытые отзывы остаются в архиве." />
      <div className={s.stack} style={{ gap: 14 }}>
        {c.reviews.items.map((r, i) => (
          <div key={r.id} className={`${s.review} ${r.visible ? "" : s.reviewHidden}`}>
            <div className={s.reviewHead}>
              <span className={s.reviewAuthor}>
                {r.author} <span>★★★★★</span>
              </span>
              <span className={s.reviewActions}>
                <button type="button" className={s.smallBtn} onClick={() => edit((d) => void (d.reviews.items[i]!.visible = !r.visible))}>
                  {r.visible ? "Скрыть" : "Показать"}
                </button>
                <button
                  type="button"
                  className={s.smallBtn}
                  onClick={() => confirm(`Удалить отзыв «${r.author}» насовсем?`) && edit((d) => void d.reviews.items.splice(i, 1))}
                >
                  Удалить
                </button>
              </span>
            </div>
            <Text label={`Текст отзыва: ${r.author}`} rows={3} value={r.text} onChange={(v) => edit((d) => void (d.reviews.items[i]!.text = v))} />
            <Text label={`Источник: ${r.author}`} value={r.source} onChange={(v) => edit((d) => void (d.reviews.items[i]!.source = v))} />
          </div>
        ))}
        <Box label="Новый отзыв">
          <div className={s.two}>
            <input aria-label="Автор" className={s.input} placeholder="Имя гостьи" value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
            <input aria-label="Источник" className={s.input} placeholder="Источник (Instagram, Tripadvisor…)" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
          </div>
          <textarea aria-label="Текст" className={s.textarea} rows={3} placeholder="«Текст отзыва»" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <button
            type="button"
            className={s.smallBtn}
            style={{ alignSelf: "flex-start" }}
            disabled={draft.author.trim().length < 2 || draft.text.trim().length < 5}
            onClick={() => {
              edit((d) =>
                d.reviews.items.push({ id: `r${Date.now().toString(36)}`, author: draft.author.trim(), text: draft.text.trim(), source: draft.source.trim(), visible: true }),
              );
              setDraft({ author: "", text: "", source: "" });
            }}
          >
            Добавить отзыв
          </button>
        </Box>
      </div>
    </>
  );
}

// ── Контакты и часы ────────────────────────────────────────
const CONTACT_FIELDS: { key: keyof SiteContent["contacts"]; label: string; hint?: string }[] = [
  { key: "phone", label: "Телефон" },
  { key: "whatsapp", label: "WhatsApp", hint: "номер для ссылки wa.me, только цифры" },
  { key: "instagram", label: "Instagram — салон", hint: "без @" },
  { key: "instagramGallery", label: "Instagram — галерея", hint: "без @" },
  { key: "address", label: "Адрес" },
  { key: "district", label: "Район, город" },
  { key: "hours", label: "Часы работы" },
  { key: "dayOff", label: "Выходной" },
];

export function ContactsSection({ c, onChange }: Props) {
  const edit = editor(c, onChange);
  return (
    <>
      <Head title="Контакты и часы" lead="Показываются в футере сайта и в кнопках WhatsApp." />
      <div className={s.stack} style={{ gap: 16 }}>
        {CONTACT_FIELDS.map((f) => (
          <label key={f.key} style={{ display: "block" }}>
            <div className={s.boxLabel} style={{ marginBottom: 7 }}>
              {f.label} {f.hint && <span className={s.small}>({f.hint})</span>}
            </div>
            <input className={s.input} style={{ background: "var(--mj-paper)" }} value={c.contacts[f.key]} onChange={(e) => edit((d) => void (d.contacts[f.key] = e.target.value))} />
          </label>
        ))}
      </div>
    </>
  );
}

// ── SEO ────────────────────────────────────────────────────
export function SeoSection({ c, onChange }: Props) {
  const edit = editor(c, onChange);
  const counter = (n: number, max: number) => <div className={`${s.counter} ${n > max ? s.counterOver : ""}`}>{`${n} / ${max}`}</div>;
  return (
    <>
      <Head title="SEO" lead="Как страница выглядит в Google и при пересылке ссылки." />
      <label style={{ display: "block", marginBottom: 16 }}>
        <div className={s.boxLabel} style={{ marginBottom: 7 }}>
          Title <span className={s.small}>(до 60 символов)</span>
        </div>
        <input className={s.input} style={{ background: "var(--mj-paper)" }} value={c.seo.title} onChange={(e) => edit((d) => void (d.seo.title = e.target.value))} />
        {counter(c.seo.title.length, 60)}
      </label>
      <label style={{ display: "block", marginBottom: 24 }}>
        <div className={s.boxLabel} style={{ marginBottom: 7 }}>
          Description <span className={s.small}>(до 160 символов)</span>
        </div>
        <textarea className={s.textarea} style={{ background: "var(--mj-paper)" }} rows={3} value={c.seo.description} onChange={(e) => edit((d) => void (d.seo.description = e.target.value))} />
        {counter(c.seo.description.length, 160)}
      </label>
      <div className={s.serp}>
        <div className={s.boxLabel} style={{ marginBottom: 10 }}>
          Предпросмотр в поиске
        </div>
        <div className={s.serpUrl}>mavzunai-jovid.tj</div>
        <div className={s.serpTitle}>{c.seo.title.length > 60 ? `${c.seo.title.slice(0, 58)}…` : c.seo.title}</div>
        <div className={s.serpDesc}>{c.seo.description.length > 160 ? `${c.seo.description.slice(0, 158)}…` : c.seo.description}</div>
      </div>
    </>
  );
}
