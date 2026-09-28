"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { shortDate } from "@/lib/format";
import type { GuestCardData } from "@/server/guests";
import { removeFormula, removePhoto, saveFormula } from "../guest-card-actions";
import s from "./guests.module.css";

const KIND: Record<string, string> = { BEFORE: "до", AFTER: "после", OTHER: "фото" };

/** Colour formulas: what was mixed, for which visit, by whom */
export function Formulas({ guestId, formulas, visits, appointmentId }: { guestId: string; formulas: GuestCardData["formulas"]; visits?: GuestCardData["recentVisits"]; appointmentId?: string }) {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [formula, setFormula] = useState("");
  const [note, setNote] = useState("");
  const [visit, setVisit] = useState(appointmentId ?? "");
  const [open, setOpen] = useState(false);
  return (
    <div aria-label="Формулы окрашивания">
      <div className={s.extraTitle}>Формулы окрашивания</div>
      {formulas.length === 0 && <div className={s.cardSub}>Пока нет формул.</div>}
      {formulas.map((f) => (
        <div key={f.id} className={s.formula}>
          <b>{f.title}</b>
          <code>{f.formula}</code>
          <small>
            {shortDate(new Date(f.at))}
            {f.master ? ` · ${f.master}` : f.by ? ` · ${f.by}` : ""}
            {f.note ? ` · ${f.note}` : ""}
          </small>{" "}
          <button
            type="button"
            className={s.linkBtn}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await removeFormula(f.id);
                if (!res.ok) return fx.toast(res.error, "Формулы");
                router.refresh();
              })
            }
          >
            удалить
          </button>
        </div>
      ))}
      {open ? (
        <form
          className={s.miniForm}
          aria-label="Новая формула"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveFormula({ guestId, appointmentId: visit || null, title, formula, note });
              if (!res.ok) return fx.toast(res.error, "Формулы");
              fx.toast("Формула сохранена", "Формулы");
              setTitle("");
              setFormula("");
              setNote("");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <input name="title" placeholder="Для чего: окрашивание корней, тонирование…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea name="formula" rows={2} placeholder="Igora 7-1 + 7-0 1:1, оксид 6%, 35 мин" value={formula} onChange={(e) => setFormula(e.target.value)} />
          <input name="note" placeholder="Заметка (необязательно)" value={note} onChange={(e) => setNote(e.target.value)} />
          {visits && visits.length > 0 && (
            <select aria-label="Визит" value={visit} onChange={(e) => setVisit(e.target.value)}>
              <option value="">без привязки к визиту</option>
              {visits.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
          <button type="submit" disabled={pending || !title.trim() || !formula.trim()}>
            Сохранить формулу
          </button>
        </form>
      ) : (
        <button type="button" className={s.linkBtn} onClick={() => setOpen(true)}>
          + Записать формулу
        </button>
      )}
    </div>
  );
}

/** Before/after photos, private to the CMS */
export function Photos({ guestId, photos, visits }: { guestId: string; photos: GuestCardData["photos"]; visits: GuestCardData["recentVisits"] }) {
  const fx = useFx();
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("BEFORE");
  const [caption, setCaption] = useState("");
  const [visit, setVisit] = useState("");
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  async function upload() {
    const f = file.current?.files?.[0];
    if (!f) return fx.toast("Выберите фото", "Фото");
    const body = new FormData();
    body.set("guestId", guestId);
    body.set("kind", kind);
    body.set("caption", caption);
    body.set("appointmentId", visit);
    body.set("file", f);
    setBusy(true);
    try {
      const res = await fetch("/api/cms/guest-photos", { method: "POST", body });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) return fx.toast(j.error ?? "Не получилось", "Фото");
      fx.toast("Фото добавлено", "Фото");
      setCaption("");
      if (file.current) file.current.value = "";
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div aria-label="Фото до и после">
      <div className={s.extraTitle}>Фото до / после</div>
      {photos.length === 0 && <div className={s.cardSub}>Фото пока нет. Они видны только в CMS.</div>}
      <div className={s.photos}>
        {photos.map((p) => (
          <figure key={p.id} className={s.photo}>
            <a href={`/api/cms/guest-photos/${p.id}`} target="_blank" rel="noopener">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked image */}
              <img src={`/api/cms/guest-photos/${p.id}`} alt={`${KIND[p.kind]} ${p.caption ?? ""}`} loading="lazy" />
            </a>
            <span className={s.photoKind}>{KIND[p.kind]}</span>
            <button
              type="button"
              className={s.photoDel}
              aria-label="Удалить фото"
              onClick={() =>
                start(async () => {
                  const res = await removePhoto(p.id);
                  if (!res.ok) return fx.toast(res.error, "Фото");
                  router.refresh();
                })
              }
            >
              ×
            </button>
            <figcaption>
              {shortDate(new Date(p.at))}
              {p.visit ? ` · ${p.visit}` : ""}
              {p.caption ? ` · ${p.caption}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className={s.miniForm} role="group" aria-label="Добавить фото">
        <input ref={file} type="file" name="photo" accept="image/jpeg,image/png,image/webp" />
        <select aria-label="До или после" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="BEFORE">до</option>
          <option value="AFTER">после</option>
          <option value="OTHER">другое</option>
        </select>
        {visits.length > 0 && (
          <select aria-label="Визит для фото" value={visit} onChange={(e) => setVisit(e.target.value)}>
            <option value="">без привязки к визиту</option>
            {visits.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        <input name="caption" placeholder="Подпись (необязательно)" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <button type="button" disabled={busy} onClick={upload}>
          {busy ? "Загружаем…" : "Добавить фото"}
        </button>
      </div>
    </div>
  );
}
