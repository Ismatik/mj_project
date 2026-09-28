"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { dict } from "@/lib/i18n/dict";
import { waitlistDict } from "@/lib/i18n/dict-waitlist";
import { dateLabel } from "@/lib/i18n/format";
import { normalizePhone } from "@/lib/phone";
import { BOOKING_HORIZON_DAYS } from "@/lib/slots";
import { addDays, isClosed, todayYmd } from "@/lib/time";
import { isHhmm } from "@/lib/waitlist";
import { getCurrentGuest } from "@/server/guest-auth";
import { getLang } from "@/server/lang";
import { tooManyAttempts } from "@/server/rate-limit";
import { acceptOffer, declineOffer, joinWaitlist } from "@/server/waitlist/core";

const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

export type JoinResult = { ok: true; message: string } | { ok: false; field?: "name" | "phone"; error: string };

/** Public: waitlist for a full day (from the booking form). */
export async function joinWaitlistOnline(input: { serviceId: string; staffId?: string | null; date: string; timeFrom?: string | null; timeTo?: string | null; name: string; phone: string; company?: string }): Promise<JoinResult> {
  const lang = await getLang();
  const e = dict(lang).errors;
  const w = waitlistDict(lang);
  if (input.company) return { ok: false, error: e.generic };
  if (tooManyAttempts(`waitlist:${await ip()}`, 6, 3600_000)) return { ok: false, error: e.tooMany };
  const name = String(input.name ?? "").trim().slice(0, 80);
  const phone = normalizePhone(String(input.phone ?? ""));
  if (name.length < 2) return { ok: false, field: "name", error: e.name };
  if (!phone) return { ok: false, field: "phone", error: e.phone };
  const date = String(input.date ?? "");
  const today = todayYmd();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > addDays(today, BOOKING_HORIZON_DAYS) || isClosed(date)) return { ok: false, error: e.pickDate };
  const service = await db.service.findFirst({ where: { id: String(input.serviceId), active: true, showOnSite: true }, include: { staff: { select: { id: true } } } });
  if (!service) return { ok: false, error: e.serviceUnavailable };
  const staffId = input.staffId && service.staff.some((m) => m.id === input.staffId) ? String(input.staffId) : null;
  const guest = await getCurrentGuest();
  const res = await joinWaitlist(db, {
    serviceId: service.id,
    staffId,
    date,
    timeFrom: isHhmm(input.timeFrom) ? input.timeFrom : null,
    timeTo: isHhmm(input.timeTo) ? input.timeTo : null,
    name,
    phone,
    guestId: guest?.phone === phone ? guest.id : null,
    lang,
    source: "WEBSITE",
  });
  revalidatePath("/cms", "layout");
  return { ok: true, message: res.duplicate ? w.already : res.offered ? w.offeredNow : w.joined(dateLabel(date, lang)) };
}

export async function acceptWaitlist(token: string) {
  const res = await acceptOffer(db, String(token));
  revalidatePath("/cms", "layout");
  return res;
}

export async function declineWaitlist(token: string) {
  const res = await declineOffer(db, String(token));
  revalidatePath("/cms", "layout");
  return res;
}
