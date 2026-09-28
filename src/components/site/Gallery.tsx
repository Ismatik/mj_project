"use client";
/* eslint-disable @next/next/no-img-element -- portfolio photos come from the admin (uploads or links) */

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import s from "./site.module.css";

export type GalleryWork = { id: string; url: string; caption: string; category: string; master?: { name: string; slug: string } };

/** Portfolio grid with category / master filters and a full-screen viewer (arrows and Esc on the keyboard). */
export function Gallery({
  works,
  categories = [],
  masters = [],
}: {
  works: GalleryWork[];
  categories?: { slug: string; name: string }[];
  masters?: { slug: string; name: string }[];
}) {
  const [cat, setCat] = useState("");
  const [master, setMaster] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const shown = works.filter((w) => (!cat || w.category === cat) && (!master || w.master?.slug === master));
  const current = open === null ? null : shown[open];

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % shown.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + shown.length) % shown.length));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, shown.length]);

  return (
    <>
      {(categories.length > 1 || masters.length > 1) && (
        <div className={s.filters}>
          {categories.length > 1 && (
            <div className={s.filterRow} role="group" aria-label="Направление">
              <button type="button" aria-pressed={!cat} onClick={() => setCat("")}>
                Все работы
              </button>
              {categories.map((c) => (
                <button key={c.slug} type="button" aria-pressed={cat === c.slug} onClick={() => setCat(c.slug)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {masters.length > 1 && (
            <div className={s.filterRow} role="group" aria-label="Мастер">
              <button type="button" aria-pressed={!master} onClick={() => setMaster("")}>
                Все мастера
              </button>
              {masters.map((m) => (
                <button key={m.slug} type="button" aria-pressed={master === m.slug} onClick={() => setMaster(m.slug)}>
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className={s.emptyNote}>Здесь скоро появятся работы — мы как раз фотографируем.</p>
      ) : (
        <ul className={s.gallery}>
          {shown.map((w, i) => (
            <li key={w.id}>
              <button type="button" className={s.work} onClick={() => setOpen(i)} aria-label={`Открыть фото: ${w.caption || "работа"}`}>
                <img src={w.url} alt={w.caption} loading="lazy" decoding="async" />
                {(w.caption || w.master) && (
                  <span className={s.workCaption}>
                    {w.caption}
                    {w.master && <small>{w.master.name}</small>}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && (
        <div className={s.viewer} role="dialog" aria-modal="true" aria-label={current.caption || "Фото работы"} onClick={() => setOpen(null)}>
          <button type="button" className={s.viewerClose} aria-label="Закрыть" onClick={() => setOpen(null)}>
            <X size={26} strokeWidth={1.3} />
          </button>
          {shown.length > 1 && (
            <button
              type="button"
              className={`${s.viewerNav} ${s.viewerPrev}`}
              aria-label="Предыдущее фото"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((open! - 1 + shown.length) % shown.length);
              }}
            >
              <ChevronLeft size={34} strokeWidth={1.2} />
            </button>
          )}
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={current.url} alt={current.caption} />
            <figcaption>
              {current.caption}
              {current.master && (
                <>
                  {" · "}
                  <a href={`/mastera/${current.master.slug}`}>{current.master.name}</a>
                </>
              )}
              <span>
                {open! + 1} / {shown.length}
              </span>
            </figcaption>
          </figure>
          {shown.length > 1 && (
            <button
              type="button"
              className={`${s.viewerNav} ${s.viewerNext}`}
              aria-label="Следующее фото"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((open! + 1) % shown.length);
              }}
            >
              <ChevronRight size={34} strokeWidth={1.2} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
