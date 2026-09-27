"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { clock, somoni } from "@/lib/format";
import { paymentMethod } from "@/lib/labels";
import type { PosData } from "@/server/pos";
import { paySale, type PayInput } from "./actions";
import s from "./pos.module.css";

type Line = { key: string; serviceId: string; name: string; price: number; appointmentId?: string };
type Who = { guestId: string | null; guestName: string | null; staffId: string | null };

const METHODS: { key: PayInput["method"]; cls: string }[] = [
  { key: "CASH", cls: s.payInk },
  { key: "CARD", cls: s.payGold },
  { key: "QR", cls: s.payOutline },
];

export function PosScreen({ data, initialAppt }: { data: PosData; initialAppt?: string }) {
  const fx = useFx();
  const router = useRouter();
  const nextKey = useRef(0);
  const newKey = () => `l${nextKey.current++}`;

  const fromAppt = (id: string | undefined) => data.waiting.find((a) => a.id === id && a.serviceId);
  const first = fromAppt(initialAppt);
  const [lines, setLines] = useState<Line[]>(() =>
    first ? [{ key: first.id, serviceId: first.serviceId!, name: first.service, price: first.price, appointmentId: first.id }] : [],
  );
  const [who, setWho] = useState<Who>(() => ({ guestId: first?.guestId ?? null, guestName: first?.guestName ?? null, staffId: first?.staffId ?? null }));
  const [paying, setPaying] = useState(false);

  const total = lines.reduce((sum, l) => sum + l.price, 0);
  const inCheck = new Set(lines.map((l) => l.appointmentId).filter(Boolean));

  function addService(id: string, name: string, price: number) {
    setLines((ls) => [...ls, { key: newKey(), serviceId: id, name, price }]);
    fx.toast(`В чек: ${name}`, "Касса");
  }

  function addAppointment(id: string) {
    const a = fromAppt(id);
    if (!a || inCheck.has(a.id)) return;
    setLines((ls) => [...ls, { key: a.id, serviceId: a.serviceId!, name: a.service, price: a.price, appointmentId: a.id }]);
    setWho((w) => ({ guestId: w.guestId ?? a.guestId, guestName: w.guestName ?? a.guestName, staffId: w.staffId ?? a.staffId }));
  }

  function clear() {
    setLines([]);
    setWho({ guestId: null, guestName: null, staffId: null });
  }

  async function pay(method: PayInput["method"], button: HTMLElement) {
    if (!lines.length) {
      fx.toast("Добавьте услугу в чек", "Касса");
      return;
    }
    setPaying(true);
    const label = `Проводим оплату · ${paymentMethod[method]}`;
    fx.showLoader(label);
    try {
      // The loader stays at least 1.7 s, as in the prototype
      const [res] = await Promise.all([
        paySale({
          method,
          guestId: who.guestId,
          staffId: who.staffId,
          lines: lines.map((l) => ({ serviceId: l.serviceId, appointmentId: l.appointmentId ?? null })),
        }),
        new Promise((r) => setTimeout(r, 1700)),
      ]);
      fx.hideLoader();
      if (!res.ok) {
        fx.toast(res.error, "Касса");
        return;
      }
      clear();
      fx.sparkle(button);
      fx.toast(`${res.message} · чек №${res.number}`, "Касса");
      router.refresh();
    } catch {
      fx.hideLoader();
      fx.toast("Оплата не прошла — проверьте соединение", "Касса");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className={s.layout}>
      <section id="check" className={s.check} aria-label="Текущий чек">
        <h1 className={s.checkTitle}>Текущий чек</h1>
        <div className={s.who}>
          <label>
            Гостья:{" "}
            <select
              value={who.guestId ?? ""}
              onChange={(e) => {
                const a = data.waiting.find((x) => x.guestId === e.target.value);
                setWho((w) => ({ ...w, guestId: e.target.value || null, guestName: a?.guestName ?? null }));
              }}
            >
              <option value="">без записи</option>
              {[...new Map(data.waiting.filter((a) => a.guestId).map((a) => [a.guestId, a])).values()].map((a) => (
                <option key={a.guestId} value={a.guestId!}>
                  {a.guestName}
                </option>
              ))}
            </select>
          </label>
          <label>
            · мастер{" "}
            <select value={who.staffId ?? ""} onChange={(e) => setWho((w) => ({ ...w, staffId: e.target.value || null }))}>
              <option value="">—</option>
              {data.staff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={s.lines}>
          {lines.map((l) => (
            <div key={l.key} className={s.line}>
              <span className={s.lineName}>
                {l.name}
                {l.appointmentId && <small> · по записи</small>}
              </span>
              <span className={s.lineRight}>
                <span className={s.linePrice}>{somoni(l.price)}</span>
                <button type="button" className={s.remove} title="Убрать" aria-label={`Убрать ${l.name}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                  ×
                </button>
              </span>
            </div>
          ))}
          {lines.length === 0 && (
            <div className={s.empty}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--mj-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                <path d="M16 8h-6" />
                <path d="M16 12h-6" />
              </svg>
              <div className={s.emptyTitle}>Чек пока пуст</div>
              <div className={s.emptyText}>Выберите услуги в быстром меню справа — они появятся здесь.</div>
            </div>
          )}
        </div>

        <div className={s.total}>
          <span className={s.totalLabel}>Итого</span>
          <span className={s.totalValue}>{somoni(total)}</span>
        </div>
        <div className={s.pay}>
          {METHODS.map((m) => (
            <button key={m.key} type="button" className={`${s.payBtn} ${m.cls}`} disabled={paying} onClick={(e) => pay(m.key, e.currentTarget)}>
              {paymentMethod[m.key]}
            </button>
          ))}
        </div>
        {lines.length > 0 && (
          <button type="button" className={s.clear} onClick={clear}>
            Очистить чек
          </button>
        )}
      </section>

      {lines.length > 0 && (
        <a href="#check" className={s.mobileBar}>
          <span>
            Чек · {lines.length} · <b>{somoni(total)}</b>
          </span>
          <span>К оплате ↓</span>
        </a>
      )}

      <section className={s.right}>
        <h2 className={s.menuTitle}>Быстрое меню</h2>
        <div className={s.menu}>
          {data.menu.map((p) => (
            <button key={p.id} type="button" className={s.menuItem} onClick={() => addService(p.id, p.name, p.price)}>
              <div className={s.menuName}>{p.name}</div>
              <div className={s.menuPrice}>{somoni(p.price)}</div>
            </button>
          ))}
        </div>

        <h2 className={s.subTitle}>Ждут оплаты сегодня</h2>
        {data.waiting.length === 0 && <div className={s.muted}>Все записи на сегодня оплачены.</div>}
        <div className={s.waiting}>
          {data.waiting.map((a) => (
            <button key={a.id} type="button" className={s.waitItem} disabled={!a.serviceId || inCheck.has(a.id)} onClick={() => addAppointment(a.id)}>
              <span className={s.waitTime}>{clock(a.startsAt)}</span>
              <span className={s.waitMain}>
                <b>{a.guestName}</b> · {a.service}
                <small>мастер {a.staffNames}</small>
              </span>
              <span className={s.waitPrice}>{inCheck.has(a.id) ? "в чеке" : somoni(a.price)}</span>
            </button>
          ))}
        </div>

        <h2 className={s.subTitle}>Чеки сегодня</h2>
        {data.recent.length === 0 && <div className={s.muted}>Сегодня ещё не было оплат.</div>}
        <div className={s.receipts}>
          {data.recent.map((r) => (
            <div key={r.id} className={s.receipt}>
              <span className={s.receiptNo}>№{r.number}</span>
              <span className={s.receiptMain}>
                {r.items.join(", ")}
                <small>
                  {clock(r.createdAt)} · {paymentMethod[r.method]}
                  {r.guest ? ` · ${r.guest}` : ""}
                  {r.staff ? ` · ${r.staff}` : ""}
                </small>
              </span>
              <span className={s.receiptTotal}>{somoni(r.total)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
