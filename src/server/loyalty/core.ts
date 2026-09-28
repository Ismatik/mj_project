// Bonus points and promotions on the server. No "server-only" import: the worker (birthday gifts) uses this file too.
import type { BonusKind, Prisma, PrismaClient } from "@/generated/prisma/client";
import { asLang, type Lang } from "../../lib/i18n/locales";
import { normalizeRules, tierFor, TIER_NAME, type BonusRules, type PromoLike } from "../../lib/loyalty";
import { todayYmd, type Ymd } from "../../lib/time";
import { guestMessage, messageContext } from "../integrations/guest-messages";

type Db = PrismaClient | Prisma.TransactionClient;

export const RULES_SETTING = "bonusRules";

export async function getRules(db: Db): Promise<BonusRules> {
  const row = await db.setting.findUnique({ where: { key: RULES_SETTING } });
  return normalizeRules(row?.value);
}

/** Money she actually paid over the last 12 months (decides her tier). */
export async function spentLastYear(db: Db, guestId: string, now = new Date()): Promise<number> {
  const agg = await db.sale.aggregate({ where: { guestId, createdAt: { gte: new Date(now.getTime() - 365 * 864e5) } }, _sum: { paid: true, depositAmount: true } });
  return (agg._sum.paid ?? 0) + (agg._sum.depositAmount ?? 0);
}

/**
 * Changes her points and writes the ledger line. A negative change fails (returns false)
 * rather than taking the balance below zero — two tills can't spend the same points.
 */
export async function addPoints(
  db: Db,
  guestId: string,
  delta: number,
  kind: BonusKind,
  o: { saleId?: string; note?: string; by?: string } = {},
): Promise<boolean> {
  if (!delta) return true;
  const updated = await db.guest.updateMany({
    where: { id: guestId, ...(delta < 0 ? { bonusBalance: { gte: -delta } } : {}) },
    data: { bonusBalance: { increment: delta } },
  });
  if (updated.count !== 1) return false;
  await db.bonusTx.create({ data: { guestId, delta, kind, saleId: o.saleId, note: o.note, createdBy: o.by } });
  return true;
}

/** Her points, tier and recent history, for the account, the bot, the guest card and the till. */
export async function guestBonus(db: Db, guestId: string, lang: Lang = "ru") {
  const [rules, guest, spent, history] = await Promise.all([
    getRules(db),
    db.guest.findUnique({ where: { id: guestId }, select: { bonusBalance: true } }),
    spentLastYear(db, guestId),
    db.bonusTx.findMany({ where: { guestId }, orderBy: { createdAt: "desc" }, take: 15, include: { sale: { select: { number: true } } } }),
  ]);
  const { tier, next } = tierFor(spent, rules);
  return {
    enabled: rules.enabled,
    balance: guest?.bonusBalance ?? 0,
    tier: { key: tier.key, name: TIER_NAME[tier.key][lang], percent: tier.percent },
    next: next ? { name: TIER_NAME[next.tier.key][lang], percent: next.tier.percent, remaining: next.remaining } : null,
    spent,
    maxSpendPercent: rules.maxSpendPercent,
    history: history.map((h) => ({ id: h.id, delta: h.delta, kind: h.kind, note: h.note, receipt: h.sale?.number ?? null, at: h.createdAt })),
  };
}
export type GuestBonus = Awaited<ReturnType<typeof guestBonus>>;

/** Worker, once a day: birthday points (once a year) with a greeting in her language. */
export async function awardBirthdays(db: PrismaClient, now = new Date()): Promise<number> {
  const rules = await getRules(db);
  if (!rules.enabled || rules.birthdayPoints <= 0) return 0;
  const today = todayYmd(now);
  const md = today.slice(5);
  const yearStart = new Date(`${today.slice(0, 4)}-01-01T00:00:00+05:00`);
  const guests = await db.$queryRaw<{ id: string }[]>`SELECT id FROM "Guest" WHERE birthday IS NOT NULL AND to_char(birthday, 'MM-DD') = ${md}`;
  if (!guests.length) return 0;
  const ctx = await messageContext(db);
  let n = 0;
  for (const { id } of guests) {
    const already = await db.bonusTx.findFirst({ where: { guestId: id, kind: "BIRTHDAY", createdAt: { gte: yearStart } } });
    if (already) continue;
    await db.$transaction(async (tx) => {
      await addPoints(tx, id, rules.birthdayPoints, "BIRTHDAY", { note: `С днём рождения, ${today.slice(0, 4)}` });
      const guest = await tx.guest.findUniqueOrThrow({ where: { id } });
      const msg = await guestMessage(tx, ctx, {
        guest,
        kind: "birthday",
        vars: () => ({ name: guest.name.split(" ")[0], points: String(rules.birthdayPoints), percent: String(rules.maxSpendPercent) }),
      });
      await tx.outboxMessage.create({ data: msg });
    });
    n++;
  }
  return n;
}

// ─── Promotions ──────────────────────────────────────────────

const ymdOf = (d: Date) => d.toISOString().slice(0, 10);

export type PromoRow = PromoLike & { title: string; titles: Record<Lang, string>; descriptions: Record<Lang, string>; showOnSite: boolean };

/** Active promotions that overlap [from, to] (dates as YYYY-MM-DD). */
export async function promotionsBetween(db: Db, from: Ymd, to: Ymd = from): Promise<PromoRow[]> {
  const rows = await db.promotion.findMany({
    where: { active: true, startsOn: { lte: new Date(`${to}T00:00:00Z`) }, endsOn: { gte: new Date(`${from}T00:00:00Z`) } },
    orderBy: { startsOn: "asc" },
  });
  return rows.map((p) => ({
    id: p.id,
    kind: p.kind,
    value: p.value,
    serviceIds: p.serviceIds,
    startsOn: ymdOf(p.startsOn),
    endsOn: ymdOf(p.endsOn),
    code: p.code,
    active: p.active,
    usageLimit: p.usageLimit,
    usedCount: p.usedCount,
    showOnSite: p.showOnSite,
    title: p.title,
    titles: { ru: p.title, tg: p.titleTg || p.title, en: p.titleEn || p.title },
    descriptions: { ru: p.description ?? "", tg: p.descriptionTg || p.description || "", en: p.descriptionEn || p.description || "" },
  }));
}

export const promoLang = (lang: string) => asLang(lang);

/** For the website: offers for the booking form (automatic ones) and the "Акции" section (shown on the site). */
export async function siteOffers(db: Db, today: Ymd, horizonDays = 30) {
  const to = new Date(`${today}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + horizonDays);
  const all = await promotionsBetween(db, today, to.toISOString().slice(0, 10));
  return {
    booking: all.filter((p) => !p.code),
    shown: all.filter((p) => p.showOnSite),
  };
}
