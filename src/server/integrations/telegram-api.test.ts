import { describe, expect, it } from "vitest";
import { replyMarkup, toBotUpdate } from "./telegram-api";

describe("Telegram mapping", () => {
  it("turns a button press into engine input", () => {
    const r = toBotUpdate({ callback_query: { id: "q1", data: "s:svc", from: { id: 42, first_name: "Зарина" }, message: { chat: { id: 42, type: "private" } } } });
    expect(r).toEqual({ callbackId: "q1", update: { chatId: "42", firstName: "Зарина", username: undefined, data: "s:svc" } });
  });

  it("accepts the sender's own contact but not a forwarded one", () => {
    const own = toBotUpdate({ message: { chat: { id: 7, type: "private" }, contact: { phone_number: "+992931112233", user_id: 7 } } });
    expect(own?.update.contactPhone).toBe("+992931112233");
    const other = toBotUpdate({ message: { chat: { id: 7, type: "private" }, contact: { phone_number: "+992935012214", user_id: 99 } } });
    expect(other?.update.contactPhone).toBeUndefined();
  });

  it("ignores group chats", () => {
    expect(toBotUpdate({ message: { chat: { id: -5, type: "group" }, text: "hi" } })).toBeNull();
  });

  it("builds inline, contact and remove keyboards", () => {
    expect(replyMarkup({ text: "x", buttons: [[{ text: "A", data: "a" }]] })).toEqual({ inline_keyboard: [[{ text: "A", callback_data: "a" }]] });
    expect(replyMarkup({ text: "x", askContact: true })).toMatchObject({ keyboard: [[{ request_contact: true }]] });
    expect(replyMarkup({ text: "x", removeKeyboard: true })).toEqual({ remove_keyboard: true });
    expect(replyMarkup({ text: "x" })).toBeUndefined();
  });
});
