import "server-only";
import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { BotDeps, BotState } from "@/lib/bot/engine";
import { db } from "@/lib/db";
import { clock, longDate } from "@/lib/format";
import { bookableDates } from "@/lib/slots";
import { addDays, todayYmd } from "@/lib/time";
import { cancelByGuest, createGuestBooking, getOnlineMenu, rescheduleByGuest, slotsFor, upcomingForGuest } from "../online-booking";
import { getSiteContent } from "../site";

/** Code staff send as "/staff CODE" to receive reception alerts. Stored in the Telegram integration config. */
export async function getStaffCode(): Promise<string> {
  const row = await db.integration.findUnique({ where: { key: "telegram" } });
  const config = (row?.config ?? {}) as { staffCode?: string };
  if (config.staffCode) return config.staffCode;
  const code = `MJ-${randomInt(1000, 9999)}`;
  await db.integration.upsert({
    where: { key: "telegram" },
    update: { config: { ...config, staffCode: code } },
    create: { key: "telegram", config: { staffCode: code } },
  });
  return code;
}

export async function rotateStaffCode(): Promise<string> {
  const row = await db.integration.findUnique({ where: { key: "telegram" } });
  const config = (row?.config ?? {}) as Record<string, unknown>;
  const code = `MJ-${randomInt(1000, 9999)}`;
  await db.integration.upsert({ where: { key: "telegram" }, update: { config: { ...config, staffCode: code } }, create: { key: "telegram", config: { staffCode: code } } });
  return code;
}

/** The bot's view of the salon: real bookings, schedules and content. */
export function botDeps(): BotDeps {
  return {
    async getChat(chatId) {
      const chat = await db.telegramChat.findUnique({ where: { id: chatId }, include: { guest: true } });
      return {
        state: (chat?.state ?? {}) as BotState,
        isStaff: chat?.isStaff ?? false,
        guest: chat?.guest ? { id: chat.guest.id, name: chat.guest.name, phone: chat.guest.phone } : null,
      };
    },
    async saveChat(chatId, patch) {
      const data = {
        ...(patch.state ? { state: patch.state as Prisma.InputJsonValue } : {}),
        ...(patch.firstName ? { firstName: patch.firstName } : {}),
        ...(patch.username ? { username: patch.username } : {}),
        ...(patch.guestId ? { guestId: patch.guestId } : {}),
        ...(patch.isStaff ? { isStaff: true } : {}),
      };
      await db.telegramChat.upsert({ where: { id: chatId }, update: data, create: { id: chatId, ...data } });
    },
    menu: getOnlineMenu,
    dates: () => {
      const today = todayYmd();
      return bookableDates(today, 9, addDays);
    },
    async slots(serviceId, date, staffId, exclude) {
      const { slots } = await slotsFor(serviceId, date, staffId, db, exclude);
      return slots.map((s) => ({ time: s.time }));
    },
    async book(i) {
      return createGuestBooking({ ...i, source: "TELEGRAM", telegramChatId: i.chatId });
    },
    upcoming: upcomingForGuest,
    cancel: cancelByGuest,
    reschedule: rescheduleByGuest,
    async findGuestByPhone(phone) {
      const g = await db.guest.findUnique({ where: { phone } });
      return g ? { id: g.id, name: g.name, phone: g.phone } : null;
    },
    async contacts() {
      return (await getSiteContent("published")).contacts;
    },
    staffCode: getStaffCode,
    formatWhen: (d) => `${longDate(d)}, ${clock(d)}`,
  };
}
