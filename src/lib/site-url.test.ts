import { afterEach, describe, expect, it } from "vitest";
import { botLink, selfServiceLink } from "./site-url";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("links sent to guests", () => {
  it("reads the bot name once it is set, tolerating a leading @", () => {
    process.env.TELEGRAM_BOT_USERNAME = "@mavzunaijovid_bot";
    expect(botLink()).toBe("https://t.me/mavzunaijovid_bot");
  });

  it("has no bot link before the bot goes live", () => {
    process.env.TELEGRAM_BOT_USERNAME = "";
    expect(botLink()).toBeNull();
  });

  it("prefers the bot - a guest who opens it becomes reachable for free", () => {
    process.env.TELEGRAM_BOT_USERNAME = "mavzunaijovid_bot";
    expect(selfServiceLink("ru", true)).toBe("https://t.me/mavzunaijovid_bot");
    expect(selfServiceLink("en", true)).toBe("https://t.me/mavzunaijovid_bot");
  });

  it("keeps to her account while the bot is named but not switched on", () => {
    process.env.TELEGRAM_BOT_USERNAME = "mavzunaijovid_bot";
    process.env.SITE_DOMAIN = "mavzunaijovid.tj";
    expect(selfServiceLink("ru", false)).toBe("https://mavzunaijovid.tj/kabinet");
  });

  it("falls back to her account on the site, in her language", () => {
    delete process.env.TELEGRAM_BOT_USERNAME;
    process.env.SITE_DOMAIN = "mavzunaijovid.tj";
    expect(selfServiceLink("ru", true)).toBe("https://mavzunaijovid.tj/kabinet");
    expect(selfServiceLink("tg", true)).toBe("https://mavzunaijovid.tj/tj/kabinet");
    expect(selfServiceLink("en", true)).toBe("https://mavzunaijovid.tj/en/kabinet");
  });

  // Meta refuses a template whose parameter is empty, so this must hold in every configuration.
  it("is never empty, however the salon is configured", () => {
    for (const bot of [undefined, "", "   ", "@x", "ok_bot_name"]) {
      for (const domain of [undefined, "", "localhost", "mavzunaijovid.tj"]) {
        if (bot === undefined) delete process.env.TELEGRAM_BOT_USERNAME;
        else process.env.TELEGRAM_BOT_USERNAME = bot;
        if (domain === undefined) delete process.env.SITE_DOMAIN;
        else process.env.SITE_DOMAIN = domain;
        for (const live of [true, false]) expect(selfServiceLink("ru", live)).toMatch(/^https?:\/\/\S+$/);
      }
    }
  });
});
