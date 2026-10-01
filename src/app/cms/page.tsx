import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { RevenueChart, ShareBar } from "@/components/ui/Bars";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Kicker, SectionHead, sectionActionClass } from "@/components/ui/Headings";
import { StatGrid } from "@/components/ui/StatCard";
import { Tag } from "@/components/ui/Tag";
import { clock, shortDate, somoni } from "@/lib/format";
import { appointmentStatus } from "@/lib/labels";
import { addDays, atSalonTime, mondayOf, todayYmd } from "@/lib/time";
import { requirePage } from "@/server/auth";
import { getDashboard, getDashboardMoney } from "@/server/dashboard";
import { Reminders } from "./Reminders";
import { Requests } from "./Requests";
import s from "./dashboard.module.css";
import m from "./money.module.css";


function greeting(hour: number) {
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

// "Мой салон сегодня" — design/Salon CMS Dashboard Main.dc.html, isDashboard.
export default async function DashboardPage() {
  const user = await requirePage("dashboard", "/cms");
  const d = await getDashboard();
  // Revenue breakdown and week-on-week are owner-only; reception keeps the operational half.
  const isOwner = user.role === "OWNER";
  const money = isOwner ? await getDashboardMoney() : null;
  const hour = Number(clock(new Date()).slice(0, 2));
  const firstName = user.name.split(" ")[0];
  const ahead = d.appointments.filter((a) => a.status !== "DONE" && a.status !== "NO_SHOW");
  // Rest of the day: prices already come with the appointments, so this costs no extra query.
  const aheadSum = ahead.reduce((a, x) => a + x.price, 0);
  const lastEnd = d.appointments.at(-1)?.endsAt;
  const guestsWord = plural(d.appointments.length, "гостья записана", "гостьи записаны", "гостей записано");

  const leadParts = [`${d.appointments.length} ${guestsWord}`, `${ahead.length} ещё впереди`];
  if (d.busiest.length === 2) leadParts.push(`${d.busiest[0]} и ${d.busiest[1]} — самые загруженные кресла`);
  else if (d.busiest.length === 1) leadParts.push(`${d.busiest[0]} — самое загруженное кресло`);

  const first = d.revenue14[0]!;
  const last = d.revenue14.at(-1)!;

  const restCard = {
    label: "Осталось сегодня",
    value: String(ahead.length),
    sub: lastEnd ? `последняя гостья до ${clock(lastEnd)}` : "день закрыт",
  };
  // Reception gets "осталось" folded into the main row; the owner gets a money row of its own.
  const baseStats = [
    { label: "Сегодня", value: somoni(d.todayRevenue), sub: `${d.todayPaidCount} ${plural(d.todayPaidCount, "чек пробит", "чека пробито", "чеков пробито")}` },
    {
      label: "Гостьи сегодня",
      value: String(d.appointments.length),
      sub: d.walkIns ? `${d.walkIns} ${plural(d.walkIns, "пришла", "пришли", "пришли")} без записи` : "все по записи",
    },
    ...(money ? [] : [restCard]),
    { label: "За месяц", value: somoni(d.monthRevenue), sub: `${d.monthChange} к ${d.previousMonthDative}`, dark: true },
    { label: "Постоянные", value: String(d.guestsTotal), sub: `${d.guestsNewThisMonth} ${plural(d.guestsNewThisMonth, "новое лицо", "новых лица", "новых лиц")} за месяц` },
  ];
  const moneyStats = money
    ? [
        restCard,
        { label: "Ждём до конца дня", value: somoni(aheadSum), sub: `к концу дня ≈ ${somoni(d.todayRevenue + aheadSum)}` },
        { label: "Средний чек", value: somoni(money.avgCheck), sub: `${money.receipts} ${plural(money.receipts, "чек", "чека", "чеков")} за день` },
        { label: "Неделя", value: somoni(money.weekRevenue), sub: `${money.weekChange} к прошлой неделе`, dark: true },
      ]
    : [];

  const today = todayYmd();
  const exportPresets = [
    { label: "Сегодня", from: today, to: today },
    { label: "Эта неделя", from: mondayOf(today), to: today },
    { label: "Этот месяц", from: `${today.slice(0, 7)}-01`, to: today },
    { label: "30 дней", from: addDays(today, -29), to: today },
  ];

  return (
    <div>
      <div className={s.hero}>
        <Kicker>
          {greeting(hour)}, {firstName}
        </Kicker>
        <h1 className={s.title}>
          Ваш салон сегодня — <em>{lastEnd ? `всё занято до ${clock(lastEnd)}` : "свободный день"}</em>
        </h1>
        <div className={s.lead}>{leadParts.join(" · ")}</div>
      </div>

      <div className={s.stats}>
        <StatGrid stats={baseStats} />
      </div>

      {moneyStats.length > 0 && (
        <div className={s.stats}>
          <StatGrid stats={moneyStats} />
        </div>
      )}

      {money && (
        <section className={m.panel}>
          <SectionHead title="Деньги сегодня" />
          <div className={s.bars}>
            {(
              [
                ["Наличными", money.byMethod.CASH],
                ["Картой", money.byMethod.CARD],
                ["QR", money.byMethod.QR],
              ] as const
            ).map(([name, amount], i) => {
              const paid = money.byMethod.CASH + money.byMethod.CARD + money.byMethod.QR;
              const share = paid ? amount / paid : 0;
              return (
                <ShareBar
                  key={name}
                  name={name}
                  share={somoni(amount)}
                  width={`${Math.round(share * 100)}%`}
                  color={i === 0 ? "var(--mj-gold-deep)" : "var(--mj-gold)"}
                  delay={0.2 + i * 0.1}
                />
              );
            })}
          </div>
          <p className={m.muted} style={{ marginBottom: 0 }}>
            {[
              money.deposits ? `предоплатами ${somoni(money.deposits)}` : null,
              money.giftCards ? `сертификатами ${somoni(money.giftCards)}` : null,
              money.bonus ? `баллами ${somoni(money.bonus)}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "весь день закрыт наличными, картой и QR"}
          </p>
          <p className={m.muted} style={{ marginBottom: 0 }}>
            Этот день неделю назад — {somoni(money.sameDayLastWeek)} ({money.sameDayChange}). Средний рабочий день {d.monthName} — {somoni(money.avgWorkingDay)} по{" "}
            {money.daysWithSales} {plural(money.daysWithSales, "дню", "дням", "дням")}.
          </p>
        </section>
      )}

      {isOwner && (
        <section className={m.panel}>
          <SectionHead
            title="Выгрузить в Excel"
            action={
              <Link href="/cms/reports" className={sectionActionClass}>
                Все отчёты →
              </Link>
            }
          />
          <div className={m.presets} role="group" aria-label="Период выгрузки">
            {exportPresets.map((p) => (
              <a key={p.label} href={`/api/cms/reports/period?from=${p.from}&to=${p.to}&format=xlsx`}>
                {p.label}
              </a>
            ))}
          </div>
          <form className={m.period} method="get" action="/api/cms/reports/period">
            <label>
              С
              <input type="date" name="from" defaultValue={today} max={today} />
            </label>
            <label>
              По
              <input type="date" name="to" defaultValue={today} max={today} />
            </label>
            <input type="hidden" name="format" value="xlsx" />
            <span style={{ flex: 1 }} />
            <div className={m.downloads}>
              <button type="submit" className={m.downloadDark}>
                Скачать Excel
              </button>
            </div>
          </form>
          <p className={m.muted} style={{ marginTop: 10, marginBottom: 0 }}>
            В файле — сводка, чеки, услуги, мастера, выручка по дням, онлайн-оплаты и смены, каждый раздел на своём листе.
          </p>
        </section>
      )}

      <div className={s.columns}>
        <section>
          {d.requests.length > 0 && (
            <div className={s.requestsBlock}>
              <SectionHead title={`Заявки с сайта · ${d.requests.length}`} />
              <Requests items={d.requests} />
            </div>
          )}
          <SectionHead
            title="Кто сегодня в кресле"
            action={
              <Link href="/cms/calendar" className={sectionActionClass}>
                Календарь →
              </Link>
            }
          />
          {d.appointments.length === 0 && <p className={s.empty}>На сегодня записей нет.</p>}
          {d.appointments.map((a) => {
            const st = appointmentStatus[a.status]!;
            return (
              <Link key={a.id} href={`/cms/calendar?appt=${a.id}`} className={s.appt}>
                <Avatar name={a.guestName} />
                <div className={s.apptMain}>
                  <div className={s.apptName}>{a.guestName}</div>
                  <div className={s.apptSub}>
                    {a.service} · мастер {a.staff}
                  </div>
                </div>
                <div className={s.apptRight}>
                  <div className={s.apptTime}>{clock(a.startsAt)}</div>
                  <div className={s.apptPrice}>{somoni(a.price)}</div>
                </div>
                <Tag tone={st.tone} wide>
                  {st.label}
                </Tag>
              </Link>
            );
          })}
        </section>

        <section className={s.side}>
          <div>
            <SectionHead title="Что любят гостьи" />
            <div className={s.bars}>
              {d.categories.map((c, i) => (
                <ShareBar
                  key={c.name}
                  name={c.name}
                  icon={<CategoryIcon name={c.icon} />}
                  share={`${Math.round(c.share * 100)}%`}
                  width={`${Math.round(c.share * 100)}%`}
                  color={i === 0 ? "var(--mj-gold-deep)" : "var(--mj-gold)"}
                  delay={0.2 + i * 0.1}
                />
              ))}
            </div>
          </div>

          <RevenueChart
            label={`Выручка · ${d.monthName}`}
            bars={d.revenue14.map((r) => ({ label: r.ymd, amount: r.amount, title: somoni(r.amount) }))}
            footLeft={shortDate(atSalonTime(first.ymd, "12:00"))}
            total={`${somoni(d.monthRevenue)} за месяц · ${d.monthChange}`}
            footRight={shortDate(atSalonTime(last.ymd, "12:00"))}
          />

          <div>
            <SectionHead title="Маленькие напоминания" />
            <Reminders items={d.reminders} />
          </div>
        </section>
      </div>
    </div>
  );
}
