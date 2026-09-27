import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { clock } from "@/lib/format";
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

async function busyOn(tx: Tx, date: Ymd, staffIds: string[]): Promise<BusyInterval[]> {
  const appts = await tx.appointment.findMany({
    where: {
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
export async function slotsFor(serviceId: string, date: Ymd, staffId: string | null, tx: Tx = db) {
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
    busy: await busyOn(tx, date, staff.map((x) => x.id)),
  });
  return { service, slots };
}
