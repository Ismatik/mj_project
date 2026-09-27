"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { normalizeContent, type SiteContent, type SitePhoto } from "@/lib/site-content";
import { requireSiteAdmin } from "@/server/auth";
import { getSiteContent, writeSiteContent } from "@/server/site";

const MAX_TEXT = 2000;

const cleanPhoto = (p: SitePhoto | undefined): SitePhoto | undefined => {
  if (!p?.url) return undefined;
  const ok = /^https:\/\/[^\s"'<>]+$/.test(p.url) || /^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(p.url);
  if (!ok) return undefined;
  const creditUrl = p.creditUrl && /^https:\/\/[^\s"'<>]+$/.test(p.creditUrl) ? p.creditUrl : undefined;
  return { url: p.url, credit: p.credit?.slice(0, 200) || undefined, creditUrl };
};

/** Normalizes shape, clips every string and drops unsafe photo links. */
function sanitize(input: unknown, fallback: SiteContent): SiteContent {
  const c = normalizeContent(input, fallback);
  const clip = (v: unknown): unknown => {
    if (typeof v === "string") return v.slice(0, MAX_TEXT);
    if (Array.isArray(v)) return v.slice(0, 30).map(clip);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clip(x)]));
    return v;
  };
  const out = clip(c) as SiteContent;
  out.photos = {
    hero: cleanPhoto(out.photos.hero) ?? fallback.photos.hero,
    bridal: cleanPhoto(out.photos.bridal) ?? fallback.photos.bridal,
    interior: cleanPhoto(out.photos.interior) ?? fallback.photos.interior,
  };
  out.reviews.items = out.reviews.items
    .filter((r) => r && typeof r.author === "string" && typeof r.text === "string")
    .map((r, i) => ({
      id: String(r.id || `r${i}`).slice(0, 40),
      author: r.author,
      text: r.text,
      source: String(r.source ?? ""),
      visible: !!r.visible,
      photo: cleanPhoto(r.photo),
    }));
  out.booking.services = out.booking.services.filter((x) => typeof x === "string" && x.trim()).slice(0, 10);
  return out;
}

export async function saveDraft(input: SiteContent): Promise<{ ok: true; savedAt: string }> {
  const user = await requireSiteAdmin();
  const current = await getSiteContent("draft");
  await writeSiteContent("draft", sanitize(input, current), user.name);
  return { ok: true, savedAt: new Date().toISOString() };
}

/** Draft → website. Pending "на сайте" switches are written to the CMS services, then cleared. */
export async function publishSite(): Promise<{ ok: true; publishedAt: string }> {
  const user = await requireSiteAdmin();
  const draft = await getSiteContent("draft");
  const overrides = Object.entries(draft.serviceOverrides);
  await db.$transaction(overrides.map(([id, showOnSite]) => db.service.updateMany({ where: { id }, data: { showOnSite } })));
  const clean = { ...draft, serviceOverrides: {} };
  await writeSiteContent("published", clean, user.name);
  await writeSiteContent("draft", clean, user.name);
  revalidatePath("/");
  revalidatePath("/cms", "layout");
  revalidatePath("/admin");
  return { ok: true, publishedAt: new Date().toISOString() };
}

/** Throws away unpublished edits. */
export async function discardDraft(): Promise<SiteContent> {
  const user = await requireSiteAdmin();
  const published = await getSiteContent("published");
  await writeSiteContent("draft", published, user.name);
  revalidatePath("/admin");
  return published;
}
