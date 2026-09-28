// Bridal package: what it costs and when a dress is free. Pure.
import { addDays, type Ymd } from "./time";

export type BridalRules = {
  /** Discount on the services when at least `minServices` are chosen */
  discountPercent: number;
  minServices: number;
  /** Rental days booked for the wedding (the wedding day and the next ones) */
  dressDays: number;
  /** The trial-look service booked with the package (null = none offered) */
  trialServiceId: string | null;
};

export const DEFAULT_BRIDAL_RULES: BridalRules = { discountPercent: 10, minServices: 3, dressDays: 2, trialServiceId: null };

const int = (v: unknown, min: number, max: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

export function normalizeBridalRules(raw: unknown): BridalRules {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<BridalRules>;
  return {
    discountPercent: int(r.discountPercent, 0, 50, DEFAULT_BRIDAL_RULES.discountPercent),
    minServices: int(r.minServices, 1, 10, DEFAULT_BRIDAL_RULES.minServices),
    dressDays: int(r.dressDays, 1, 7, DEFAULT_BRIDAL_RULES.dressDays),
    trialServiceId: typeof r.trialServiceId === "string" && r.trialServiceId ? r.trialServiceId : null,
  };
}

export function packagePrice(services: { price: number }[], dress: { pricePerDay: number } | null, rules: BridalRules) {
  const servicesSum = services.reduce((a, s) => a + s.price, 0);
  const discountPercent = services.length >= rules.minServices ? rules.discountPercent : 0;
  const discount = Math.round((servicesSum * discountPercent) / 100);
  const dressSum = dress ? dress.pricePerDay * rules.dressDays : 0;
  return { servicesSum, discountPercent, discount, dressSum, subtotal: servicesSum + dressSum, total: servicesSum - discount + dressSum };
}

/** Rental days for a wedding: the wedding day and the following days */
export function dressSpan(wedding: Ymd, days: number): { from: Ymd; to: Ymd } {
  return { from: wedding, to: addDays(wedding, Math.max(1, days) - 1) };
}

/** Does a booking [startsOn, endsOn] (inclusive days) overlap the span? */
export const overlaps = (b: { startsOn: Ymd; endsOn: Ymd }, span: { from: Ymd; to: Ymd }) => b.startsOn <= span.to && span.from <= b.endsOn;
