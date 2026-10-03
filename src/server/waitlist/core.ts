// Waitlist: when a booking is cancelled, the freed time is offered to the first guest waiting for that day
// and held for her for 30 minutes; she confirms or declines by a link. Unanswered offers expire (worker)
// and the time goes to the next guest. No "server-only" import: the worker uses this file too.
import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { clock, longDate, somoni } from "../../lib/format";
import { asLang, LANG_NAME, type Lang } from "../../lib/i18n/locales";
import { bestOffer, promoPrice } from "../../lib/loyalty";
import { formatPhone } from "../../lib/phone";
import { siteLink } from "../../lib/site-url";
import { freeSlots, type BusyInterval } from "../../lib/slots";
import { addDays, atSalonTime, todayYmd, type Ymd } from "../../lib/time";
import { offerExpiry, pickOffer } from "../../lib/waitlist";
import { appointmentVars, guestMessage, messageContext } from "../integrations/guest-messages";
import { forEachMaster, newBookingAlert } from "../integrations/master-alerts";
import { promotionsBetween } from "../loyalty/core";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export const newWaitlistToken = () => randomBytes(18).toString("base64url");
export const dateOf = (ymd: Ymd) => new Date(`${ymd}T00:00:00Z`);
export const ymdOf = (d: Date) => d.toISOString().slice(0, 10);
export const minutesOf = (d: Date) => {
  const [h, m] = clock(d).split(":").map(Number);
  return h! * 60 + m!;
};
export const shortName = (full: string) => {
  const [first, last] = full.trim().split(/\s+/);
  return last ? `${first} ${last[0]}.` : first!;
};
const lockDate = (tx: Tx, date: Ymd) => tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"booking:" + date}))::text AS locked`;

export async function busyOn(tx: Tx | Db, date: Ymd, staffIds: string[]): Promise<BusyInterval[]> {
  const appts = await tx.appointment.findMany({
    where: {
      startsAt: { gte: atSalonTime(date), lt: atSalonTime(addDays(date, 1)) },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      staff: { some: { staffId: { in: staffIds } } },
    },
    include: { staff: true },
  });
  return appts.flatMap((a) => a.staff.map((s) => ({ staffId: s.staffId, start: minutesOf(a.startsAt), end: minutesOf(a.startsAt) + a.durationMin })));
}

/** Free times for any active service (also ones not shown on the website) */
export async function freeSlotsFor(tx: Tx | Db, serviceId: string, date: Ymd, staffId: string | null) {
  const service = await tx.service.findFirst({ where: { id: serviceId, active: true }, include: { staff: { where: { active: true }, orderBy: { sortOrder: "asc" } } } });
  if (!service) return { service: null, slots: [] };
  const staff = service.staff.filter((m) => !staffId || m.id === staffId);
  const now = new Date();
  const slots = freeSlots({
    date,
    today: todayYmd(now),
    nowMinutes: minutesOf(now),
    durationMin: service.durationMin,
    staff: staff.map((m) => ({ id: m.id, workDays: m.workDays })),
    busy: await busyOn(tx, date, staff.map((m) => m.id)),
  });
  return { service, slots };
}

export type OfferResult = { entryId: string; appointmentId: string; name: string; when: string } | null;

/**
 * Offers a free time on `date` to the first waiting guest it suits (her service, master and window).
 * `freed` limits it to the time a cancelled booking left; without it any free time that day counts.
 */
export async function offerFreed(db: Db, date: Ymd, freed: { start: number; end: number } | null, only?: { entryId: string }): Promise<OfferResult> {
  const entries = await db.waitlistEntry.findMany({
    where: { kind: "WAITLIST", status: "WAITING", date: dateOf(date), ...(only ? { id: only.entryId } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const { id } of entries) {
    const res = await db.$transaction(async (tx) => {
      await lockDate(tx, date);
      const e = await tx.waitlistEntry.findUnique({ where: { id } });
      if (!e || e.status !== "WAITING") return null;
      const { service, slots } = await freeSlotsFor(tx, e.serviceId, date, e.staffId);
      if (!service) return null;
      const slot = pickOffer(slots, { timeFrom: e.timeFrom, timeTo: e.timeTo, freed });
      if (!slot) return null;
      const startsAt = atSalonTime(date, slot.time);
      const expires = offerExpiry(new Date(), startsAt);
      if (!expires) return null;
      const master = service.staff.find((m) => m.id === slot.staffIds[0])!;
      const guest = e.guestId ? await tx.guest.findUnique({ where: { id: e.guestId } }) : e.phone ? await tx.guest.findUnique({ where: { phone: e.phone } }) : null;
      const offer = bestOffer(await promotionsBetween(tx, date), service.id, service.price, date);
      const price = offer ? promoPrice(service.price, offer).price : service.price;
      const appt = await tx.appointment.create({
        data: {
          guestId: guest?.id ?? null,
          guestName: shortName(e.name),
          serviceId: service.id,
          serviceLabel: service.name,
          startsAt,
          durationMin: service.durationMin,
          price,
          fullPrice: offer ? service.price : null,
          promotionId: offer?.id ?? null,
          status: "PENDING",
          source: e.source === "WALK_IN" ? "CMS" : e.source,
          holdUntil: expires,
          note: `Лист ожидания: ждём ответа гостьи до ${clock(expires)}`,
          staff: { create: [{ staffId: master.id }] },
        },
      });
      await tx.waitlistEntry.update({ where: { id: e.id }, data: { status: "OFFERED", offerId: appt.id, offerExpiresAt: expires, offers: { increment: 1 }, guestId: guest?.id ?? e.guestId } });

      const lang = asLang(e.lang);
      const ctx = await messageContext(tx);
      const link = siteLink(`/ochered/${e.token}`, lang);
      const vars = (l: Lang) => ({ ...appointmentVars(ctx, l, { startsAt, serviceId: service.id, serviceLabel: service.name, staff: [master] }, e.name), link: siteLink(`/ochered/${e.token}`, l) });
      const messages: Prisma.OutboxMessageCreateManyInput[] = [
        {
          channel: "telegram",
          to: "reception",
          body: `Лист ожидания: освободившееся время предложено гостье ${e.name}${e.phone ? `, ${formatPhone(e.phone)}` : ""} - ${service.name}, ${longDate(startsAt)}, ${clock(startsAt)}, мастер ${master.name}. Держим до ${clock(expires)}.${e.phone ? "" : " Номера нет - позвоните или напишите ей сами."}`,
          meta: { kind: "waitlist-offer", entryId: e.id, appointmentId: appt.id },
        },
      ];
      if (e.phone) messages.push(await guestMessage(tx, ctx, { guest: { id: guest?.id ?? "-", phone: e.phone, lang }, kind: "waitlist-offer", vars, meta: { entryId: e.id, link } }));
      await tx.outboxMessage.createMany({ data: messages });
      return { entryId: e.id, appointmentId: appt.id, name: e.name, when: `${longDate(startsAt)}, ${clock(startsAt)}` };
    });
    if (res) return res;
  }
  return null;
}

/** A booking was cancelled: its time goes to the waitlist. Called by every cancel path. */
export async function onBookingCancelled(db: Db, a: { startsAt: Date; durationMin: number }): Promise<OfferResult> {
  if (a.startsAt < new Date()) return null;
  const start = minutesOf(a.startsAt);
  return offerFreed(db, todayYmd(a.startsAt), { start, end: start + a.durationMin });
}

export type OfferState =
  | { state: "offered"; entry: OfferView }
  | { state: "booked"; entry: OfferView }
  | { state: "declined" | "expired" | "gone" };
type OfferView = { name: string; serviceId: string; service: string; staffId: string; master: string; startsAt: Date; expiresAt: Date | null; lang: Lang };

export async function offerByToken(db: Db, token: string): Promise<OfferState> {
  const e = await db.waitlistEntry.findUnique({ where: { token }, include: { offer: { include: { staff: { include: { staff: true } } } } } });
  if (!e) return { state: "gone" };
  if (e.status === "DECLINED") return { state: "declined" };
  const a = e.offer;
  if (!a) return { state: e.status === "EXPIRED" ? "expired" : "gone" };
  const view: OfferView = {
    name: e.name,
    serviceId: a.serviceId ?? "",
    service: a.serviceLabel,
    staffId: a.staff[0]?.staffId ?? "",
    master: a.staff.map((s) => s.staff.name).join(" + "),
    startsAt: a.startsAt,
    expiresAt: e.offerExpiresAt,
    lang: asLang(e.lang),
  };
  if (e.status === "BOOKED") return { state: "booked", entry: view };
  if (e.status !== "OFFERED" || a.status === "CANCELLED" || !e.offerExpiresAt || e.offerExpiresAt < new Date()) return { state: "expired" };
  return { state: "offered", entry: view };
}

/** She takes the offered time: the booking is confirmed and she gets the usual confirmation. */
export async function acceptOffer(db: Db, token: string): Promise<{ ok: boolean; error?: "expired" | "gone" }> {
  return db.$transaction(async (tx) => {
    const e = await tx.waitlistEntry.findUnique({ where: { token }, include: { offer: { include: { staff: { include: { staff: true } } } } } });
    if (!e || !e.offer) return { ok: false, error: "gone" as const };
    if (e.status === "BOOKED") return { ok: true };
    const a = e.offer;
    if (e.status !== "OFFERED" || a.status !== "PENDING" || !e.offerExpiresAt || e.offerExpiresAt < new Date()) return { ok: false, error: "expired" as const };
    const lang = asLang(e.lang);
    let guest = e.guestId ? await tx.guest.findUnique({ where: { id: e.guestId } }) : e.phone ? await tx.guest.findUnique({ where: { phone: e.phone } }) : null;
    if (!guest && e.phone) guest = await tx.guest.create({ data: { name: e.name, phone: e.phone, tag: "NEW", lang } });
    await tx.appointment.update({ where: { id: a.id }, data: { status: "CONFIRMED", holdUntil: null, guestId: guest?.id ?? null, note: "Из листа ожидания" } });
    await tx.waitlistEntry.update({ where: { id: e.id }, data: { status: "BOOKED", guestId: guest?.id ?? null } });
    const ctx = await messageContext(tx);
    const staff = a.staff.map((s) => s.staff);
    const messages: Prisma.OutboxMessageCreateManyInput[] = [
      {
        channel: "telegram",
        to: "reception",
        body: `Лист ожидания: ${e.name} подтвердила время - ${a.serviceLabel}, ${longDate(a.startsAt)}, ${clock(a.startsAt)}, мастер ${staff.map((m) => m.name).join(" + ")}, ${somoni(a.price)}.${lang === "ru" ? "" : ` Язык гостьи: ${LANG_NAME[lang]}.`}`,
        meta: { kind: "waitlist-booked", entryId: e.id, appointmentId: a.id },
      },
    ];
    if (guest) messages.push(await guestMessage(tx, ctx, { guest, kind: "booking-confirmation", vars: (l) => appointmentVars(ctx, l, { ...a, staff }, e.name), meta: { appointmentId: a.id } }));
    // Told now that she has said yes, not when the time was offered: most offers expire unanswered,
    // and a booking that evaporates in half an hour is worse than no message at all.
    const visit = { guestName: e.name, phone: e.phone, serviceLabel: a.serviceLabel, startsAt: a.startsAt };
    messages.push(...(await forEachMaster(a.staff.map((s) => s.staffId), (staffId) => newBookingAlert(tx, staffId, visit, { appointmentId: a.id }))));
    await tx.outboxMessage.createMany({ data: messages });
    return { ok: true };
  });
}

/** She doesn't want the offered time: it is released and offered to the next guest. */
export async function declineOffer(db: Db, token: string): Promise<{ ok: boolean }> {
  const e = await db.waitlistEntry.findUnique({ where: { token }, include: { offer: true } });
  if (!e || e.status !== "OFFERED" || !e.offer) return { ok: false };
  const a = e.offer;
  await db.$transaction([
    db.waitlistEntry.update({ where: { id: e.id }, data: { status: "DECLINED" } }),
    db.appointment.updateMany({ where: { id: a.id, status: "PENDING" }, data: { status: "CANCELLED", holdUntil: null, note: "Лист ожидания: гостья отказалась" } }),
    db.outboxMessage.create({
      data: { channel: "telegram", to: "reception", body: `Лист ожидания: ${e.name} отказалась от времени ${longDate(a.startsAt)}, ${clock(a.startsAt)} (${a.serviceLabel}).`, meta: { kind: "waitlist-declined", entryId: e.id } },
    }),
  ]);
  await onBookingCancelled(db, a);
  return { ok: true };
}

/** Worker, every minute: offers nobody answered are released and go to the next guest. */
export async function expireOffers(db: Db, now = new Date()): Promise<number> {
  const due = await db.waitlistEntry.findMany({ where: { status: "OFFERED", offerExpiresAt: { lt: now } }, include: { offer: true } });
  for (const e of due) {
    await db.waitlistEntry.update({ where: { id: e.id }, data: { status: "EXPIRED" } });
    if (e.offer && e.offer.status === "PENDING" && e.offer.holdUntil) {
      await db.appointment.update({ where: { id: e.offer.id }, data: { status: "CANCELLED", holdUntil: null, note: "Лист ожидания: гостья не ответила" } });
      await db.outboxMessage.create({
        data: {
          channel: "telegram",
          to: "reception",
          body: `Лист ожидания: ${e.name} не ответила на предложение ${longDate(e.offer.startsAt)}, ${clock(e.offer.startsAt)}. Время предложено следующей гостье, если она есть.`,
          meta: { kind: "waitlist-expired", entryId: e.id },
        },
      });
      await onBookingCancelled(db, e.offer);
    }
  }
  return due.length;
}

/** Days in the past are no longer wanted */
export async function closePastEntries(db: Db, today = todayYmd()) {
  await db.waitlistEntry.updateMany({ where: { status: "WAITING", date: { lt: dateOf(today) } }, data: { status: "EXPIRED" } });
}

export type JoinInput = {
  serviceId: string;
  staffId: string | null;
  date: Ymd;
  timeFrom?: string | null;
  timeTo?: string | null;
  name: string;
  phone: string | null;
  guestId?: string | null;
  lang: Lang;
  source: "CMS" | "WEBSITE" | "TELEGRAM";
  note?: string | null;
  createdBy?: string | null;
};

/** Adds her to the waitlist for a day; if a matching time is already free, it is offered straight away. */
export async function joinWaitlist(db: Db, input: JoinInput) {
  const guest = input.guestId ? await db.guest.findUnique({ where: { id: input.guestId } }) : input.phone ? await db.guest.findUnique({ where: { phone: input.phone } }) : null;
  const existing = await db.waitlistEntry.findFirst({
    where: { kind: "WAITLIST", status: { in: ["WAITING", "OFFERED"] }, date: dateOf(input.date), serviceId: input.serviceId, ...(input.phone ? { phone: input.phone } : { name: input.name }) },
  });
  if (existing) return { entryId: existing.id, token: existing.token, duplicate: true, offered: null as OfferResult };
  const service = await db.service.findUnique({ where: { id: input.serviceId } });
  const e = await db.waitlistEntry.create({
    data: {
      kind: "WAITLIST",
      name: input.name,
      phone: input.phone,
      guestId: guest?.id ?? null,
      lang: input.lang,
      serviceId: input.serviceId,
      staffId: input.staffId,
      date: dateOf(input.date),
      timeFrom: input.timeFrom ?? null,
      timeTo: input.timeTo ?? null,
      note: input.note ?? null,
      source: input.source,
      token: newWaitlistToken(),
      createdBy: input.createdBy ?? null,
    },
  });
  if (input.source !== "CMS") {
    const via = input.source === "TELEGRAM" ? "Telegram" : "сайта";
    await db.outboxMessage.create({
      data: {
        channel: "telegram",
        to: "reception",
        body: `Лист ожидания (с ${via}): ${input.name}${input.phone ? `, ${formatPhone(input.phone)}` : ""} - ${service?.name ?? "услуга"}, ${longDate(atSalonTime(input.date, "12:00"))}${input.timeFrom || input.timeTo ? `, ${input.timeFrom ?? "…"}-${input.timeTo ?? "…"}` : ""}. Предложим время, если кто-то отменит запись.`,
        meta: { kind: "waitlist-join", entryId: e.id },
      },
    });
  }
  const offered = await offerFreed(db, input.date, null, { entryId: e.id });
  return { entryId: e.id, token: e.token, duplicate: false, offered };
}
