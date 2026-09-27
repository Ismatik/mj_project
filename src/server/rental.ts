import "server-only";
import { db } from "@/lib/db";
import { todayYmd } from "@/lib/time";

export async function getRental() {
  const today = todayYmd();
  const todayDate = new Date(`${today}T00:00:00Z`);
  const dresses = await db.dress.findMany({
    where: { status: { not: "RETIRED" } },
    orderBy: { sortOrder: "asc" },
    include: {
      bookings: { where: { endsOn: { gte: todayDate } }, orderBy: { startsOn: "asc" }, include: { guest: true } },
    },
  });
  const upcoming = dresses.reduce((n, d) => n + d.bookings.length, 0);
  return {
    today,
    upcoming,
    dresses: dresses.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      size: d.size,
      pricePerDay: d.pricePerDay,
      status: d.status,
      bookings: d.bookings.map((b) => ({
        id: b.id,
        startsOn: b.startsOn.toISOString().slice(0, 10),
        endsOn: b.endsOn.toISOString().slice(0, 10),
        guest: b.guest?.name ?? null,
      })),
    })),
  };
}

export type RentalData = Awaited<ReturnType<typeof getRental>>;
export type DressData = RentalData["dresses"][number];
