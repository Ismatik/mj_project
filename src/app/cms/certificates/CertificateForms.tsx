"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Button } from "@/components/ui/Button";
import { somoni } from "@/lib/format";
import { GIFT_PRESETS } from "@/lib/money";
import { cancelGiftCard, sellGiftCard, type SellInput } from "./actions";
import s from "./certificates.module.css";

const METHODS: { key: SellInput["method"]; label: string }[] = [
  { key: "CASH", label: "Наличные" },
  { key: "CARD", label: "Карта" },
  { key: "QR", label: "QR" },
];

export function SellForm() {
  const fx = useFx();
  const router = useRouter();
  const [amount, setAmount] = useState("1000");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [buyer, setBuyer] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<SellInput["method"]>("CARD");
  const [error, setError] = useState("");
  const [sold, setSold] = useState<{ code: string; token: string } | null>(null);
  const [pending, start] = useTransition();

  if (sold) {
    return (
      <div className={s.sold} role="status">
        <div className={s.soldCode}>{sold.code}</div>
        <p>Сертификат оформлен. Распечатайте PDF или отправьте ссылку гостье.</p>
        <div className={s.soldActions}>
          <a href={`/api/gift/${sold.token}/pdf`} target="_blank" rel="noopener noreferrer" className={s.pdfBtn}>
            Открыть PDF
          </a>
          <button
            type="button"
            className={s.linkBtn}
            onClick={() => {
              void navigator.clipboard?.writeText(`${window.location.origin}/sertifikat/${sold.token}`);
              fx.toast("Ссылка на сертификат скопирована", "Сертификаты");
            }}
          >
            Скопировать ссылку
          </button>
          <button type="button" className={s.linkBtn} onClick={() => (setSold(null), setRecipient(""), setMessage(""), setBuyer(""), setPhone(""))}>
            Ещё один
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const res = await sellGiftCard({ amount: Number(amount), recipientName: recipient, message, buyerName: buyer, buyerPhone: phone || undefined, method });
          if (!res.ok) return setError(res.error);
          setSold(res);
          fx.toast(`Сертификат ${res.code} на ${somoni(Number(amount))} продан`, "Сертификаты");
          router.refresh();
        });
      }}
    >
      <div className={s.presets} role="group" aria-label="Сумма">
        {GIFT_PRESETS.map((a) => (
          <button key={a} type="button" aria-pressed={Number(amount) === a} onClick={() => setAmount(String(a))}>
            {somoni(a)}
          </button>
        ))}
      </div>
      <label>
        Сумма, сомони
        <input name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
      </label>
      <label>
        Кому (имя на сертификате)
        <input name="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
      </label>
      <label>
        Пожелание <small>необязательно</small>
        <textarea name="message" rows={2} maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <div className={s.two}>
        <label>
          Покупатель
          <input name="buyer" value={buyer} onChange={(e) => setBuyer(e.target.value)} />
        </label>
        <label>
          Телефон <small>необязательно</small>
          <input name="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>
      <div className={s.methods} role="group" aria-label="Оплата">
        {METHODS.map((m) => (
          <button key={m.key} type="button" aria-pressed={method === m.key} onClick={() => setMethod(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className={s.error}>
          {error}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Оформляем…" : `Продать за ${somoni(Number(amount) || 0)}`}
      </Button>
    </form>
  );
}

export function CancelCard({ id, code }: { id: string; code: string }) {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={s.linkBtn}
      disabled={pending}
      onClick={() => {
        if (!confirm(`Аннулировать сертификат ${code}? Им больше нельзя будет оплатить.`)) return;
        start(async () => {
          const res = await cancelGiftCard(id);
          fx.toast(res.ok ? `Сертификат ${code} аннулирован` : (res.error ?? "Не получилось"), "Сертификаты");
          router.refresh();
        });
      }}
    >
      Аннулировать
    </button>
  );
}
