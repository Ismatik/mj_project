"use client";
/* eslint-disable @next/next/no-img-element -- previews of admin photos (uploads or external links) */

import { useState } from "react";
import { useFx } from "@/components/fx/FxProvider";
import type { Names } from "@/lib/i18n/content";
import { LANG_NAME, type Lang } from "@/lib/i18n/locales";
import { EMPTY_PROFILE, masterSlugs, slugify, type MasterProfile } from "@/lib/masters";
import type { SiteContent } from "@/lib/site-content";
import { Box, editor, Head, Text, upload } from "./sections";
import s from "./admin.module.css";

export type AdminStaff = { id: string; name: string; title: string; mainCategory: string };
export type AdminCategory = { slug: string; name: string };

type Props = {
  c: SiteContent;
  onChange: (c: SiteContent) => void;
  staff: AdminStaff[];
  categories: AdminCategory[];
  /** Tajik / English: only names, specialty, bio and captions are edited */
  translating?: Lang | null;
  names?: Names;
  onName?: (kind: keyof Names, id: string, v: string) => void;
};

// ── Мастера и портфолио ────────────────────────────────────
export function MastersSection({ c, onChange, staff, categories, translating, names, onName }: Props) {
  const edit = editor(c, onChange);
  const slugs = masterSlugs(staff, c.masters);
  /** Edits one master's profile (created on first edit). */
  const editMaster = (id: string, fn: (p: MasterProfile) => void) =>
    edit((d) => {
      const p = (d.masters[id] ??= structuredClone(EMPTY_PROFILE));
      fn(p);
    });

  return (
    <>
      <Head
        title="Мастера и портфолио"
        lead="Страницы «Мастера» и «Портфолио» на сайте. Имена, должности и услуги мастеров берутся из CMS; здесь — фото, рассказ о мастере и его работы."
      />
      <div className={s.stack}>
        <Box label="Тексты страниц">
          <div className={s.two}>
            <Text label="Заголовок «Мастера»" title value={c.team.title} onChange={(v) => edit((d) => void (d.team.title = v))} />
            <Text label="Заголовок «Портфолио»" title value={c.team.portfolioTitle} onChange={(v) => edit((d) => void (d.team.portfolioTitle = v))} />
          </div>
          <div className={s.two}>
            <Text label="Вступление «Мастера»" rows={3} value={c.team.intro} onChange={(v) => edit((d) => void (d.team.intro = v))} />
            <Text label="Вступление «Портфолио»" rows={3} value={c.team.portfolioIntro} onChange={(v) => edit((d) => void (d.team.portfolioIntro = v))} />
          </div>
        </Box>

        {staff.map((m) =>
          translating && names && onName ? (
            <MasterTranslation
              key={m.id}
              m={m}
              lang={translating}
              p={c.masters[m.id]}
              name={names.staff[m.id] ?? ""}
              onName={(v) => onName("staff", m.id, v)}
              onEdit={(fn) => c.masters[m.id] && editMaster(m.id, fn)}
            />
          ) : (
            <MasterEditor key={m.id} m={m} slug={slugs.get(m.id)!} p={c.masters[m.id] ?? EMPTY_PROFILE} categories={categories} onEdit={(fn) => editMaster(m.id, fn)} />
          ),
        )}
      </div>
    </>
  );
}

/** Name (e.g. in Latin letters for English), specialty, bio and portfolio captions in another language. */
function MasterTranslation({
  m,
  lang,
  p,
  name,
  onName,
  onEdit,
}: {
  m: AdminStaff;
  lang: Lang;
  p?: MasterProfile;
  name: string;
  onName: (v: string) => void;
  onEdit: (fn: (p: MasterProfile) => void) => void;
}) {
  return (
    <section className={s.master} aria-label={`Мастер ${m.name} — ${LANG_NAME[lang]}`}>
      <div className={s.masterHead}>
        <div className={s.masterAvatar}>{p?.photo?.url ? <img src={p.photo.url} alt="" /> : <span>{m.name[0]}</span>}</div>
        <div className={s.masterWho}>
          <div className={s.reviewAuthor}>{m.name}</div>
          <div className={s.small}>{m.title}</div>
        </div>
      </div>
      <div className={s.masterFields}>
        <div className={s.two}>
          <label className={s.fieldLabel}>
            Имя на сайте
            <input className={s.input} placeholder={m.name} value={name} onChange={(e) => onName(e.target.value)} />
          </label>
          <label className={s.fieldLabel}>
            Специализация
            <input className={s.input} placeholder={m.title} value={p?.specialty ?? ""} disabled={!p} onChange={(e) => onEdit((d) => void (d.specialty = e.target.value))} />
          </label>
        </div>
        <label className={s.fieldLabel}>
          О мастере
          <textarea className={s.textarea} rows={4} value={p?.bio ?? ""} disabled={!p} onChange={(e) => onEdit((d) => void (d.bio = e.target.value))} />
        </label>
        {!p && <span className={s.small}>Сначала заполните профиль на русской вкладке.</span>}
        {p && p.portfolio.length > 0 && (
          <div className={s.works}>
            {p.portfolio.map((w, i) => (
              <div key={w.id} className={s.workCard}>
                <img src={w.url} alt="" />
                <input
                  aria-label={`Подпись к фото ${i + 1}: ${m.name}`}
                  className={s.input}
                  value={w.caption}
                  onChange={(e) => onEdit((d) => void (d.portfolio[i]!.caption = e.target.value))}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MasterEditor({
  m,
  slug,
  p,
  categories,
  onEdit,
}: {
  m: AdminStaff;
  slug: string;
  p: MasterProfile;
  categories: AdminCategory[];
  onEdit: (fn: (p: MasterProfile) => void) => void;
}) {
  const fx = useFx();
  const [busy, setBusy] = useState<"photo" | "works" | null>(null);
  const [error, setError] = useState("");

  async function uploadMany(files: File[]) {
    setBusy("works");
    setError("");
    const added: MasterProfile["portfolio"] = [];
    for (const file of files.slice(0, 12)) {
      const res = await upload(file);
      if (!res.ok) {
        setError(`${file.name}: ${res.error}`);
        continue;
      }
      added.push({ id: `w${Date.now().toString(36)}${added.length}`, url: res.url, caption: "", category: m.mainCategory });
    }
    setBusy(null);
    if (added.length) {
      onEdit((d) => void d.portfolio.unshift(...added));
      fx.toast(`Добавлено фото: ${added.length} — ${m.name}`, "Сайт");
    }
  }

  const move = (i: number, dir: -1 | 1) =>
    onEdit((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.portfolio.length) return;
      [d.portfolio[i], d.portfolio[j]] = [d.portfolio[j]!, d.portfolio[i]!];
    });

  return (
    <section className={`${s.master} ${p.visible ? "" : s.reviewHidden}`} aria-label={`Мастер ${m.name}`}>
      <div className={s.masterHead}>
        <div className={s.masterAvatar}>{p.photo?.url ? <img src={p.photo.url} alt="" /> : <span>{m.name[0]}</span>}</div>
        <div className={s.masterWho}>
          <div className={s.reviewAuthor}>{m.name}</div>
          <div className={s.small}>
            {m.title} · <a href={`/mastera/${slug}`} target="_blank" rel="noopener noreferrer">/mastera/{slug}</a>
          </div>
        </div>
        <button type="button" aria-pressed={p.visible} className={`${s.toggle} ${p.visible ? s.toggleOn : ""}`} onClick={() => onEdit((d) => void (d.visible = !p.visible))}>
          {p.visible ? "На сайте ✓" : "Скрыт"}
        </button>
      </div>

      <div className={s.masterFields}>
        <div className={s.two}>
          <label className={s.fieldLabel}>
            Специализация на сайте
            <input className={s.input} placeholder={m.title} value={p.specialty} onChange={(e) => onEdit((d) => void (d.specialty = e.target.value))} />
          </label>
          <label className={s.fieldLabel}>
            Адрес страницы
            <input className={s.input} placeholder={slugify(m.name)} value={p.slug} onChange={(e) => onEdit((d) => void (d.slug = e.target.value))} />
          </label>
        </div>
        <label className={s.fieldLabel}>
          О мастере
          <textarea
            className={s.textarea}
            rows={4}
            placeholder="Опыт, в чём сильна, любимые техники — пара живых абзацев."
            value={p.bio}
            onChange={(e) => onEdit((d) => void (d.bio = e.target.value))}
          />
        </label>
        <div className={s.masterPhotoRow}>
          <label className={s.fileBtn}>
            {busy === "photo" ? "Загружаем…" : p.photo?.url ? "Заменить портрет" : "Загрузить портрет"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!!busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setBusy("photo");
                setError("");
                const res = await upload(file);
                setBusy(null);
                if (!res.ok) return setError(res.error);
                onEdit((d) => void (d.photo = { url: res.url }));
                fx.toast(`Портрет обновлён — ${m.name}`, "Сайт");
              }}
            />
          </label>
          {p.photo?.url && (
            <button type="button" className={s.smallBtn} onClick={() => onEdit((d) => void delete d.photo)}>
              Убрать портрет
            </button>
          )}
        </div>
      </div>

      <div className={s.worksHead}>
        <div className={s.boxLabel}>Портфолио · {p.portfolio.length}</div>
        <label className={s.fileBtn}>
          {busy === "works" ? "Загружаем…" : "+ Добавить работы"}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={!!busy}
            aria-label={`Добавить работы: ${m.name}`}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length) void uploadMany(files);
            }}
          />
        </label>
      </div>
      {error && <div className={s.error}>{error}</div>}
      {p.portfolio.length === 0 ? (
        <div className={s.small}>Пока нет работ. Можно выбрать сразу несколько фото (до 12 за раз, каждое до 8 МБ).</div>
      ) : (
        <div className={s.works}>
          {p.portfolio.map((w, i) => (
            <div key={w.id} className={s.workCard}>
              <img src={w.url} alt={w.caption} />
              <input
                aria-label={`Подпись к фото ${i + 1}: ${m.name}`}
                className={s.input}
                placeholder="Подпись: «Балаяж, холодный блонд»"
                value={w.caption}
                onChange={(e) => onEdit((d) => void (d.portfolio[i]!.caption = e.target.value))}
              />
              <select aria-label={`Направление фото ${i + 1}: ${m.name}`} className={s.input} value={w.category} onChange={(e) => onEdit((d) => void (d.portfolio[i]!.category = e.target.value))}>
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <div className={s.workActions}>
                <button type="button" className={s.smallBtn} aria-label="Левее" disabled={i === 0} onClick={() => move(i, -1)}>
                  ←
                </button>
                <button type="button" className={s.smallBtn} aria-label="Правее" disabled={i === p.portfolio.length - 1} onClick={() => move(i, 1)}>
                  →
                </button>
                <button type="button" className={s.smallBtn} onClick={() => confirm("Удалить фото из портфолио?") && onEdit((d) => void d.portfolio.splice(i, 1))}>
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
