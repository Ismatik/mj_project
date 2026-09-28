import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { LANGS, localePath } from "@/lib/i18n/locales";
import { siteUrl } from "@/lib/site-url";
import { getSiteMasters } from "@/server/masters";
import { getSiteContent } from "@/server/site";

export const dynamic = "force-dynamic";

/** Public pages in all three languages, published articles and masters' pages */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [posts, masters] = await Promise.all([
    db.blogPost.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    getSiteContent("published").then((c) => getSiteMasters(c)),
  ]);
  const page = (path: string, lastModified?: Date, priority = 0.6): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified,
    priority,
    alternates: { languages: Object.fromEntries(LANGS.map((l) => [l === "tg" ? "tg" : l, `${base}${localePath(l, path)}`])) },
  });
  return [
    page("/", undefined, 1),
    page("/mastera"),
    page("/portfolio"),
    page("/podarok"),
    page("/svadba", undefined, 0.8),
    page("/blog", posts[0]?.updatedAt, 0.7),
    ...posts.map((p) => page(`/blog/${p.slug}`, p.updatedAt, 0.5)),
    ...masters.map((m) => page(`/mastera/${m.slug}`, undefined, 0.5)),
  ];
}
