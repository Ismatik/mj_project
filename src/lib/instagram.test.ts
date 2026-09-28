import { describe, expect, it } from "vitest";
import { needsRefresh, parseMedia, shortCaption } from "./instagram";

describe("instagram", () => {
  it("keeps images and video thumbnails with instagram links", () => {
    const posts = parseMedia({
      data: [
        { id: "1", media_type: "IMAGE", media_url: "https://cdn.example/1.jpg", permalink: "https://www.instagram.com/p/A/", caption: "Балаяж ✦ #mj", timestamp: "2026-09-20T10:00:00+0000" },
        { id: "2", media_type: "VIDEO", media_url: "https://cdn.example/2.mp4", thumbnail_url: "https://cdn.example/2.jpg", permalink: "https://www.instagram.com/reel/B/" },
        { id: "3", media_type: "IMAGE", media_url: "http://insecure/3.jpg", permalink: "https://www.instagram.com/p/C/" },
        { id: "4", media_type: "IMAGE", media_url: "https://cdn.example/4.jpg", permalink: "https://evil.example/p/D/" },
      ],
    });
    expect(posts.map((p) => [p.id, p.image, p.video])).toEqual([
      ["1", "https://cdn.example/1.jpg", false],
      ["2", "https://cdn.example/2.jpg", true],
    ]);
    expect(parseMedia({ error: { message: "bad token" } })).toEqual([]);
  });
  it("short captions without hashtags", () => {
    expect(shortCaption("Свадебный образ для Мадины #wedding #mj\nвторая строка")).toBe("Свадебный образ для Мадины");
  });
  it("refreshes the token weekly", () => {
    const now = new Date("2026-09-29T00:00:00Z");
    expect(needsRefresh(null, now)).toBe(true);
    expect(needsRefresh("2026-09-25T00:00:00Z", now)).toBe(false);
    expect(needsRefresh("2026-09-20T00:00:00Z", now)).toBe(true);
  });
});
