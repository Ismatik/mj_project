import "server-only";
import { db } from "@/lib/db";
import { clock, longDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

const CANCEL_LEAD_MS = 2 * 3600_000;

/** Everything the guest sees in her account: profile, upcoming bookings, past visits, favourite master. */
export async function getGuestAccount(guestId: string) {
  const now = new Date();
  const guest = await db.guest.findUniqueOrThrow({
    where: { id: guestId },
    include: {
      favouriteStaff: { select: { id: true, name: true, title: true, active: true } },
      telegramChats: { where: { isStaff: false, NOT: { id: { startsWith: "sim-" } } }, select: { id: true }, take: 1 },
    },
  });
  const include = { staff: { include: { staff: { select: { id: true, name: true } } } }, service: { select: { id: true, active: true, showOnSite: true } } } as const;
  const [upcoming, past] = await Promise.all([
    db.appointment.findMany({ where: { guestId, startsAt: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } }, orderBy: { startsAt: "asc" }, include }),
    db.appointment.findMany({ where: { guestId, startsAt: { lt: now }, status: { in: ["DONE", "IN_CHAIR"] } }, orderBy: { startsAt: "desc" }, take: 20, include }),
  ]);
  const view = (a: (typeof upcoming)[number]) => ({
    id: a.id,
    service: a.serviceLabel,
    date: longDate(a.startsAt),
    time: clock(a.startsAt),
    price: a.price,
    status: a.status,
    masters: a.staff.map((s) => s.staff),
    /** Service can be booked again online with the same master */
    rebook: a.service?.active && a.service.showOnSite ? { serviceId: a.service.id, staffId: a.staff[0]?.staffId ?? null } : null,
  });
  // Masters she has visited, most frequent first — candidates for "favourite"
  const counts = new Map<string, { id: string; name: string; visits: number }>();
  for (const a of past) for (const s of a.staff) counts.set(s.staff.id, { ...s.staff, visits: (counts.get(s.staff.id)?.visits ?? 0) + 1 });

  return {
    profile: { name: guest.name, phone: formatPhone(guest.phone), telegram: guest.telegramChats.length > 0 },
    favourite: guest.favouriteStaff?.active ? { id: guest.favouriteStaff.id, name: guest.favouriteStaff.name, title: guest.favouriteStaff.title } : null,
    upcoming: upcoming.map((a) => ({ ...view(a), canChange: a.startsAt.getTime() - now.getTime() >= CANCEL_LEAD_MS && !!a.serviceId })),
    past: past.map(view),
    visitedMasters: [...counts.values()].sort((a, b) => b.visits - a.visits),
  };
}
export type GuestAccount = Awaited<ReturnType<typeof getGuestAccount>>;
