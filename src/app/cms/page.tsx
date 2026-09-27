import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { RevenueChart, ShareBar } from "@/components/ui/Bars";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Kicker, SectionHead, sectionActionClass } from "@/components/ui/Headings";
import { StatGrid } from "@/components/ui/StatCard";
import { Tag } from "@/components/ui/Tag";
import { clock, shortDate, somoni } from "@/lib/format";
import { appointmentStatus } from "@/lib/labels";
import { atSalonTime } from "@/lib/time";
import { requirePage } from "@/server/auth";
import { getDashboard } from "@/server/dashboard";
import { Reminders } from "./Reminders";
import s from "./dashboard.module.css";

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
  const hour = Number(clock(new Date()).slice(0, 2));
  const firstName = user.name.split(" ")[0];
  const ahead = d.appointments.filter((a) => a.status !== "DONE" && a.status !== "NO_SHOW");
  const lastEnd = d.appointments.at(-1)?.endsAt;
  const guestsWord = plural(d.appointments.length, "гостья записана", "гостьи записаны", "гостей записано");

  const leadParts = [`${d.appointments.length} ${guestsWord}`, `${ahead.length} ещё впереди`];
  if (d.busiest.length === 2) leadParts.push(`${d.busiest[0]} и ${d.busiest[1]} — самые загруженные кресла`);
  else if (d.busiest.length === 1) leadParts.push(`${d.busiest[0]} — самое загруженное кресло`);

  const first = d.revenue14[0]!;
  const last = d.revenue14.at(-1)!;

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
        <StatGrid
          stats={[
            { label: "Сегодня", value: somoni(d.todayRevenue), sub: `${d.todayPaidCount} ${plural(d.todayPaidCount, "чек пробит", "чека пробито", "чеков пробито")}` },
            {
              label: "Гостьи сегодня",
              value: String(d.appointments.length),
              sub: d.walkIns ? `${d.walkIns} ${plural(d.walkIns, "пришла", "пришли", "пришли")} без записи` : "все по записи",
            },
            { label: "За месяц", value: somoni(d.monthRevenue), sub: `${d.monthChange} к ${d.previousMonthDative}`, dark: true },
            { label: "Постоянные", value: String(d.guestsTotal), sub: `${d.guestsNewThisMonth} ${plural(d.guestsNewThisMonth, "новое лицо", "новых лица", "новых лиц")} за месяц` },
          ]}
        />
      </div>

      <div className={s.columns}>
        <section>
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
