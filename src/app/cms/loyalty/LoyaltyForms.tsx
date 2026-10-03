"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { shortDate, somoni } from "@/lib/format";
import { TIER_NAME, type BonusRules } from "@/lib/loyalty";
import { addDays } from "@/lib/time";
import type { PromotionForm } from "@/server/loyalty/admin";
import { savePromotion, saveRules } from "./actions";
import s from "./loyalty.module.css";

const num = (v: string) => Number(v.replace(/\D/g, "")) || 0;

export function RulesForm({ initial }: { initial: BonusRules }) {
  const fx = useFx();
  const [r, setR] = useState(initial);
  const [pending, start] = useTransition();
  const setTier = (i: number, patch: Partial<BonusRules["tiers"][number]>) => setR({ ...r, tiers: r.tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)) });
  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveRules(r);
          if (!res.ok) return fx.toast(res.error, "Бонусы");
          setR(res.rules);
          fx.toast("Правила бонусной программы сохранены", "Бонусы");
        });
      }}
    >
      <label className={s.check}>
        <input type="checkbox" checked={r.enabled} onChange={(e) => setR({ ...r, enabled: e.target.checked })} /> Бонусная программа включена
      </label>
      <div className={s.tiers}>
        <div className={s.tierHead}>
          <span>Уровень</span>
          <span>От суммы за 12 мес.</span>
          <span>Начисление</span>
        </div>
        {r.tiers.map((t, i) => (
          <div key={t.key} className={s.tier}>
            <b>{TIER_NAME[t.key].ru}</b>
            {i === 0 ? (
              <span className={s.muted}>с первого визита</span>
            ) : (
              <input aria-label={`${TIER_NAME[t.key].ru}: от суммы`} inputMode="numeric" value={String(t.from)} onChange={(e) => setTier(i, { from: num(e.target.value) })} />
            )}
            <span className={s.pct}>
              <input aria-label={`${TIER_NAME[t.key].ru}: процент`} inputMode="numeric" value={String(t.percent)} onChange={(e) => setTier(i, { percent: num(e.target.value) })} /> %
            </span>
          </div>
        ))}
      </div>
      <div className={s.two}>
        <label>
          Бонусами можно оплатить до, %
          <input aria-label="Оплата бонусами, %" inputMode="numeric" value={String(r.maxSpendPercent)} onChange={(e) => setR({ ...r, maxSpendPercent: num(e.target.value) })} />
        </label>
        <label>
          Подарок ко дню рождения, бонусов
          <input aria-label="Бонусы ко дню рождения" inputMode="numeric" value={String(r.birthdayPoints)} onChange={(e) => setR({ ...r, birthdayPoints: num(e.target.value) })} />
        </label>
        <label>
          Приветственные бонусы за первый визит
          <input aria-label="Приветственные бонусы" inputMode="numeric" value={String(r.welcomePoints)} onChange={(e) => setR({ ...r, welcomePoints: num(e.target.value) })} />
        </label>
      </div>
      <p className={s.muted}>
        Бонусы начисляются с денег, реально оплаченных гостьей (наличные, карта, QR, онлайн-предоплата) - не с оплаты бонусами и сертификатом. Поздравление с днём
        рождения уходит утром вместе с бонусами (шаблон - в «Шаблонах сообщений»).
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Сохраняем…" : "Сохранить правила"}
      </Button>
    </form>
  );
}

const EMPTY: Omit<PromotionForm, "id" | "usedCount"> = {
  title: "",
  titleTg: "",
  titleEn: "",
  description: "",
  descriptionTg: "",
  descriptionEn: "",
  kind: "PERCENT",
  value: 10,
  serviceIds: [],
  startsOn: "",
  endsOn: "",
  code: "",
  active: true,
  showOnSite: true,
  usageLimit: null,
};

/** A new promotion runs for two weeks from the salon's today (given by the server) */
export function Promotions({ promotions, services, today }: { promotions: PromotionForm[]; services: { id: string; name: string }[]; today: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const name = new Map(services.map((x) => [x.id, x.name]));
  return (
    <div className={s.promos}>
      {editing === "new" ? (
        <PromotionEditor initial={{ ...EMPTY, startsOn: today, endsOn: addDays(today, 13) }} services={services} onDone={() => setEditing(null)} />
      ) : (
        <button type="button" className={s.add} onClick={() => setEditing("new")}>
          + Новая акция или промокод
        </button>
      )}
      {promotions.map((p) =>
        editing === p.id ? (
          <PromotionEditor key={p.id} initial={p} services={services} onDone={() => setEditing(null)} />
        ) : (
          <article key={p.id} className={`${s.promo} ${p.active ? "" : s.off}`} aria-label={`Акция ${p.title}`}>
            <div className={s.promoValue}>{p.kind === "PERCENT" ? `−${p.value}%` : `−${somoni(p.value)}`}</div>
            <div className={s.promoMain}>
              <b>{p.title}</b>
              <small>
                {shortDate(new Date(`${p.startsOn}T07:00:00Z`))} - {shortDate(new Date(`${p.endsOn}T07:00:00Z`))} ·{" "}
                {p.serviceIds.length ? p.serviceIds.map((id) => name.get(id)).filter(Boolean).join(", ") : "все услуги"}
              </small>
              <small>
                {p.code ? `промокод ${p.code}` : "автоматически"} · использовано {p.usedCount}
                {p.usageLimit ? ` из ${p.usageLimit}` : ""}
                {p.showOnSite ? " · на сайте" : ""}
                {p.active ? "" : " · выключена"}
              </small>
            </div>
            <button type="button" className={s.edit} onClick={() => setEditing(p.id)}>
              Изменить
            </button>
          </article>
        ),
      )}
    </div>
  );
}

type Editable = Omit<PromotionForm, "usedCount" | "id"> & { id?: string };

function PromotionEditor({ initial, services, onDone }: { initial: Editable; services: { id: string; name: string }[]; onDone: () => void }) {
  const fx = useFx();
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [error, setError] = useState("");
  const [lang, setLang] = useState<"ru" | "tg" | "en">("ru");
  const [pending, start] = useTransition();
  const titleKey = lang === "ru" ? "title" : lang === "tg" ? "titleTg" : "titleEn";
  const descKey = lang === "ru" ? "description" : lang === "tg" ? "descriptionTg" : "descriptionEn";
  return (
    <form
      className={`${s.form} ${s.editor}`}
      aria-label="Акция"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const res = await savePromotion(f);
          if (!res.ok) return setError(res.error);
          fx.toast(`Сохранено: ${f.title}`, "Акции");
          onDone();
          router.refresh();
        });
      }}
    >
      <div className={s.langs} role="tablist" aria-label="Язык текста">
        {(["ru", "tg", "en"] as const).map((l) => (
          <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)}>
            {l === "ru" ? "Русский" : l === "tg" ? "Тоҷикӣ" : "English"}
          </button>
        ))}
      </div>
      <label>
        Название{lang !== "ru" && <small> (пусто - по-русски)</small>}
        <input name="title" value={f[titleKey]} onChange={(e) => setF({ ...f, [titleKey]: e.target.value })} />
      </label>
      <label>
        Описание для сайта
        <textarea name="description" rows={2} value={f[descKey]} onChange={(e) => setF({ ...f, [descKey]: e.target.value })} />
      </label>
      <div className={s.two}>
        <label>
          Скидка
          <span className={s.valueRow}>
            <input name="value" inputMode="numeric" value={String(f.value)} onChange={(e) => setF({ ...f, value: num(e.target.value) })} />
            <select aria-label="Тип скидки" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as "PERCENT" | "FIXED" })}>
              <option value="PERCENT">%</option>
              <option value="FIXED">сомони</option>
            </select>
          </span>
        </label>
        <label>
          Промокод <small>пусто - акция применяется сама</small>
          <input name="code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
        </label>
        <label>
          С
          <input type="date" name="startsOn" value={f.startsOn} onChange={(e) => setF({ ...f, startsOn: e.target.value })} />
        </label>
        <label>
          По
          <input type="date" name="endsOn" value={f.endsOn} onChange={(e) => setF({ ...f, endsOn: e.target.value })} />
        </label>
        <label>
          Лимит использований <small>необязательно</small>
          <input name="limit" inputMode="numeric" value={f.usageLimit ? String(f.usageLimit) : ""} onChange={(e) => setF({ ...f, usageLimit: num(e.target.value) || null })} />
        </label>
      </div>
      <fieldset className={s.services}>
        <legend>Услуги (ничего не отмечено - все)</legend>
        {services.map((sv) => (
          <label key={sv.id} className={s.check}>
            <input
              type="checkbox"
              checked={f.serviceIds.includes(sv.id)}
              onChange={(e) => setF({ ...f, serviceIds: e.target.checked ? [...f.serviceIds, sv.id] : f.serviceIds.filter((x) => x !== sv.id) })}
            />{" "}
            {sv.name}
          </label>
        ))}
      </fieldset>
      <div className={s.checks}>
        <label className={s.check}>
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Включена
        </label>
        <label className={s.check}>
          <input type="checkbox" checked={f.showOnSite} onChange={(e) => setF({ ...f, showOnSite: e.target.checked })} /> Показывать на сайте
        </label>
      </div>
      {error && (
        <div role="alert" className={s.error}>
          {error}
        </div>
      )}
      <div className={s.actions}>
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняем…" : "Сохранить акцию"}
        </Button>
        <button type="button" className={s.linkBtn} onClick={onDone}>
          Отмена
        </button>
      </div>
    </form>
  );
}
