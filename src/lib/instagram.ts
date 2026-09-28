// Instagram feed: the salon's latest posts from the Instagram API (live) or portfolio photos (mock). Pure parts.

export type InstaPost = { id: string; image: string; caption: string; permalink: string; at: string; video: boolean };
export type InstaFeed = { updatedAt: string; posts: InstaPost[]; error?: string | null; tokenRefreshedAt?: string | null };

/** GET /me/media → posts with an image we can show (videos use their thumbnail) */
export function parseMedia(json: unknown, limit = 12): InstaPost[] {
  const data = (json as { data?: unknown[] })?.data;
  if (!Array.isArray(data)) return [];
  const out: InstaPost[] = [];
  for (const raw of data) {
    const m = raw as Record<string, unknown>;
    const video = m.media_type === "VIDEO";
    const image = String((video ? m.thumbnail_url : m.media_url) ?? "");
    const permalink = String(m.permalink ?? "");
    if (!/^https:\/\//.test(image) || !/^https:\/\/(www\.)?instagram\.com\//.test(permalink)) continue;
    out.push({ id: String(m.id ?? permalink), image, caption: String(m.caption ?? "").slice(0, 300), permalink, at: String(m.timestamp ?? ""), video });
    if (out.length >= limit) break;
  }
  return out;
}

/** First line of a caption, without hashtags, for alt text and hover */
export const shortCaption = (c: string, max = 90) => {
  const line = c.split("\n")[0]!.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

/** Long-lived tokens last 60 days; refresh weekly */
export const needsRefresh = (refreshedAt: string | null | undefined, now = new Date()) => !refreshedAt || now.getTime() - Date.parse(refreshedAt) > 7 * 864e5;
