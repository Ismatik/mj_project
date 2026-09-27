import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_CONTENT, normalizeContent, type SiteContent } from "@/lib/site-content";

type DocId = "draft" | "published";

export async function getSiteContent(id: DocId): Promise<SiteContent> {
  const doc = await db.siteDocument.findUnique({ where: { id } });
  return normalizeContent(doc?.data ?? DEFAULT_CONTENT);
}

export async function getSiteDocuments() {
  const docs = await db.siteDocument.findMany();
  const draft = docs.find((d) => d.id === "draft");
  const published = docs.find((d) => d.id === "published");
  return {
    draft: normalizeContent(draft?.data ?? DEFAULT_CONTENT),
    published: normalizeContent(published?.data ?? DEFAULT_CONTENT),
    draftSavedAt: draft?.updatedAt ?? null,
    publishedAt: published?.updatedAt ?? null,
    publishedBy: published?.updatedBy ?? null,
  };
}

export async function writeSiteContent(id: DocId, content: SiteContent, by: string) {
  const data = content as unknown as Prisma.InputJsonValue;
  await db.siteDocument.upsert({ where: { id }, update: { data, updatedBy: by }, create: { id, data, updatedBy: by } });
}

/**
 * Services shown on the website price list: the CMS menu filtered by "на сайте".
 * `overrides` (the admin's unpublished changes) are applied for the draft preview.
 */
export async function getSitePriceList(overrides: Record<string, boolean> = {}) {
  const categories = await db.serviceCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { services: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
  });
  return categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      services: c.services
        .filter((s) => overrides[s.id] ?? s.showOnSite)
        .map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, price: s.price })),
    }))
    .filter((c) => c.services.length);
}

/** All active services with their website flag, for the admin's "Услуги и цены". */
export async function getServicesForAdmin() {
  return db.service.findMany({
    where: { active: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true, name: true, price: true, durationMin: true, showOnSite: true, category: { select: { name: true } } },
  });
}
