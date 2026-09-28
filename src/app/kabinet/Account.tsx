"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFx } from "@/components/fx/FxProvider";
import { dict } from "@/lib/i18n/dict";
import { moneyDict } from "@/lib/i18n/dict-money";
import { loyaltyDict } from "@/lib/i18n/dict-loyalty";
import { MONTHS, somoni, WEEKDAYS } from "@/lib/i18n/format";
import { LANG_NAME, LANGS, localePath, type Lang } from "@/lib/i18n/locales";
import { weekdayOf } from "@/lib/time";
import type { GuestAccount } from "@/server/guest-account";
import { cancelMyBooking, rescheduleMyBooking, rescheduleSlots, setFavouriteMaster, setMessageLanguage, signOut } from "./actions";
import s from "./kabinet.module.css";

const HISTORY_SHOWN = 5;

export type MasterInfo = Record<string, { slug: string; title: string }>;

export function Account({ account, dates, masters, botLink, lang }: { account: GuestAccount; dates: string[]; masters: MasterInfo; botLink: string | null; lang: Lang }) {
  const t = dict(lang).account;
  const { profile, upcoming, past, favourite, visitedMasters } = account;
  const [allHistory, setAllHistory] = useState(false);
  const first = profile.name.split(" ")[0]!;
  const rebookHref = (r: { serviceId: string; staffId: string | null }) => localePath(lang, `/?service=${r.serviceId}${r.staffId ? `&master=${r.staffId}` : ""}#zapis`);

  return (
    <section className={s.account} aria-labelledby="account-title">
      <header className={s.accountHead}>
        <div>
          <div className={s.kicker}>{t.kicker}</div>
          <h1 id="account-title" className={s.title}>
            {t.hello(first)}
          </h1>
          <div className={s.rule} />
          <div className={s.phone}>{profile.phone}</div>
        </div>
        <form action={signOut}>
          <button type="submit" className={s.linkBtn}>
            {t.signOut}
          </button>
        </form>
      </header>

      <div className={s.grid}>
        <div className={s.mainCol}>
          <div className={s.blockHead}>
            <h2 className={s.h2}>{t.upcoming}</h2>
            <Link href={localePath(lang, "/#zapis")} className={s.primarySmall}>
              {t.book}
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className={s.empty}>{t.noUpcoming}</p>
          ) : (
            <ul className={s.list}>
              {upcoming.map((a) => (
                <Upcoming key={a.id} a={a} dates={dates} lang={lang} />
              ))}
            </ul>
          )}

          <h2 className={s.h2} style={{ marginTop: 48 }}>
            {t.history}
          </h2>
          {past.length === 0 ? (
            <p className={s.empty}>{t.noHistory}</p>
          ) : (
            <ul className={s.history}>
              {(allHistory ? past : past.slice(0, HISTORY_SHOWN)).map((a) => (
                <li key={a.id}>
                  <div>
                    <div className={s.itemTitle}>{a.service}</div>
                    <div className={s.itemMeta}>
                      {a.date} · {a.masters.map((m) => m.name).join(" + ")} · {somoni(a.price, lang)}
                    </div>
                  </div>
                  {a.rebook && (
                    <Link className={s.ghostSmall} href={rebookHref(a.rebook)}>
                      {t.rebook}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {past.length > HISTORY_SHOWN && (
            <button type="button" className={`${s.linkBtn} ${s.more}`} onClick={() => setAllHistory(!allHistory)}>
              {allHistory ? t.collapse : t.showAll(past.length)}
            </button>
          )}
        </div>

        <aside className={s.side}>
          {account.bonus.enabled && <BonusCard bonus={account.bonus} lang={lang} />}
          <Favourite favourite={favourite} visited={visitedMasters} masters={masters} lang={lang} />
          <div className={s.card}>
            <div className={s.cardLabel}>{t.reminders}</div>
            <p className={s.cardText}>
              {profile.telegram ? t.telegramOn : t.telegramOff}
              {!profile.telegram && botLink && (
                <>
                  {" "}
                  <a href={botLink} target="_blank" rel="noopener noreferrer">
                    {t.openBot}
                  </a>
                </>
              )}
            </p>
          </div>
          <MessageLanguage current={profile.lang} lang={lang} />
        </aside>
      </div>
    </section>
  );
}

function Upcoming({ a, dates, lang }: { a: GuestAccount["upcoming"][number]; dates: string[]; lang: Lang }) {
  const t = dict(lang).account;
  const m = moneyDict(lang).pay;
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
        setError(res.error ?? dict(lang).errors.generic);
        setTimes(await rescheduleSlots(a.id, date));
        return;
      }
      fx.toast(t.moved(res.when ?? ""), "MJ");
      setMode("view");
      router.refresh();
    });

  const cancel = () =>
    start(async () => {
      const res = await cancelMyBooking(a.id);
      if (!res.ok) return setError(res.error ?? dict(lang).errors.generic);
      fx.toast(t.cancelled, "MJ");
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
          {a.masters.map((m) => m.name).join(" + ")} · {somoni(a.price, lang)}
        </div>
        <span className={`${s.status} ${a.status === "CONFIRMED" ? s.statusOk : ""}`}>{a.pay ? m.awaiting(somoni(a.pay.amount, lang)) : t.status[a.status]}</span>
        {a.pay && (
          <Link href={localePath(lang, `/oplata/${a.pay.id}`)} className={s.payBtn}>
            {m.payDeposit(somoni(a.pay.amount, lang))}
          </Link>
        )}
        {!a.pay && a.depositPaid > 0 && <span className={s.hint}>{m.depositPaid(somoni(a.depositPaid, lang))}</span>}

        {mode === "view" &&
          (a.canChange ? (
            <div className={s.actions}>
              <button type="button" className={s.ghostSmall} onClick={() => setMode("move")}>
                {t.move}
              </button>
              <button type="button" className={s.linkBtn} onClick={() => setMode("cancel")}>
                {t.cancel}
              </button>
            </div>
          ) : (
            <p className={s.hint}>{t.tooLate}</p>
          ))}

        {mode === "cancel" && (
          <div className={s.confirm}>
            <span>{t.cancelAsk}</span>
            <button type="button" className={s.dangerSmall} disabled={pending} onClick={cancel}>
              {t.cancelYes}
            </button>
            <button type="button" className={s.linkBtn} onClick={() => setMode("view")}>
              {t.keep}
            </button>
          </div>
        )}

        {mode === "move" && (
          <div className={s.move}>
            <div className={s.moveLabel}>{t.newDay}</div>
            <div className={s.dates}>
              {dates.map((d) => (
                <button key={d} type="button" aria-pressed={d === date} className={s.date} onClick={() => pickDate(d)}>
                  <small>{WEEKDAYS[lang][weekdayOf(d)]}</small>
                  <b>{Number(d.slice(8))}</b>
                  <small>{MONTHS[lang][Number(d.slice(5, 7)) - 1]}</small>
                </button>
              ))}
            </div>
            {date && (
              <>
                <div className={s.moveLabel}>{t.sameMaster}</div>
                {times === null ? (
                  <div className={s.hint}>{t.searching}</div>
                ) : times.length === 0 ? (
                  <div className={s.hint}>{t.busy}</div>
                ) : (
                  <div className={s.times}>
                    {times.map((x) => (
                      <button key={x} type="button" className={s.time} disabled={pending} onClick={() => move(x)}>
                        {x}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <button type="button" className={s.linkBtn} onClick={() => (setMode("view"), setDate(""), setTimes(null))}>
              {t.dontMove}
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

function Favourite({ favourite, visited, masters, lang }: { favourite: GuestAccount["favourite"]; visited: GuestAccount["visitedMasters"]; masters: MasterInfo; lang: Lang }) {
  const t = dict(lang).account;
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (id: string | null) =>
    start(async () => {
      await setFavouriteMaster(id);
      router.refresh();
    });
  const others = visited.filter((m) => m.id !== favourite?.id && masters[m.id]);
  const fav = favourite ? masters[favourite.id] : undefined;
  return (
    <div className={s.card}>
      <div className={s.cardLabel}>{t.favourite}</div>
      {favourite ? (
        <>
          <div className={s.favName}>★ {fav ? <Link href={localePath(lang, `/mastera/${fav.slug}`)}>{favourite.name}</Link> : favourite.name}</div>
          <div className={s.itemMeta}>{fav?.title ?? favourite.title}</div>
          <button type="button" className={s.linkBtn} disabled={pending} onClick={() => set(null)}>
            {t.remove}
          </button>
        </>
      ) : (
        <p className={s.cardText}>{t.favouriteHint}</p>
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
      <Link href={localePath(lang, "/mastera")} className={s.cardLink}>
        {t.allMasters}
      </Link>
    </div>
  );
}

function BonusCard({ bonus, lang }: { bonus: GuestAccount["bonus"]; lang: Lang }) {
  const t = loyaltyDict(lang).bonus;
  const [open, setOpen] = useState(false);
  return (
    <div className={s.card} aria-label={t.title}>
      <div className={s.cardLabel}>{t.title}</div>
      <div className={s.points}>{t.points(bonus.balance)}</div>
      <p className={s.cardText}>{t.tier(bonus.tier.name, bonus.tier.percent)}</p>
      <p className={s.cardText}>{bonus.next ? t.next(bonus.next.name, somoni(bonus.next.remaining, lang), bonus.next.percent) : t.top}</p>
      <p className={s.hint}>{t.how(bonus.maxSpendPercent)}</p>
      {bonus.history.length > 0 ? (
        <>
          <button type="button" className={s.linkBtn} onClick={() => setOpen(!open)}>
            {t.history}
          </button>
          {open && (
            <ul className={s.bonusList}>
              {bonus.history.map((h) => (
                <li key={h.id}>
                  <span>
                    {t.kinds[h.kind] ?? h.kind}
                    {h.receipt ? ` · ${t.receipt(h.receipt)}` : ""}
                  </span>
                  <b>{h.delta > 0 ? `+${h.delta}` : h.delta}</b>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className={s.hint}>{t.none}</p>
      )}
    </div>
  );
}

function MessageLanguage({ current, lang }: { current: Lang; lang: Lang }) {
  const t = dict(lang).account;
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={s.card}>
      <div className={s.cardLabel}>{t.language}</div>
      <p className={s.cardText}>{t.languageHint}</p>
      <div className={s.chips} role="group" aria-label={t.language}>
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            className={s.chip}
            aria-pressed={l === current}
            disabled={pending}
            onClick={() =>
              start(async () => {
                await setMessageLanguage(l);
                router.refresh();
              })
            }
          >
            {LANG_NAME[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
