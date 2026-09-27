"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { Tag } from "@/components/ui/Tag";
import { clock, shortDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { setRequestStatus } from "./actions";
import s from "./dashboard.module.css";

type Request = { id: string; name: string; phone: string; date: string; service: string; status: string; createdAt: Date };

/** Requests from the website's "Онлайн-запись" form, waiting for reception to call back. */
export function Requests({ items }: { items: Request[] }) {
  const fx = useFx();
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (r: Request, status: "CALLED" | "BOOKED" | "DECLINED", note: string) =>
    start(async () => {
      await setRequestStatus(r.id, status);
      fx.toast(`${r.name}: ${note}`, "Заявки");
      router.refresh();
    });

  return (
    <div className={s.requests}>
      {items.map((r) => (
        <div key={r.id} className={s.request}>
          <div className={s.requestMain}>
            <div className={s.apptName}>
              {r.name} · <a href={`tel:${r.phone}`}>{formatPhone(r.phone)}</a>
            </div>
            <div className={s.apptSub}>
              {r.service} · на {shortDate(new Date(`${r.date}T12:00:00Z`))} · заявка от {shortDate(r.createdAt)}, {clock(r.createdAt)}
            </div>
          </div>
          <Tag tone={r.status === "NEW" ? "chair" : "confirmed"}>{r.status === "NEW" ? "Новая" : "Позвонили"}</Tag>
          <div className={s.requestActions}>
            {r.status === "NEW" && (
              <button type="button" disabled={pending} onClick={() => set(r, "CALLED", "отмечено «позвонили»")}>
                Позвонили
              </button>
            )}
            <button type="button" disabled={pending} onClick={() => set(r, "BOOKED", "записана")}>
              Записали
            </button>
            <button type="button" disabled={pending} onClick={() => set(r, "DECLINED", "заявка закрыта")}>
              Отклонить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
