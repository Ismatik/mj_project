"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { clock, somoni } from "@/lib/format";
import { paymentMethod } from "@/lib/labels";
import type { PosData } from "@/server/pos";
import { settle } from "@/lib/money";
import { checkGift, paySale, type PayInput } from "./actions";
import s from "./pos.module.css";

type Line = { key: string; serviceId: string; name: string; price: number; appointmentId?: string; depositPaid?: number };
type Gift = { code: string; balance: number; recipientName: string };
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
    first ? [{ key: first.id, serviceId: first.serviceId!, name: first.service, price: first.price, appointmentId: first.id, depositPaid: first.depositPaid }] : [],
  );
  const [who, setWho] = useState<Who>(() => ({ guestId: first?.guestId ?? null, guestName: first?.guestName ?? null, staffId: first?.staffId ?? null }));
  const [paying, setPaying] = useState(false);
  const [gift, setGift] = useState<Gift | null>(null);
  const [giftInput, setGiftInput] = useState("");
  const [giftError, setGiftError] = useState("");
  const [checking, setChecking] = useState(false);

  const total = lines.reduce((sum, l) => sum + l.price, 0);
  const split = settle(total, lines.reduce((sum, l) => sum + (l.depositPaid ?? 0), 0), gift?.balance ?? 0, gift?.balance ?? 0);
  const inCheck = new Set(lines.map((l) => l.appointmentId).filter(Boolean));

  function addService(id: string, name: string, price: number) {
    setLines((ls) => [...ls, { key: newKey(), serviceId: id, name, price }]);
    fx.toast(`В чек: ${name}`, "Касса");
  }

  function addAppointment(id: string) {
    const a = fromAppt(id);
    if (!a || inCheck.has(a.id)) return;
    setLines((ls) => [...ls, { key: a.id, serviceId: a.serviceId!, name: a.service, price: a.price, appointmentId: a.id, depositPaid: a.depositPaid }]);
    setWho((w) => ({ guestId: w.guestId ?? a.guestId, guestName: w.guestName ?? a.guestName, staffId: w.staffId ?? a.staffId }));
  }

  function clear() {
    setLines([]);
    setWho({ guestId: null, guestName: null, staffId: null });
    setGift(null);
    setGiftInput("");
    setGiftError("");
  }

  async function applyGift() {
    setGiftError("");
    setChecking(true);
    const res = await checkGift(giftInput);
    setChecking(false);
    if (!res.ok) return setGiftError(res.error);
    setGift({ code: res.code, balance: res.balance, recipientName: res.recipientName });
    fx.toast(`Сертификат ${res.code}: доступно ${somoni(res.balance)}`, "Касса");
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
          giftCode: gift?.code ?? null,
          giftAmount: split.gift,
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
                {!!l.depositPaid && <small className={s.deposit}>предоплата онлайн {somoni(l.depositPaid)}</small>}
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

        <div className={s.gift}>
          {gift ? (
            <div className={s.giftApplied}>
              <span>
                Сертификат {gift.code} · {gift.recipientName}
                <small>на сертификате {somoni(gift.balance)}</small>
              </span>
              <button type="button" className={s.remove} aria-label="Убрать сертификат" onClick={() => setGift(null)}>
                ×
              </button>
            </div>
          ) : (
            <form
              className={s.giftForm}
              onSubmit={(e) => {
                e.preventDefault();
                if (giftInput.trim()) void applyGift();
              }}
            >
              <input aria-label="Код сертификата" placeholder="Сертификат MJ-…" value={giftInput} onChange={(e) => setGiftInput(e.target.value)} />
              <button type="submit" disabled={checking || !giftInput.trim()}>
                {checking ? "…" : "Применить"}
              </button>
            </form>
          )}
          {giftError && (
            <div role="alert" className={s.giftError}>
              {giftError}
            </div>
          )}
        </div>

        {(split.deposit > 0 || split.gift > 0) && (
          <div className={s.breakdown}>
            <div>
              <span>Услуги</span>
              <span>{somoni(total)}</span>
            </div>
            {split.deposit > 0 && (
              <div>
                <span>Предоплата онлайн</span>
                <span>−{somoni(split.deposit)}</span>
              </div>
            )}
            {split.gift > 0 && (
              <div>
                <span>Сертификат</span>
                <span>−{somoni(split.gift)}</span>
              </div>
            )}
          </div>
        )}
        <div className={s.total}>
          <span className={s.totalLabel}>{split.deposit || split.gift ? "К оплате" : "Итого"}</span>
          <span className={s.totalValue}>{somoni(split.paid)}</span>
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
                  {clock(r.createdAt)} · {r.paid ? paymentMethod[r.method] : "без доплаты"}
                  {r.depositAmount ? ` · предоплата ${somoni(r.depositAmount)}` : ""}
                  {r.giftCardAmount ? ` · сертификат ${somoni(r.giftCardAmount)}` : ""}
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
