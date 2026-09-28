import "server-only";
import { db } from "@/lib/db";
import { todayYmd, type Ymd } from "@/lib/time";
import { dayRange } from "./ranges";

export async function getPos(today: Ymd = todayYmd()) {
  const [menu, waiting, staff, recent] = await Promise.all([
    db.service.findMany({
      where: { showInPos: true, active: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      select: { id: true, name: true, price: true },
    }),
    db.appointment.findMany({
      where: { startsAt: dayRange(today), status: { in: ["PENDING", "CONFIRMED", "IN_CHAIR"] } },
      orderBy: { startsAt: "asc" },
      include: { staff: { include: { staff: true } } },
    }),
    db.staff.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.sale.findMany({
      where: { createdAt: dayRange(today) },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { guest: true, staff: true, items: true },
    }),
  ]);

  return {
    menu,
    staff,
    waiting: waiting.map((a) => ({
      id: a.id,
      guestId: a.guestId,
      guestName: a.guestName,
      serviceId: a.serviceId,
      service: a.serviceLabel,
      price: a.price,
      /** Paid online in advance — counted in the receipt */
      depositPaid: a.depositPaid,
      startsAt: a.startsAt,
      staffId: a.staff[0]?.staffId ?? null,
      staffNames: a.staff.map((s) => s.staff.name).join(" + "),
      status: a.status,
    })),
    recent: recent.map((s) => ({
      id: s.id,
      number: s.number,
      total: s.total,
      paid: s.paid,
      depositAmount: s.depositAmount,
      giftCardAmount: s.giftCardAmount,
      method: s.method,
      createdAt: s.createdAt,
      guest: s.guest?.name ?? null,
      staff: s.staff?.name ?? null,
      items: s.items.map((i) => i.name),
    })),
  };
}

export type PosData = Awaited<ReturnType<typeof getPos>>;
