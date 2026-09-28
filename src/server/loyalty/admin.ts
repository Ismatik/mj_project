import "server-only";
import { db } from "@/lib/db";
import { getRules } from "./core";

/** CMS «Бонусы и акции»: rules, promotions and how the points are used. */
export async function getLoyaltyPage() {
  const monthStart = new Date(Date.now() - 30 * 864e5);
  const [rules, promotions, services, outstanding, earned, spent, members] = await Promise.all([
    getRules(db),
    db.promotion.findMany({ orderBy: [{ active: "desc" }, { endsOn: "desc" }] }),
    db.service.findMany({ where: { active: true }, orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }], select: { id: true, name: true } }),
    db.guest.aggregate({ _sum: { bonusBalance: true } }),
    db.bonusTx.aggregate({ where: { delta: { gt: 0 }, createdAt: { gte: monthStart } }, _sum: { delta: true } }),
    db.bonusTx.aggregate({ where: { kind: "SPEND", createdAt: { gte: monthStart } }, _sum: { delta: true } }),
    db.guest.count({ where: { bonusBalance: { gt: 0 } } }),
  ]);
  return {
    rules,
    services,
    stats: { outstanding: outstanding._sum.bonusBalance ?? 0, earned30: earned._sum.delta ?? 0, spent30: -(spent._sum.delta ?? 0), members },
    promotions: promotions.map((p) => ({
      id: p.id,
      title: p.title,
      titleTg: p.titleTg ?? "",
      titleEn: p.titleEn ?? "",
      description: p.description ?? "",
      descriptionTg: p.descriptionTg ?? "",
      descriptionEn: p.descriptionEn ?? "",
      kind: p.kind,
      value: p.value,
      serviceIds: p.serviceIds,
      startsOn: p.startsOn.toISOString().slice(0, 10),
      endsOn: p.endsOn.toISOString().slice(0, 10),
      code: p.code ?? "",
      active: p.active,
      showOnSite: p.showOnSite,
      usageLimit: p.usageLimit,
      usedCount: p.usedCount,
    })),
  };
}
export type LoyaltyPage = Awaited<ReturnType<typeof getLoyaltyPage>>;
export type PromotionForm = LoyaltyPage["promotions"][number];
