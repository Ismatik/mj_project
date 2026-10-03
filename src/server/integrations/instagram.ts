// Instagram feed (Instagram API with Instagram Login). The worker refreshes it hourly in live mode;
// the website reads the stored copy, so a slow or failing Instagram never slows the site down.
// No "server-only" import: the worker uses this file too.
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { needsRefresh, parseMedia, type InstaFeed, type InstaPost } from "../../lib/instagram";
import type { SiteContent } from "../../lib/site-content";

export const FEED_SETTING = "instagramFeed";
const TOKEN_SETTING = "instagramToken";
const base = () => (process.env.INSTAGRAM_API_BASE || "https://graph.instagram.com").replace(/\/$/, "");

async function token(db: PrismaClient): Promise<{ value: string; refreshedAt: string | null } | null> {
  const stored = await db.setting.findUnique({ where: { key: TOKEN_SETTING } });
  const v = stored?.value as { token?: string; refreshedAt?: string } | undefined;
  if (v?.token) return { value: v.token, refreshedAt: v.refreshedAt ?? null };
  return process.env.INSTAGRAM_TOKEN ? { value: process.env.INSTAGRAM_TOKEN, refreshedAt: null } : null;
}

async function saveFeed(db: PrismaClient, feed: InstaFeed) {
  await db.setting.upsert({ where: { key: FEED_SETTING }, update: { value: feed as unknown as Prisma.InputJsonValue }, create: { key: FEED_SETTING, value: feed as unknown as Prisma.InputJsonValue } });
}

/** Fetches the latest posts (live mode only). Returns how many were stored, or an error. */
export async function refreshInstagram(db: PrismaClient): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const integ = await db.integration.findUnique({ where: { key: "instagram" } });
  if (!integ?.enabled || integ.mode !== "LIVE") return { ok: false, error: "Instagram в режиме «Мок» - на сайте показываются фото из портфолио" };
  const t = await token(db);
  if (!t) return { ok: false, error: "Нет INSTAGRAM_TOKEN" };
  const prev = (await db.setting.findUnique({ where: { key: FEED_SETTING } }))?.value as InstaFeed | undefined;
  try {
    // Long-lived tokens expire after 60 days unless refreshed
    let current = t.value;
    let refreshedAt = t.refreshedAt;
    if (needsRefresh(t.refreshedAt)) {
      const r = await fetch(`${base()}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`, { signal: AbortSignal.timeout(10_000) });
      const j = (await r.json().catch(() => ({}))) as { access_token?: string };
      if (r.ok && j.access_token) {
        current = j.access_token;
        refreshedAt = new Date().toISOString();
        await db.setting.upsert({ where: { key: TOKEN_SETTING }, update: { value: { token: current, refreshedAt } }, create: { key: TOKEN_SETTING, value: { token: current, refreshedAt } } });
      }
    }
    const res = await fetch(`${base()}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=18&access_token=${encodeURIComponent(current)}`, { signal: AbortSignal.timeout(15_000) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = (json as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
      await saveFeed(db, { updatedAt: prev?.updatedAt ?? new Date(0).toISOString(), posts: prev?.posts ?? [], error, tokenRefreshedAt: refreshedAt });
      return { ok: false, error };
    }
    const posts = parseMedia(json);
    await saveFeed(db, { updatedAt: new Date().toISOString(), posts, error: null, tokenRefreshedAt: refreshedAt });
    return { ok: true, count: posts.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await saveFeed(db, { updatedAt: prev?.updatedAt ?? new Date(0).toISOString(), posts: prev?.posts ?? [], error, tokenRefreshedAt: t.refreshedAt });
    return { ok: false, error };
  }
}

/** What the website shows: live posts, or (mock / nothing fetched yet) the portfolio linking to the profile */
export async function instagramFeed(db: PrismaClient, content: SiteContent, limit = 6): Promise<{ posts: InstaPost[]; live: boolean }> {
  const integ = await db.integration.findUnique({ where: { key: "instagram" } });
  if (integ?.enabled === false) return { posts: [], live: false };
  if (integ?.mode === "LIVE") {
    const feed = (await db.setting.findUnique({ where: { key: FEED_SETTING } }))?.value as InstaFeed | undefined;
    if (feed?.posts?.length) return { posts: feed.posts.slice(0, limit), live: true };
  }
  const profile = `https://www.instagram.com/${content.contacts.instagram.replace(/^@/, "")}/`;
  const works = Object.values(content.masters).flatMap((m) => m.portfolio);
  return { posts: works.slice(0, limit).map((w) => ({ id: w.id, image: w.url, caption: w.caption ?? "", permalink: profile, at: "", video: false })), live: false };
}

export async function instagramStatus(db: PrismaClient) {
  const feed = (await db.setting.findUnique({ where: { key: FEED_SETTING } }))?.value as InstaFeed | undefined;
  return { updatedAt: feed?.updatedAt ?? null, count: feed?.posts?.length ?? 0, error: feed?.error ?? null };
}
