"use client";
/* eslint-disable @next/next/no-img-element -- cover preview (upload or external link) */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { slugify, type PostI18n } from "@/lib/blog";
import { localePath, type Lang } from "@/lib/i18n/locales";
import type { AdminPost } from "@/server/blog";
import { deleteBlogPost, publishBlogPost, saveBlogPost } from "./blog-actions";
import { Box, Head, upload, type AdminService } from "./sections";
import s from "./admin.module.css";

const EMPTY: AdminPost = { id: "", slug: "", status: "DRAFT", title: "", excerpt: "", body: "", i18n: {}, coverUrl: "", tags: [], serviceId: "", publishedAt: null, updatedAt: "" };

export function BlogSection({ posts, services, lang }: { posts: AdminPost[]; services: AdminService[]; lang: Lang }) {
  const [editing, setEditing] = useState<AdminPost | null>(null);
  if (editing) return <PostEditor key={editing.id || "new"} post={editing} services={services} lang={lang} onClose={() => setEditing(null)} />;
  return (
    <>
      <Head title="Блог и советы" lead="Статьи и советы по уходу — на странице /blog и в разделе «Советы» на главной. Каждая статья публикуется отдельно." />
      <div className={s.stack}>
        <div>
          <Button size="sm" onClick={() => setEditing(EMPTY)}>
            + Новая статья
          </Button>
        </div>
        {posts.length === 0 && <p className={s.lead}>Статей пока нет.</p>}
        {posts.map((p) => (
          <div key={p.id} className={s.review} data-post={p.slug}>
            <div className={s.reviewHead}>
              <span className={s.reviewAuthor}>{p.title}</span>
              <span className={s.small}>
                {p.status === "PUBLISHED" ? "опубликована" : "черновик"} · /blog/{p.slug}
                {p.i18n.tg?.title ? " · TJ" : ""}
                {p.i18n.en?.title ? " · EN" : ""}
              </span>
            </div>
            <p className={s.small}>{p.excerpt || p.body.slice(0, 160)}</p>
            <div className={s.reviewActions}>
              <button type="button" className={s.smallBtn} onClick={() => setEditing(p)}>
                Редактировать
              </button>
              {p.status === "PUBLISHED" && (
                <a className={s.smallBtn} href={localePath(lang, `/blog/${p.slug}`)} target="_blank" rel="noopener noreferrer">
                  Открыть на сайте
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PostEditor({ post, services, lang, onClose }: { post: AdminPost; services: AdminService[]; lang: Lang; onClose: () => void }) {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [p, setP] = useState(post);
  const [slugTouched, setSlugTouched] = useState(!!post.id);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tr = lang === "ru" ? null : lang;
  // Tajik / English tabs edit the translation; empty fields show Russian on the site
  const text = (k: "title" | "excerpt" | "body") => (tr ? (p.i18n[tr]?.[k] ?? "") : p[k]);
  const setText = (k: "title" | "excerpt" | "body", v: string) => {
    if (!tr) {
      setP((x) => ({ ...x, [k]: v, ...(k === "title" && !slugTouched ? { slug: slugify(v) } : {}) }));
      return;
    }
    setP((x) => ({ ...x, i18n: { ...x.i18n, [tr]: { ...(x.i18n[tr] ?? {}), [k]: v } } as PostI18n }));
  };

  const save = (then?: (id: string) => Promise<unknown>) =>
    start(async () => {
      setError("");
      const res = await saveBlogPost({ id: p.id || undefined, slug: p.slug, title: p.title, excerpt: p.excerpt, body: p.body, i18n: p.i18n, coverUrl: p.coverUrl, tags: p.tags, serviceId: p.serviceId });
      if (!res.ok) return setError(res.error);
      setP((x) => ({ ...x, id: res.id, slug: res.slug }));
      if (then) {
        const r = (await then(res.id)) as { ok: boolean; error?: string };
        if (!r.ok) return setError(r.error ?? "Не получилось");
      }
      fx.toast(then ? "Статья опубликована" : "Статья сохранена", "Блог");
      router.refresh();
      if (then) onClose();
    });

  return (
    <>
      <Head title={post.id ? "Статья" : "Новая статья"} lead={tr ? "Перевод: пустое поле — на сайте будет русский текст." : "Текст: пустая строка — новый абзац, «## » — подзаголовок, «- » — пункт списка, «> » — цитата, **жирный**, [ссылка](/#zapis)."} />
      <div className={s.stack}>
        <Box label="Заголовок">
          <input aria-label="Заголовок статьи" className={s.inputTitle} value={text("title")} placeholder={tr ? p.title : ""} onChange={(e) => setText("title", e.target.value)} />
        </Box>
        {!tr && (
          <Box label="Адрес страницы">
            <input
              aria-label="Адрес статьи"
              className={s.input}
              value={p.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setP({ ...p, slug: e.target.value.toLowerCase() });
              }}
            />
            <span className={s.small}>/blog/{p.slug || "…"}</span>
          </Box>
        )}
        <Box label="Кратко — для списка статей и поиска">
          <textarea aria-label="Кратко" className={s.textarea} rows={2} value={text("excerpt")} placeholder={tr ? p.excerpt : ""} onChange={(e) => setText("excerpt", e.target.value)} />
        </Box>
        <Box label="Текст">
          <textarea aria-label="Текст статьи" className={s.textarea} rows={14} value={text("body")} placeholder={tr ? p.body.slice(0, 200) : ""} onChange={(e) => setText("body", e.target.value)} />
        </Box>
        {!tr && (
          <div className={s.two}>
            <Box label="Обложка">
              {p.coverUrl && <img src={p.coverUrl} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", filter: "grayscale(1)" }} />}
              <label className={s.fileBtn}>
                {busy ? "Загружаем…" : p.coverUrl ? "Заменить" : "Загрузить фото"}
                <input
                  type="file"
                  aria-label="Обложка статьи"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setBusy(true);
                    const res = await upload(file);
                    setBusy(false);
                    if (!res.ok) return setError(res.error);
                    setP((x) => ({ ...x, coverUrl: res.url }));
                  }}
                />
              </label>
            </Box>
            <Box label="Теги и запись">
              <input aria-label="Теги" className={s.input} placeholder="волосы, уход" value={p.tags.join(", ")} onChange={(e) => setP({ ...p, tags: e.target.value.split(",").map((t) => t.trimStart()) })} />
              <select aria-label="Услуга для записи" className={s.input} value={p.serviceId} onChange={(e) => setP({ ...p, serviceId: e.target.value })}>
                <option value="">кнопка «Записаться» без услуги</option>
                {services
                  .filter((x) => x.showOnSite)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </Box>
          </div>
        )}
        {error && (
          <div className={s.error} role="alert">
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => save()}>
            Сохранить
          </Button>
          {p.status !== "PUBLISHED" ? (
            <Button size="sm" disabled={pending} onClick={() => save((id) => publishBlogPost(id, true))}>
              Опубликовать
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await publishBlogPost(p.id, false);
                  setP({ ...p, status: "DRAFT" });
                  fx.toast("Статья снята с сайта", "Блог");
                  router.refresh();
                })
              }
            >
              Снять с публикации
            </Button>
          )}
          {p.id && (
            <a className={s.smallBtn} href={`${localePath(lang, `/blog/${p.slug}`)}?preview=1`} target="_blank" rel="noopener noreferrer">
              Предпросмотр
            </a>
          )}
          {p.id && (
            <button
              type="button"
              className={s.smallBtn}
              onClick={() =>
                confirm("Удалить статью?") &&
                start(async () => {
                  await deleteBlogPost(p.id);
                  fx.toast("Статья удалена", "Блог");
                  router.refresh();
                  onClose();
                })
              }
            >
              Удалить
            </button>
          )}
          <button type="button" className={s.smallBtn} onClick={onClose}>
            ← К списку
          </button>
        </div>
      </div>
    </>
  );
}
