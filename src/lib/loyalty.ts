// Bonus program and promotions: rules and calculations (pure, shared by the till, website, bot and worker).
import type { Lang } from "./i18n/locales";

// Bonus program
// 1 point = 1 somoni. Points are earned on money actually paid (cash, card, QR, online prepayment),
// not on what was paid with points or a gift certificate.

export type Tier = { key: "classic" | "silver" | "gold"; from: number; percent: number };
export type BonusRules = {
  enabled: boolean;
  /** Tiers by what the guest paid over the last 12 months */
  tiers: Tier[];
  /** Up to this share of a receipt can be paid with points */
  maxSpendPercent: number;
  /** Gift on her birthday */
  birthdayPoints: number;
  /** Points for the first visit after signing up (0 = none) */
  welcomePoints: number;
};

export const DEFAULT_RULES: BonusRules = {
  enabled: true,
  tiers: [
    { key: "classic", from: 0, percent: 5 },
    { key: "silver", from: 5000, percent: 7 },
    { key: "gold", from: 15000, percent: 10 },
  ],
  maxSpendPercent: 30,
  birthdayPoints: 100,
  welcomePoints: 0,
};

export const TIER_NAME: Record<Tier["key"], Record<Lang, string>> = {
  classic: { ru: "Классика", tg: "Классик", en: "Classic" },
  silver: { ru: "Серебро", tg: "Нуқра", en: "Silver" },
  gold: { ru: "Золото", tg: "Тилло", en: "Gold" },
};

const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Stored rules → complete, sane rules (tiers ascending, first one from 0). */
export function normalizeRules(raw: unknown): BonusRules {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<BonusRules>;
  const tiers = DEFAULT_RULES.tiers.map((d, i) => {
    const t = Array.isArray(r.tiers) ? (r.tiers as Partial<Tier>[]).find((x) => x?.key === d.key) : undefined;
    return { key: d.key, from: i === 0 ? 0 : int(t?.from, 1, 10_000_000, d.from), percent: int(t?.percent, 0, 50, d.percent) };
  });
  for (let i = 1; i < tiers.length; i++) if (tiers[i]!.from <= tiers[i - 1]!.from) tiers[i]!.from = tiers[i - 1]!.from + 1;
  return {
    enabled: r.enabled !== false,
    tiers,
    maxSpendPercent: int(r.maxSpendPercent, 0, 100, DEFAULT_RULES.maxSpendPercent),
    birthdayPoints: int(r.birthdayPoints, 0, 100_000, DEFAULT_RULES.birthdayPoints),
    welcomePoints: int(r.welcomePoints, 0, 100_000, DEFAULT_RULES.welcomePoints),
  };
}

/** Her tier for what she paid in the last 12 months, and how far the next one is. */
export function tierFor(spent12m: number, rules: BonusRules) {
  const tiers = rules.tiers;
  let i = 0;
  for (let k = 0; k < tiers.length; k++) if (spent12m >= tiers[k]!.from) i = k;
  const next = tiers[i + 1];
  return { tier: tiers[i]!, next: next ? { tier: next, remaining: next.from - spent12m } : null };
}

export const earnPoints = (paidMoney: number, percent: number) => Math.max(0, Math.floor((paidMoney * percent) / 100));

// Settling a receipt

/**
 * How a receipt is paid: online prepayment first, then the gift certificate, then points (capped by the rules),
 * the rest with cash / card / QR.
 */
export function settleReceipt(
  total: number,
  o: { deposit?: number; giftBalance?: number; giftWanted?: number; points?: number; pointsWanted?: number; maxPointsPercent?: number } = {},
) {
  const deposit = Math.min(Math.max(o.deposit ?? 0, 0), total);
  let left = total - deposit;
  const gift = Math.min(Math.max(o.giftWanted ?? 0, 0), Math.max(o.giftBalance ?? 0, 0), left);
  left -= gift;
  const cap = Math.floor(((total - deposit) * (o.maxPointsPercent ?? 100)) / 100);
  const bonus = Math.min(Math.max(o.pointsWanted ?? 0, 0), Math.max(o.points ?? 0, 0), cap, left);
  left -= bonus;
  return { deposit, gift, bonus, paid: left };
}

// Promotions

export type PromoLike = {
  id: string;
  kind: "PERCENT" | "FIXED";
  value: number;
  serviceIds: string[];
  startsOn: string; // YYYY-MM-DD
  endsOn: string;
  code: string | null;
  active: boolean;
  usageLimit: number | null;
  usedCount: number;
};

/** Does the promotion cover this service on this day? */
export function promoApplies(p: PromoLike, serviceId: string, ymd: string): boolean {
  if (!p.active || ymd < p.startsOn || ymd > p.endsOn) return false;
  if (p.usageLimit !== null && p.usedCount >= p.usageLimit) return false;
  return p.serviceIds.length === 0 || p.serviceIds.includes(serviceId);
}

/** Price after the promotion (never below zero), rounded to whole somoni. */
export function promoPrice(price: number, p: Pick<PromoLike, "kind" | "value">): { price: number; discount: number } {
  const discount = p.kind === "PERCENT" ? Math.round((price * Math.min(p.value, 100)) / 100) : Math.min(p.value, price);
  return { price: price - discount, discount };
}

/** The best automatic offer (no code) for a service on a day. */
export function bestOffer<P extends PromoLike>(promos: P[], serviceId: string, price: number, ymd: string): P | null {
  let best: P | null = null;
  let bestDiscount = 0;
  for (const p of promos) {
    if (p.code || !promoApplies(p, serviceId, ymd)) continue;
    const d = promoPrice(price, p).discount;
    if (d > bestDiscount) {
      best = p;
      bestDiscount = d;
    }
  }
  return best;
}

/** "SPRING-20", "  spring 20 " → "SPRING20"-style canonical code (letters, digits, dashes) */
export const normalizePromoCode = (s: string) =>
  s
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9А-ЯЁ-]/g, "")
    .slice(0, 24);
