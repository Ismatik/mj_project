"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { somoni } from "@/lib/format";
import { weekdayOf, WEEKDAYS_SHORT } from "@/lib/time";
import type { GuestAccount } from "@/server/guest-account";
import { cancelMyBooking, rescheduleMyBooking, rescheduleSlots, setFavouriteMaster, signOut } from "./actions";
import s from "./kabinet.module.css";

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const STATUS: Record<string, string> = { PENDING: "Ждёт подтверждения", CONFIRMED: "Подтверждена" };

const rebookHref = (r: { serviceId: string; staffId: string | null }) => `/?service=${r.serviceId}${r.staffId ? `&master=${r.staffId}` : ""}#zapis`;

const HISTORY_SHOWN = 5;

export function Account({ account, dates, slugOf, botLink }: { account: GuestAccount; dates: string[]; slugOf: Record<string, string>; botLink: string | null }) {
  const { profile, upcoming, past, favourite, visitedMasters } = account;
  const [allHistory, setAllHistory] = useState(false);
  const first = profile.name.split(" ")[0];
  return (
    <section className={s.account} aria-labelledby="account-title">
      <header className={s.accountHead}>
        <div>
          <div className={s.kicker}>Личный кабинет</div>
          <h1 id="account-title" className={s.title}>
            Здравствуйте, {first}
          </h1>
          <div className={s.rule} />
          <div className={s.phone}>{profile.phone}</div>
        </div>
        <form action={signOut}>
          <button type="submit" className={s.linkBtn}>
            Выйти
          </button>
        </form>
      </header>

      <div className={s.grid}>
        <div className={s.mainCol}>
          <div className={s.blockHead}>
            <h2 className={s.h2}>Предстоящие записи</h2>
            <Link href="/#zapis" className={s.primarySmall}>
              + Записаться
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className={s.empty}>Пока записей нет. Выберите услугу и удобное время — это займёт минуту.</p>
          ) : (
            <ul className={s.list}>
              {upcoming.map((a) => (
                <Upcoming key={a.id} a={a} dates={dates} />
              ))}
            </ul>
          )}

          <h2 className={s.h2} style={{ marginTop: 48 }}>
            История визитов
          </h2>
          {past.length === 0 ? (
            <p className={s.empty}>Здесь появятся ваши визиты в салон.</p>
          ) : (
            <ul className={s.history}>
              {(allHistory ? past : past.slice(0, HISTORY_SHOWN)).map((a) => (
                <li key={a.id}>
                  <div>
                    <div className={s.itemTitle}>{a.service}</div>
                    <div className={s.itemMeta}>
                      {a.date} · {a.masters.map((m) => m.name).join(" + ")} · {somoni(a.price)}
                    </div>
                  </div>
                  {a.rebook && (
                    <Link className={s.ghostSmall} href={rebookHref(a.rebook)}>
                      Записаться снова
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {past.length > HISTORY_SHOWN && (
            <button type="button" className={`${s.linkBtn} ${s.more}`} onClick={() => setAllHistory(!allHistory)}>
              {allHistory ? "Свернуть" : `Показать все визиты (${past.length})`}
            </button>
          )}
        </div>

        <aside className={s.side}>
          <Favourite favourite={favourite} visited={visitedMasters} slugOf={slugOf} />
          <div className={s.card}>
            <div className={s.cardLabel}>Напоминания</div>
            {profile.telegram ? (
              <p className={s.cardText}>Telegram подключён: напоминания о визитах и коды для входа приходят в бот салона.</p>
            ) : (
              <p className={s.cardText}>
                Подключите Telegram-бот салона — напоминания о визите за день и за два часа, запись и перенос прямо в чате.
                {botLink && (
                  <>
                    {" "}
                    <a href={botLink} target="_blank" rel="noopener noreferrer">
                      Открыть бота →
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Upcoming({ a, dates }: { a: GuestAccount["upcoming"][number]; dates: string[] }) {
  const fx = useFx();
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "move" | "cancel">("view");
  const [date, setDate] = useState("");
  const [times, setTimes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const pickDate = (d: string) =>
    start(async () => {
      setDate(d);
      setTimes(null);
      setError("");
      setTimes(await rescheduleSlots(a.id, d));
    });

  const move = (time: string) =>
    start(async () => {
      const res = await rescheduleMyBooking(a.id, date, time);
      if (!res.ok) {
        setError(res.error ?? "Не получилось");
        setTimes(await rescheduleSlots(a.id, date));
        return;
      }
      fx.toast(`Запись перенесена: ${res.when}`, "MJ");
      setMode("view");
      router.refresh();
    });

  const cancel = () =>
    start(async () => {
      const res = await cancelMyBooking(a.id);
      if (!res.ok) return setError(res.error ?? "Не получилось");
      fx.toast("Запись отменена", "MJ");
      router.refresh();
    });

  return (
    <li className={s.item} aria-label={`${a.service}, ${a.date}, ${a.time}`}>
      <div className={s.when}>
        <b>{a.time}</b>
        <span>{a.date}</span>
      </div>
      <div className={s.itemBody}>
        <div className={s.itemTitle}>{a.service}</div>
        <div className={s.itemMeta}>
          {a.masters.map((m) => m.name).join(" + ")} · {somoni(a.price)}
        </div>
        <span className={`${s.status} ${a.status === "CONFIRMED" ? s.statusOk : ""}`}>{STATUS[a.status]}</span>

        {mode === "view" &&
          (a.canChange ? (
            <div className={s.actions}>
              <button type="button" className={s.ghostSmall} onClick={() => setMode("move")}>
                Перенести
              </button>
              <button type="button" className={s.linkBtn} onClick={() => setMode("cancel")}>
                Отменить
              </button>
            </div>
          ) : (
            <p className={s.hint}>До визита меньше двух часов — изменить запись можно по телефону.</p>
          ))}

        {mode === "cancel" && (
          <div className={s.confirm}>
            <span>Отменить запись?</span>
            <button type="button" className={s.dangerSmall} disabled={pending} onClick={cancel}>
              Да, отменить
            </button>
            <button type="button" className={s.linkBtn} onClick={() => setMode("view")}>
              Оставить
            </button>
          </div>
        )}

        {mode === "move" && (
          <div className={s.move}>
            <div className={s.moveLabel}>Новый день</div>
            <div className={s.dates}>
              {dates.map((d) => (
                <button key={d} type="button" aria-pressed={d === date} className={s.date} onClick={() => pickDate(d)}>
                  <small>{WEEKDAYS_SHORT[weekdayOf(d)]}</small>
                  <b>{Number(d.slice(8))}</b>
                  <small>{MONTHS[Number(d.slice(5, 7)) - 1]}</small>
                </button>
              ))}
            </div>
            {date && (
              <>
                <div className={s.moveLabel}>Время — тот же мастер</div>
                {times === null ? (
                  <div className={s.hint}>Ищем свободное время…</div>
                ) : times.length === 0 ? (
                  <div className={s.hint}>На этот день у мастера всё занято — выберите другой.</div>
                ) : (
                  <div className={s.times}>
                    {times.map((t) => (
                      <button key={t} type="button" className={s.time} disabled={pending} onClick={() => move(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <button type="button" className={s.linkBtn} onClick={() => (setMode("view"), setDate(""), setTimes(null))}>
              Не переносить
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className={s.error}>
            {error}
          </div>
        )}
      </div>
    </li>
  );
}

function Favourite({ favourite, visited, slugOf }: { favourite: GuestAccount["favourite"]; visited: GuestAccount["visitedMasters"]; slugOf: Record<string, string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (id: string | null) =>
    start(async () => {
      await setFavouriteMaster(id);
      router.refresh();
    });
  const others = visited.filter((m) => m.id !== favourite?.id && slugOf[m.id]);
  return (
    <div className={s.card}>
      <div className={s.cardLabel}>Любимый мастер</div>
      {favourite ? (
        <>
          <div className={s.favName}>
            ★ {slugOf[favourite.id] ? <a href={`/mastera/${slugOf[favourite.id]}`}>{favourite.name}</a> : favourite.name}
          </div>
          <div className={s.itemMeta}>{favourite.title}</div>
          <button type="button" className={s.linkBtn} disabled={pending} onClick={() => set(null)}>
            Убрать
          </button>
        </>
      ) : (
        <p className={s.cardText}>Отметьте мастера — при онлайн-записи он будет первым в списке.</p>
      )}
      {others.length > 0 && (
        <div className={s.chips}>
          {others.map((m) => (
            <button key={m.id} type="button" className={s.chip} disabled={pending} onClick={() => set(m.id)}>
              ☆ {m.name}
            </button>
          ))}
        </div>
      )}
      <Link href="/mastera" className={s.cardLink}>
        Все мастера →
      </Link>
    </div>
  );
}
