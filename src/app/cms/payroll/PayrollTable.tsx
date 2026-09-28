"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { somoni } from "@/lib/format";
import type { Payroll } from "@/server/payroll";
import { removeAdjustment, removePayout, saveAdjustment, savePayout, saveRate } from "./actions";
import s from "../money.module.css";

type Row = Payroll["rows"][number];
const bonusFines = (b: number, f: number) => [b ? `+${somoni(b)}` : "", f ? `−${somoni(f)}` : ""].filter(Boolean).join(" / ") || "—";
const signed = (n: number) => (n > 0 ? `+${somoni(n)}` : n < 0 ? `−${somoni(-n)}` : somoni(0));

export function PayrollTable({ payroll, editable }: { payroll: Payroll; editable: boolean }) {
  const [open, setOpen] = useState<string | null>(payroll.rows.length === 1 ? payroll.rows[0]!.staff.id : null);
  const t = payroll.totals;
  return (
    <div className={s.scroll}>
      <table className={s.table} aria-label="Зарплата мастеров">
        <thead>
          <tr>
            <th>Мастер</th>
            <th className={s.num}>Услуг</th>
            <th className={s.num}>Выручка</th>
            <th className={s.num}>Комиссия</th>
            <th className={s.num}>Оклад</th>
            <th className={s.num}>Премии / штрафы</th>
            <th className={s.num}>Начислено</th>
            <th className={s.num}>Выплачено</th>
            <th className={s.num}>К выплате</th>
          </tr>
        </thead>
        <tbody>
          {payroll.rows.map((r) => (
            <Fragment key={r.staff.id}>
              <tr data-staff={r.staff.name}>
                <td>
                  <button type="button" className={s.linkBtn} aria-expanded={open === r.staff.id} onClick={() => setOpen(open === r.staff.id ? null : r.staff.id)}>
                    {r.staff.name}
                  </button>
                  <small>
                    {r.staff.title} · {r.staff.commission}%
                  </small>
                </td>
                <td className={s.num}>{r.services}</td>
                <td className={s.num}>{somoni(r.revenue)}</td>
                <td className={s.num}>{somoni(r.pay.commission)}</td>
                <td className={s.num}>{somoni(r.staff.salary)}</td>
                <td className={s.num}>{bonusFines(r.pay.bonuses, r.pay.fines)}</td>
                <td className={`${s.num} ${s.money}`}>{somoni(r.pay.earned)}</td>
                <td className={s.num}>{somoni(r.pay.paid)}</td>
                <td className={`${s.num} ${s.money}`} data-testid="due">
                  {somoni(r.pay.due)}
                </td>
              </tr>
              {open === r.staff.id && (
                <tr>
                  <td colSpan={9} className={s.detail}>
                    <Detail row={r} month={payroll.month} editable={editable} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
        {payroll.rows.length > 1 && (
          <tfoot>
            <tr>
              <td>Итого</td>
              <td className={s.num}>{t.services}</td>
              <td className={s.num}>{somoni(t.revenue)}</td>
              <td className={s.num}>{somoni(t.commission)}</td>
              <td className={s.num}>{somoni(t.salary)}</td>
              <td className={s.num}>
                {bonusFines(t.bonuses, t.fines)}
              </td>
              <td className={s.num}>{somoni(t.earned)}</td>
              <td className={s.num}>{somoni(t.paid)}</td>
              <td className={s.num}>{somoni(t.due)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function useAction() {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText?: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return fx.toast(res.error ?? "Не получилось", "Зарплата");
      if (okText) fx.toast(okText, "Зарплата");
      after?.();
      router.refresh();
    });
  return { pending, run };
}

function Detail({ row, month, editable }: { row: Row; month: string; editable: boolean }) {
  const { pending, run } = useAction();
  const [pct, setPct] = useState(String(row.staff.commission));
  const [salary, setSalary] = useState(String(row.staff.salary));
  const [adj, setAdj] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [pay, setPay] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "CARD">("CASH");
  const [payNote, setPayNote] = useState("");
  const n = (v: string) => Number(v.replace(/[^\d-]/g, "")) || 0;
  return (
    <div className={s.detailGrid}>
      <div>
        <h4>Ставка</h4>
        <div className={s.entry}>
          <span>Процент от выручки</span>
          <b>{row.staff.commission}%</b>
        </div>
        <div className={s.entry}>
          <span>Оклад в месяц</span>
          <b>{somoni(row.staff.salary)}</b>
        </div>
        <div className={s.entry}>
          <span>
            Чеков <small>· услуг</small>
          </span>
          <span>
            {row.receipts} · {row.services}
          </span>
        </div>
        {editable && (
          <form
            className={s.inline}
            aria-label={`Ставка ${row.staff.name}`}
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveRate(row.staff.id, n(pct), n(salary)), `Ставка ${row.staff.name}: ${n(pct)}%`);
            }}
          >
            <input aria-label="Процент" inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, ""))} style={{ flexBasis: 56 }} />%
            <input aria-label="Оклад" inputMode="numeric" value={salary} onChange={(e) => setSalary(e.target.value.replace(/\D/g, ""))} />
            <button type="submit" disabled={pending}>
              Сохранить
            </button>
          </form>
        )}
      </div>

      <div>
        <h4>Премии и штрафы</h4>
        {row.adjustments.length === 0 && <div className={s.entry}>—</div>}
        {row.adjustments.map((a) => (
          <div key={a.id} className={s.entry}>
            <span>
              {a.note} <small>· {a.at}</small>
            </span>
            <span>
              <b className={a.amount < 0 ? s.diffMinus : s.diffPlus}>{signed(a.amount)}</b>
              {editable && (
                <button type="button" className={s.remove} aria-label="Удалить" onClick={() => run(() => removeAdjustment(a.id))}>
                  ×
                </button>
              )}
            </span>
          </div>
        ))}
        {editable && (
          <form
            className={s.inline}
            aria-label={`Премия или штраф ${row.staff.name}`}
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveAdjustment(row.staff.id, month, n(adj), adjNote), n(adj) > 0 ? "Премия добавлена" : "Штраф добавлен", () => {
                setAdj("");
                setAdjNote("");
              });
            }}
          >
            <input aria-label="Сумма премии или штрафа" placeholder="+500 или −200" value={adj} onChange={(e) => setAdj(e.target.value.replace(/[^\d−-]/g, "").replace("−", "-"))} style={{ flexBasis: 90 }} />
            <input aria-label="Причина" placeholder="Причина" value={adjNote} onChange={(e) => setAdjNote(e.target.value)} />
            <button type="submit" disabled={pending || !n(adj) || !adjNote.trim()}>
              Добавить
            </button>
          </form>
        )}
      </div>

      <div>
        <h4>Выплаты</h4>
        {row.payouts.length === 0 && <div className={s.entry}>Пока ничего не выплачено</div>}
        {row.payouts.map((p) => (
          <div key={p.id} className={s.entry}>
            <span>
              {p.at} <small>· {p.method === "CASH" ? "наличные из кассы" : "перевод"}{p.note ? ` · ${p.note}` : ""}</small>
            </span>
            <span>
              <b>{somoni(p.amount)}</b>
              {editable && (
                <button type="button" className={s.remove} aria-label="Отменить выплату" onClick={() => run(() => removePayout(p.id))}>
                  ×
                </button>
              )}
            </span>
          </div>
        ))}
        <div className={s.entry}>
          <span>Осталось выплатить</span>
          <b>{somoni(row.pay.due)}</b>
        </div>
        {editable && (
          <form
            className={s.inline}
            aria-label={`Выплата ${row.staff.name}`}
            onSubmit={(e) => {
              e.preventDefault();
              run(() => savePayout(row.staff.id, month, n(pay), payMethod, payNote), `Выплачено ${row.staff.name}: ${somoni(n(pay))}`, () => {
                setPay("");
                setPayNote("");
              });
            }}
          >
            <input aria-label="Сумма выплаты" inputMode="numeric" placeholder={row.pay.due > 0 ? String(row.pay.due) : "Сумма"} value={pay} onChange={(e) => setPay(e.target.value.replace(/\D/g, ""))} style={{ flexBasis: 90 }} />
            <select aria-label="Способ выплаты" value={payMethod} onChange={(e) => setPayMethod(e.target.value as "CASH" | "CARD")}>
              <option value="CASH">из кассы</option>
              <option value="CARD">переводом</option>
            </select>
            <input aria-label="Комментарий к выплате" placeholder="аванс / расчёт" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
            <button type="submit" disabled={pending || !n(pay)}>
              Выплатить
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
