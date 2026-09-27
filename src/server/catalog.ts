import "server-only";
import { db } from "@/lib/db";

export async function getServiceMenu() {
  const [categories, staff] = await Promise.all([
    db.serviceCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        services: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          include: { staff: { select: { id: true } } },
        },
      },
    }),
    db.staff.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    staff,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      services: c.services.map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.durationMin,
        price: s.price,
        showOnSite: s.showOnSite,
        showInPos: s.showInPos,
        staffIds: s.staff.map((x) => x.id),
      })),
    })),
  };
}

export type ServiceMenu = Awaited<ReturnType<typeof getServiceMenu>>;
export type ServiceRowData = ServiceMenu["categories"][number]["services"][number];
