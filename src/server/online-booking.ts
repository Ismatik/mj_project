import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { clock, longDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { freeSlots, type BusyInterval } from "@/lib/slots";
import { addDays, atSalonTime, todayYmd, type Ymd } from "@/lib/time";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Public menu for online booking: services shown on the site, with masters who do them (names only). */
export async function getOnlineMenu() {
  const categories = await db.serviceCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      services: {
        where: { active: true, showOnSite: true },
        orderBy: { sortOrder: "asc" },
        include: { staff: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, title: true } } },
      },
    },
  });
  return categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      services: c.services
        .filter((s) => s.staff.length)
        .map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, price: s.price, staff: s.staff })),
    }))
    .filter((c) => c.services.length);
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
export async function slotsFor(serviceId: string, date: Ymd, staffId: string | null, tx: Tx = db, excludeAppointmentId?: string) {
  const service = await tx.service.findFirst({
    where: { id: serviceId, active: true, showOnSite: true },
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

// ─── Booking, cancelling and rescheduling by guests (website and Telegram) ───

export type BookingSourceKind = "WEBSITE" | "TELEGRAM";
export type GuestBookingResult =
  | { ok: true; appointmentId: string; summary: { name: string; service: string; master: string; when: string; phone: string } }
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
}): Promise<GuestBookingResult> {
  return db.$transaction(async (tx) => {
    await lockDate(tx, input.date);
    const { service, slots } = await slotsFor(input.serviceId, input.date, input.staffId, tx);
    if (!service) return { ok: false as const, error: "Услуга недоступна для онлайн-записи" };
    const slot = slots.find((x) => x.time === input.time);
    if (!slot) return { ok: false as const, error: "Это время только что заняли — выберите другое" };
    const staffId = slot.staffIds[0]!;
    const master = service.staff.find((m) => m.id === staffId)!;

    const guest =
      (input.guestId ? await tx.guest.findUnique({ where: { id: input.guestId } }) : null) ??
      (await tx.guest.findUnique({ where: { phone: input.phone } })) ??
      (await tx.guest.create({ data: { name: input.name, phone: input.phone, tag: "NEW" } }));
    const startsAt = atSalonTime(input.date, input.time);
    const appt = await tx.appointment.create({
      data: {
        guestId: guest.id,
        guestName: shortName(guest.name),
        serviceId: service.id,
        serviceLabel: service.name,
        startsAt,
        durationMin: service.durationMin,
        price: service.price,
        status: "PENDING",
        source: input.source,
        staff: { create: [{ staffId }] },
      },
    });
    const when = `${longDate(startsAt)}, ${clock(startsAt)}`;
    const via = input.source === "TELEGRAM" ? "Telegram" : "сайта";
    const messages: Prisma.OutboxMessageCreateManyInput[] = [
      {
        channel: "telegram",
        to: "reception",
        body: `Онлайн-запись с ${via}: ${guest.name}, ${formatPhone(guest.phone)} — ${service.name}, ${when}, мастер ${master.name}. Подтвердите в календаре.`,
        meta: { kind: "online-booking", appointmentId: appt.id },
      },
    ];
    // Website bookings get a confirmation message; in Telegram the bot confirms in the chat itself.
    if (input.source === "WEBSITE") {
      const chat = await tx.telegramChat.findFirst({ where: { guestId: guest.id, isStaff: false }, orderBy: { updatedAt: "desc" } });
      messages.push({
        channel: chat ? "telegram" : "whatsapp",
        to: chat ? chat.id : guest.phone,
        body: `Mavzunai Jovid: ${input.name}, вы записаны — ${service.name}, ${when}, мастер ${master.name}. ул. Бухоро 23/25. Если планы изменятся, напишите нам.`,
        meta: { kind: "booking-confirmation", appointmentId: appt.id },
      });
    }
    await tx.outboxMessage.createMany({ data: messages });
    if (input.telegramChatId) await tx.telegramChat.update({ where: { id: input.telegramChatId }, data: { guestId: guest.id } });
    return { ok: true as const, appointmentId: appt.id, summary: { name: input.name, service: service.name, master: master.name, when, phone: formatPhone(guest.phone) } };
  });
}

/** The guest's upcoming, not cancelled bookings. */
export async function upcomingForGuest(guestId: string) {
  const list = await db.appointment.findMany({
    where: { guestId, startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
    orderBy: { startsAt: "asc" },
    take: 5,
    include: { staff: { include: { staff: true } } },
  });
  return list.map((a) => ({
    id: a.id,
    service: a.serviceLabel,
    serviceId: a.serviceId,
    startsAt: a.startsAt,
    master: a.staff.map((s) => s.staff.name).join(" + "),
    staffId: a.staff[0]?.staffId ?? null,
    status: a.status,
  }));
}

/** Guest cancels her own booking (at least 2 hours ahead). Reception is notified. */
export async function cancelByGuest(appointmentId: string, guestId: string): Promise<{ ok: boolean; error?: string }> {
  const a = await db.appointment.findFirst({ where: { id: appointmentId, guestId }, include: { guest: true } });
  if (!a || !["PENDING", "CONFIRMED"].includes(a.status)) return { ok: false, error: "Запись не найдена" };
  if (a.startsAt.getTime() - Date.now() < 2 * 3600_000) return { ok: false, error: "До визита меньше двух часов — позвоните нам, пожалуйста" };
  await db.$transaction([
    db.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED" } }),
    db.outboxMessage.create({
      data: {
        channel: "telegram",
        to: "reception",
        body: `Гостья отменила запись: ${a.guest?.name ?? a.guestName} — ${a.serviceLabel}, ${longDate(a.startsAt)}, ${clock(a.startsAt)}.`,
        meta: { kind: "guest-cancel", appointmentId: a.id },
      },
    }),
  ]);
  return { ok: true };
}

/** Guest moves her booking to another free time with the same master. */
export async function rescheduleByGuest(appointmentId: string, guestId: string, date: Ymd, time: string): Promise<GuestBookingResult> {
  return db.$transaction(async (tx) => {
    const a = await tx.appointment.findFirst({ where: { id: appointmentId, guestId }, include: { staff: { include: { staff: true } }, guest: true } });
    if (!a || !a.serviceId || !["PENDING", "CONFIRMED"].includes(a.status)) return { ok: false as const, error: "Запись не найдена" };
    await lockDate(tx, date);
    const staffId = a.staff[0]?.staffId ?? null;
    const { slots } = await slotsFor(a.serviceId, date, staffId, tx, a.id);
    if (!slots.some((x) => x.time === time)) return { ok: false as const, error: "Это время уже занято — выберите другое" };
    const startsAt = atSalonTime(date, time);
    await tx.appointment.update({ where: { id: a.id }, data: { startsAt, status: "PENDING", remindedDayAt: null, remindedHoursAt: null } });
    const when = `${longDate(startsAt)}, ${clock(startsAt)}`;
    await tx.outboxMessage.create({
      data: {
        channel: "telegram",
        to: "reception",
        body: `Гостья перенесла запись: ${a.guest?.name ?? a.guestName} — ${a.serviceLabel}, теперь ${when}. Подтвердите в календаре.`,
        meta: { kind: "guest-reschedule", appointmentId: a.id },
      },
    });
    return {
      ok: true as const,
      appointmentId: a.id,
      summary: { name: a.guest?.name ?? a.guestName, service: a.serviceLabel, master: a.staff.map((s) => s.staff.name).join(" + "), when, phone: formatPhone(a.guest?.phone ?? "") },
    };
  });
}
