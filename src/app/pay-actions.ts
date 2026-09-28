"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { dict } from "@/lib/i18n/dict";
import { moneyDict } from "@/lib/i18n/dict-money";
import { somoni } from "@/lib/i18n/format";
import { localePath } from "@/lib/i18n/locales";
import { GIFT_MAX, GIFT_MIN, validGiftAmount } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { createGiftCard } from "@/server/gift-cards";
import { getLang } from "@/server/lang";
import { cancelPayment, markPaid } from "@/server/payments/core";
import { clientIp } from "@/server/client-ip";
import { tooManyAttempts } from "@/server/rate-limit";


export type BuyGiftInput = { amount: number; recipientName: string; message?: string; buyerName: string; buyerPhone: string; company?: string };

/** Public: a certificate bought on the website → test checkout (the bank's page once it is connected). */
export async function buyGiftCard(input: BuyGiftInput): Promise<{ ok: true; url: string } | { ok: false; field?: string; error: string }> {
  const lang = await getLang();
  const e = dict(lang).errors;
  const g = moneyDict(lang).gift;
  if (input.company) return { ok: false, error: e.generic }; // honeypot
  if (tooManyAttempts(`gift:${await clientIp()}`, 10, 3600_000)) return { ok: false, error: e.tooMany };
  const amount = Math.round(Number(input.amount));
  if (!validGiftAmount(amount)) return { ok: false, field: "amount", error: g.errAmount(somoni(GIFT_MIN, lang), somoni(GIFT_MAX, lang)) };
  const recipientName = String(input.recipientName ?? "").trim().slice(0, 60);
  if (recipientName.length < 2) return { ok: false, field: "recipient", error: g.errRecipient };
  const buyerName = String(input.buyerName ?? "").trim().slice(0, 80);
  if (buyerName.length < 2) return { ok: false, field: "buyer", error: e.name };
  const buyerPhone = normalizePhone(String(input.buyerPhone ?? ""));
  if (!buyerPhone) return { ok: false, field: "phone", error: e.phone };
  const message = String(input.message ?? "").trim().slice(0, 200) || null;
  const { payment } = await createGiftCard({ amount, recipientName, message, buyerName, buyerPhone, lang, via: "WEBSITE" });
  return { ok: true, url: localePath(lang, `/oplata/${payment.id}`) };
}

/** Test checkout only works while online payments are in mock mode. */
async function testCheckoutAllowed(paymentId: string) {
  const [p, integration] = await Promise.all([db.payment.findUnique({ where: { id: String(paymentId) } }), db.integration.findUnique({ where: { key: "payments" } })]);
  return !!p && p.provider === "test" && (integration?.mode ?? "MOCK") === "MOCK";
}

export async function payTest(paymentId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await testCheckoutAllowed(paymentId))) return { ok: false, error: "not-available" };
  const res = await markPaid(db, String(paymentId), `test-${Date.now().toString(36)}`);
  revalidatePath("/cms", "layout");
  revalidatePath("/kabinet");
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function cancelTest(paymentId: string): Promise<{ ok: boolean }> {
  if (!(await testCheckoutAllowed(paymentId))) return { ok: false };
  const ok = await cancelPayment(db, String(paymentId), "cancelled");
  revalidatePath("/cms", "layout");
  return { ok };
}
