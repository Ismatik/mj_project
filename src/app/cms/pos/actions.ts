"use server";

import { revalidatePath } from "next/cache";
import { canOpen } from "@/lib/access";
import { db } from "@/lib/db";
import { somoni } from "@/lib/format";
import { paymentMethod } from "@/lib/labels";
import { bestOffer, earnPoints, normalizePromoCode, promoApplies, promoPrice, settleReceipt, tierFor } from "@/lib/loyalty";
import { normalizePhone } from "@/lib/phone";
import { todayYmd } from "@/lib/time";
import { getCurrentUser } from "@/server/auth";
import { checkGiftCard } from "@/server/gift-cards";
import { addPoints, getRules, guestBonus, promotionsBetween, spentLastYear } from "@/server/loyalty/core";
import { writeOffForSale } from "@/server/stock";

export type SaleLine = { serviceId: string; appointmentId?: string | null };
export type PayInput = {
  lines: SaleLine[];
  method: "CASH" | "CARD" | "QR";
  guestId?: string | null;
  staffId?: string | null;
  /** Gift certificate code and how much of it to use */
  giftCode?: string | null;
  giftAmount?: number;
  /** Promo code for lines from the quick menu (bookings already carry their price) */
  promoCode?: string | null;
  /** Bonus points to pay with (needs the guest) */
  points?: number;
};
export type PayResult = { ok: true; number: number; total: number; message: string } | { ok: false; error: string };

async function staffOnly() {
  const user = await getCurrentUser();
  return user && canOpen(user.role, "pos") ? user : null;
}

/**
 * Records a paid receipt. Prices come from the database, never from the browser:
 * a line from a booking uses the booked price (promotion already applied when booking);
 * a line from the quick menu uses the menu price with today's best offer, or the promo code if it gives more.
 * Settled in this order: online prepayment, gift certificate, bonus points, then cash / card / QR.
 */
export async function paySale(input: PayInput): Promise<PayResult> {
  const user = await staffOnly();
  if (!user) return { ok: false, error: "Нет доступа к кассе" };
  if (!["CASH", "CARD", "QR"].includes(input.method)) return { ok: false, error: "Неизвестный способ оплаты" };
  const lines = (input.lines ?? []).slice(0, 30);
  if (!lines.length) return { ok: false, error: "Добавьте услугу в чек" };

  const today = todayYmd();
  const serviceIds = [...new Set(lines.map((l) => String(l.serviceId)))];
  const apptIds = [...new Set(lines.map((l) => l.appointmentId).filter(Boolean) as string[])];
  const [services, appts, promos] = await Promise.all([
    db.service.findMany({ where: { id: { in: serviceIds } } }),
    db.appointment.findMany({ where: { id: { in: apptIds }, status: { in: ["PENDING", "CONFIRMED", "IN_CHAIR"] } } }),
    promotionsBetween(db, today),
  ]);
  const svc = new Map(services.map((x) => [x.id, x]));
  const appt = new Map(appts.map((x) => [x.id, x]));

  let code: (typeof promos)[number] | null = null;
  if (input.promoCode) {
    const norm = normalizePromoCode(String(input.promoCode));
    code = promos.find((p) => p.code === norm) ?? null;
    if (!code) return { ok: false, error: "Промокод не действует сегодня" };
  }

  const items: { serviceId: string; name: string; price: number; discount: number; promotionId: string | null }[] = [];
  const usedPromos = new Set<string>();
  for (const l of lines) {
    const service = svc.get(String(l.serviceId));
    if (!service) return { ok: false, error: "Услуга не найдена — обновите страницу" };
    if (l.appointmentId) {
      const a = appt.get(l.appointmentId);
      if (!a) return { ok: false, error: "Эта запись уже оплачена или отменена" };
      items.push({ serviceId: service.id, name: a.serviceLabel, price: a.price, discount: a.fullPrice ? a.fullPrice - a.price : 0, promotionId: a.promotionId });
      continue;
    }
    const offer = bestOffer(promos, service.id, service.price, today);
    const withCode = code && promoApplies(code, service.id, today) ? promoPrice(service.price, code) : null;
    const withOffer = offer ? promoPrice(service.price, offer) : null;
    const use = withCode && (!withOffer || withCode.discount >= withOffer.discount) ? { ...withCode, id: code!.id } : withOffer ? { ...withOffer, id: offer!.id } : null;
    if (use) usedPromos.add(use.id);
    items.push({ serviceId: service.id, name: service.name, price: use?.price ?? service.price, discount: use?.discount ?? 0, promotionId: use?.id ?? null });
  }
  if (code && !usedPromos.has(code.id)) return { ok: false, error: "Промокод не подходит к услугам в чеке" };

  const total = items.reduce((sum, i) => sum + i.price, 0);
  const deposit = appts.reduce((sum, a) => sum + a.depositPaid, 0);
  let gift: { id: string; code: string; balance: number } | null = null;
  if (input.giftCode) {
    const check = await checkGiftCard(String(input.giftCode));
    if (!check.ok) return { ok: false, error: check.error };
    gift = check.card;
  }

  const guest = input.guestId ? await db.guest.findUnique({ where: { id: String(input.guestId) } }) : null;
  const staffId = input.staffId ? ((await db.staff.findUnique({ where: { id: String(input.staffId) } }))?.id ?? null) : null;
  const rules = await getRules(db);
  const pointsWanted = guest && rules.enabled ? Math.max(0, Math.round(Number(input.points ?? 0))) : 0;
  const split = settleReceipt(total, {
    deposit,
    giftBalance: gift?.balance ?? 0,
    giftWanted: gift ? Math.round(Number(input.giftAmount ?? gift.balance)) : 0,
    points: guest?.bonusBalance ?? 0,
    pointsWanted,
    maxPointsPercent: rules.maxSpendPercent,
  });
  // Points are earned on money actually paid (now and online in advance), at her tier's rate
  const earned = guest && rules.enabled ? earnPoints(split.paid + split.deposit, tierFor(await spentLastYear(db, guest.id), rules).tier.percent) : 0;
  const firstVisit = guest && rules.enabled && rules.welcomePoints > 0 ? !(await db.bonusTx.findFirst({ where: { guestId: guest.id, kind: { in: ["EARN", "WELCOME"] } } })) : false;

  const sale = await db
    .$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          total,
          paid: split.paid,
          depositAmount: split.deposit,
          giftCardAmount: split.gift,
          bonusAmount: split.bonus,
          bonusEarned: earned,
          method: input.method,
          guestId: guest?.id ?? null,
          staffId,
          items: { create: items },
        },
      });
      if (gift && split.gift > 0) {
        // Guarded update: the balance can't go below zero even if two tills use the code at once
        const updated = await tx.giftCard.updateMany({ where: { id: gift.id, status: "ACTIVE", balance: { gte: split.gift } }, data: { balance: { decrement: split.gift } } });
        if (updated.count !== 1) throw new Error("GIFT_BALANCE");
        await tx.giftCard.updateMany({ where: { id: gift.id, balance: 0 }, data: { status: "USED" } });
        await tx.giftRedemption.create({ data: { giftCardId: gift.id, saleId: created.id, amount: split.gift } });
      }
      if (guest && split.bonus > 0 && !(await addPoints(tx, guest.id, -split.bonus, "SPEND", { saleId: created.id, by: user.name }))) throw new Error("POINTS");
      if (guest && earned > 0) await addPoints(tx, guest.id, earned, "EARN", { saleId: created.id });
      if (guest && firstVisit) await addPoints(tx, guest.id, rules.welcomePoints, "WELCOME", { saleId: created.id });
      if (code && usedPromos.has(code.id)) await tx.promotion.update({ where: { id: code.id }, data: { usedCount: { increment: 1 } } });
      if (apptIds.length) await tx.appointment.updateMany({ where: { id: { in: apptIds } }, data: { status: "DONE" } });
      // Consumables of these services come off the stock
      await writeOffForSale(tx, created.id, items.map((i) => i.serviceId), user.name);
      return created;
    })
    .catch((e: Error) => {
      if (e.message === "GIFT_BALANCE" || e.message === "POINTS") return e.message;
      throw e;
    });
  if (sale === "GIFT_BALANCE") return { ok: false, error: "На сертификате не хватает средств — обновите сумму" };
  if (sale === "POINTS") return { ok: false, error: "Бонусов не хватает — обновите страницу" };

  revalidatePath("/cms", "layout");
  const parts = [
    split.deposit ? `предоплата ${somoni(split.deposit)}` : "",
    split.gift ? `сертификат ${somoni(split.gift)}` : "",
    split.bonus ? `бонусы ${somoni(split.bonus)}` : "",
  ].filter(Boolean);
  return {
    ok: true,
    number: sale.number,
    total,
    message: `Оплата ${somoni(split.paid)} принята · ${paymentMethod[input.method]}${parts.length ? ` (+ ${parts.join(", ")})` : ""}${earned ? ` · начислено ${earned} б.` : ""}`,
  };
}

/** For the till: balance of a certificate before applying it. */
export async function checkGift(code: string) {
  if (!(await staffOnly())) return { ok: false as const, error: "Нет доступа к кассе" };
  const res = await checkGiftCard(String(code ?? ""));
  return res.ok ? { ok: true as const, code: res.card.code, balance: res.card.balance, recipientName: res.card.recipientName } : res;
}

/** For the till: a guest by phone (walk-ins too), with her points. */
export async function findGuestForPos(phone: string) {
  if (!(await staffOnly())) return { ok: false as const, error: "Нет доступа к кассе" };
  const norm = normalizePhone(String(phone ?? ""));
  if (!norm) return { ok: false as const, error: "Нужно 9 цифр, например 98 103 11 11" };
  const g = await db.guest.findUnique({ where: { phone: norm } });
  if (!g) return { ok: false as const, error: "Гостья с таким номером не найдена" };
  return { ok: true as const, guest: await posGuest(g.id, g.name) };
}

/** Points of a guest chosen at the till */
export async function guestPoints(guestId: string) {
  if (!(await staffOnly())) return null;
  const g = await db.guest.findUnique({ where: { id: String(guestId) } });
  return g ? posGuest(g.id, g.name) : null;
}

async function posGuest(id: string, name: string) {
  const b = await guestBonus(db, id);
  return { id, name, balance: b.enabled ? b.balance : 0, tier: b.tier.name, percent: b.tier.percent, maxSpendPercent: b.maxSpendPercent, enabled: b.enabled };
}

/** For the till: a promo code valid today, with the services it covers. */
export async function checkPosPromo(code: string) {
  if (!(await staffOnly())) return { ok: false as const, error: "Нет доступа к кассе" };
  const norm = normalizePromoCode(String(code ?? ""));
  const p = (await promotionsBetween(db, todayYmd())).find((x) => x.code === norm);
  if (!p || !p.active || (p.usageLimit !== null && p.usedCount >= p.usageLimit)) return { ok: false as const, error: "Промокод не действует сегодня" };
  return { ok: true as const, promo: { id: p.id, code: p.code!, title: p.title, kind: p.kind, value: p.value, serviceIds: p.serviceIds } };
}
