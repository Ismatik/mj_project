"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { BOOKING_HORIZON_DAYS } from "@/lib/slots";
import { addDays, isClosed, todayYmd } from "@/lib/time";
import { dict } from "@/lib/i18n/dict";
import { loyaltyDict } from "@/lib/i18n/dict-loyalty";
import { normalizePromoCode, promoApplies, promoPrice } from "@/lib/loyalty";
import { LANG_NAME, localePath, type Lang } from "@/lib/i18n/locales";
import { getCurrentGuest } from "@/server/guest-auth";
import { getLang } from "@/server/lang";
import { promotionsBetween } from "@/server/loyalty/core";
import { createGuestBooking, slotsFor } from "@/server/online-booking";
import { tooManyAttempts } from "@/server/rate-limit";

const ymdOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

function dateError(date: string, lang: Lang = "ru"): string | null {
  const e = dict(lang).errors;
  const today = todayYmd();
  if (!ymdOk(date)) return e.pickDate;
  if (date < today) return e.pastDate;
  if (date > addDays(today, BOOKING_HORIZON_DAYS)) return e.horizon;
  if (isClosed(date)) return e.monday;
  return null;
}

/** Public: free times for a service on a date (optionally with one master). */
export async function getSlots(serviceId: string, date: string, staffId?: string | null): Promise<{ time: string; staffIds: string[] }[]> {
  if (tooManyAttempts(`slots:${await clientIp()}`, 300, 60 * 60 * 1000)) return [];
  if (dateError(String(date))) return [];
  const { slots } = await slotsFor(String(serviceId), String(date), staffId ? String(staffId) : null);
  return slots.map((s) => ({ time: s.time, staffIds: s.staffIds }));
}

export type OnlineBookingInput = {
  serviceId: string;
  staffId?: string | null;
  date: string;
  time: string;
  name: string;
  phone: string;
  company?: string;
  promoCode?: string | null;
};
export type OnlineBookingResult =
  | {
      ok: true;
      summary: { name: string; service: string; master: string; when: string; phone: string };
      payment?: { amount: number; payBy: string; url: string };
      promo?: { title: string; price: number; fullPrice: number };
    }
  | { ok: false; field?: "name" | "phone" | "slot"; error: string };

/**
 * Public: books a real slot. The slot is re-checked inside a transaction holding a per-date lock,
 * so two visitors can't take the same time. The booking lands in the CMS calendar as "Ожидание".
 */
export async function bookOnline(input: OnlineBookingInput): Promise<OnlineBookingResult> {
  const lang = await getLang();
  const e = dict(lang).errors;
  if (input.company) return { ok: false, error: e.generic }; // honeypot
  if (tooManyAttempts(`book:${await clientIp()}`, 6, 60 * 60 * 1000)) {
    return { ok: false, error: e.tooManyBookings };
  }
  const name = String(input.name ?? "").trim().slice(0, 80);
  const phone = normalizePhone(String(input.phone ?? ""));
  if (name.length < 2) return { ok: false, field: "name", error: e.name };
  if (!phone) return { ok: false, field: "phone", error: e.phone };
  const date = String(input.date ?? "");
  const time = String(input.time ?? "");
  const de = dateError(date, lang);
  if (de) return { ok: false, field: "slot", error: de };
  if (!/^\d{2}:\d{2}$/.test(time)) return { ok: false, field: "slot", error: e.pickTime };
  const wantedStaff = input.staffId ? String(input.staffId) : null;

  // Signed in to her account with the same number → the booking goes to her guest card
  const guest = await getCurrentGuest();
  const guestId = guest && guest.phone === phone ? guest.id : undefined;
  const result = await createGuestBooking({ serviceId: String(input.serviceId), staffId: wantedStaff, date, time, name, phone, source: "WEBSITE", guestId, lang, promoCode: input.promoCode ? String(input.promoCode).slice(0, 40) : null });
  if (result.ok) {
    revalidatePath("/cms", "layout");
    if (guestId) revalidatePath("/kabinet");
  }
  if (!result.ok) return { ok: false, field: "slot", error: result.error };
  return {
    ok: true,
    summary: result.summary,
    ...(result.promo ? { promo: result.promo } : {}),
    ...(result.payment ? { payment: { amount: result.payment.amount, payBy: result.payment.payBy, url: localePath(lang, `/oplata/${result.payment.id}`) } } : {}),
  };
}

/** Public: "перезвоните мне" when no time suits. Goes to the CMS dashboard as a website request. */
export async function requestCallback(input: { name: string; phone: string; service: string; date?: string; company?: string }): Promise<{ ok: boolean; error?: string }> {
  const lang = await getLang();
  const e = dict(lang).errors;
  if (input.company) return { ok: true };
  if (tooManyAttempts(`callback:${await clientIp()}`, 5, 60 * 60 * 1000)) return { ok: false, error: e.tooManyCallbacks };
  const name = String(input.name ?? "").trim().slice(0, 80);
  const phone = normalizePhone(String(input.phone ?? ""));
  if (name.length < 2) return { ok: false, error: e.name };
  if (!phone) return { ok: false, error: e.phone };
  const date = input.date && !dateError(input.date) ? input.date : todayYmd();
  const service = String(input.service || "Консультация").slice(0, 80);
  const guest = await db.guest.findUnique({ where: { phone } });
  const req = await db.bookingRequest.create({ data: { name, phone, service, date: new Date(`${date}T00:00:00Z`), guestId: guest?.id } });
  await db.outboxMessage.create({
    data: { channel: "telegram", to: "reception", body: `Перезвонить: ${name}, ${formatPhone(phone)} — ${service}${lang === "ru" ? "" : ` · говорит: ${LANG_NAME[lang]}`}`, meta: { kind: "site-request", requestId: req.id } },
  });
  revalidatePath("/cms", "layout");
  return { ok: true };
}

/** Public: does this promo code work for the service on that day, and what is the price then? */
export async function checkPromo(code: string, serviceId: string, date: string): Promise<{ ok: true; title: string; price: number; fullPrice: number } | { ok: false; error: string }> {
  const lang = await getLang();
  const pe = loyaltyDict(lang).promo;
  if (tooManyAttempts(`promo:${await clientIp()}`, 30, 3600_000)) return { ok: false, error: dict(lang).errors.tooMany };
  const norm = normalizePromoCode(String(code ?? ""));
  if (!norm || dateError(String(date), lang)) return { ok: false, error: pe.invalid };
  const service = await db.service.findFirst({ where: { id: String(serviceId), active: true, showOnSite: true } });
  if (!service) return { ok: false, error: pe.invalid };
  const promo = (await promotionsBetween(db, String(date))).find((p) => p.code === norm);
  if (!promo) return { ok: false, error: (await db.promotion.findUnique({ where: { code: norm } })) ? pe.invalid : pe.unknown };
  if (!promoApplies(promo, service.id, String(date))) return { ok: false, error: pe.invalid };
  return { ok: true, title: promo.titles[lang], price: promoPrice(service.price, promo).price, fullPrice: service.price };
}
