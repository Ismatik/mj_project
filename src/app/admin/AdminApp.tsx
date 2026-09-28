"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { diffOverlay, localize, type Names, type Overlay } from "@/lib/i18n/content";
import { LANG_NAME, LANGS, localePath, type Lang } from "@/lib/i18n/locales";
import type { SiteContent } from "@/lib/site-content";
import { logout } from "../login/actions";
import { discardDraft, publishSite, saveDraft } from "./actions";
import type { AdminPost } from "@/server/blog";
import { BlogSection } from "./BlogSection";
import { MastersSection, type AdminCategory, type AdminStaff } from "./MastersSection";
import { ContactsSection, PhotosSection, ReviewsSection, SeoSection, ServicesSection, TextsSection, type AdminService } from "./sections";
import s from "./admin.module.css";

const SECTIONS = [
  { id: "texts", label: "Тексты секций" },
  { id: "prices", label: "Услуги и цены" },
  { id: "photos", label: "Фотографии" },
  { id: "masters", label: "Мастера и портфолио" },
  { id: "reviews", label: "Отзывы" },
  { id: "blog", label: "Блог и советы" },
  { id: "contacts", label: "Контакты и часы" },
  { id: "seo", label: "SEO" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const same = (a: SiteContent, b: SiteContent) => JSON.stringify(a) === JSON.stringify(b);

export function AdminApp(props: {
  draft: SiteContent;
  published: SiteContent;
  services: AdminService[];
  staff: AdminStaff[];
  categories: AdminCategory[];
  posts: AdminPost[];
  user: { name: string; roleLabel: string; isOwner: boolean };
}) {
  const fx = useFx();
  const [section, setSection] = useState<SectionId>("texts");
  const [editLang, setEditLang] = useState<Lang>("ru");
  const [draft, setDraft] = useState(props.draft);
  const [published, setPublished] = useState(props.published);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [justPublished, setJustPublished] = useState(false);
  const [pending, start] = useTransition();
  const first = useRef(true);
  const lastSaved = useRef(JSON.stringify(props.draft));

  // Remember the open section in the URL hash
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as SectionId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the URL on mount
    if (SECTIONS.some((x) => x.id === fromHash)) setSection(fromHash);
  }, []);

  // Autosave the draft 700 ms after the last edit
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const json = JSON.stringify(draft);
    if (json === lastSaved.current) return;
    const t = setTimeout(async () => {
      setSaving("saving");
      try {
        await saveDraft(draft);
        lastSaved.current = json;
        setSaving("saved");
      } catch {
        setSaving("error");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [draft]);

  const dirty = !same(draft, published);
  const update = (next: SiteContent) => {
    setJustPublished(false);
    setDraft(next);
  };

  // Tajik / English: sections edit the translated view; what differs from Russian is stored as the overlay
  const translating = editLang === "ru" ? null : editLang;
  const view = translating ? localize(draft, translating) : draft;
  const change = (next: SiteContent) => {
    if (!translating) return update(next);
    const ov = (diffOverlay(next, draft) ?? {}) as Overlay;
    update({ ...draft, i18n: { ...draft.i18n, [translating]: { ...ov, names: draft.i18n[translating].names } } });
  };
  const setName = (kind: keyof Names, id: string, value: string) => {
    if (!translating) return;
    const ov = draft.i18n[translating];
    const names = structuredClone(ov.names ?? { services: {}, categories: {}, staff: {} });
    if (value.trim()) names[kind][id] = value;
    else delete names[kind][id];
    update({ ...draft, i18n: { ...draft.i18n, [translating]: { ...ov, names } } });
  };
  const names = translating ? draft.i18n[translating].names : undefined;

  const publish = () =>
    start(async () => {
      await saveDraft(draft);
      await publishSite();
      const clean = { ...draft, serviceOverrides: {} };
      lastSaved.current = JSON.stringify(clean);
      setDraft(clean);
      setPublished(clean);
      setJustPublished(true);
      fx.toast("Изменения опубликованы на сайте", "Сайт");
    });

  const discard = () =>
    start(async () => {
      if (!confirm("Отменить все неопубликованные изменения?")) return;
      const restored = await discardDraft();
      lastSaved.current = JSON.stringify(restored);
      setDraft(restored);
      fx.toast("Черновик сброшен к опубликованной версии", "Сайт");
    });

  const statusText =
    saving === "saving" ? "Сохраняем черновик…" : saving === "error" ? "Черновик не сохранился — проверьте соединение" : dirty ? "Есть неопубликованные изменения" : "Сайт актуален";

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Monogram size={30} />
        <div className={s.title}>Админка сайта</div>
        <span className={s.sub}>mavzunai-jovid · Gallery of Beauty MJ</span>
        <div className={s.spacer} />
        <span className={`${s.status} ${dirty ? s.statusDirty : ""}`} role="status">
          {statusText}
        </span>
        {dirty && (
          <button type="button" className={s.headLink} onClick={discard} disabled={pending}>
            Сбросить
          </button>
        )}
        <a href={localePath(editLang, "/?preview=1")} target="_blank" rel="noopener noreferrer" className={s.headLink}>
          Предпросмотр
        </a>
        <Button variant="outlineGold" size="sm" onClick={() => window.open("/", "_blank", "noopener")}>
          Открыть сайт
        </Button>
        <Button size="sm" onClick={publish} disabled={pending || (!dirty && saving !== "saving")}>
          {pending ? "Публикуем…" : "Опубликовать"}
        </Button>
      </header>
      {justPublished && <div className={s.banner}>✦ Изменения опубликованы на сайте</div>}

      <div className={s.body}>
        <nav className={s.nav} aria-label="Разделы админки">
          {SECTIONS.map((x) => (
            <button
              key={x.id}
              type="button"
              className={`${s.navItem} ${section === x.id ? s.navOn : ""}`}
              aria-current={section === x.id ? "page" : undefined}
              onClick={() => {
                setSection(x.id);
                history.replaceState(null, "", `#${x.id}`);
              }}
            >
              {x.label}
            </button>
          ))}
          <div className={s.navUser}>
            <span>
              {props.user.name} — {props.user.roleLabel}
            </span>
            {props.user.isOwner && <Link href="/cms">CMS салона →</Link>}
            <form action={logout}>
              <button type="submit">Выйти</button>
            </form>
          </div>
        </nav>

        <main className={s.main}>
          <div className={s.langTabs} role="tablist" aria-label="Язык сайта">
            {LANGS.map((l) => (
              <button key={l} type="button" role="tab" aria-selected={editLang === l} className={editLang === l ? s.langOn : ""} onClick={() => setEditLang(l)}>
                {LANG_NAME[l]}
              </button>
            ))}
            {translating && <span className={s.small}>Перевод: пустое поле или текст как на русском — на сайте будет русский вариант.</span>}
          </div>
          {section === "texts" && <TextsSection c={view} onChange={change} />}
          {section === "prices" && <ServicesSection c={view} services={props.services} onChange={change} names={names} onName={setName} />}
          {section === "photos" &&
            (translating ? <p className={s.lead}>Фотографии общие для всех языков — меняйте их на русской вкладке.</p> : <PhotosSection c={draft} onChange={update} />)}
          {section === "masters" && (
            <MastersSection c={view} onChange={change} staff={props.staff} categories={props.categories} translating={translating} names={names} onName={setName} />
          )}
          {section === "reviews" && <ReviewsSection c={view} onChange={change} translating={!!translating} />}
          {section === "blog" && <BlogSection posts={props.posts} services={props.services} lang={editLang} />}
          {section === "contacts" && <ContactsSection c={view} onChange={change} translating={!!translating} />}
          {section === "seo" && <SeoSection c={view} onChange={change} />}
        </main>
      </div>
    </div>
  );
}
