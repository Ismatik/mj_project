// Prepayments and gift certificates: amounts, codes and limits.

/** How long an online booking waiting for its prepayment holds the time */
export const DEPOSIT_HOLD_MIN = 30;
/** How long a guest has to pay for a certificate online */
export const GIFT_PAY_MIN = 60;
export const GIFT_MIN = 200;
export const GIFT_MAX = 20000;
export const GIFT_PRESETS = [500, 1000, 2000, 3000, 5000] as const;
export const GIFT_VALID_DAYS = 365;

/** Prepayment for a service: the percent of its price, rounded up to 10 somoni. */
export function depositFor(price: number, percent: number): number {
  if (percent <= 0 || price <= 0) return 0;
  return Math.min(price, Math.ceil((price * percent) / 100 / 10) * 10);
}

// No 0/O, 1/I/L: codes are read out loud and typed at the till
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** "MJ-7K2P-QX4M" from random bytes */
export function giftCode(random: (n: number) => number[]): string {
  const chars = random(8).map((b) => ALPHABET[b % ALPHABET.length]);
  return `MJ-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** What staff type → canonical code: "mj 7k2p qx4m" → "MJ-7K2P-QX4M" (null if it can't be a code) */
export function normalizeGiftCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("MJ") ? s.slice(2) : s;
  if (body.length !== 8 || [...body].some((c) => !ALPHABET.includes(c))) return null;
  return `MJ-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function validGiftAmount(n: number): boolean {
  return Number.isInteger(n) && n >= GIFT_MIN && n <= GIFT_MAX;
}

/** How a receipt is settled: prepayment first, then the certificate, the rest with the chosen method. */
export function settle(total: number, deposit: number, giftBalance: number, giftWanted: number) {
  const depositUsed = Math.min(Math.max(deposit, 0), total);
  const left = total - depositUsed;
  const gift = Math.min(Math.max(giftWanted, 0), giftBalance, left);
  return { deposit: depositUsed, gift, paid: left - gift };
}
