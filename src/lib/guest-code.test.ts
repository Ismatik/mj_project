import { describe, expect, it } from "vitest";
import { pickCodeChannel } from "./guest-code";

const all = { telegram: "MOCK", whatsapp: "MOCK", sms: "MOCK" } as const;

describe("pickCodeChannel", () => {
  it("prefers the guest's Telegram chat", () => {
    expect(pickCodeChannel(["123"], all)).toEqual({ channel: "telegram", to: "123" });
  });
  it("falls back to WhatsApp, then SMS", () => {
    expect(pickCodeChannel([], all)).toEqual({ channel: "whatsapp" });
    expect(pickCodeChannel([], { ...all, whatsapp: null })).toEqual({ channel: "sms" });
    expect(pickCodeChannel([], { telegram: null, whatsapp: null, sms: null })).toBeNull();
  });
  it("uses simulator chats only while Telegram is mocked", () => {
    expect(pickCodeChannel(["sim-1"], all)).toEqual({ channel: "telegram", to: "sim-1" });
    expect(pickCodeChannel(["sim-1"], { ...all, telegram: "LIVE" })).toEqual({ channel: "whatsapp" });
    expect(pickCodeChannel(["sim-1", "777"], { ...all, telegram: "LIVE" })).toEqual({ channel: "telegram", to: "777" });
  });
});
