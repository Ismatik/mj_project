import "server-only";
import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { BotDeps, BotState } from "@/lib/bot/engine";
import { db } from "@/lib/db";
import { localize } from "@/lib/i18n/content";
import { when } from "@/lib/i18n/format";
import { asLang, isLang } from "@/lib/i18n/locales";
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
        // Chosen in the bot; otherwise the language she uses on the website
        lang: isLang(chat?.lang) ? chat.lang : chat?.guest ? asLang(chat.guest.lang) : null,
      };
    },
    async saveChat(chatId, patch) {
      const data = {
        ...(patch.state ? { state: patch.state as Prisma.InputJsonValue } : {}),
        ...(patch.firstName ? { firstName: patch.firstName } : {}),
        ...(patch.username ? { username: patch.username } : {}),
        ...(patch.guestId ? { guestId: patch.guestId } : {}),
        ...(patch.isStaff ? { isStaff: true } : {}),
        ...(patch.lang ? { lang: patch.lang } : {}),
      };
      const chat = await db.telegramChat.upsert({ where: { id: chatId }, update: data, create: { id: chatId, ...data } });
      // Her reminders follow the language she picked in the bot
      if (patch.lang && chat.guestId) await db.guest.update({ where: { id: chat.guestId }, data: { lang: patch.lang } });
    },
    menu: (lang) => getOnlineMenu(lang),
    dates: () => {
      const today = todayYmd();
      return bookableDates(today, 9, addDays);
    },
    async slots(serviceId, date, staffId, exclude) {
      const { slots } = await slotsFor(serviceId, date, staffId, db, exclude);
      return slots.map((s) => ({ time: s.time }));
    },
    async book({ chatId, ...i }) {
      return createGuestBooking({ ...i, source: "TELEGRAM", telegramChatId: chatId });
    },
    upcoming: upcomingForGuest,
    cancel: cancelByGuest,
    reschedule: rescheduleByGuest,
    async findGuestByPhone(phone) {
      const g = await db.guest.findUnique({ where: { phone } });
      return g ? { id: g.id, name: g.name, phone: g.phone } : null;
    },
    async contacts(lang) {
      return localize(await getSiteContent("published"), lang).contacts;
    },
    staffCode: getStaffCode,
    formatWhen: (d, lang) => when(d, lang),
  };
}
