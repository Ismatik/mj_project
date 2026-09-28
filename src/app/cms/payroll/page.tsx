import Link from "next/link";
import { PageHead } from "@/components/ui/Headings";
import { StatGrid } from "@/components/ui/StatCard";
import { somoni } from "@/lib/format";
import { isMonth, monthOf, monthTitle, shiftMonth } from "@/lib/payroll";
import { todayYmd } from "@/lib/time";
import { requirePage } from "@/server/auth";
import { getPayroll } from "@/server/payroll";
import { PayrollTable } from "./PayrollTable";
import s from "../money.module.css";

// Master pay by month. The owner sees everyone and records bonuses, fines and payments; a master sees only herself.
export default async function PayrollPage({ searchParams }: PageProps<"/cms/payroll">) {
  const user = await requirePage("payroll", "/cms/payroll");
  const sp = await searchParams;
  const current = monthOf(todayYmd());
  const month = isMonth(sp.month) && sp.month <= current ? sp.month : current;
  const owner = user.role === "OWNER";
  const payroll = await getPayroll(month, owner ? null : (user.staffId ?? "none"));
  const t = payroll.totals;
  const q = (m: string) => (m === current ? "/cms/payroll" : `/cms/payroll?month=${m}`);

  return (
    <div>
      <PageHead
        title={owner ? "Зарплата мастеров" : "Моя зарплата"}
        meta="Начислено = оклад + процент от выручки + премии − штрафы · выручка — стоимость услуг в чеках мастера после скидок"
      />
      <div className={s.bar}>
        <div className={s.monthNav}>
          <Link href={q(shiftMonth(month, -1))} aria-label="Предыдущий месяц">
            ← {monthTitle(shiftMonth(month, -1))}
          </Link>
          <span data-testid="month">{monthTitle(month)}</span>
          {month < current && (
            <Link href={q(shiftMonth(month, 1))} aria-label="Следующий месяц">
              {monthTitle(shiftMonth(month, 1))} →
            </Link>
          )}
        </div>
        <div className={s.downloads}>
          <a className={s.download} href={`/api/cms/reports/payroll?month=${month}&format=xlsx`}>
            Excel
          </a>
          <a className={s.download} href={`/api/cms/reports/payroll?month=${month}&format=pdf`} target="_blank" rel="noopener">
            PDF
          </a>
        </div>
      </div>
      <StatGrid
        stats={[
          { label: "Начислено", value: somoni(t.earned), sub: `комиссия ${somoni(t.commission)}`, dark: true },
          { label: "Выплачено", value: somoni(t.paid) },
          { label: "К выплате", value: somoni(t.due) },
          { label: "Выручка", value: somoni(t.revenue), sub: `${t.services} услуг` },
        ]}
      />
      <section className={s.panel} style={{ marginTop: 22 }}>
        {payroll.rows.length ? <PayrollTable payroll={payroll} editable={owner} /> : <p className={s.muted}>Нет данных: учётная запись не связана с мастером.</p>}
        {owner && (
          <p className={s.muted} style={{ marginTop: 14 }}>
            Нажмите на имя мастера, чтобы изменить процент и оклад, добавить премию или штраф и записать выплату. Выплата «из кассы» уменьшает наличные в сегодняшней смене.
          </p>
        )}
      </section>
    </div>
  );
}
