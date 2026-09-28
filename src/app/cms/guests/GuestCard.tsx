"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, inputClass } from "@/components/ui/Field";
import { Tag } from "@/components/ui/Tag";
import { clock, shortDate, somoni } from "@/lib/format";
import { appointmentStatus, guestTag } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import type { GuestCardData } from "@/server/guests";
import { adjustPoints } from "../loyalty/actions";
import { saveGuest, type GuestForm } from "./actions";
import s from "./guests.module.css";

export function GuestCard({ guest, closeHref, isOwner }: { guest: GuestCardData; closeHref: string; isOwner: boolean }) {
  const fx = useFx();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<GuestForm>({
    id: guest.id,
    name: guest.name,
    phone: formatPhone(guest.phone),
    tag: guest.tag,
    birthday: guest.birthday,
    notes: guest.notes,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof GuestForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const tag = guestTag[guest.tag]!;
  const set = (k: keyof GuestForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    const res = await saveGuest(form);
    setSaving(false);
    if (!res.ok) return setErrors(res.errors);
    setErrors({});
    setEditing(false);
    fx.toast("Карточка гостьи сохранена", "Гостьи");
    router.refresh();
  }

  return (
    <section className={s.card} aria-label={`Карточка: ${guest.name}`}>
      <div className={s.cardHead}>
        <Avatar name={guest.name} size="lg" />
        <div className={s.cardWho}>
          <div className={s.cardName}>{guest.name}</div>
          <div className={s.cardSub}>
            {formatPhone(guest.phone)}
            {guest.birthday && ` · день рождения ${shortDate(new Date(`${guest.birthday}T12:00:00Z`))}`}
          </div>
        </div>
        <Tag tone={tag.tone}>{tag.label}</Tag>
        <Link href={closeHref} className={s.cardClose} aria-label="Закрыть карточку" scroll={false}>
          ×
        </Link>
      </div>

      <div className={s.cardStats}>
        <div>
          <span>Визитов</span>
          <b>{guest.visits}</b>
        </div>
        <div>
          <span>Потрачено</span>
          <b>{somoni(guest.spent)}</b>
        </div>
        <div>
          <span>Средний чек</span>
          <b>{somoni(guest.averageCheck)}</b>
        </div>
        <div>
          <span>Любимая услуга</span>
          <b className={s.small}>{guest.favourite ?? "—"}</b>
        </div>
      </div>

      {guest.bonus.enabled && <BonusBlock guest={guest} isOwner={isOwner} />}

      {editing ? (
        <div className={s.editGrid}>
          <Field label="Имя и фамилия" value={form.name} onChange={set("name")} error={errors.name} />
          <Field label="Телефон" value={form.phone} onChange={set("phone")} error={errors.phone} inputMode="tel" />
          <label className={s.fieldLike}>
            <span>Статус</span>
            <select className={inputClass} value={form.tag} onChange={set("tag")}>
              {Object.entries(guestTag).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="День рождения" type="date" value={form.birthday} onChange={set("birthday")} error={errors.birthday} />
          <div className={s.full}>
            <TextArea label="Заметки" hint="(аллергии, предпочтения, формулы окрашивания)" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
          <div className={s.editActions}>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Отмена
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </div>
      ) : (
        <div className={s.notes}>
          <span>Заметки</span>
          <p>{guest.notes || "Пока нет заметок."}</p>
          <button type="button" className={s.linkBtn} onClick={() => setEditing(true)}>
            Изменить карточку
          </button>
        </div>
      )}

      <div className={s.history}>
        {guest.upcoming.length > 0 && (
          <>
            <div className={s.histTitle}>Впереди</div>
            {guest.upcoming.map((a) => (
              <HistoryRow key={a.id} a={a} />
            ))}
          </>
        )}
        <div className={s.histTitle}>История визитов</div>
        {guest.history.length === 0 && <div className={s.cardSub}>Визитов пока не было.</div>}
        {guest.history.map((a) => (
          <HistoryRow key={a.id} a={a} />
        ))}
      </div>
    </section>
  );
}

const BONUS_KIND: Record<string, string> = { EARN: "за визит", SPEND: "оплата бонусами", BIRTHDAY: "день рождения", WELCOME: "приветственные", MANUAL: "вручную" };

function BonusBlock({ guest, isOwner }: { guest: GuestCardData; isOwner: boolean }) {
  const fx = useFx();
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const b = guest.bonus;
  return (
    <div className={s.bonus} aria-label="Бонусы">
      <div className={s.bonusHead}>
        <span>Бонусы</span>
        <b>{b.balance}</b>
        <small>
          {b.tier.name} · {b.tier.percent}%{b.next ? ` · до «${b.next.name}» ${somoni(b.next.remaining)}` : ""}
        </small>
      </div>
      {b.history.length > 0 && (
        <div className={s.bonusHistory}>
          {b.history.slice(0, 5).map((h) => (
            <div key={h.id}>
              <span>
                {shortDate(new Date(h.at))} · {BONUS_KIND[h.kind] ?? h.kind}
                {h.receipt ? ` · чек №${h.receipt}` : ""}
                {h.note ? ` · ${h.note}` : ""}
              </span>
              <b className={h.delta < 0 ? s.minus : ""}>{h.delta > 0 ? `+${h.delta}` : h.delta}</b>
            </div>
          ))}
        </div>
      )}
      {isOwner && (
        <form
          className={s.bonusAdjust}
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await adjustPoints(guest.id, Number(delta), note);
              if (!res.ok) return fx.toast(res.error ?? "Не получилось", "Бонусы");
              fx.toast(`Бонусы: ${Number(delta) > 0 ? "+" : ""}${delta}`, "Бонусы");
              setDelta("");
              setNote("");
              router.refresh();
            });
          }}
        >
          <input aria-label="Бонусы вручную" placeholder="+100 или −50" value={delta} onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ""))} />
          <input aria-label="Причина" placeholder="Причина" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="submit" disabled={pending || !Number(delta)}>
            Начислить
          </button>
        </form>
      )}
    </div>
  );
}

function HistoryRow({ a }: { a: GuestCardData["history"][number] }) {
  const st = appointmentStatus[a.status]!;
  return (
    <Link href={`/cms/calendar?appt=${a.id}`} className={s.histRow}>
      <span className={s.histDate}>
        {shortDate(a.startsAt)}, {clock(a.startsAt)}
      </span>
      <span className={s.histMain}>
        {a.service} · {a.staff}
      </span>
      <span className={s.histPrice}>{somoni(a.price)}</span>
      <Tag tone={st.tone}>{st.label}</Tag>
    </Link>
  );
}
