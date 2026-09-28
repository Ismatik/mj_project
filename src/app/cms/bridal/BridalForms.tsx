"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import type { BridalRules } from "@/lib/bridal";
import { bridalRules, packageStatus } from "./actions";
import s from "../money.module.css";

function useRun() {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return fx.toast(res.error ?? "Не получилось", "Свадьбы");
      fx.toast(ok, "Свадьбы");
      router.refresh();
    });
  return { pending, run };
}

export function PackageActions({ id, number, status }: { id: string; number: number; status: string }) {
  const { pending, run } = useRun();
  return (
    <div className={s.inline} style={{ marginTop: 6 }}>
      {status === "NEW" && (
        <button type="button" disabled={pending} onClick={() => run(() => packageStatus(id, "CONFIRMED"), `Пакет №${number} подтверждён`)}>
          Подтвердить
        </button>
      )}
      {status === "CONFIRMED" && (
        <button type="button" disabled={pending} onClick={() => run(() => packageStatus(id, "DONE"), `Пакет №${number} выполнен`)}>
          Свадьба прошла
        </button>
      )}
      {status !== "CANCELLED" && status !== "DONE" && (
        <button
          type="button"
          className={s.linkBtn}
          style={{ background: "none", border: "none", color: "var(--mj-gold-deep)" }}
          disabled={pending}
          onClick={() => confirm(`Отменить пакет №${number}? Платье освободится.`) && run(() => packageStatus(id, "CANCELLED"), `Пакет №${number} отменён`)}
        >
          Отменить
        </button>
      )}
    </div>
  );
}

export function RulesForm({ rules, services, owner }: { rules: BridalRules; services: { id: string; name: string }[]; owner: boolean }) {
  const { pending, run } = useRun();
  const [f, setF] = useState({ discountPercent: String(rules.discountPercent), minServices: String(rules.minServices), dressDays: String(rules.dressDays), trialServiceId: rules.trialServiceId ?? "" });
  const d = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value.replace(/\D/g, "") });
  return (
    <form
      className={s.form}
      aria-label="Условия пакета"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => bridalRules({ discountPercent: Number(f.discountPercent), minServices: Number(f.minServices), dressDays: Number(f.dressDays), trialServiceId: f.trialServiceId || null }), "Условия сохранены");
      }}
    >
      <div className={s.two}>
        <label>
          Скидка на услуги, %
          <input name="discountPercent" inputMode="numeric" disabled={!owner} value={f.discountPercent} onChange={d("discountPercent")} />
        </label>
        <label>
          От скольких услуг
          <input name="minServices" inputMode="numeric" disabled={!owner} value={f.minServices} onChange={d("minServices")} />
        </label>
      </div>
      <div className={s.two}>
        <label>
          Прокат платья, суток
          <input name="dressDays" inputMode="numeric" disabled={!owner} value={f.dressDays} onChange={d("dressDays")} />
        </label>
        <label>
          Пробный образ
          <select name="trialService" disabled={!owner} value={f.trialServiceId} onChange={(e) => setF({ ...f, trialServiceId: e.target.value })}>
            <option value="">не предлагать</option>
            {services.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {owner && (
        <Button type="submit" size="sm" disabled={pending}>
          Сохранить условия
        </Button>
      )}
    </form>
  );
}
