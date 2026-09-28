import "server-only";
import { randomBytes } from "node:crypto";
import type { PaymentMethod } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { somoni } from "@/lib/format";
import type { Lang } from "@/lib/i18n/locales";
import { GIFT_PAY_MIN, GIFT_VALID_DAYS, giftCode, normalizeGiftCode } from "@/lib/money";

const newCode = () => giftCode((n) => [...randomBytes(n)]);

/**
 * A certificate bought online is PENDING until the test checkout (or the bank) confirms payment;
 * one sold at the till is valid at once.
 */
export async function createGiftCard(input: {
  amount: number;
  recipientName: string;
  message?: string | null;
  buyerName: string;
  buyerPhone?: string | null;
  lang: Lang;
  via: "WEBSITE" | "CMS";
  method?: PaymentMethod;
  soldBy?: string;
}) {
  const now = Date.now();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    if (await db.giftCard.findUnique({ where: { code } })) continue;
    const atTill = input.via === "CMS";
    const card = await db.giftCard.create({
      data: {
        code,
        token: randomBytes(18).toString("base64url"),
        amount: input.amount,
        balance: input.amount,
        status: atTill ? "ACTIVE" : "PENDING",
        recipientName: input.recipientName,
        message: input.message || null,
        buyerName: input.buyerName,
        buyerPhone: input.buyerPhone ?? null,
        lang: input.lang,
        soldVia: input.via,
        soldBy: input.soldBy ?? null,
        expiresAt: new Date(now + GIFT_VALID_DAYS * 864e5),
        payments: {
          create: {
            purpose: "GIFT_CARD",
            amount: input.amount,
            status: atTill ? "PAID" : "PENDING",
            provider: atTill ? "pos" : "test",
            method: atTill ? input.method : null,
            description: `Подарочный сертификат ${code} на ${somoni(input.amount)}`,
            lang: input.lang,
            returnPath: null,
            paidAt: atTill ? new Date(now) : null,
            expiresAt: new Date(now + (atTill ? 0 : GIFT_PAY_MIN * 60_000)),
          },
        },
      },
      include: { payments: true },
    });
    return { card, payment: card.payments[0]! };
  }
  throw new Error("Не удалось создать код сертификата");
}

export type GiftCheck =
  | { ok: true; card: { id: string; code: string; amount: number; balance: number; recipientName: string; expiresAt: Date } }
  | { ok: false; error: string };

/** For the till: is this code valid, and how much is left? */
export async function checkGiftCard(input: string): Promise<GiftCheck> {
  const code = normalizeGiftCode(input);
  if (!code) return { ok: false, error: "Код сертификата выглядит так: MJ-XXXX-XXXX" };
  const card = await db.giftCard.findUnique({ where: { code } });
  if (!card) return { ok: false, error: "Сертификат не найден" };
  if (card.status === "PENDING") return { ok: false, error: "Сертификат ещё не оплачен" };
  if (card.status === "CANCELLED") return { ok: false, error: "Сертификат аннулирован" };
  if (card.balance <= 0 || card.status === "USED") return { ok: false, error: "Сертификат уже использован полностью" };
  if (card.expiresAt < new Date()) return { ok: false, error: "Срок действия сертификата истёк" };
  return { ok: true, card: { id: card.id, code: card.code, amount: card.amount, balance: card.balance, recipientName: card.recipientName, expiresAt: card.expiresAt } };
}

export async function giftCardByToken(token: string) {
  if (!/^[\w-]{10,60}$/.test(token)) return null;
  return db.giftCard.findUnique({ where: { token }, include: { redemptions: { orderBy: { createdAt: "desc" } } } });
}
