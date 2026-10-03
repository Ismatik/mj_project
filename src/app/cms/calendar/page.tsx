import Link from "next/link";
import { clock } from "@/lib/format";
import { addDays } from "@/lib/time";
import { requirePage } from "@/server/auth";
import { getAppointment, getWeek } from "@/server/calendar";
import { LiveRefresh } from "../LiveRefresh";
import { AppointmentPanel } from "./AppointmentPanel";
import s from "./calendar.module.css";

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function weekLabel(monday: string) {
  const sunday = addDays(monday, 6);
  const m1 = Number(monday.slice(5, 7)) - 1;
  const m2 = Number(sunday.slice(5, 7)) - 1;
  const d1 = Number(monday.slice(8));
  const d2 = Number(sunday.slice(8));
  return m1 === m2 ? `${d1}–${d2} ${MONTHS_GEN[m2]}` : `${d1} ${MONTHS_GEN[m1]} – ${d2} ${MONTHS_GEN[m2]}`;
}

// "Календарь записей" — design isCalendar: 7 day columns, Monday closed.
export default async function CalendarPage({ searchParams }: PageProps<"/cms/calendar">) {
  const user = await requirePage("calendar", "/cms/calendar");
  const sp = await searchParams;
  const apptId = typeof sp.appt === "string" ? sp.appt : null;
  const appt = apptId ? await getAppointment(apptId, user) : null;
  // Opening a booking from search or the dashboard jumps to its week
  const weekParam = typeof sp.week === "string" ? sp.week : typeof sp.date === "string" ? sp.date : appt?.ymd;
  const staffParam = typeof sp.staff === "string" ? sp.staff : null;
  const w = await getWeek({ week: weekParam, staffId: staffParam, user });

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | null> = { week: w.monday, staff: staffParam, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/cms/calendar?${p}`;
  };

  return (
    <div>
      <LiveRefresh />
      <div className={s.head}>
        <h1 className={s.title}>Календарь записей</h1>
        <div className={s.weekNav}>
          <Link href={href({ week: addDays(w.monday, -7) })} aria-label="Предыдущая неделя">
            ←
          </Link>
          <span>Неделя {weekLabel(w.monday)}</span>
          <Link href={href({ week: addDays(w.monday, 7) })} aria-label="Следующая неделя">
            →
          </Link>
          {!w.days.some((d) => d.isToday) && (
            <Link href={href({ week: w.today })} className={s.todayLink}>
              Сегодня
            </Link>
          )}
        </div>
      </div>

      {user.role !== "MASTER" && (
        <div className={s.staffFilter} aria-label="Мастер">
          <Link href={href({ staff: null })} className={`${s.chip} ${!staffParam ? s.chipOn : ""}`}>
            Все мастера
          </Link>
          {w.staff.map((m) => (
            <Link key={m.id} href={href({ staff: m.id })} className={`${s.chip} ${staffParam === m.id ? s.chipOn : ""}`}>
              {m.name}
            </Link>
          ))}
        </div>
      )}

      {appt && <AppointmentPanel key={`${appt.id}-${appt.status}-${appt.startsAt.toISOString()}`} a={appt} closeHref={href({})} role={user.role} />}

      <div className={s.gridWrap}>
        <div className={s.grid}>
          {w.days.map((day) => (
            <div key={day.ymd} className={`${s.day} ${day.closed ? s.dayClosed : ""} ${day.isToday ? s.dayToday : ""}`}>
              <div className={s.dayHead}>
                <div className={s.dow}>{day.dow}</div>
                <div className={s.date}>{day.date}</div>
              </div>
              {day.closed && <div className={s.closed}>Выходной</div>}
              <div className={s.cards}>
                {day.appts.map((a) => (
                  <Link
                    key={a.id}
                    href={href({ appt: a.id })}
                    scroll={false}
                    className={`${s.card} ${s["st_" + a.status] ?? ""} ${a.id === apptId ? s.cardOn : ""}`}
                    title={`${clock(a.startsAt)} · ${a.guestName} · ${a.service}`}
                  >
                    <div className={s.cardTime}>
                      {clock(a.startsAt)} · {a.guestName}
                    </div>
                    <div className={s.cardService}>{a.service}</div>
                    <div className={s.cardStaff}>{a.staff}</div>
                  </Link>
                ))}
                {!day.closed && day.appts.length === 0 && <div className={s.free}>Свободно</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className={s.foot}>Записей на неделе: {w.total}</p>
    </div>
  );
}
