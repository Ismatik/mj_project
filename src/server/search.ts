import "server-only";
import { canOpen } from "@/lib/access";
import { db } from "@/lib/db";
import { clock, shortDate, somoni } from "@/lib/format";
import { formatPhone, phoneDigits } from "@/lib/phone";
import { todayYmd } from "@/lib/time";
import type { CurrentUser } from "./auth";

export type SearchHit = { id: string; kind: "guest" | "appointment" | "sale"; title: string; sub: string; href: string };
export type SearchResults = { guests: SearchHit[]; appointments: SearchHit[]; sales: SearchHit[] };

const EMPTY: SearchResults = { guests: [], appointments: [], sales: [] };

/** Header search: guests by name or phone, bookings by guest or service, receipts by number or guest. */
export async function searchCms(query: string, user: CurrentUser, only?: "guests"): Promise<SearchResults> {
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return EMPTY;
  const digits = phoneDigits(q);
  const receipt = /^(?:№|#|чек\s*)?\s*(\d{1,7})$/i.exec(q);
  const text = { contains: q, mode: "insensitive" as const };

  const wantGuests = canOpen(user.role, "guests") || (only === "guests" && canOpen(user.role, "calendar"));
  const wantAppts = !only && canOpen(user.role, "calendar");
  const wantSales = !only && canOpen(user.role, "pos");

  const [guests, appointments, sales] = await Promise.all([
    wantGuests
      ? db.guest.findMany({
          where: { OR: [{ name: text }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] },
          orderBy: { name: "asc" },
          take: 5,
        })
      : [],
    wantAppts
      ? db.appointment.findMany({
          where: {
            OR: [{ guestName: text }, { serviceLabel: text }, { guest: { name: text } }],
            status: { not: "CANCELLED" },
            // Masters only see their own bookings
            ...(user.role === "MASTER" ? { staff: { some: { staffId: user.staffId ?? "-" } } } : {}),
          },
          orderBy: { startsAt: "desc" },
          take: 6,
          include: { staff: { include: { staff: true } } },
        })
      : [],
    wantSales
      ? db.sale.findMany({
          where: receipt ? { number: Number(receipt[1]) } : { guest: { name: text } },
          orderBy: { createdAt: "desc" },
          take: 4,
          include: { guest: true },
        })
      : [],
  ]);

  return {
    guests: guests.map((g) => ({
      id: g.id,
      kind: "guest",
      title: g.name,
      sub: formatPhone(g.phone),
      href: `/cms/guests?guest=${g.id}`,
    })),
    appointments: appointments.map((a) => ({
      id: a.id,
      kind: "appointment",
      title: `${a.guestName} · ${a.serviceLabel}`,
      sub: `${shortDate(a.startsAt)}, ${clock(a.startsAt)} · ${a.staff.map((s) => s.staff.name).join(" + ")}`,
      href: `/cms/calendar?date=${todayYmd(a.startsAt)}&appt=${a.id}`,
    })),
    sales: sales.map((s) => ({
      id: s.id,
      kind: "sale",
      title: `Чек №${s.number} · ${somoni(s.total)}`,
      sub: `${shortDate(s.createdAt)}, ${clock(s.createdAt)}${s.guest ? ` · ${s.guest.name}` : ""}`,
      href: `/cms/pos?sale=${s.id}`,
    })),
  };
}
