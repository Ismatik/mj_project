import { Avatar } from "@/components/ui/Avatar";
import { Kicker } from "@/components/ui/Headings";
import { SectionHead, sectionActionClass } from "@/components/ui/Headings";
import { StatGrid } from "@/components/ui/StatCard";
import { Tag } from "@/components/ui/Tag";
import Link from "next/link";
import { clock, somoni } from "@/lib/format";
import { appointmentStatus } from "@/lib/labels";
import { requirePage } from "@/server/auth";
import { getDashboard } from "@/server/dashboard";
import s from "./dashboard.module.css";

function greeting(hour: number) {
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

// "Мой салон сегодня". Full dashboard (categories, revenue, reminders) lands in Sprint 3.
export default async function DashboardPage() {
  const user = await requirePage("dashboard", "/cms");
  const d = await getDashboard();
  const hour = Number(clock(new Date()).slice(0, 2));
  const firstName = user.name.split(" ")[0];
  const active = d.appointments.filter((a) => a.status !== "DONE");
  const last = d.appointments.at(-1);

  return (
    <div>
      <div className={s.hero}>
        <Kicker>
          {greeting(hour)}, {firstName}
        </Kicker>
        <h1 className={s.title}>
          Ваш салон сегодня —{" "}
          <em>{last ? `записи до ${clock(last.startsAt)}` : "свободный день"}</em>
        </h1>
        <div className={s.lead}>
          {d.appointments.length} гостей записано · {active.length} ещё впереди
        </div>
      </div>

      <div className={s.stats}>
        <StatGrid
          stats={[
            { label: "Сегодня", value: somoni(d.todayRevenue), sub: `${d.todayPaidCount} чеков пробито` },
            { label: "Гостьи сегодня", value: String(d.appointments.length), sub: "по записи" },
            { label: "За месяц", value: somoni(d.monthRevenue), sub: "выручка с 1-го числа", dark: true },
            { label: "Постоянные", value: String(d.guestsTotal), sub: `${d.guestsNewThisMonth} новых лиц за месяц` },
          ]}
        />
      </div>

      <section className={s.section}>
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
            <div key={a.id} className={s.appt}>
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
            </div>
          );
        })}
      </section>
    </div>
  );
}
