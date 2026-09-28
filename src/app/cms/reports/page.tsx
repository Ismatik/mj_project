import Link from "next/link";
import { PageHead, SectionHead } from "@/components/ui/Headings";
import { StatGrid } from "@/components/ui/StatCard";
import { somoni } from "@/lib/format";
import { monthOf, monthSpan, shiftMonth } from "@/lib/payroll";
import { addDays, mondayOf, todayYmd } from "@/lib/time";
import { requirePage } from "@/server/auth";
import { dmy } from "@/server/reports/export";
import { getPeriodReport, periodFrom } from "@/server/reports/period";
import s from "../money.module.css";

const signed = (n: number) => (n > 0 ? `+${somoni(n)}` : n < 0 ? `−${somoni(-n)}` : somoni(0));

// Reports for any period, on screen and as Excel / PDF; closed shifts with their Z-reports.
export default async function ReportsPage({ searchParams }: PageProps<"/cms/reports">) {
  await requirePage("reports", "/cms/reports");
  const sp = await searchParams;
  const today = todayYmd();
  const period = periodFrom({ from: sp.from, to: sp.to }) ?? periodFrom({})!;
  const r = await getPeriodReport(period.from, period.to);
  const x = r.summary;
  const month = monthOf(today);
  const last = monthSpan(shiftMonth(month, -1));
  const presets = [
    { label: "Сегодня", from: today, to: today },
    { label: "Вчера", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "Эта неделя", from: mondayOf(today), to: today },
    { label: "Этот месяц", from: `${month}-01`, to: today },
    { label: "Прошлый месяц", from: last.from, to: addDays(last.to, -1) },
    { label: "Этот год", from: `${today.slice(0, 4)}-01-01`, to: today },
  ];
  const qs = `from=${period.from}&to=${period.toIncl}`;

  return (
    <div>
      <PageHead title="Отчёты" meta={`${dmy(period.from)} — ${dmy(period.toIncl)}`} />
      <section className={s.panel}>
        <div className={s.presets} role="group" aria-label="Период">
          {presets.map((p) => (
            <Link key={p.label} href={`/cms/reports?from=${p.from}&to=${p.to}`} aria-current={p.from === period.from && p.to === period.toIncl ? "true" : undefined}>
              {p.label}
            </Link>
          ))}
        </div>
        <form className={s.period} method="get" action="/cms/reports">
          <label>
            С
            <input type="date" name="from" defaultValue={period.from} max={today} />
          </label>
          <label>
            По
            <input type="date" name="to" defaultValue={period.toIncl} max={today} />
          </label>
          <button type="submit" className={s.small}>
            Показать
          </button>
          <span style={{ flex: 1 }} />
          <div className={s.downloads}>
            <a className={s.downloadDark} href={`/api/cms/reports/period?${qs}&format=xlsx`}>
              Скачать Excel
            </a>
            <a className={s.download} href={`/api/cms/reports/period?${qs}&format=pdf`} target="_blank" rel="noopener">
              PDF
            </a>
          </div>
        </form>
        <p className={s.muted} style={{ marginTop: 10, marginBottom: 0 }}>
          В Excel — сводка, все чеки, услуги, мастера, выручка по дням, онлайн-оплаты и смены, каждый раздел на своём листе.
        </p>
      </section>

      <div style={{ marginTop: 22 }}>
        <StatGrid
          stats={[
            { label: "Выручка", value: somoni(x.revenue), sub: `${x.receipts} чеков · средний ${somoni(x.average)}`, dark: true },
            { label: "Наличные · карта · QR", value: somoni(x.cash + x.card + x.qr), sub: `${somoni(x.cash)} · ${somoni(x.card)} · ${somoni(x.qr)}` },
            { label: "Предоплаты · сертификаты · бонусы", value: somoni(x.deposits + x.gifts + x.bonus), sub: `${somoni(x.deposits)} · ${somoni(x.gifts)} · ${somoni(x.bonus)}` },
            { label: "Скидки по акциям", value: somoni(x.discounts), sub: `продано сертификатов на ${somoni(x.giftCardsSold)}` },
          ]}
        />
      </div>

      <div className={s.grid}>
        <section className={s.panel} aria-labelledby="masters">
          <SectionHead title={<span id="masters">Мастера</span>} action={<Link href={`/cms/payroll?month=${monthOf(period.from)}`} className={s.linkBtn}>Зарплата →</Link>} />
          <table className={s.table}>
            <thead>
              <tr>
                <th>Мастер</th>
                <th className={s.num}>Услуг</th>
                <th className={s.num}>Выручка</th>
              </tr>
            </thead>
            <tbody>
              {r.masters.map((m) => (
                <tr key={m.name}>
                  <td>{m.name}</td>
                  <td className={s.num}>{m.services}</td>
                  <td className={s.num}>{somoni(m.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!r.masters.length && <p className={s.muted}>Чеков за период нет.</p>}
        </section>

        <section className={s.panel} aria-labelledby="services">
          <SectionHead title={<span id="services">Услуги</span>} />
          <table className={s.table}>
            <thead>
              <tr>
                <th>Услуга</th>
                <th className={s.num}>Кол-во</th>
                <th className={s.num}>Выручка</th>
                <th className={s.num}>Скидки</th>
              </tr>
            </thead>
            <tbody>
              {r.services.slice(0, 12).map((sv) => (
                <tr key={sv.name}>
                  <td>{sv.name}</td>
                  <td className={s.num}>{sv.count}</td>
                  <td className={s.num}>{somoni(sv.revenue)}</td>
                  <td className={s.num}>{sv.discounts ? somoni(sv.discounts) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.services.length > 12 && <p className={s.muted}>Все {r.services.length} услуг — в Excel.</p>}
        </section>
      </div>

      <section className={s.panel} style={{ marginTop: 22 }} aria-labelledby="shifts">
        <SectionHead title={<span id="shifts">Смены</span>} />
        {!r.shifts.length && <p className={s.muted}>Закрытых смен за период нет. Смену закрывают на странице «Ресепшен и касса» → «Закрытие смены».</p>}
        {r.shifts.length > 0 && (
          <div className={s.scroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>День</th>
                  <th className={s.num}>Чеков</th>
                  <th className={s.num}>Выручка</th>
                  <th className={s.num}>Наличные</th>
                  <th className={s.num}>Ожидалось</th>
                  <th className={s.num}>Посчитано</th>
                  <th className={s.num}>Разница</th>
                  <th className={s.num}>Сдано</th>
                  <th>Закрыла</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {r.shifts
                  .slice()
                  .reverse()
                  .map((z) => (
                    <tr key={z.id}>
                      <td>{dmy(z.ymd)}</td>
                      <td className={s.num}>{z.receipts}</td>
                      <td className={s.num}>{somoni(z.revenue)}</td>
                      <td className={s.num}>{somoni(z.cashSales)}</td>
                      <td className={s.num}>{somoni(z.expectedCash)}</td>
                      <td className={s.num}>{somoni(z.countedCash)}</td>
                      <td className={`${s.num} ${z.difference > 0 ? s.diffPlus : z.difference < 0 ? s.diffMinus : ""}`}>{signed(z.difference)}</td>
                      <td className={s.num}>{somoni(z.handedOver)}</td>
                      <td>{z.closedBy}</td>
                      <td className={s.num}>
                        <a className={s.linkBtn} href={`/api/cms/reports/shift/${z.id}`} target="_blank" rel="noopener">
                          Z-отчёт
                        </a>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
