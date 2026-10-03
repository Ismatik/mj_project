import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { clock, longDate, somoni } from "@/lib/format";
import { DEPOSIT_HOLD_MIN, depositFor } from "@/lib/money";
import { loyaltyDict } from "@/lib/i18n/dict-loyalty";
import { bestOffer, normalizePromoCode, promoApplies, promoPrice } from "@/lib/loyalty";
import { formatPhone } from "@/lib/phone";
import { freeSlots, type BusyInterval } from "@/lib/slots";
import { nameIn } from "@/lib/i18n/content";
import { dict } from "@/lib/i18n/dict";
import { when } from "@/lib/i18n/format";
import { LANG_NAME, type Lang } from "@/lib/i18n/locales";
import { addDays, atSalonTime, todayYmd, type Ymd } from "@/lib/time";
import { appointmentVars, guestMessage, messageContext } from "./integrations/guest-messages";
import { cancelAlert, forEachMaster, newBookingAlert, rescheduleAlert } from "./integrations/master-alerts";
import { promotionsBetween } from "./loyalty/core";
import { onBookingCancelled } from "./waitlist/core";
import { namerFor } from "./names";
import { getSiteContent } from "./site";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Public menu for online booking: services shown on the site, with masters who do them (names only), in a language. */
export async function getOnlineMenu(lang: Lang = "ru") {
  const [categories, c] = await Promise.all([
    db.serviceCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        services: {
          where: { active: true, showOnSite: true },
          orderBy: { sortOrder: "asc" },
          include: { staff: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, title: true } } },
        },
      },
    }),
    lang === "ru" ? null : getSiteContent("published"),
  ]);
  const name = (kind: "services" | "categories" | "staff", id: string, fallback: string) => (c ? nameIn(c, lang, kind, id, fallback) : fallback);
  return categories
    .map((cat) => ({
      id: cat.id,
      name: name("categories", cat.id, cat.name),
      services: cat.services
        .filter((s) => s.staff.length)
        .map((s) => ({
          id: s.id,
          name: name("services", s.id, s.name),
          durationMin: s.durationMin,
          price: s.price,
          staff: s.staff.map((m) => ({ id: m.id, name: name("staff", m.id, m.name), title: m.title })),
        })),
    }))
    .filter((cat) => cat.services.length);
}
export type OnlineMenu = Awaited<ReturnType<typeof getOnlineMenu>>;

async function busyOn(tx: Tx, date: Ymd, staffIds: string[], excludeId?: string): Promise<BusyInterval[]> {
  const appts = await tx.appointment.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startsAt: { gte: atSalonTime(date), lt: atSalonTime(addDays(date, 1)) },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      staff: { some: { staffId: { in: staffIds } } },
    },
    include: { staff: true },
  });
  return appts.flatMap((a) => {
    const [h, m] = clock(a.startsAt).split(":").map(Number);
    const start = h! * 60 + m!;
    return a.staff.map((s) => ({ staffId: s.staffId, start, end: start + a.durationMin }));
  });
}

/** Free slots for a service on a date, optionally for one master. Works inside or outside a transaction. */
export async function slotsFor(serviceId: string, date: Ymd, staffId: string | null, tx: Tx = db, excludeAppointmentId?: string, includeHidden = false) {
  const service = await tx.service.findFirst({
    where: { id: serviceId, active: true, ...(includeHidden ? {} : { showOnSite: true }) },
    include: { staff: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!service) return { service: null, slots: [] };
  const staff = service.staff.filter((m) => !staffId || m.id === staffId);
  const now = new Date();
  const [h, m] = clock(now).split(":").map(Number);
  const slots = freeSlots({
    date,
    today: todayYmd(now),
    nowMinutes: h! * 60 + m!,
    durationMin: service.durationMin,
    staff: staff.map((x) => ({ id: x.id, workDays: x.workDays })),
    busy: await busyOn(tx, date, staff.map((x) => x.id), excludeAppointmentId),
  });
  return { service, slots };
}

// Booking, cancelling and rescheduling by guests (website and Telegram)

export type BookingSourceKind = "WEBSITE" | "TELEGRAM";
export type GuestBookingResult =
  | {
      ok: true;
      appointmentId: string;
      summary: { name: string; service: string; master: string; when: string; phone: string };
      /** Prepayment to make online before the time is confirmed */
      payment?: { id: string; amount: number; payBy: string };
      promo?: { title: string; price: number; fullPrice: number };
    }
  | { ok: false; error: string };

const lockDate = (tx: Prisma.TransactionClient, date: Ymd) =>
  tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"booking:" + date}))::text AS locked`;

const shortName = (full: string) => {
  const [first, last] = full.split(" ");
  return last ? `${first} ${last[0]}.` : first!;
};

/**
 * Books a free slot for a guest. The slot is re-checked inside a transaction holding a per-date lock,
 * so two guests can't take the same time. Lands in the CMS calendar as "Ожидание".
 * `lang` is the guest's language: errors, the summary and her confirmation come in it (reception stays in Russian).
 */
export async function createGuestBooking(input: {
  serviceId: string;
  staffId: string | null;
  date: Ymd;
  time: string;
  name: string;
  phone: string; // normalized +992…
  source: BookingSourceKind;
  guestId?: string;
  telegramChatId?: string;
  lang?: Lang;
  /** Promo code typed by the guest (otherwise the best automatic offer applies) */
  promoCode?: string | null;
  /** A service not shown on the website (the trial look of a bridal package) */
  includeHidden?: boolean;
  /** Added to the reception alert and the booking note */
  note?: string;
}): Promise<GuestBookingResult> {
  const lang = input.lang ?? "ru";
  const e = dict(lang).errors;
  const pe = loyaltyDict(lang).promo;
  return db.$transaction(async (tx) => {
    await lockDate(tx, input.date);
    const { service, slots } = await slotsFor(input.serviceId, input.date, input.staffId, tx, undefined, input.includeHidden);
    if (!service) return { ok: false as const, error: e.serviceUnavailable };
    const slot = slots.find((x) => x.time === input.time);
    if (!slot) return { ok: false as const, error: e.slotTaken };
    const staffId = slot.staffIds[0]!;
    const master = service.staff.find((m) => m.id === staffId)!;
    // Promotion: the code she typed, or the best automatic offer on that day
    const promos = await promotionsBetween(tx, input.date);
    let promo: (typeof promos)[number] | null = null;
    if (input.promoCode) {
      const code = normalizePromoCode(input.promoCode);
      const found = promos.find((p) => p.code === code);
      if (!found) return { ok: false as const, error: (await tx.promotion.findUnique({ where: { code } })) ? pe.invalid : pe.unknown };
      if (!promoApplies(found, service.id, input.date)) return { ok: false as const, error: pe.invalid };
      promo = found;
    } else promo = bestOffer(promos, service.id, service.price, input.date);
    const price = promo ? promoPrice(service.price, promo).price : service.price;

    const found =
      (input.guestId ? await tx.guest.findUnique({ where: { id: input.guestId } }) : null) ?? (await tx.guest.findUnique({ where: { phone: input.phone } }));
    const guest = found
      ? input.lang && found.lang !== input.lang
        ? await tx.guest.update({ where: { id: found.id }, data: { lang: input.lang } })
        : found
      : await tx.guest.create({ data: { name: input.name, phone: input.phone, tag: "NEW", lang } });
    const startsAt = atSalonTime(input.date, input.time);
    // Services with a prepayment (weddings, long looks) hold the time until it is paid online
    const deposit = depositFor(price, service.depositPercent);
    const holdUntil = deposit ? new Date(Date.now() + DEPOSIT_HOLD_MIN * 60_000) : null;
    const appt = await tx.appointment.create({
      data: {
        depositRequired: deposit,
        holdUntil,
        guestId: guest.id,
        guestName: shortName(guest.name),
        serviceId: service.id,
        serviceLabel: service.name,
        startsAt,
        durationMin: service.durationMin,
        price,
        fullPrice: promo ? service.price : null,
        promotionId: promo?.id ?? null,
        note: [input.note, promo ? `${promo.code ? `Промокод ${promo.code}` : "Акция"}: ${promo.title}` : null].filter(Boolean).join(" · ") || null,
        status: "PENDING",
        source: input.source,
        staff: { create: [{ staffId }] },
      },
    });
    if (promo) await tx.promotion.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } });
    const via = input.source === "TELEGRAM" ? "Telegram" : "сайта";
    const ctx = await messageContext(tx);
    const varsIn = (l: Lang) => appointmentVars(ctx, l, { startsAt, serviceId: service.id, serviceLabel: service.name, staff: [master] }, input.name);
    const vars = varsIn(lang);
    const messages: Prisma.OutboxMessageCreateManyInput[] = [
      {
        channel: "telegram",
        to: "reception",
        body: `Онлайн-запись с ${via}${input.note ? ` (${input.note})` : ""}: ${guest.name}, ${formatPhone(guest.phone)} - ${service.name}, ${longDate(startsAt)}, ${clock(startsAt)}, мастер ${master.name}.${promo ? ` ${promo.code ? `Промокод ${promo.code}` : `Акция «${promo.title}»`}: ${somoni(price)} вместо ${somoni(service.price)}.` : ""}${lang === "ru" ? "" : ` Язык гостьи: ${LANG_NAME[lang]}.`}${deposit ? ` Ждёт предоплату ${somoni(deposit)} до ${clock(holdUntil!)}.` : " Подтвердите в календаре."}`,
        meta: { kind: "online-booking", appointmentId: appt.id },
      },
    ];
    // Website bookings get a confirmation message (after the prepayment, if any); in Telegram the bot confirms in the chat itself.
    if (input.source === "WEBSITE" && !deposit) {
      messages.push(await guestMessage(tx, ctx, { guest, kind: "booking-confirmation", vars: varsIn, meta: { appointmentId: appt.id } }));
    }
    const forMaster = await newBookingAlert(tx, staffId, { guestName: guest.name, phone: guest.phone, serviceLabel: service.name, startsAt }, { appointmentId: appt.id, deposit });
    if (forMaster) messages.push(forMaster);
    await tx.outboxMessage.createMany({ data: messages });
    if (input.telegramChatId) await tx.telegramChat.update({ where: { id: input.telegramChatId }, data: { guestId: guest.id } });
    const payment = deposit
      ? await tx.payment.create({
          data: {
            purpose: "DEPOSIT",
            amount: deposit,
            description: `Предоплата: ${service.name}, ${longDate(startsAt)}, ${clock(startsAt)}`,
            appointmentId: appt.id,
            lang,
            returnPath: "/kabinet",
            expiresAt: holdUntil!,
          },
        })
      : null;
    return {
      ok: true as const,
      appointmentId: appt.id,
      ...(payment ? { payment: { id: payment.id, amount: payment.amount, payBy: clock(holdUntil!) } } : {}),
      summary: { name: input.name, service: vars.service!, master: vars.master!, when: vars.when!, phone: formatPhone(guest.phone) },
      ...(promo ? { promo: { title: promo.titles[lang], price, fullPrice: service.price } } : {}),
    };
  });
}

/** The guest's upcoming, not cancelled bookings (service and master names in her language). */
export async function upcomingForGuest(guestId: string, lang: Lang = "ru") {
  const [list, name] = await Promise.all([
    db.appointment.findMany({
      where: { guestId, startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: { staff: { include: { staff: true } } },
    }),
    namerFor(lang),
  ]);
  return list.map((a) => ({
    id: a.id,
    service: name("services", a.serviceId, a.serviceLabel),
    serviceId: a.serviceId,
    startsAt: a.startsAt,
    master: a.staff.map((s) => name("staff", s.staffId, s.staff.name)).join(" + "),
    staffId: a.staff[0]?.staffId ?? null,
    status: a.status,
  }));
}

/** Guest cancels her own booking (at least 2 hours ahead). Reception is notified. */
export async function cancelByGuest(appointmentId: string, guestId: string, lang: Lang = "ru"): Promise<{ ok: boolean; error?: string }> {
  const e = dict(lang).errors;
  const a = await db.appointment.findFirst({ where: { id: appointmentId, guestId }, include: { guest: true, staff: { select: { staffId: true } } } });
  if (!a || !["PENDING", "CONFIRMED"].includes(a.status)) return { ok: false, error: e.notFound };
  if (a.startsAt.getTime() - Date.now() < 2 * 3600_000) return { ok: false, error: e.tooLate };
  const visit = { guestName: a.guest?.name ?? a.guestName, phone: a.guest?.phone ?? null, serviceLabel: a.serviceLabel, startsAt: a.startsAt };
  const forMasters = await forEachMaster(a.staff.map((s) => s.staffId), (staffId) => cancelAlert(db, staffId, visit, a.id));
  await db.$transaction([
    db.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED", holdUntil: null } }),
    db.payment.updateMany({ where: { appointmentId: a.id, status: "PENDING" }, data: { status: "CANCELLED" } }),
    db.outboxMessage.create({
      data: {
        channel: "telegram",
        to: "reception",
        body: `Гостья отменила запись: ${a.guest?.name ?? a.guestName} - ${a.serviceLabel}, ${longDate(a.startsAt)}, ${clock(a.startsAt)}.${a.depositPaid ? ` Внесена предоплата ${somoni(a.depositPaid)} - решите с гостьей возврат или перенос.` : ""}`,
        meta: { kind: "guest-cancel", appointmentId: a.id },
      },
    }),
    ...forMasters.map((row) => db.outboxMessage.create({ data: row })),
  ]);
  await onBookingCancelled(db, a); // the freed time goes to the waitlist
  return { ok: true };
}

/** Guest moves her booking to another free time with the same master. */
export async function rescheduleByGuest(appointmentId: string, guestId: string, date: Ymd, time: string, lang: Lang = "ru"): Promise<GuestBookingResult> {
  const e = dict(lang).errors;
  const name = await namerFor(lang);
  const result = await db.$transaction(async (tx): Promise<GuestBookingResult & { freed?: { startsAt: Date; durationMin: number } }> => {
    const a = await tx.appointment.findFirst({ where: { id: appointmentId, guestId }, include: { staff: { include: { staff: true } }, guest: true } });
    if (!a || !a.serviceId || !["PENDING", "CONFIRMED"].includes(a.status)) return { ok: false as const, error: e.notFound };
    await lockDate(tx, date);
    const staffId = a.staff[0]?.staffId ?? null;
    const { slots } = await slotsFor(a.serviceId, date, staffId, tx, a.id);
    if (!slots.some((x) => x.time === time)) return { ok: false as const, error: e.slotBusy };
    const startsAt = atSalonTime(date, time);
    const freed = { startsAt: a.startsAt, durationMin: a.durationMin };
    await tx.appointment.update({ where: { id: a.id }, data: { startsAt, status: "PENDING", remindedDayAt: null, remindedHoursAt: null } });
    await tx.outboxMessage.create({
      data: {
        channel: "telegram",
        to: "reception",
        body: `Гостья перенесла запись: ${a.guest?.name ?? a.guestName} - ${a.serviceLabel}, теперь ${longDate(startsAt)}, ${clock(startsAt)}. Подтвердите в календаре.`,
        meta: { kind: "guest-reschedule", appointmentId: a.id },
      },
    });
    const visit = { guestName: a.guest?.name ?? a.guestName, phone: a.guest?.phone ?? null, serviceLabel: a.serviceLabel, startsAt };
    const forMasters = await forEachMaster(a.staff.map((s) => s.staffId), (id) => rescheduleAlert(tx, id, visit, freed.startsAt, a.id));
    if (forMasters.length) await tx.outboxMessage.createMany({ data: forMasters });
    return {
      ok: true as const,
      appointmentId: a.id,
      summary: {
        name: a.guest?.name ?? a.guestName,
        service: name("services", a.serviceId, a.serviceLabel),
        master: a.staff.map((s) => name("staff", s.staffId, s.staff.name)).join(" + "),
        when: when(startsAt, lang),
        phone: formatPhone(a.guest?.phone ?? ""),
      },
      freed,
    };
  });
  if (result.ok && result.freed) await onBookingCancelled(db, result.freed);
  if (!result.ok) return result;
  const { freed: _freed, ...rest } = result;
  return rest;
}
