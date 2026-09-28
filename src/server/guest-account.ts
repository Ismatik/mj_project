import "server-only";
import { db } from "@/lib/db";
import { clock } from "@/lib/format";
import { longDate } from "@/lib/i18n/format";
import { asLang, type Lang } from "@/lib/i18n/locales";
import { formatPhone } from "@/lib/phone";
import { namerFor } from "./names";

const CANCEL_LEAD_MS = 2 * 3600_000;

/** Everything the guest sees in her account: profile, upcoming bookings, past visits, favourite master. */
export async function getGuestAccount(guestId: string, lang: Lang = "ru") {
  const name = await namerFor(lang);
  const now = new Date();
  const guest = await db.guest.findUniqueOrThrow({
    where: { id: guestId },
    include: {
      favouriteStaff: { select: { id: true, name: true, title: true, active: true } },
      telegramChats: { where: { isStaff: false, NOT: { id: { startsWith: "sim-" } } }, select: { id: true }, take: 1 },
    },
  });
  const include = {
    staff: { include: { staff: { select: { id: true, name: true } } } },
    service: { select: { id: true, active: true, showOnSite: true } },
    payments: { where: { status: "PENDING", purpose: "DEPOSIT" }, select: { id: true, amount: true }, take: 1 },
  } as const;
  const [upcoming, past] = await Promise.all([
    db.appointment.findMany({ where: { guestId, startsAt: { gte: now }, status: { in: ["PENDING", "CONFIRMED"] } }, orderBy: { startsAt: "asc" }, include }),
    db.appointment.findMany({ where: { guestId, startsAt: { lt: now }, status: { in: ["DONE", "IN_CHAIR"] } }, orderBy: { startsAt: "desc" }, take: 20, include }),
  ]);
  const view = (a: (typeof upcoming)[number]) => ({
    id: a.id,
    service: name("services", a.serviceId, a.serviceLabel),
    date: longDate(a.startsAt, lang),
    time: clock(a.startsAt),
    price: a.price,
    status: a.status,
    masters: a.staff.map((s) => ({ id: s.staff.id, name: name("staff", s.staff.id, s.staff.name) })),
    /** Service can be booked again online with the same master */
    depositPaid: a.depositPaid,
    /** Prepayment still to make online (the time is held until then) */
    pay: a.payments[0] ?? null,
    rebook: a.service?.active && a.service.showOnSite ? { serviceId: a.service.id, staffId: a.staff[0]?.staffId ?? null } : null,
  });
  // Masters she has visited, most frequent first — candidates for "favourite"
  const counts = new Map<string, { id: string; name: string; visits: number }>();
  for (const a of past) for (const s of a.staff) counts.set(s.staff.id, { id: s.staff.id, name: name("staff", s.staff.id, s.staff.name), visits: (counts.get(s.staff.id)?.visits ?? 0) + 1 });

  return {
    profile: { name: guest.name, phone: formatPhone(guest.phone), telegram: guest.telegramChats.length > 0, lang: asLang(guest.lang) },
    favourite: guest.favouriteStaff?.active ? { id: guest.favouriteStaff.id, name: name("staff", guest.favouriteStaff.id, guest.favouriteStaff.name), title: guest.favouriteStaff.title } : null,
    upcoming: upcoming.map((a) => ({ ...view(a), canChange: a.startsAt.getTime() - now.getTime() >= CANCEL_LEAD_MS && !!a.serviceId })),
    past: past.map(view),
    visitedMasters: [...counts.values()].sort((a, b) => b.visits - a.visits),
  };
}
export type GuestAccount = Awaited<ReturnType<typeof getGuestAccount>>;
