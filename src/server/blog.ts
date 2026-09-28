import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { isSlug, postIn, readingMinutes, slugify, type PostI18n } from "@/lib/blog";
import { db } from "@/lib/db";
import type { Lang } from "@/lib/i18n/locales";

// Blog / beauty tips: written in the site admin, shown at /blog in three languages.

const view = (p: Prisma.BlogPostGetPayload<object>, lang: Lang) => {
  const text = postIn(p, lang);
  return { id: p.id, slug: p.slug, ...text, coverUrl: p.coverUrl, tags: p.tags, serviceId: p.serviceId, publishedAt: p.publishedAt ?? p.createdAt, minutes: readingMinutes(text.body), status: p.status };
};
export type PostView = ReturnType<typeof view>;

export async function publishedPosts(lang: Lang, o: { tag?: string | null; limit?: number } = {}) {
  const rows = await db.blogPost.findMany({
    where: { status: "PUBLISHED", ...(o.tag ? { tags: { has: o.tag } } : {}) },
    orderBy: { publishedAt: "desc" },
    take: o.limit ?? 50,
  });
  return rows.map((p) => view(p, lang));
}

export async function blogTags(): Promise<string[]> {
  const rows = await db.blogPost.findMany({ where: { status: "PUBLISHED" }, select: { tags: true } });
  return [...new Set(rows.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, "ru"));
}

/** A post by its address; drafts only for site editors previewing */
export async function postBySlug(slug: string, lang: Lang, preview = false) {
  const p = await db.blogPost.findUnique({ where: { slug } });
  if (!p || (p.status !== "PUBLISHED" && !preview)) return null;
  const more = await db.blogPost.findMany({ where: { status: "PUBLISHED", id: { not: p.id } }, orderBy: { publishedAt: "desc" }, take: 3 });
  return { post: view(p, lang), more: more.map((m) => view(m, lang)) };
}

// ─── Site admin ──────────────────────────────────────────

export async function adminPosts() {
  const rows = await db.blogPost.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }] });
  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    status: p.status,
    title: p.title,
    excerpt: p.excerpt,
    body: p.body,
    i18n: (p.i18n ?? {}) as PostI18n,
    coverUrl: p.coverUrl ?? "",
    tags: p.tags,
    serviceId: p.serviceId ?? "",
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  }));
}
export type AdminPost = Awaited<ReturnType<typeof adminPosts>>[number];

export type PostInput = { id?: string; slug: string; title: string; excerpt: string; body: string; i18n: PostI18n; coverUrl: string; tags: string[]; serviceId: string };

const clean = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);

export async function savePost(input: PostInput, by: string): Promise<{ ok: true; id: string; slug: string } | { ok: false; error: string }> {
  const title = clean(input.title, 140);
  if (title.length < 3) return { ok: false, error: "Заголовок статьи" };
  const slug = clean(input.slug, 80) || slugify(title);
  if (!isSlug(slug)) return { ok: false, error: "Адрес: латиница, цифры и дефисы, например uhod-za-volosami" };
  const clash = await db.blogPost.findUnique({ where: { slug } });
  if (clash && clash.id !== input.id) return { ok: false, error: "Такой адрес уже есть у другой статьи" };
  const cover = clean(input.coverUrl, 300);
  if (cover && !/^(\/media\/[a-f0-9-]{36}\.(jpg|png|webp)|https:\/\/[^\s"'<>]+)$/.test(cover)) return { ok: false, error: "Обложка: загрузите фото" };
  const i18n: PostI18n = {};
  for (const l of ["tg", "en"] as const) {
    const t = input.i18n?.[l];
    if (t) i18n[l] = { title: clean(t.title, 140), excerpt: clean(t.excerpt, 400), body: clean(t.body, 20000) };
  }
  const service = input.serviceId ? await db.service.findUnique({ where: { id: input.serviceId }, select: { id: true } }) : null;
  const data = {
    slug,
    title,
    excerpt: clean(input.excerpt, 400),
    body: clean(input.body, 20000),
    i18n: i18n as Prisma.InputJsonValue,
    coverUrl: cover || null,
    tags: [...new Set((input.tags ?? []).map((t) => clean(t, 30).toLowerCase()).filter(Boolean))].slice(0, 8),
    serviceId: service?.id ?? null,
  };
  const row = input.id ? await db.blogPost.update({ where: { id: input.id }, data }) : await db.blogPost.create({ data: { ...data, createdBy: by } });
  return { ok: true, id: row.id, slug: row.slug };
}

export async function setPostStatus(id: string, status: "DRAFT" | "PUBLISHED") {
  const p = await db.blogPost.findUnique({ where: { id } });
  if (!p) return { ok: false as const, error: "Статья не найдена" };
  if (status === "PUBLISHED" && p.body.trim().length < 20) return { ok: false as const, error: "Допишите текст статьи перед публикацией" };
  await db.blogPost.update({ where: { id }, data: { status, ...(status === "PUBLISHED" && !p.publishedAt ? { publishedAt: new Date() } : {}) } });
  return { ok: true as const, slug: p.slug };
}

export async function deletePost(id: string) {
  await db.blogPost.deleteMany({ where: { id } });
  return { ok: true as const };
}
