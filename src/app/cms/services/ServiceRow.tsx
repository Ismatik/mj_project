"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { duration } from "@/lib/duration";
import { somoni } from "@/lib/format";
import type { ServiceRowData } from "@/server/catalog";
import { archiveService, saveService } from "./actions";
import s from "./services.module.css";

type Staff = { id: string; name: string };

export function ServiceRow({ service, staff, canEdit }: { service: ServiceRowData; staff: Staff[]; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <ServiceEditor initial={service} staff={staff} categoryId="" onDone={() => setEditing(false)} />;
  return (
    <div className={s.row}>
      <span className={s.name}>{service.name}</span>
      <span className={s.dur}>{duration(service.durationMin)}</span>
      <span className={s.price}>{somoni(service.price)}</span>
      <span className={s.tags}>
        {service.showOnSite && <span className={s.onSite}>на сайте</span>}
        {service.showInPos && <span className={s.inPos}>в кассе</span>}
      </span>
      {canEdit && (
        <button type="button" className={s.edit} onClick={() => setEditing(true)} aria-label={`Изменить: ${service.name}`}>
          Изменить
        </button>
      )}
    </div>
  );
}

export function NewService({ categoryId, staff }: { categoryId: string; staff: Staff[] }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className={s.add} onClick={() => setOpen(true)}>
        + Добавить услугу
      </button>
    );
  return (
    <ServiceEditor
      initial={{ id: "", name: "", durationMin: 60, price: 0, showOnSite: true, showInPos: false, staffIds: [] }}
      staff={staff}
      categoryId={categoryId}
      onDone={() => setOpen(false)}
    />
  );
}

function ServiceEditor({ initial, staff, categoryId, onDone }: { initial: ServiceRowData; staff: Staff[]; categoryId: string; onDone: () => void }) {
  const fx = useFx();
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await saveService({ ...f, id: f.id || undefined, categoryId });
      if (!res.ok) return setError(res.error);
      fx.toast(f.id ? `Сохранено: ${f.name}` : `Добавлена услуга: ${f.name}`, "Меню услуг");
      onDone();
      router.refresh();
    });

  const archive = () =>
    start(async () => {
      if (!confirm(`Убрать «${f.name}» из меню? История визитов сохранится.`)) return;
      await archiveService(f.id);
      fx.toast(`Убрано из меню: ${f.name}`, "Меню услуг");
      onDone();
      router.refresh();
    });

  return (
    <div className={s.editor}>
      <div className={s.editorGrid}>
        <label className={s.wide}>
          <span>Название</span>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </label>
        <label>
          <span>Минут</span>
          <input inputMode="numeric" value={f.durationMin || ""} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value.replace(/\D/g, "")) })} />
        </label>
        <label>
          <span>Цена, c.</span>
          <input inputMode="numeric" value={String(f.price)} onChange={(e) => setF({ ...f, price: Number(e.target.value.replace(/\D/g, "")) })} />
        </label>
      </div>
      <div className={s.checks}>
        <label>
          <input type="checkbox" checked={f.showOnSite} onChange={(e) => setF({ ...f, showOnSite: e.target.checked })} /> на сайте
        </label>
        <label>
          <input type="checkbox" checked={f.showInPos} onChange={(e) => setF({ ...f, showInPos: e.target.checked })} /> в быстром меню кассы
        </label>
      </div>
      <div className={s.checks}>
        <span className={s.checksLabel}>Мастера:</span>
        {staff.map((m) => (
          <label key={m.id}>
            <input
              type="checkbox"
              checked={f.staffIds.includes(m.id)}
              onChange={(e) => setF({ ...f, staffIds: e.target.checked ? [...f.staffIds, m.id] : f.staffIds.filter((x) => x !== m.id) })}
            />{" "}
            {m.name}
          </label>
        ))}
      </div>
      {error && (
        <div className={s.error} role="alert">
          {error}
        </div>
      )}
      <div className={s.editorActions}>
        {f.id && (
          <button type="button" className={s.archive} onClick={archive} disabled={pending}>
            Убрать из меню
          </button>
        )}
        <Button size="sm" variant="outline" onClick={onDone}>
          Отмена
        </Button>
        <Button size="sm" onClick={save} disabled={pending}>
          Сохранить
        </Button>
      </div>
    </div>
  );
}
