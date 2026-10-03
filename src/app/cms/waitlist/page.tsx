import { PageHead, SectionHead } from "@/components/ui/Headings";
import { formatPhone } from "@/lib/phone";
import { requirePage } from "@/server/auth";
import { getWaitlistPage } from "@/server/waitlist/admin";
import { LiveRefresh } from "../LiveRefresh";
import { EntryActions, EntryForm, WalkInActions, WalkInForm } from "./WaitlistForms";
import s from "../money.module.css";

const SOURCE: Record<string, string> = { CMS: "ресепшен", WEBSITE: "сайт", TELEGRAM: "Telegram", WHATSAPP: "WhatsApp", WALK_IN: "в салоне" };
const STATUS: Record<string, string> = { BOOKED: "записана", SERVED: "обслужена", LEFT: "ушла", DECLINED: "отказалась", EXPIRED: "не ответила / истекло", CANCELLED: "убрана" };

// Walk-in queue for today and the waitlist for full days. A cancelled booking is offered to the waitlist automatically.
export default async function WaitlistPage() {
  await requirePage("waitlist", "/cms/waitlist");
  const d = await getWaitlistPage();
  return (
    <div>
      <LiveRefresh />
      <PageHead title="Лист ожидания" meta="Когда запись отменяют, освободившееся время само предлагается первой подходящей гостье - ссылка держит его 30 минут" />
      <div className={s.grid}>
        <div className={s.stack}>
          <section className={s.panel} aria-labelledby="walkin-form">
            <SectionHead title={<span id="walkin-form">Пришла без записи</span>} />
            <WalkInForm services={d.services} staff={d.staff} />
          </section>
          <section className={s.panel} aria-labelledby="entry-form">
            <SectionHead title={<span id="entry-form">В лист ожидания</span>} />
            <p className={s.muted}>Для гостьи, которой не хватило времени: как только кто-то отменит запись на этот день, ей придёт сообщение со ссылкой.</p>
            <EntryForm services={d.services} staff={d.staff} dates={d.dates} />
          </section>
        </div>

        <div className={s.stack}>
          <section className={s.panel} aria-labelledby="queue">
            <SectionHead title={<span id="queue">Живая очередь · {d.walkIns.length}</span>} />
            {d.walkIns.length === 0 && <p className={s.muted}>Сейчас никто не ждёт.</p>}
            {d.walkIns.length > 0 && (
              <div className={s.scroll}>
                <table className={s.table}>
                  <tbody>
                    {d.walkIns.map((w) => (
                      <tr key={w.id} data-walkin={w.name}>
                        <td>
                          <b>{w.name}</b>
                          <small>
                            {w.service}
                            {w.master ? ` · к мастеру ${w.master}` : ""}
                            {w.phone ? ` · ${formatPhone(w.phone)}` : ""}
                            {w.note ? ` · ${w.note}` : ""}
                          </small>
                        </td>
                        <td className={s.num}>
                          ждёт {w.waited}
                          <small>с {w.since}</small>
                        </td>
                        <td style={{ minWidth: 220 }}>
                          <WalkInActions id={w.id} name={w.name} freeNow={w.freeNow} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={s.panel} aria-labelledby="list">
            <SectionHead title={<span id="list">Ждут времени · {d.entries.length}</span>} />
            {d.entries.length === 0 && <p className={s.muted}>Лист ожидания пуст.</p>}
            {d.entries.length > 0 && (
              <div className={s.scroll}>
                <table className={s.table}>
                  <tbody>
                    {d.entries.map((e) => (
                      <tr key={e.id} data-entry={e.name}>
                        <td style={{ whiteSpace: "nowrap" }}>{e.dateLabel}</td>
                        <td>
                          <b>{e.name}</b>
                          <small>
                            {e.service}
                            {e.master ? ` · ${e.master}` : ""}
                            {e.window ? ` · ${e.window}` : ""}
                            {e.phone ? ` · ${formatPhone(e.phone)}` : " · без телефона"} · {SOURCE[e.source] ?? e.source}
                          </small>
                          {e.offer && (
                            <small className={s.diffPlus}>
                              Предложено {e.offer.at}, {e.offer.master} - ждём ответа до {e.offer.until}
                            </small>
                          )}
                        </td>
                        <td>
                          <EntryActions id={e.id} name={e.name} status={e.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {d.recent.length > 0 && (
            <section className={s.panel} aria-labelledby="recent">
              <SectionHead title={<span id="recent">За неделю</span>} />
              <div className={s.scroll}>
                <table className={s.table}>
                  <tbody>
                    {d.recent.map((r) => (
                      <tr key={r.id}>
                        <td>{r.updated}</td>
                        <td>
                          {r.name}
                          <small>
                            {r.service}
                            {r.at ? ` · ${r.at}` : ""} · {r.kind === "WALK_IN" ? "без записи" : "лист ожидания"}
                          </small>
                        </td>
                        <td className={s.num}>{STATUS[r.status] ?? r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
