"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { validateSiteBooking, type SiteBookingErrors, type SiteBookingInput } from "@/lib/site-booking";
import { todayYmd } from "@/lib/time";
import { tooManyAttempts } from "@/server/rate-limit";
import { getSiteContent } from "@/server/site";

export type SiteBookingResult = { ok: true } | { ok: false; errors: SiteBookingErrors; message?: string };

/** Public: the website's booking request. Creates a request for reception and an outbox notification. */
export async function requestBooking(input: SiteBookingInput & { company?: string }): Promise<SiteBookingResult> {
  // Honeypot: real visitors never fill the hidden "company" field
  if (input.company) return { ok: true };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (tooManyAttempts(`site-booking:${ip}`, 5, 60 * 60 * 1000)) {
    return { ok: false, errors: {}, message: "Слишком много заявок подряд. Позвоните нам или напишите в WhatsApp." };
  }

  const content = await getSiteContent("published");
  const v: SiteBookingInput = {
    name: String(input.name ?? "").trim().slice(0, 80),
    phone: String(input.phone ?? "").slice(0, 30),
    date: String(input.date ?? ""),
    service: String(input.service ?? ""),
  };
  const errors = validateSiteBooking(v, todayYmd(), content.booking.services);
  if (Object.keys(errors).length) return { ok: false, errors };

  const phone = normalizePhone(v.phone)!;
  const guest = await db.guest.findUnique({ where: { phone } });
  const request = await db.bookingRequest.create({
    data: { name: v.name, phone, date: new Date(`${v.date}T00:00:00Z`), service: v.service, guestId: guest?.id },
  });
  await db.outboxMessage.create({
    data: {
      channel: "telegram",
      to: "reception",
      body: `Новая заявка с сайта: ${v.name}, ${phone}, ${v.date.split("-").reverse().join(".")}, ${v.service}`,
      meta: { kind: "site-request", requestId: request.id },
    },
  });
  revalidatePath("/cms", "layout");
  return { ok: true };
}
