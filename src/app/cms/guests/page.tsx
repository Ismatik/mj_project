import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { PageHead } from "@/components/ui/Headings";
import { Tag } from "@/components/ui/Tag";
import { shortDate } from "@/lib/format";
import { guestTag } from "@/lib/labels";
import { formatPhone } from "@/lib/phone";
import { inDays } from "@/lib/birthday";
import { requirePage } from "@/server/auth";
import { getGuestBook, getGuestCard, type GuestFilter } from "@/server/guests";
import { GuestCard } from "./GuestCard";
import s from "./guests.module.css";

const FILTERS: { key: GuestFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "VIP", label: "VIP" },
  { key: "BRIDE", label: "Невесты" },
  { key: "REGULAR", label: "Постоянные" },
  { key: "NEW", label: "Новые" },
  { key: "birthdays", label: "Дни рождения · 2 недели" },
];

const plural = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "гостья" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "гостьи" : "гостий");

// "Книга гостей" — design isCrm.
export default async function GuestsPage({ searchParams }: PageProps<"/cms/guests">) {
  const user = await requirePage("guests", "/cms/guests");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const tag = (FILTERS.find((f) => f.key === sp.tag)?.key ?? "all") as GuestFilter;
  const limit = Math.min(Number(sp.limit) || 50, 1000);
  const guestId = typeof sp.guest === "string" ? sp.guest : null;

  const [book, card] = await Promise.all([getGuestBook({ q, tag, limit }), guestId ? getGuestCard(guestId) : null]);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { q: q || null, tag: tag === "all" ? null : tag, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const str = p.toString();
    return str ? `/cms/guests?${str}` : "/cms/guests";
  };

  return (
    <div>
      <PageHead title="Книга гостей" meta={`${book.total} ${plural(book.total)} · ${book.newThisMonth} новых в ${book.monthPrep}`} />

      {card && <GuestCard key={card.id} guest={card} closeHref={href({})} isOwner={user.role === "OWNER"} />}

      <div className={s.toolbar}>
        <div className={s.filters} aria-label="Статус гостьи">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href({ tag: f.key === "all" ? null : f.key })}
              aria-current={tag === f.key ? "true" : undefined}
              className={`${s.filter} ${tag === f.key ? s.filterOn : ""}`}
            >
              {f.label}
              <span>{f.key === "all" ? book.total : (book.counts[f.key] ?? 0)}</span>
            </Link>
          ))}
        </div>
        <form className={s.find} action="/cms/guests">
          {tag !== "all" && <input type="hidden" name="tag" value={tag} />}
          <input name="q" defaultValue={q} placeholder="Имя или телефон" aria-label="Найти в книге гостей" />
        </form>
      </div>

      <div className={s.tableWrap}>
        <div className={`${s.row} ${s.headRow}`}>
          <span>Гостья</span>
          <span>Телефон</span>
          <span>Визитов</span>
          <span>Последний</span>
          <span>Любимая услуга</span>
          <span>Статус</span>
        </div>
        {book.rows.map((g) => {
          const t = guestTag[g.tag]!;
          return (
            <Link key={g.id} href={href({ guest: g.id })} className={`${s.row} ${g.id === guestId ? s.rowOn : ""}`}>
              <span className={s.nameCell}>
                <Avatar name={g.name} size="sm" />
                <span className={s.name}>{g.name}</span>
                {g.allergy && (
                  <i className={s.allergyDot} title="Есть аллергии — откройте карточку" aria-label="аллергии">
                    !
                  </i>
                )}
                {g.birthdayIn && (
                  <i className={s.bday}>
                    🎂 {inDays(g.birthdayIn.days)} · {g.birthdayIn.turns}
                  </i>
                )}
              </span>
              <span className={s.light}>{formatPhone(g.phone)}</span>
              <span className={s.serif}>{g.visits}</span>
              <span className={s.light}>{g.last ? shortDate(g.last) : "—"}</span>
              <span className={s.light}>{g.fav}</span>
              <span>
                <Tag tone={t.tone}>{t.label}</Tag>
              </span>
            </Link>
          );
        })}
        {book.rows.length === 0 && <div className={s.none}>Никого не нашли{q ? ` по «${q}»` : ""}.</div>}
      </div>
      {book.found > book.rows.length && (
        <div className={s.more}>
          <Link href={href({ limit: String(limit + 50) })} scroll={false}>
            Показать ещё · {book.found - book.rows.length}
          </Link>
        </div>
      )}
    </div>
  );
}
