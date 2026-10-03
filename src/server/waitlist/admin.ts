import "server-only";
import { db } from "@/lib/db";
import { clock, longDate } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { atSalonTime, addDays, todayYmd, type Ymd } from "@/lib/time";
import { freeNow, isHhmm, waited } from "@/lib/waitlist";
import { busyOn, dateOf, joinWaitlist, minutesOf, newWaitlistToken, offerFreed, shortName, ymdOf } from "./core";

// CMS side of the waitlist: the walk-in queue for today and the waitlist for coming days.

export async function getWaitlistPage() {
  const today = todayYmd();
  const [walkIns, entries, recent, services, staff] = await Promise.all([
    db.waitlistEntry.findMany({ where: { kind: "WALK_IN", status: "WAITING", date: dateOf(today) }, orderBy: { createdAt: "asc" }, include: { service: true, staff: true } }),
    db.waitlistEntry.findMany({
      where: { kind: "WAITLIST", status: { in: ["WAITING", "OFFERED"] }, date: { gte: dateOf(today) } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: { service: true, staff: true, offer: { include: { staff: { include: { staff: true } } } } },
    }),
    db.waitlistEntry.findMany({
      where: { status: { notIn: ["WAITING", "OFFERED"] }, updatedAt: { gte: new Date(Date.now() - 7 * 864e5) } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { service: true, offer: true },
    }),
    db.service.findMany({ where: { active: true }, orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }], include: { staff: { where: { active: true }, select: { id: true } } } }),
    db.staff.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  // Who could take each walk-in right now
  const now = new Date();
  const busy = await busyOn(db, today, staff.map((m) => m.id));
  const names = new Map(staff.map((m) => [m.id, m.name]));
  const walkInRows = walkIns.map((w) => {
    const qualified = services.find((s) => s.id === w.serviceId)?.staff.map((x) => x.id) ?? [];
    const free = freeNow({
      date: today,
      nowMinutes: minutesOf(now),
      durationMin: w.service.durationMin,
      staff: staff.filter((m) => qualified.includes(m.id) && (!w.staffId || m.id === w.staffId)).map((m) => ({ id: m.id, workDays: m.workDays })),
      busy,
    });
    return {
      id: w.id,
      name: w.name,
      phone: w.phone,
      service: w.service.name,
      master: w.staff?.name ?? null,
      note: w.note,
      since: clock(w.createdAt),
      waited: waited(w.createdAt, now),
      freeNow: free ? { time: free.time, staff: free.staffIds.map((id) => ({ id, name: names.get(id)! })) } : null,
    };
  });

  return {
    today,
    walkIns: walkInRows,
    entries: entries.map((e) => ({
      id: e.id,
      date: ymdOf(e.date),
      dateLabel: longDate(atSalonTime(ymdOf(e.date), "12:00")),
      name: e.name,
      phone: e.phone,
      service: e.service.name,
      master: e.staff?.name ?? null,
      window: e.timeFrom || e.timeTo ? `${e.timeFrom ?? "09:00"}-${e.timeTo ?? "18:00"}` : null,
      note: e.note,
      source: e.source,
      status: e.status,
      offer: e.offer && e.status === "OFFERED" ? { at: `${clock(e.offer.startsAt)}`, master: e.offer.staff.map((s) => s.staff.name).join(" + "), until: e.offerExpiresAt ? clock(e.offerExpiresAt) : "" } : null,
      token: e.token,
    })),
    recent: recent.map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      service: e.service.name,
      status: e.status,
      date: ymdOf(e.date),
      at: e.offer ? `${longDate(e.offer.startsAt)}, ${clock(e.offer.startsAt)}` : null,
      updated: `${clock(e.updatedAt)}`,
    })),
    services: services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, staffIds: s.staff.map((x) => x.id) })),
    staff: staff.map((m) => ({ id: m.id, name: m.name })),
    dates: Array.from({ length: 30 }, (_, i) => addDays(today, i)),
  };
}
export type WaitlistPage = Awaited<ReturnType<typeof getWaitlistPage>>;

type Fail = { ok: false; error: string };

export async function addWalkIn(input: { name: string; phone: string; serviceId: string; staffId: string | null; note: string }, by: string): Promise<{ ok: true } | Fail> {
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) return { ok: false, error: "Как зовут гостью?" };
  const phone = input.phone.trim() ? normalizePhone(input.phone) : null;
  if (input.phone.trim() && !phone) return { ok: false, error: "Телефон: 9 цифр, например 98 103 11 11" };
  const service = await db.service.findFirst({ where: { id: input.serviceId, active: true } });
  if (!service) return { ok: false, error: "Выберите услугу" };
  const guest = phone ? await db.guest.findUnique({ where: { phone } }) : null;
  await db.waitlistEntry.create({
    data: {
      kind: "WALK_IN",
      name: guest?.name ?? name,
      phone,
      guestId: guest?.id ?? null,
      serviceId: service.id,
      staffId: input.staffId || null,
      date: dateOf(todayYmd()),
      note: input.note.trim().slice(0, 200) || null,
      source: "WALK_IN",
      token: newWaitlistToken(),
      createdBy: by,
    },
  });
  return { ok: true };
}

/** Seats a walk-in with a master who is free now: a booking "в кресле" from now on. */
export async function seatWalkIn(entryId: string, staffId: string | null, by: string): Promise<{ ok: true; master: string; time: string } | Fail> {
  const today = todayYmd();
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"booking:" + today}))::text AS locked`;
    const e = await tx.waitlistEntry.findUnique({ where: { id: entryId }, include: { service: { include: { staff: { where: { active: true } } } } } });
    if (!e || e.kind !== "WALK_IN" || e.status !== "WAITING") return { ok: false as const, error: "Гостья уже не в очереди" };
    const candidates = e.service.staff.filter((m) => (staffId ? m.id === staffId : !e.staffId || m.id === e.staffId));
    const free = freeNow({
      date: today,
      nowMinutes: minutesOf(new Date()),
      durationMin: e.service.durationMin,
      staff: candidates.map((m) => ({ id: m.id, workDays: m.workDays })),
      busy: await busyOn(tx, today, candidates.map((m) => m.id)),
    });
    if (!free) return { ok: false as const, error: staffId ? "Этот мастер сейчас занят" : "Сейчас все подходящие мастера заняты" };
    const master = candidates.find((m) => m.id === free.staffIds[0])!;
    let guest = e.guestId ? await tx.guest.findUnique({ where: { id: e.guestId } }) : null;
    if (!guest && e.phone) guest = (await tx.guest.findUnique({ where: { phone: e.phone } })) ?? (await tx.guest.create({ data: { name: e.name, phone: e.phone, tag: "NEW" } }));
    const appt = await tx.appointment.create({
      data: {
        guestId: guest?.id ?? null,
        guestName: guest ? shortName(guest.name) : e.name,
        serviceId: e.serviceId,
        serviceLabel: e.service.name,
        startsAt: atSalonTime(today, free.time),
        durationMin: e.service.durationMin,
        price: e.service.price,
        status: "IN_CHAIR",
        source: "WALK_IN",
        note: `Без записи, ждала ${waited(e.createdAt)}${e.note ? ` · ${e.note}` : ""}`,
        staff: { create: [{ staffId: master.id }] },
      },
    });
    await tx.waitlistEntry.update({ where: { id: e.id }, data: { status: "SERVED", offerId: appt.id, guestId: guest?.id ?? null, createdBy: e.createdBy ?? by } });
    return { ok: true as const, master: master.name, time: free.time };
  });
}

export async function setEntryStatus(entryId: string, status: "LEFT" | "CANCELLED"): Promise<{ ok: true } | Fail> {
  const e = await db.waitlistEntry.findUnique({ where: { id: entryId }, include: { offer: true } });
  if (!e || !["WAITING", "OFFERED"].includes(e.status)) return { ok: false, error: "Запись уже закрыта" };
  await db.waitlistEntry.update({ where: { id: e.id }, data: { status } });
  // A held time goes back
  if (e.status === "OFFERED" && e.offer?.status === "PENDING" && e.offer.holdUntil) {
    await db.appointment.update({ where: { id: e.offer.id }, data: { status: "CANCELLED", holdUntil: null } });
  }
  return { ok: true };
}

export async function addEntry(
  input: { name: string; phone: string; serviceId: string; staffId: string | null; date: Ymd; timeFrom: string; timeTo: string; note: string },
  by: string,
): Promise<{ ok: true; offered: boolean } | Fail> {
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) return { ok: false, error: "Как зовут гостью?" };
  const phone = input.phone.trim() ? normalizePhone(input.phone) : null;
  if (input.phone.trim() && !phone) return { ok: false, error: "Телефон: 9 цифр, например 98 103 11 11" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < todayYmd()) return { ok: false, error: "Выберите день" };
  const service = await db.service.findFirst({ where: { id: input.serviceId, active: true } });
  if (!service) return { ok: false, error: "Выберите услугу" };
  const guest = phone ? await db.guest.findUnique({ where: { phone } }) : null;
  const res = await joinWaitlist(db, {
    serviceId: service.id,
    staffId: input.staffId || null,
    date: input.date,
    timeFrom: isHhmm(input.timeFrom) ? input.timeFrom : null,
    timeTo: isHhmm(input.timeTo) ? input.timeTo : null,
    name: guest?.name ?? name,
    phone,
    guestId: guest?.id ?? null,
    lang: (guest?.lang as "ru" | "tg" | "en" | undefined) ?? "ru",
    source: "CMS",
    note: input.note.trim().slice(0, 200) || null,
    createdBy: by,
  });
  if (res.duplicate) return { ok: false, error: "Эта гостья уже ждёт эту услугу в этот день" };
  return { ok: true, offered: !!res.offered };
}

/** Looks for a free time for one waiting guest right now (reception presses "Найти время"). */
export async function offerNow(entryId: string): Promise<{ ok: true; when: string } | Fail> {
  const e = await db.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!e || e.status !== "WAITING" || e.kind !== "WAITLIST") return { ok: false, error: "Запись уже закрыта" };
  const res = await offerFreed(db, ymdOf(e.date), null, { entryId });
  return res ? { ok: true, when: res.when } : { ok: false, error: "Подходящего свободного времени пока нет" };
}

export async function waitingCount() {
  return db.waitlistEntry.count({ where: { status: { in: ["WAITING", "OFFERED"] }, date: { gte: dateOf(todayYmd()) } } });
}
