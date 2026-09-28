"use server";

import { revalidatePath } from "next/cache";
import { dict } from "@/lib/i18n/dict";
import { bridalDict } from "@/lib/i18n/dict-bridal";
import { normalizePhone } from "@/lib/phone";
import { BOOKING_HORIZON_DAYS } from "@/lib/slots";
import { addDays, isClosed, todayYmd } from "@/lib/time";
import { getBridalRules, submitBridal, takenDresses, type BridalResult } from "@/server/bridal";
import { getCurrentGuest } from "@/server/guest-auth";
import { getLang } from "@/server/lang";
import { slotsFor } from "@/server/online-booking";
import { clientIp } from "@/server/client-ip";
import { tooManyAttempts } from "@/server/rate-limit";

const isYmd = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Dresses already booked around this wedding date */
export async function dressesTaken(wedding: string): Promise<string[]> {
  if (!isYmd(String(wedding))) return [];
  return takenDresses(String(wedding));
}

/** Free times for the trial look on a day before the wedding */
export async function trialSlots(date: string): Promise<string[]> {
  if (tooManyAttempts(`slots:${await clientIp()}`, 300, 3600_000)) return [];
  const d = String(date);
  const today = todayYmd();
  if (!isYmd(d) || d < today || d > addDays(today, BOOKING_HORIZON_DAYS) || isClosed(d)) return [];
  const rules = await getBridalRules();
  if (!rules.trialServiceId) return [];
  const { slots } = await slotsFor(rules.trialServiceId, d, null, undefined, undefined, true);
  return slots.map((s) => s.time);
}

export async function sendBridal(input: { weddingDate: string; serviceIds: string[]; dressId: string | null; trial: { date: string; time: string } | null; name: string; phone: string; note: string; company?: string }): Promise<BridalResult> {
  const lang = await getLang();
  const e = dict(lang).errors;
  if (input.company) return { ok: false, error: e.generic };
  if (tooManyAttempts(`bridal:${await clientIp()}`, 5, 3600_000)) return { ok: false, error: e.tooMany };
  const name = String(input.name ?? "").trim().slice(0, 80);
  const phone = normalizePhone(String(input.phone ?? ""));
  if (name.length < 2) return { ok: false, field: "name", error: e.name };
  if (!phone) return { ok: false, field: "phone", error: e.phone };
  const trial = input.trial && isYmd(String(input.trial.date)) && /^\d\d:\d\d$/.test(String(input.trial.time)) ? { date: String(input.trial.date), time: String(input.trial.time) } : null;
  if (trial && trial.date >= String(input.weddingDate)) return { ok: false, error: bridalDict(lang).errors.date };
  const guest = await getCurrentGuest();
  const res = await submitBridal(
    { weddingDate: String(input.weddingDate), serviceIds: Array.isArray(input.serviceIds) ? input.serviceIds.map(String) : [], dressId: input.dressId ? String(input.dressId) : null, trial, name, phone, note: String(input.note ?? "") },
    lang,
    guest?.phone === phone ? guest.id : null,
  );
  if (res.ok) revalidatePath("/cms", "layout");
  return res;
}
