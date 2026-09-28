import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { CHANNEL_WHERE, CODE_MAX_ATTEMPTS, CODE_RESEND_SECONDS, CODE_TTL_MIN, CODES_PER_HOUR, pickCodeChannel, type CodeChannel } from "@/lib/guest-code";
import { deliverNow } from "./integrations/outbox";

// Guest accounts on the website: phone number → one-time code → session cookie (separate from staff sessions).

export const GUEST_COOKIE = "mj_guest";
const SESSION_DAYS = 90;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const codeHash = (phone: string, code: string) => sha(`${phone}:${code}`);

export type CurrentGuest = { id: string; name: string; phone: string; favouriteStaffId: string | null };

export const getCurrentGuest = cache(async (): Promise<CurrentGuest | null> => {
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!token) return null;
  const s = await db.guestSession.findUnique({ where: { tokenHash: sha(token) }, include: { guest: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return { id: s.guest.id, name: s.guest.name, phone: s.guest.phone, favouriteStaffId: s.guest.favouriteStaffId };
});

export type SendCodeResult =
  | { ok: true; channel: CodeChannel; where: string; resendIn: number; demoCode?: string }
  | { ok: false; error: string; resendIn?: number };

/**
 * On-screen codes while a channel is in mock mode: always in development, and on a server only with DEMO_LOGIN_CODES=1
 * (staging) — otherwise anyone could open any guest's account by typing her number.
 */
const demoCodesAllowed = () => process.env.NODE_ENV !== "production" || process.env.DEMO_LOGIN_CODES === "1";

/** Sends a 4-digit code. In mock mode nothing leaves the server, so the code is returned to be shown on screen. */
export async function sendLoginCode(phone: string): Promise<SendCodeResult> {
  const now = Date.now();
  const recent = await db.loginCode.findMany({ where: { phone, createdAt: { gte: new Date(now - 3600_000) } }, orderBy: { createdAt: "desc" } });
  const last = recent[0];
  if (last && now - last.createdAt.getTime() < CODE_RESEND_SECONDS * 1000) {
    const resendIn = Math.ceil((CODE_RESEND_SECONDS * 1000 - (now - last.createdAt.getTime())) / 1000);
    return { ok: false, error: `Код уже отправлен. Новый можно запросить через ${resendIn} с.`, resendIn };
  }
  if (recent.length >= CODES_PER_HOUR) return { ok: false, error: "Слишком много кодов за час. Попробуйте позже или позвоните нам." };

  const [guest, integrations] = await Promise.all([
    db.guest.findUnique({ where: { phone }, include: { telegramChats: { where: { isStaff: false }, orderBy: { updatedAt: "desc" }, select: { id: true } } } }),
    db.integration.findMany({ where: { key: { in: ["telegram", "whatsapp", "sms"] } } }),
  ]);
  const modeOf = (k: CodeChannel) => {
    const row = integrations.find((i) => i.key === k);
    return row?.enabled ? row.mode : null;
  };
  const modes = { telegram: modeOf("telegram"), whatsapp: modeOf("whatsapp"), sms: modeOf("sms") };
  const route = pickCodeChannel(guest?.telegramChats.map((c) => c.id) ?? [], modes);
  const mock = !!route && modes[route.channel] === "MOCK";
  if (!route || (mock && !demoCodesAllowed())) return { ok: false, error: "Вход в кабинет скоро заработает. Пока записаться и изменить запись можно по телефону или в WhatsApp." };

  const code = String(randomInt(0, 10000)).padStart(4, "0");
  await db.loginCode.create({
    data: { phone, codeHash: codeHash(phone, code), channel: route.channel, expiresAt: new Date(now + CODE_TTL_MIN * 60_000) },
  });
  const msg = await db.outboxMessage.create({
    data: {
      channel: route.channel,
      to: route.to ?? phone,
      body: `Mavzunai Jovid: код для входа в личный кабинет — ${code}. Никому его не сообщайте.`,
      meta: { kind: "login-code", secret: code },
    },
  });
  const status = await deliverNow(db, msg.id);
  if (status === "FAILED") return { ok: false, error: "Не удалось отправить код. Попробуйте ещё раз или позвоните нам." };
  return { ok: true, channel: route.channel, where: CHANNEL_WHERE[route.channel], resendIn: CODE_RESEND_SECONDS, ...(mock ? { demoCode: code } : {}) };
}

export type VerifyResult = { ok: true } | { ok: false; error: string; needName?: boolean };

/** Checks the latest code for the phone; on success signs the guest in (a new guest is created with the given name). */
export async function verifyLoginCode(phone: string, code: string, name?: string): Promise<VerifyResult> {
  const row = await db.loginCode.findFirst({ where: { phone, usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt < new Date()) return { ok: false, error: "Код устарел — запросите новый" };
  if (row.attempts >= CODE_MAX_ATTEMPTS) return { ok: false, error: "Слишком много попыток — запросите новый код" };
  const a = Buffer.from(row.codeHash);
  const b = Buffer.from(codeHash(phone, code));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = CODE_MAX_ATTEMPTS - row.attempts - 1;
    return { ok: false, error: left > 0 ? `Неверный код. Осталось попыток: ${left}` : "Неверный код. Запросите новый" };
  }
  let guest = await db.guest.findUnique({ where: { phone } });
  if (!guest) {
    const clean = (name ?? "").trim().slice(0, 80);
    if (clean.length < 2) return { ok: false, error: "Как к вам обращаться?", needName: true };
    guest = await db.guest.create({ data: { name: clean, phone, tag: "NEW" } });
  }
  await db.loginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600_000);
  await db.guestSession.create({ data: { tokenHash: sha(token), guestId: guest.id, expiresAt } });
  (await cookies()).set(GUEST_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
  return { ok: true };
}

export async function signOutGuest() {
  const store = await cookies();
  const token = store.get(GUEST_COOKIE)?.value;
  if (token) await db.guestSession.deleteMany({ where: { tokenHash: sha(token) } });
  store.delete(GUEST_COOKIE);
}
