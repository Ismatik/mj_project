import "server-only";
import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { BotDeps, BotState } from "@/lib/bot/engine";
import { db } from "@/lib/db";
import { localize } from "@/lib/i18n/content";
import { dayMonthYear, somoni as somoniIn, when } from "@/lib/i18n/format";
import { asLang, isLang, localePath } from "@/lib/i18n/locales";
import { bookableDates } from "@/lib/slots";
import { addDays, todayYmd } from "@/lib/time";
import { cancelByGuest, createGuestBooking, getOnlineMenu, rescheduleByGuest, slotsFor, upcomingForGuest } from "../online-booking";
import { guestBonus, siteOffers } from "../loyalty/core";
import { siteUrl } from "../payments/core";
import { joinWaitlist } from "../waitlist/core";
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

/**
 * A master's own code, made on first sight and kept. Personal rather than one code for everyone:
 * a code that only works for its owner cannot subscribe the wrong person to another master's
 * bookings, which carry guests' names and phone numbers.
 */
export async function getMasterCode(staffId: string): Promise<string> {
  const row = await db.staff.findUnique({ where: { id: staffId }, select: { botCode: true } });
  if (row?.botCode) return row.botCode;
  return rotateMasterCode(staffId);
}

/** A fresh code; the old one stops working. Every chat linked with it is unlinked. */
export async function rotateMasterCode(staffId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `MJ-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`;
    try {
      await db.$transaction([
        db.staff.update({ where: { id: staffId }, data: { botCode: code } }),
        db.telegramChat.updateMany({ where: { staffId }, data: { staffId: null } }),
      ]);
      return code;
    } catch {
      // botCode is unique; on the rare collision just draw again
    }
  }
  throw new Error("Не удалось выдать код мастеру");
}

export async function unlinkMaster(staffId: string): Promise<void> {
  await db.telegramChat.updateMany({ where: { staffId }, data: { staffId: null } });
}

/** "/master CODE" in the bot: ties this chat to that master. Her name back, or null if no match. */
export async function linkMasterChat(chatId: string, code: string): Promise<string | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const staff = await db.staff.findUnique({ where: { botCode: trimmed }, select: { id: true, name: true, active: true } });
  if (!staff || !staff.active) return null;
  await db.telegramChat.upsert({
    where: { id: chatId },
    update: { staffId: staff.id },
    create: { id: chatId, staffId: staff.id },
  });
  return staff.name;
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
      const res = await createGuestBooking({ ...i, source: "TELEGRAM", telegramChatId: chatId });
      if (!res.ok || !res.payment) return res;
      return { ...res, deposit: { amount: res.payment.amount, payBy: res.payment.payBy, url: `${siteUrl()}${localePath(i.lang, `/oplata/${res.payment.id}`)}` } };
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
    linkMaster: linkMasterChat,
    formatWhen: (d, lang) => when(d, lang),
    async bonus(guestId, lang) {
      const b = await guestBonus(db, guestId, lang);
      return b.enabled ? { balance: b.balance, tier: b.tier.name, percent: b.tier.percent, maxSpendPercent: b.maxSpendPercent } : null;
    },
    async offers(lang) {
      const today = todayYmd();
      return (await siteOffers(db, today)).shown
        .filter((o) => o.startsOn <= today)
        .map((o) => ({
          title: o.titles[lang],
          description: o.descriptions[lang],
          label: o.kind === "PERCENT" ? `−${o.value}%` : `−${somoniIn(o.value, lang)}`,
          until: dayMonthYear(new Date(`${o.endsOn}T07:00:00Z`), lang),
          code: o.code,
        }));
    },
    async waitlist({ chatId, guestId, ...i }) {
      // She becomes a guest now, so the offer comes into this chat rather than WhatsApp
      const guest =
        (guestId ? await db.guest.findUnique({ where: { id: guestId } }) : null) ??
        (await db.guest.findUnique({ where: { phone: i.phone } })) ??
        (await db.guest.create({ data: { name: i.name, phone: i.phone, tag: "NEW", lang: i.lang } }));
      await db.telegramChat.update({ where: { id: chatId }, data: { guestId: guest.id } });
      const res = await joinWaitlist(db, { ...i, name: guest.name, guestId: guest.id, source: "TELEGRAM" });
      return res.duplicate ? "already" : res.offered ? "offered" : "joined";
    },
  };
}
