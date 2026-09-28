import "server-only";
import { db } from "@/lib/db";
import { longDate } from "@/lib/format";
import { addDays, atSalonTime, todayYmd } from "@/lib/time";
import type { CurrentUser } from "./auth";
import { lowStockCount } from "./stock";

/** Data for the CMS sidebar and header. */
export async function getShellData(user: CurrentUser) {
  const today = todayYmd();
  const [todayCount, upcomingDresses, branch, newRequests, lowStock, waiting] = await Promise.all([
    db.appointment.count({
      where: {
        startsAt: { gte: atSalonTime(today), lt: atSalonTime(addDays(today, 1)) },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        ...(user.role === "MASTER" ? { staff: { some: { staffId: user.staffId ?? "-" } } } : {}),
      },
    }),
    db.dressBooking.count({ where: { startsOn: { gte: new Date(`${today}T00:00:00Z`) } } }),
    db.setting.findUnique({ where: { key: "salon.branch" } }),
    user.role === "MASTER" ? 0 : db.bookingRequest.count({ where: { status: "NEW" } }),
    user.role === "MASTER" ? 0 : lowStockCount(db),
    user.role === "MASTER" ? 0 : db.waitlistEntry.count({ where: { status: { in: ["WAITING", "OFFERED"] }, date: { gte: new Date(`${today}T00:00:00Z`) } } }),
  ]);
  return {
    counts: { dashboard: newRequests, calendar: todayCount, rental: upcomingDresses, waitlist: waiting, stock: lowStock } as Record<string, number>,
    branch: typeof branch?.value === "string" ? branch.value : "Студия на Бухоро",
    dateLabel: longDate(new Date()),
  };
}
