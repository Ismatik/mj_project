import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead, SectionHead } from "@/components/ui/Headings";
import { StatGrid } from "@/components/ui/StatCard";
import { clock, longDate, somoni } from "@/lib/format";
import { paymentMethod } from "@/lib/labels";
import { atSalonTime, todayYmd } from "@/lib/time";
import { requirePage } from "@/server/auth";
import { getShiftDay, unclosedBefore } from "@/server/shift";
import { CloseForm, MovementForm, RemoveMovement } from "./ShiftForms";
import s from "../../money.module.css";

const signed = (n: number) => (n > 0 ? `+${somoni(n)}` : n < 0 ? `−${somoni(-n)}` : somoni(0));

// End of the day at the till: money by method, cash in/out, the cash count and the Z-report.
export default async function ShiftPage({ searchParams }: PageProps<"/cms/pos/shift">) {
  await requirePage("pos", "/cms/pos/shift");
  const sp = await searchParams;
  const today = todayYmd();
  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) && sp.day <= today ? sp.day : today;
  const [d, unclosed] = await Promise.all([getShiftDay(day), day === today ? unclosedBefore(today) : Promise.resolve(null)]);
  const z = d.closed;
  const t = z
    ? { cashSales: z.cashSales, cardSales: z.cardSales, qrSales: z.qrSales, cashIn: z.cashIn, cashOut: z.cashOut, expectedCash: z.expectedCash, receipts: z.receipts, revenue: z.revenue }
    : d.live;
  const opening = z ? z.openingCash : d.opening;

  return (
    <div>
      <PageHead title="Закрытие смены" meta={`${longDate(atSalonTime(day, "12:00"))}${day === today ? " · сегодня" : ""}`} />
      <div className={s.bar}>
        <div className={s.barLinks}>
          <ButtonLink href="/cms/pos" variant="outline" size="sm">
            ← Касса
          </ButtonLink>
          {day !== today && (
            <Link href="/cms/pos/shift" className={s.linkBtn}>
              Сегодня
            </Link>
          )}
        </div>
        {z && (
          <div className={s.downloads}>
            <a className={s.downloadDark} href={`/api/cms/reports/shift/${z.id}`} target="_blank" rel="noopener">
              Z-отчёт PDF
            </a>
          </div>
        )}
      </div>

      {unclosed && (
        <div className={s.warn} role="note">
          Смена за {longDate(atSalonTime(unclosed, "12:00"))} не закрыта. <Link href={`/cms/pos/shift?day=${unclosed}`}>Закрыть её →</Link>
        </div>
      )}
      {z && d.late.count > 0 && (
        <div className={s.warn} role="note">
          После закрытия пробито чеков: {d.late.count} на {somoni(d.late.total)}. Они не вошли в Z-отчёт - попадут в отчёты за период.
        </div>
      )}

      <StatGrid
        stats={[
          { label: "Выручка", value: somoni(t.revenue), sub: `${t.receipts} чеков`, dark: true },
          { label: "Наличные", value: somoni(t.cashSales) },
          { label: "Карта", value: somoni(t.cardSales) },
          { label: "QR", value: somoni(t.qrSales) },
        ]}
      />

      <div className={s.grid}>
        <div className={s.stack}>
          <section className={s.panel} aria-labelledby="cash">
            <SectionHead title={<span id="cash">Наличные в кассе</span>} />
            <div className={s.lines}>
              <div className={s.line}>
                <span>На начало дня</span>
                <b>{somoni(opening)}</b>
              </div>
              <div className={s.line}>
                <span>+ наличные за день</span>
                <b>{somoni(t.cashSales)}</b>
              </div>
              <div className={s.line}>
                <span>+ внесено</span>
                <b>{somoni(t.cashIn)}</b>
              </div>
              <div className={s.line}>
                <span>− изъято и выплачено</span>
                <b>{t.cashOut ? `−${somoni(t.cashOut)}` : somoni(0)}</b>
              </div>
              <div className={s.lineTotal}>
                <span>Должно быть в кассе</span>
                <b data-testid="expected">{somoni(t.expectedCash)}</b>
              </div>
              {z && (
                <>
                  <div className={s.line}>
                    <span>Посчитано</span>
                    <b>{somoni(z.countedCash)}</b>
                  </div>
                  <div className={s.line}>
                    <span>{z.difference > 0 ? "Излишек" : z.difference < 0 ? "Недостача" : "Разница"}</span>
                    <b className={z.difference > 0 ? s.diffPlus : z.difference < 0 ? s.diffMinus : ""}>{signed(z.difference)}</b>
                  </div>
                  <div className={s.line}>
                    <span>Сдано владелице</span>
                    <b>{somoni(z.handedOver)}</b>
                  </div>
                  <div className={s.line}>
                    <span>Оставлено на завтра</span>
                    <b>{somoni(z.leftCash)}</b>
                  </div>
                </>
              )}
            </div>
            {z ? (
              <p className={s.muted}>
                Смена закрыта: {z.closedBy}, {clock(z.closedAt)}.{z.note ? ` ${z.note}` : ""}
              </p>
            ) : null}
          </section>

          {!z && (
            <section className={s.panel} aria-labelledby="close">
              <SectionHead title={<span id="close">Закрыть смену</span>} />
              <p className={s.muted}>Пересчитайте наличные в ящике. Разница с «должно быть» попадёт в Z-отчёт, владелице придёт уведомление.</p>
              <CloseForm day={day} expected={t.expectedCash} opening={opening} />
            </section>
          )}
        </div>

        <div className={s.stack}>
          <section className={s.panel} aria-labelledby="moves">
            <SectionHead title={<span id="moves">Внесения и изъятия</span>} />
            {d.movements.length === 0 && <p className={s.muted}>Сегодня наличные не вносили и не изымали.</p>}
            {d.movements.length > 0 && (
              <div className={s.scroll}>
                <table className={s.table}>
                  <tbody>
                    {d.movements.map((m) => (
                      <tr key={m.id}>
                        <td>{m.at}</td>
                        <td>
                          {m.note}
                          {m.by && <small>{m.by}</small>}
                        </td>
                        <td className={`${s.num} ${s.money}`}>{signed(m.amount)}</td>
                        <td className={s.num}>{!z && !m.payout && <RemoveMovement id={m.id} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!z && (
              <div style={{ marginTop: 14 }}>
                <MovementForm />
              </div>
            )}
          </section>

          <section className={s.panel} aria-labelledby="checks">
            <SectionHead title={<span id="checks">Чеки за день</span>} />
            {d.receipts.length === 0 && <p className={s.muted}>Чеков нет.</p>}
            {d.receipts.length > 0 && (
              <div className={s.scroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>№</th>
                      <th>Время</th>
                      <th>Гостья · мастер</th>
                      <th className={s.num}>Сумма</th>
                      <th className={s.num}>Оплачено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.receipts.map((r) => (
                      <tr key={r.id}>
                        <td>{r.number}</td>
                        <td>{r.at}</td>
                        <td>
                          {[r.guest === "-" ? "" : r.guest, r.master === "-" ? "" : r.master].filter(Boolean).join(" · ") || "Без записи"}
                          <small>{r.services}</small>
                        </td>
                        <td className={s.num}>{somoni(r.total)}</td>
                        <td className={s.num}>
                          {somoni(r.paid)}
                          <small>{paymentMethod[r.method]}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
