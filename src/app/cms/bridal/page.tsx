import Link from "next/link";
import { PageHead, SectionHead } from "@/components/ui/Headings";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { shortDate, somoni } from "@/lib/format";
import { appointmentStatus } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import { requirePage } from "@/server/auth";
import { getBridalAdmin } from "@/server/bridal";
import { PackageActions, RulesForm } from "./BridalForms";
import s from "../money.module.css";

const STATUS: Record<string, { label: string; tone: TagTone }> = {
  NEW: { label: "Новый", tone: "pending" },
  CONFIRMED: { label: "Подтверждён", tone: "confirmed" },
  DONE: { label: "Прошла", tone: "done" },
  CANCELLED: { label: "Отменён", tone: "chair" },
};

// Bridal packages from the website builder: services, dress, trial look; reception confirms and books the day.
export default async function BridalAdminPage() {
  const user = await requirePage("bridal", "/cms/bridal");
  const d = await getBridalAdmin();
  return (
    <div>
      <PageHead title="Свадебные пакеты" meta="Невесты собирают пакет на сайте (/svadba): услуги со скидкой, платье из проката и пробный образ" />
      <div className={s.grid}>
        <section className={s.panel} aria-labelledby="rules">
          <SectionHead title={<span id="rules">Условия</span>} />
          <p className={s.muted}>Скидка действует на услуги (не на платье). Платье закрепляется за невестой на дни проката, начиная с дня свадьбы.</p>
          <RulesForm rules={d.rules} services={d.services} owner={user.role === "OWNER"} />
        </section>
        <section className={s.panel} aria-labelledby="list">
          <SectionHead title={<span id="list">Пакеты · {d.packages.length}</span>} />
          {d.packages.length === 0 && <p className={s.muted}>Пакетов пока нет.</p>}
          <div className={s.scroll}>
            <table className={s.table}>
              <tbody>
                {d.packages.map((p) => {
                  const st = STATUS[p.status]!;
                  return (
                    <tr key={p.id} data-package={p.number}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <b>{p.weddingLabel}</b>
                        <small>{p.daysLeft >= 0 ? `через ${p.daysLeft} дн.` : "прошла"}</small>
                        <small>№{p.number} · {shortDate(p.createdAt)}</small>
                      </td>
                      <td>
                        <b>{p.guestId ? <Link href={`/cms/guests?guest=${p.guestId}`}>{p.name}</Link> : p.name}</b> · {formatPhone(p.phone)}
                        <small>{p.services.map((x) => x.name).join(", ")}</small>
                        {p.dress && (
                          <small>
                            {p.dress.name}, {p.dress.size} · {p.dress.days} сут. · {somoni(p.dress.price)}
                          </small>
                        )}
                        {p.trial && (
                          <small>
                            Пробный образ: {p.trial.when} · {appointmentStatus[p.trial.status]?.label ?? p.trial.status}
                            {p.trial.deposit ? "" : " · ждёт предоплату"}
                          </small>
                        )}
                        {p.note && <small>«{p.note}»</small>}
                        <PackageActions id={p.id} number={p.number} status={p.status} />
                      </td>
                      <td className={s.num}>
                        <span className={s.money}>{somoni(p.total)}</span>
                        {p.discountPercent > 0 && <small>скидка {p.discountPercent}% · без скидки {somoni(p.subtotal)}</small>}
                      </td>
                      <td>
                        <Tag tone={st.tone}>{st.label}</Tag>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
