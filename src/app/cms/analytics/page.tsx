import { RevenueChart, ShareBar } from "@/components/ui/Bars";
import { PageHead, SectionHead } from "@/components/ui/Headings";
import { StatGrid } from "@/components/ui/StatCard";
import { shortDate, somoni } from "@/lib/format";
import { paymentMethod } from "@/lib/labels";
import { atSalonTime } from "@/lib/time";
import { requirePage } from "@/server/auth";
import { getAnalytics } from "@/server/analytics";
import s from "./analytics.module.css";

const pct = (x: number) => `${Math.round(x * 100)}%`;

// "Аналитика" — design isAnalytics, plus payment methods and top services.
export default async function AnalyticsPage() {
  await requirePage("analytics", "/cms/analytics");
  const a = await getAnalytics();
  const maxHour = Math.max(0.01, ...a.hours.map((h) => h.share));

  return (
    <div>
      <PageHead title="Аналитика" meta="Месяц с 1-го числа по сегодня" />
      <div className={s.kpis}>
        <StatGrid
          stats={[
            { label: "Выручка месяца", value: somoni(a.kpis.monthRevenue), sub: `${a.kpis.monthChange} к ${a.prevDative}`, dark: true },
            { label: "Средний чек", value: somoni(a.kpis.avg), sub: `${a.kpis.avgChange} к ${a.prevDative}` },
            { label: "Возвращаемость", value: `${a.kpis.retention}%`, sub: "гостьи приходят снова" },
            { label: "Записи онлайн", value: String(a.kpis.online), sub: "сайт, Telegram и WhatsApp" },
          ]}
        />
      </div>

      <div className={s.row}>
        <RevenueChart
          label="Выручка · последние 14 дней"
          height={130}
          bars={a.revenue14.map((r) => ({ label: r.ymd, amount: r.amount, title: somoni(r.amount) }))}
          footLeft={shortDate(atSalonTime(a.revenue14[0]!.ymd, "12:00"))}
          total={somoni(a.revenue14.reduce((x, r) => x + r.amount, 0))}
          footRight={shortDate(atSalonTime(a.revenue14.at(-1)!.ymd, "12:00"))}
        />
        <div>
          <SectionHead title="Пиковые часы" />
          <div className={s.bars}>
            {a.hours.map((h) => (
              <ShareBar key={h.label} name={h.label} share={pct(h.share)} width={`${Math.round((h.share / maxHour) * 100)}%`} />
            ))}
          </div>
        </div>
      </div>

      <div className={s.row}>
        <div>
          <SectionHead title="Способы оплаты" />
          <div className={s.bars}>
            {a.methods.map((m, i) => (
              <ShareBar
                key={m.key}
                name={`${paymentMethod[m.key]} · ${somoni(m.amount)}`}
                share={pct(m.share)}
                width={pct(m.share)}
                color={i === 0 ? "var(--mj-gold-deep)" : "var(--mj-gold)"}
              />
            ))}
          </div>
        </div>
        <div>
          <SectionHead title="Топ услуг месяца" />
          <div className={s.top}>
            {a.top.map((t, i) => (
              <div key={t.name} className={s.topRow}>
                <span className={s.topN}>{i + 1}</span>
                <span className={s.topName}>
                  {t.name}
                  <small>{t.count} раз</small>
                </span>
                <span className={s.topSum}>{somoni(t.amount)}</span>
              </div>
            ))}
            {a.top.length === 0 && <div className={s.muted}>В этом месяце ещё не было оплат.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
