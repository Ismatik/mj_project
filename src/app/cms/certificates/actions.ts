"use server";

import { revalidatePath } from "next/cache";
import { canOpen } from "@/lib/access";
import { db } from "@/lib/db";
import { somoni } from "@/lib/format";
import { GIFT_MAX, GIFT_MIN, validGiftAmount } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { getCurrentUser } from "@/server/auth";
import { createGiftCard } from "@/server/gift-cards";

export type SellInput = { amount: number; recipientName: string; message?: string; buyerName: string; buyerPhone?: string; method: "CASH" | "CARD" | "QR" };

/** Certificate sold at the till: valid at once, paid with cash / card / QR. */
export async function sellGiftCard(input: SellInput): Promise<{ ok: true; code: string; token: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user || !canOpen(user.role, "certificates")) return { ok: false, error: "Нет доступа" };
  const amount = Math.round(Number(input.amount));
  if (!validGiftAmount(amount)) return { ok: false, error: `Сумма от ${somoni(GIFT_MIN)} до ${somoni(GIFT_MAX)}` };
  if (!["CASH", "CARD", "QR"].includes(input.method)) return { ok: false, error: "Выберите способ оплаты" };
  const recipientName = String(input.recipientName ?? "").trim().slice(0, 60);
  const buyerName = String(input.buyerName ?? "").trim().slice(0, 80);
  if (recipientName.length < 2) return { ok: false, error: "Кому дарим?" };
  if (buyerName.length < 2) return { ok: false, error: "Кто покупает?" };
  const buyerPhone = input.buyerPhone ? normalizePhone(String(input.buyerPhone)) : null;
  if (input.buyerPhone && !buyerPhone) return { ok: false, error: "Телефон: 9 цифр, например 98 103 11 11" };
  const { card } = await createGiftCard({
    amount,
    recipientName,
    message: String(input.message ?? "").trim().slice(0, 200) || null,
    buyerName,
    buyerPhone,
    lang: "ru",
    via: "CMS",
    method: input.method,
    soldBy: user.name,
  });
  revalidatePath("/cms", "layout");
  return { ok: true, code: card.code, token: card.token };
}

/** Owner only: a certificate issued by mistake or returned. */
export async function cancelGiftCard(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") return { ok: false, error: "Аннулировать может только владелица" };
  const res = await db.giftCard.updateMany({ where: { id: String(id), status: "ACTIVE" }, data: { status: "CANCELLED" } });
  revalidatePath("/cms/certificates");
  return res.count ? { ok: true } : { ok: false, error: "Сертификат не активен" };
}
