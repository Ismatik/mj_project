"use server";

import { revalidatePath } from "next/cache";
import { canOpen } from "@/lib/access";
import { db } from "@/lib/db";
import { somoni } from "@/lib/format";
import { paymentMethod } from "@/lib/labels";
import { settle } from "@/lib/money";
import { getCurrentUser } from "@/server/auth";
import { checkGiftCard } from "@/server/gift-cards";

export type SaleLine = { serviceId: string; appointmentId?: string | null };
export type PayInput = {
  lines: SaleLine[];
  method: "CASH" | "CARD" | "QR";
  guestId?: string | null;
  staffId?: string | null;
  /** Gift certificate code and how much of it to use */
  giftCode?: string | null;
  giftAmount?: number;
};
export type PayResult = { ok: true; number: number; total: number; message: string } | { ok: false; error: string };

/**
 * Records a paid receipt. Prices come from the database, never from the browser:
 * a line from a booking uses the booked price, a line from the quick menu uses the menu price.
 */
export async function paySale(input: PayInput): Promise<PayResult> {
  const user = await getCurrentUser();
  if (!user || !canOpen(user.role, "pos")) return { ok: false, error: "Нет доступа к кассе" };
  if (!["CASH", "CARD", "QR"].includes(input.method)) return { ok: false, error: "Неизвестный способ оплаты" };
  const lines = (input.lines ?? []).slice(0, 30);
  if (!lines.length) return { ok: false, error: "Добавьте услугу в чек" };

  const serviceIds = [...new Set(lines.map((l) => String(l.serviceId)))];
  const apptIds = [...new Set(lines.map((l) => l.appointmentId).filter(Boolean) as string[])];
  const [services, appts] = await Promise.all([
    db.service.findMany({ where: { id: { in: serviceIds } } }),
    db.appointment.findMany({ where: { id: { in: apptIds }, status: { in: ["PENDING", "CONFIRMED", "IN_CHAIR"] } } }),
  ]);
  const svc = new Map(services.map((x) => [x.id, x]));
  const appt = new Map(appts.map((x) => [x.id, x]));

  const items: { serviceId: string; name: string; price: number }[] = [];
  for (const l of lines) {
    const service = svc.get(String(l.serviceId));
    if (!service) return { ok: false, error: "Услуга не найдена — обновите страницу" };
    if (l.appointmentId) {
      const a = appt.get(l.appointmentId);
      if (!a) return { ok: false, error: "Эта запись уже оплачена или отменена" };
      items.push({ serviceId: service.id, name: a.serviceLabel, price: a.price });
    } else {
      items.push({ serviceId: service.id, name: service.name, price: service.price });
    }
  }
  const total = items.reduce((sum, i) => sum + i.price, 0);
  // Prepayments made online for the bookings in this receipt
  const deposit = appts.reduce((sum, a) => sum + a.depositPaid, 0);
  let gift: { id: string; code: string; balance: number } | null = null;
  if (input.giftCode) {
    const check = await checkGiftCard(String(input.giftCode));
    if (!check.ok) return { ok: false, error: check.error };
    gift = check.card;
  }
  const split = settle(total, deposit, gift?.balance ?? 0, gift ? Math.round(Number(input.giftAmount ?? gift.balance)) : 0);

  const guestId = input.guestId ? (await db.guest.findUnique({ where: { id: input.guestId } }))?.id ?? null : null;
  const staffId = input.staffId ? (await db.staff.findUnique({ where: { id: input.staffId } }))?.id ?? null : null;

  const sale = await db.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: { total, paid: split.paid, depositAmount: split.deposit, giftCardAmount: split.gift, method: input.method, guestId, staffId, items: { create: items } },
    });
    if (gift && split.gift > 0) {
      // Guarded update: the balance can't go below zero even if two tills use the code at once
      const updated = await tx.giftCard.updateMany({ where: { id: gift.id, status: "ACTIVE", balance: { gte: split.gift } }, data: { balance: { decrement: split.gift } } });
      if (updated.count !== 1) throw new Error("GIFT_BALANCE");
      await tx.giftCard.updateMany({ where: { id: gift.id, balance: 0 }, data: { status: "USED" } });
      await tx.giftRedemption.create({ data: { giftCardId: gift.id, saleId: created.id, amount: split.gift } });
    }
    if (apptIds.length) await tx.appointment.updateMany({ where: { id: { in: apptIds } }, data: { status: "DONE" } });
    return created;
  }).catch((e: Error) => {
    if (e.message === "GIFT_BALANCE") return null;
    throw e;
  });
  if (!sale) return { ok: false, error: "На сертификате не хватает средств — обновите сумму" };

  revalidatePath("/cms", "layout");
  const parts = [split.deposit ? `предоплата ${somoni(split.deposit)}` : "", split.gift ? `сертификат ${somoni(split.gift)}` : ""].filter(Boolean);
  return {
    ok: true,
    number: sale.number,
    total,
    message: `Оплата ${somoni(split.paid)} принята · ${paymentMethod[input.method]}${parts.length ? ` (+ ${parts.join(", ")})` : ""}`,
  };
}

/** For the till: balance of a certificate before applying it. */
export async function checkGift(code: string) {
  const user = await getCurrentUser();
  if (!user || !canOpen(user.role, "pos")) return { ok: false as const, error: "Нет доступа к кассе" };
  const res = await checkGiftCard(String(code ?? ""));
  return res.ok ? { ok: true as const, code: res.card.code, balance: res.card.balance, recipientName: res.card.recipientName } : res;
}
