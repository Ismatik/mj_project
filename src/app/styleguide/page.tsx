import type { Metadata } from "next";
import { Avatar } from "@/components/ui/Avatar";
import { RevenueChart, ShareBar } from "@/components/ui/Bars";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Kicker, PageHead, SectionHead } from "@/components/ui/Headings";
import { Monogram } from "@/components/ui/Monogram";
import { StatGrid } from "@/components/ui/StatCard";
import { Tag } from "@/components/ui/Tag";
import { NailLoader } from "@/components/fx/NailLoader";
import { clock, longDate, shortDate, somoni } from "@/lib/format";
import { appointmentStatus, guestTag } from "@/lib/labels";
import { atSalonTime } from "@/lib/time";
import { getDashboard } from "@/server/dashboard";
import { FxDemo } from "./FxDemo";
import s from "./styleguide.module.css";

export const metadata: Metadata = { title: "MJ · Компоненты", robots: { index: false } };
export const dynamic = "force-dynamic";

const PALETTE = [
  ["--mj-ink", "#26221D"],
  ["--mj-cream", "#F2EDE3"],
  ["--mj-paper", "#F7F2E7"],
  ["--mj-sand", "#EDE6D6"],
  ["--mj-sand-2", "#E4DCC9"],
  ["--mj-line", "#DDD3BF"],
  ["--mj-gold", "#B8A06A"],
  ["--mj-gold-hover", "#A68D55"],
  ["--mj-gold-deep", "#8F7A4B"],
  ["--mj-text-2", "#5C5344"],
] as const;

export default async function StyleguidePage() {
  const d = await getDashboard();
  const date = atSalonTime(d.today, "12:00");
  const first = d.revenue14[0]!;
  const last = d.revenue14.at(-1)!;

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Monogram size={44} />
        <div>
          <Kicker>R1 · Sprint 1</Kicker>
          <h1 className={s.title}>Компоненты и эффекты MJ</h1>
          <p className={s.lead}>
            Токены, компоненты и эффекты из прототипов. Данные ниже — живые, из базы ({longDate(date)}).
          </p>
        </div>
      </header>

      <section className={s.section}>
        <SectionHead title="Цвета" />
        <div className={s.swatches}>
          {PALETTE.map(([token, hex]) => (
            <div key={token} className={s.swatch}>
              <div className={s.chip} style={{ background: `var(${token})` }} />
              <code>{token}</code>
              <span>{hex}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={s.section}>
        <SectionHead title="Типографика" />
        <div className={s.type}>
          <Kicker>Доброе утро, Мавзуна</Kicker>
          <div className={s.display}>
            Ваш салон сегодня — <em>всё занято до 17:00</em>
          </div>
          <PageHead title="Книга гостей" meta={`${d.guestsTotal} гостий · ${d.guestsNewThisMonth} новых в этом месяце`} />
          <p className={s.body}>Jost 300 — основной текст интерфейса. Zen Old Mincho — заголовки и цифры.</p>
        </div>
      </section>

      <section className={s.section}>
        <SectionHead title="Кнопки и метки" />
        <div className={s.row}>
          <Button>+ Новая запись</Button>
          <Button variant="ink">Наличные</Button>
          <Button variant="outline">QR</Button>
          <div className={s.inkBox}>
            <Button variant="outlineGold" size="sm">
              Открыть сайт
            </Button>
          </div>
          <Button size="sm" variant="outline">
            Скрыть
          </Button>
          <Button disabled>Недоступно</Button>
        </div>
        <div className={s.row}>
          {Object.values(appointmentStatus)
            .slice(0, 4)
            .map((st) => (
              <Tag key={st.label} tone={st.tone} wide>
                {st.label}
              </Tag>
            ))}
          {Object.values(guestTag).map((t) => (
            <Tag key={t.label} tone={t.tone}>
              {t.label}
            </Tag>
          ))}
        </div>
      </section>

      <section className={s.section}>
        <SectionHead title="Карточки показателей" />
        <StatGrid
          stats={[
            { label: "Сегодня", value: somoni(d.todayRevenue), sub: `${d.todayPaidCount} чеков пробито` },
            { label: "Гостьи сегодня", value: String(d.appointments.length), sub: "по записи" },
            { label: "За месяц", value: somoni(d.monthRevenue), sub: "выручка с 1-го числа", dark: true },
            { label: "Постоянные", value: String(d.guestsTotal), sub: `${d.guestsNewThisMonth} новых за месяц` },
          ]}
        />
      </section>

      <div className={s.split}>
        <section className={s.section}>
          <SectionHead title="Кто сегодня в кресле" />
          <div>
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
          </div>
        </section>

        <section className={s.section} style={{ gap: 34 }}>
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
            label="Выручка · последние 14 дней"
            bars={d.revenue14.map((r) => ({ label: r.ymd, amount: r.amount, title: somoni(r.amount) }))}
            footLeft={shortDate(atSalonTime(first.ymd, "12:00"))}
            footRight={shortDate(atSalonTime(last.ymd, "12:00"))}
            total={`${somoni(d.monthRevenue)} за месяц`}
          />
        </section>
      </div>

      <section className={s.section}>
        <SectionHead title="Эффекты" />
        <div className={s.row} style={{ alignItems: "center", gap: 40 }}>
          <NailLoader width={160} />
          <FxDemo />
        </div>
      </section>
    </div>
  );
}
