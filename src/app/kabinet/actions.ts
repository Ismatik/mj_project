"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { BOOKING_HORIZON_DAYS } from "@/lib/slots";
import { addDays, isClosed, todayYmd } from "@/lib/time";
import { getCurrentGuest, sendLoginCode, signOutGuest, verifyLoginCode, type SendCodeResult, type VerifyResult } from "@/server/guest-auth";
import { cancelByGuest, rescheduleByGuest, slotsFor } from "@/server/online-booking";
import { tooManyAttempts } from "@/server/rate-limit";

const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
const PHONE_HINT = "Нужно 9 цифр, например 98 103 11 11";

export async function requestCode(rawPhone: string): Promise<SendCodeResult> {
  const phone = normalizePhone(String(rawPhone ?? ""));
  if (!phone) return { ok: false, error: PHONE_HINT };
  if (tooManyAttempts(`guest-code:${await ip()}`, 10, 3600_000)) return { ok: false, error: "Слишком много попыток. Попробуйте позже." };
  return sendLoginCode(phone);
}

export async function confirmCode(rawPhone: string, code: string, name?: string): Promise<VerifyResult> {
  const phone = normalizePhone(String(rawPhone ?? ""));
  if (!phone) return { ok: false, error: PHONE_HINT };
  if (!/^\d{4}$/.test(String(code ?? ""))) return { ok: false, error: "Код — 4 цифры" };
  if (tooManyAttempts(`guest-verify:${await ip()}`, 30, 3600_000)) return { ok: false, error: "Слишком много попыток. Попробуйте позже." };
  const res = await verifyLoginCode(phone, String(code), name ? String(name) : undefined);
  if (res.ok) revalidatePath("/", "layout");
  return res;
}

export async function signOut() {
  await signOutGuest();
  redirect("/kabinet");
}

async function guestOrFail() {
  const guest = await getCurrentGuest();
  if (!guest) throw new Error("Войдите в личный кабинет");
  return guest;
}

const dateOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= todayYmd() && d <= addDays(todayYmd(), BOOKING_HORIZON_DAYS) && !isClosed(d);

export async function cancelMyBooking(appointmentId: string): Promise<{ ok: boolean; error?: string }> {
  const guest = await guestOrFail();
  const res = await cancelByGuest(String(appointmentId), guest.id);
  if (res.ok) revalidatePath("/kabinet");
  revalidatePath("/cms", "layout");
  return res;
}

/** Free times for moving one of her bookings (same service and master). */
export async function rescheduleSlots(appointmentId: string, date: string): Promise<string[]> {
  const guest = await guestOrFail();
  if (!dateOk(String(date))) return [];
  const a = await db.appointment.findFirst({ where: { id: String(appointmentId), guestId: guest.id }, include: { staff: true } });
  if (!a?.serviceId) return [];
  const { slots } = await slotsFor(a.serviceId, String(date), a.staff[0]?.staffId ?? null, db, a.id);
  return slots.map((s) => s.time);
}

export async function rescheduleMyBooking(appointmentId: string, date: string, time: string): Promise<{ ok: boolean; error?: string; when?: string }> {
  const guest = await guestOrFail();
  if (!dateOk(String(date)) || !/^\d{2}:\d{2}$/.test(String(time))) return { ok: false, error: "Выберите день и время" };
  const a = await db.appointment.findFirst({ where: { id: String(appointmentId), guestId: guest.id } });
  if (!a) return { ok: false, error: "Запись не найдена" };
  if (a.startsAt.getTime() - Date.now() < 2 * 3600_000) return { ok: false, error: "До визита меньше двух часов — позвоните нам, пожалуйста" };
  const res = await rescheduleByGuest(a.id, guest.id, String(date), String(time));
  revalidatePath("/kabinet");
  revalidatePath("/cms", "layout");
  return res.ok ? { ok: true, when: res.summary.when } : { ok: false, error: res.error };
}

export async function setFavouriteMaster(staffId: string | null): Promise<{ ok: boolean }> {
  const guest = await guestOrFail();
  const id = staffId ? String(staffId) : null;
  if (id && !(await db.staff.findFirst({ where: { id, active: true } }))) return { ok: false };
  await db.guest.update({ where: { id: guest.id }, data: { favouriteStaffId: id } });
  revalidatePath("/kabinet");
  revalidatePath("/mastera", "layout");
  return { ok: true };
}
