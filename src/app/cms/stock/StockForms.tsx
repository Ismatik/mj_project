"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { qty } from "@/lib/stock";
import type { StockPage } from "@/server/stock";
import { doStock, saveServiceNorms, saveStockItem } from "./actions";
import s from "../money.module.css";

type Item = StockPage["items"][number];
const digits = (v: string) => v.replace(/\D/g, "");

function useRun(title = "Склад") {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return fx.toast(res.error ?? "Не получилось", title);
      fx.toast(ok, title);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

const ACTIONS = { RECEIPT: "Приход", WASTE: "Списать", COUNT: "Пересчёт" } as const;

/** Delivery, waste or stocktake for one item */
export function ItemActions({ item }: { item: Item }) {
  const { pending, run } = useRun();
  const [action, setAction] = useState<keyof typeof ACTIONS | null>(null);
  const [amount, setAmount] = useState("");
  const [packs, setPacks] = useState(false);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  if (editing) return <ItemForm item={item} onDone={() => setEditing(false)} />;
  if (!action)
    return (
      <div className={s.inline} style={{ marginTop: 0, justifyContent: "flex-end" }}>
        {(Object.keys(ACTIONS) as (keyof typeof ACTIONS)[]).map((a) => (
          <button key={a} type="button" onClick={() => setAction(a)} aria-label={`${ACTIONS[a]}: ${item.name}`}>
            {ACTIONS[a]}
          </button>
        ))}
        <button type="button" className={s.linkBtn} style={{ background: "none", border: "none", color: "var(--mj-gold-deep)" }} onClick={() => setEditing(true)}>
          Изменить
        </button>
      </div>
    );
  const units = packs && action === "RECEIPT" ? Number(amount || 0) * item.packSize : Number(amount || 0);
  return (
    <form
      className={s.inline}
      style={{ marginTop: 0 }}
      aria-label={`${ACTIONS[action]}: ${item.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => doStock(item.id, action, units, note), `${item.name}: ${ACTIONS[action].toLowerCase()} ${qty(units, item.unit)}`, () => (setAction(null), setAmount(""), setNote("")));
      }}
    >
      <input aria-label="Количество" inputMode="numeric" placeholder={action === "COUNT" ? `по факту, ${item.unit}` : item.unit} value={amount} onChange={(e) => setAmount(digits(e.target.value))} style={{ flexBasis: 90 }} />
      {action === "RECEIPT" && item.packSize > 1 && (
        <select aria-label="Единица прихода" value={packs ? "packs" : "units"} onChange={(e) => setPacks(e.target.value === "packs")}>
          <option value="units">{item.unit}</option>
          <option value="packs">уп. по {qty(item.packSize, item.unit)}</option>
        </select>
      )}
      <input aria-label="Комментарий" placeholder={action === "WASTE" ? "Причина" : "Комментарий"} value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="submit" disabled={pending || amount === ""}>
        {ACTIONS[action]}
      </button>
      <button type="button" className={s.remove} onClick={() => setAction(null)} aria-label="Отмена">
        ×
      </button>
    </form>
  );
}

/** New item or editing one */
export function ItemForm({ item, onDone }: { item?: Item; onDone?: () => void }) {
  const { pending, run } = useRun();
  const [f, setF] = useState({
    name: item?.name ?? "",
    unit: item?.unit ?? "мл",
    category: item?.category ?? "Расходники",
    minQuantity: String(item?.minQuantity ?? ""),
    packSize: String(item?.packSize ?? "1"),
    packPrice: String(item?.packPrice ?? ""),
    supplier: item?.supplier ?? "",
    quantity: "",
    active: item?.active ?? true,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className={s.form}
      aria-label={item ? `Позиция ${item.name}` : "Новая позиция"}
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            saveStockItem({
              id: item?.id,
              name: f.name,
              unit: f.unit,
              category: f.category,
              minQuantity: Number(f.minQuantity || 0),
              packSize: Number(f.packSize || 1),
              packPrice: Number(f.packPrice || 0),
              supplier: f.supplier,
              quantity: Number(f.quantity || 0),
              active: f.active,
            }),
          item ? "Сохранено" : `Добавлено: ${f.name}`,
          () => {
            if (!item) setF({ ...f, name: "", quantity: "", packPrice: "", minQuantity: "" });
            onDone?.();
          },
        );
      }}
    >
      <label>
        Название
        <input name="name" value={f.name} onChange={set("name")} placeholder="Краситель Igora Royal 6-0" />
      </label>
      <div className={s.two}>
        <label>
          Категория
          <input name="category" value={f.category} onChange={set("category")} list="stock-cats" />
        </label>
        <label>
          Единица
          <select name="unit" value={f.unit} onChange={set("unit")}>
            <option value="мл">мл</option>
            <option value="г">г</option>
            <option value="шт">шт</option>
          </select>
        </label>
      </div>
      <div className={s.two}>
        <label>
          В упаковке, {f.unit}
          <input name="packSize" inputMode="numeric" value={f.packSize} onChange={(e) => setF({ ...f, packSize: digits(e.target.value) })} />
        </label>
        <label>
          Цена упаковки, c.
          <input name="packPrice" inputMode="numeric" value={f.packPrice} onChange={(e) => setF({ ...f, packPrice: digits(e.target.value) })} />
        </label>
      </div>
      <div className={s.two}>
        <label>
          Минимум, {f.unit} <small>ниже - предупредим</small>
          <input name="minQuantity" inputMode="numeric" value={f.minQuantity} onChange={(e) => setF({ ...f, minQuantity: digits(e.target.value) })} />
        </label>
        {item ? (
          <label>
            Поставщик
            <input name="supplier" value={f.supplier} onChange={set("supplier")} />
          </label>
        ) : (
          <label>
            Сейчас на складе, {f.unit}
            <input name="quantity" inputMode="numeric" value={f.quantity} onChange={(e) => setF({ ...f, quantity: digits(e.target.value) })} />
          </label>
        )}
      </div>
      {!item && (
        <label>
          Поставщик <small>необязательно</small>
          <input name="supplier" value={f.supplier} onChange={set("supplier")} />
        </label>
      )}
      {item && (
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Используется
        </label>
      )}
      <div className={s.inline}>
        <Button type="submit" size="sm" disabled={pending || f.name.trim().length < 2}>
          {item ? "Сохранить" : "Добавить позицию"}
        </Button>
        {onDone && (
          <button type="button" className={s.linkBtn} style={{ background: "none", border: "none", color: "var(--mj-gold-deep)" }} onClick={onDone}>
            Отмена
          </button>
        )}
      </div>
    </form>
  );
}

/** What one service uses, written off at payment */
export function NormsEditor({ services, items }: { services: StockPage["services"]; items: StockPage["items"] }) {
  const { pending, run } = useRun();
  const [serviceId, setServiceId] = useState("");
  const [rows, setRows] = useState<{ itemId: string; amount: string }[]>([]);
  const active = items.filter((i) => i.active);
  const pick = (id: string) => {
    setServiceId(id);
    setRows((services.find((x) => x.id === id)?.norms ?? []).map((n) => ({ itemId: n.itemId, amount: String(n.amount) })));
  };
  return (
    <div className={s.form} role="group" aria-label="Расход на услуги">
      <label>
        Услуга
        <select name="normService" value={serviceId} onChange={(e) => pick(e.target.value)}>
          <option value="">- выберите -</option>
          {services.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
              {x.norms.length ? ` · ${x.norms.length}` : ""}
            </option>
          ))}
        </select>
      </label>
      {serviceId && (
        <>
          {rows.map((r, i) => {
            const unit = active.find((x) => x.id === r.itemId)?.unit ?? "";
            return (
              <div key={i} className={s.inline} style={{ marginTop: 0 }}>
                <select aria-label="Позиция" value={r.itemId} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, itemId: e.target.value } : x)))}>
                  <option value="">-</option>
                  {active.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </select>
                <input aria-label="Расход" inputMode="numeric" value={r.amount} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, amount: digits(e.target.value) } : x)))} style={{ flexBasis: 70 }} />
                <span>{unit}</span>
                <button type="button" className={s.remove} aria-label="Убрать" onClick={() => setRows(rows.filter((_, k) => k !== i))}>
                  ×
                </button>
              </div>
            );
          })}
          <div className={s.inline}>
            <button type="button" className={s.linkBtn} style={{ background: "none", border: "none", color: "var(--mj-gold-deep)" }} onClick={() => setRows([...rows, { itemId: "", amount: "" }])}>
              + позиция
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => saveServiceNorms(serviceId, rows.filter((r) => r.itemId).map((r) => ({ itemId: r.itemId, amount: Number(r.amount || 0) }))), "Расход сохранён")}
            >
              Сохранить расход
            </button>
          </div>
        </>
      )}
    </div>
  );
}
