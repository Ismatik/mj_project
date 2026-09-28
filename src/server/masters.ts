import "server-only";
import { db } from "@/lib/db";
import { EMPTY_PROFILE, masterSlugs, type PortfolioItem } from "@/lib/masters";
import type { SiteContent } from "@/lib/site-content";

/** Masters shown on the website: active staff with the profile from the site content (hidden ones left out). */
export async function getSiteMasters(c: SiteContent) {
  const staff = await db.staff.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      services: {
        where: { active: true, showOnSite: true },
        orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
        include: { category: { select: { slug: true, name: true } } },
      },
    },
  });
  const slugs = masterSlugs(staff, c.masters);
  return staff
    .map((m) => {
      const p = c.masters[m.id] ?? EMPTY_PROFILE;
      return {
        id: m.id,
        slug: slugs.get(m.id)!,
        name: m.name,
        title: p.specialty || m.title,
        bio: p.bio,
        photo: p.photo,
        visible: p.visible,
        portfolio: p.portfolio,
        services: m.services.map((s) => ({ id: s.id, name: s.name, price: s.price, durationMin: s.durationMin, category: s.category.name })),
      };
    })
    .filter((m) => m.visible);
}
export type SiteMaster = Awaited<ReturnType<typeof getSiteMasters>>[number];

export type PortfolioWork = PortfolioItem & { master: { name: string; slug: string } };

/** All works of visible masters, newest first per master, and the categories that have works. */
export async function getPortfolio(c: SiteContent) {
  const [masters, categories] = await Promise.all([getSiteMasters(c), db.serviceCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } })]);
  const works: PortfolioWork[] = masters.flatMap((m) => m.portfolio.map((w) => ({ ...w, master: { name: m.name, slug: m.slug } })));
  const used = new Set(works.map((w) => w.category));
  return { works, categories: categories.filter((x) => used.has(x.slug)), masters };
}

/** Staff and categories for the admin's "Мастера и портфолио". */
export async function getMastersForAdmin() {
  const [staff, categories] = await Promise.all([
    db.staff.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, title: true, services: { where: { active: true }, select: { category: { select: { slug: true, sortOrder: true } } } } },
    }),
    db.serviceCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
  ]);
  return {
    staff: staff.map(({ services, ...m }) => ({
      ...m,
      /** Her main field: the category most of her services belong to (default for new portfolio photos) */
      mainCategory: mostCommon(services.map((x) => x.category.slug)) ?? categories[0]?.slug ?? "",
    })),
    categories,
  };
}

function mostCommon(xs: string[]): string | undefined {
  const n = new Map<string, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0];
}
