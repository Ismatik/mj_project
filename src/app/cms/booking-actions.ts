"use server";

import { revalidatePath } from "next/cache";
import { canBook } from "@/lib/access";
import { validateBooking, type BookingErrors, type BookingInput, type Busy } from "@/lib/booking";
import { db } from "@/lib/db";
import { clock, shortDate } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { addDays, atSalonTime, todayYmd, type Ymd } from "@/lib/time";
import { getCurrentUser } from "@/server/auth";
import { newBookingAlert } from "@/server/integrations/master-alerts";

async function requireBooker() {
  const user = await getCurrentUser();
  if (!user || !canBook(user.role)) throw new Error("Нет доступа к записи");
  return user;
}

export type BookingOptions = {
  categories: { id: string; name: string; services: { id: string; name: string; durationMin: number; price: number; staffIds: string[] }[] }[];
  staff: { id: string; name: string; title: string; workDays: number[] }[];
  today: Ymd;
};

export async function getBookingOptions(): Promise<BookingOptions> {
  await requireBooker();
  const [categories, staff] = await Promise.all([
    db.serviceCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        services: { where: { active: true }, orderBy: { sortOrder: "asc" }, include: { staff: { select: { id: true } } } },
      },
    }),
    db.staff.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return {
    today: todayYmd(),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      services: c.services.map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.durationMin,
        price: s.price,
        staffIds: s.staff.map((x) => x.id),
      })),
    })),
    staff: staff.map((s) => ({ id: s.id, name: s.name, title: s.title, workDays: s.workDays })),
  };
}

async function busyFor(staffIds: string[], date: Ymd): Promise<Busy[]> {
  if (!staffIds.length || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const appts = await db.appointment.findMany({
    where: {
      startsAt: { gte: atSalonTime(date), lt: atSalonTime(addDays(date, 1)) },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      staff: { some: { staffId: { in: staffIds } } },
    },
    include: { staff: true },
    orderBy: { startsAt: "asc" },
  });
  return appts.flatMap((a) => {
    const [h, m] = clock(a.startsAt).split(":").map(Number);
    const start = h! * 60 + m!;
    return a.staff
      .filter((s) => staffIds.includes(s.staffId))
      .map((s) => ({ staffId: s.staffId, start, end: start + a.durationMin, label: `${a.guestName}, ${a.serviceLabel}` }));
  });
}

/** The chosen masters' existing bookings that day — shown as a hint under the time field. */
export async function getBusy(staffIds: string[], date: Ymd): Promise<Busy[]> {
  await requireBooker();
  return busyFor(staffIds, date);
}

export type CreateBookingResult = { ok: true; message: string } | { ok: false; errors: BookingErrors; message?: string };

export async function createBooking(raw: BookingInput): Promise<CreateBookingResult> {
  await requireBooker();

  const input: BookingInput = {
    guestId: raw.guestId || null,
    guestName: String(raw.guestName ?? "").trim().slice(0, 80),
    guestPhone: String(raw.guestPhone ?? ""),
    serviceId: String(raw.serviceId ?? ""),
    staffIds: Array.isArray(raw.staffIds) ? raw.staffIds.map(String).slice(0, 3) : [],
    date: String(raw.date ?? ""),
    time: String(raw.time ?? ""),
    durationMin: 0,
    price: Number(raw.price),
    note: raw.note ? String(raw.note).slice(0, 500) : undefined,
  };

  const [service, staff, guest] = await Promise.all([
    input.serviceId ? db.service.findUnique({ where: { id: input.serviceId } }) : null,
    db.staff.findMany({ where: { id: { in: input.staffIds }, active: true } }),
    input.guestId ? db.guest.findUnique({ where: { id: input.guestId } }) : null,
  ]);
  if (input.serviceId && !service) return { ok: false, errors: { service: "Услуга не найдена" } };
  if (staff.length !== input.staffIds.length) return { ok: false, errors: { staff: "Мастер не найден" } };
  if (input.guestId && !guest) return { ok: false, errors: { guest: "Гостья не найдена" } };
  input.durationMin = service?.durationMin ?? 60;

  const now = new Date();
  const [h, m] = clock(now).split(":").map(Number);
  const errors = validateBooking(input, {
    today: todayYmd(now),
    nowMinutes: h! * 60 + m!,
    workDays: Object.fromEntries(staff.map((s) => [s.id, s.workDays])),
    staffNames: Object.fromEntries(staff.map((s) => [s.id, s.name])),
    busy: await busyFor(input.staffIds, input.date),
  });
  if (Object.keys(errors).length) return { ok: false, errors };

  // Existing guest, or find-or-create by phone
  let guestId = guest?.id;
  let guestName = guest?.name;
  if (!guestId) {
    const phone = normalizePhone(input.guestPhone)!;
    const found = await db.guest.findUnique({ where: { phone } });
    const g = found ?? (await db.guest.create({ data: { name: input.guestName, phone, tag: "NEW" } }));
    guestId = g.id;
    guestName = g.name;
  }
  const [first, last] = guestName!.split(" ");
  const shortName = last ? `${first} ${last[0]}.` : first!;

  const startsAt = atSalonTime(input.date, input.time.padStart(5, "0"));
  const appt = await db.appointment.create({
    data: {
      guestId,
      guestName: shortName,
      serviceId: service!.id,
      serviceLabel: service!.name,
      startsAt,
      durationMin: input.durationMin,
      price: input.price,
      status: "CONFIRMED",
      source: "CMS",
      note: input.note,
      staff: { create: input.staffIds.map((staffId) => ({ staffId })) },
    },
  });
  // Reception booked this one, so nobody has told the master yet.
  const phone = (await db.guest.findUnique({ where: { id: guestId }, select: { phone: true } }))?.phone ?? null;
  for (const staffId of input.staffIds) {
    const row = await newBookingAlert(db, staffId, { guestName: guestName!, phone, serviceLabel: service!.name, startsAt }, { appointmentId: appt.id });
    if (row) await db.outboxMessage.create({ data: row });
  }

  revalidatePath("/cms", "layout");
  return { ok: true, message: `${shortName} · ${service!.name} · ${shortDate(startsAt)}, ${clock(startsAt)}` };
}
