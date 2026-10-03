import { PageHead, SectionHead } from "@/components/ui/Headings";
import { StatGrid } from "@/components/ui/StatCard";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { clock, shortDate, somoni } from "@/lib/format";
import { requirePage } from "@/server/auth";
import { getCertificatesPage } from "@/server/certificates";
import { CancelCard, SellForm } from "./CertificateForms";
import s from "./certificates.module.css";

const CARD_STATUS: Record<string, { label: string; tone: TagTone }> = {
  ACTIVE: { label: "Действует", tone: "confirmed" },
  USED: { label: "Использован", tone: "done" },
  EXPIRED: { label: "Истёк", tone: "done" },
  CANCELLED: { label: "Аннулирован", tone: "chair" },
};
const PAY_STATUS: Record<string, { label: string; tone: TagTone }> = {
  PENDING: { label: "Ждёт оплаты", tone: "pending" },
  PAID: { label: "Оплачено", tone: "confirmed" },
  CANCELLED: { label: "Отменено", tone: "done" },
  FAILED: { label: "Ошибка", tone: "chair" },
};

// Gift certificates (sold at the till or online) and online payments (prepayments, certificates).
export default async function CertificatesPage() {
  const user = await requirePage("certificates", "/cms/certificates");
  const d = await getCertificatesPage();
  return (
    <div>
      <PageHead title="Сертификаты и оплаты" meta="Подарочные сертификаты, онлайн-предоплаты и продажи на сайте" />
      <StatGrid
        stats={[
          { label: "Действующих сертификатов", value: String(d.stats.activeCount), sub: `остаток ${somoni(d.stats.outstanding)}`, dark: true },
          { label: "Продано за месяц", value: somoni(d.stats.soldMonth), sub: `${d.stats.soldMonthCount} шт.` },
          { label: "Предоплаты сегодня", value: somoni(d.stats.depositsToday) },
        ]}
      />

      <div className={s.grid}>
        <section className={s.panel} aria-labelledby="sell">
          <SectionHead title={<span id="sell">Продать сертификат</span>} />
          <SellForm />
        </section>

        <section className={s.panel} aria-labelledby="list">
          <SectionHead title={<span id="list">Сертификаты</span>} />
          {d.cards.length === 0 && <p className={s.muted}>Сертификатов пока нет.</p>}
          <div className={s.table}>
            {d.cards.map((c) => {
              const st = CARD_STATUS[c.status] ?? CARD_STATUS.ACTIVE!;
              return (
                <div key={c.id} className={s.row}>
                  <div className={s.code}>
                    <b>{c.code}</b>
                    <small>
                      {shortDate(c.createdAt)} · {c.soldVia === "WEBSITE" ? "сайт" : "касса"} · до {shortDate(c.expiresAt)}
                    </small>
                  </div>
                  <div className={s.who}>
                    {c.recipientName}
                    <small>от {c.buyerName}</small>
                  </div>
                  <div className={s.money}>
                    {somoni(c.balance)}
                    <small>из {somoni(c.amount)}</small>
                    {c.used.length > 0 && <small>{c.used.map((u) => `чек №${u.receipt}: ${somoni(u.amount)}`).join(" · ")}</small>}
                  </div>
                  <div className={s.status}>
                    <Tag tone={st.tone}>{st.label}</Tag>
                    <div className={s.links}>
                      <a href={`/api/gift/${c.token}/pdf`} target="_blank" rel="noopener noreferrer">
                        PDF
                      </a>
                      {user.role === "OWNER" && c.status === "ACTIVE" && <CancelCard id={c.id} code={c.code} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className={s.panel} aria-labelledby="online">
        <SectionHead title={<span id="online">Онлайн-оплаты</span>} />
        <p className={s.muted}>Пока банк не подключён, оплаты проходят через тестовую кассу - деньги не списываются (CMS → Интеграции → Онлайн-оплата).</p>
        {d.payments.length === 0 && <p className={s.muted}>Онлайн-оплат ещё не было.</p>}
        <div className={s.table}>
          {d.payments.map((p) => {
            const st = PAY_STATUS[p.status]!;
            return (
              <div key={p.id} className={s.row}>
                <div className={s.code}>
                  <b>{p.purpose === "DEPOSIT" ? "Предоплата" : "Сертификат"}</b>
                  <small>
                    {shortDate(p.createdAt)}, {clock(p.createdAt)}
                  </small>
                </div>
                <div className={s.who}>
                  {p.description}
                  {p.who && <small>{p.who}</small>}
                </div>
                <div className={s.money}>{somoni(p.amount)}</div>
                <div className={s.status}>
                  <Tag tone={st.tone}>{st.label}</Tag>
                  {p.gift && p.status === "PAID" && (
                    <div className={s.links}>
                      <a href={`/api/gift/${p.gift.token}/pdf`}>PDF</a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
