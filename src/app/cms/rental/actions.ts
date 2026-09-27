"use server";

import { revalidatePath } from "next/cache";
import { canOpen } from "@/lib/access";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { addDays, todayYmd } from "@/lib/time";
import { getCurrentUser } from "@/server/auth";

type Result = { ok: true } | { ok: false; error: string };

async function requireRental() {
  const user = await getCurrentUser();
  if (!user || !canOpen(user.role, "rental")) throw new Error("Нет доступа");
}

const ymd = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);

export async function bookDress(input: { dressId: string; startsOn: string; days: number; guestName: string; guestPhone: string }): Promise<Result> {
  await requireRental();
  const days = Math.floor(Number(input.days));
  if (!ymd(input.startsOn)) return { ok: false, error: "Выберите дату" };
  if (input.startsOn < todayYmd()) return { ok: false, error: "Эта дата уже прошла" };
  if (!(days >= 1 && days <= 14)) return { ok: false, error: "От 1 до 14 дней" };
  const endsOn = addDays(input.startsOn, days - 1);

  const dress = await db.dress.findUnique({ where: { id: input.dressId } });
  if (!dress || dress.status === "RETIRED") return { ok: false, error: "Платье не найдено" };
  const clash = await db.dressBooking.findFirst({
    where: { dressId: dress.id, startsOn: { lte: asDate(endsOn) }, endsOn: { gte: asDate(input.startsOn) } },
  });
  if (clash) return { ok: false, error: `Уже забронировано ${clash.startsOn.toISOString().slice(0, 10).split("-").reverse().join(".")}` };

  let guestId: string | null = null;
  const phone = input.guestPhone.trim() ? normalizePhone(input.guestPhone) : null;
  if (input.guestPhone.trim() && !phone) return { ok: false, error: "Телефон: нужно 9 цифр" };
  if (phone) {
    const found = await db.guest.findUnique({ where: { phone } });
    if (found) guestId = found.id;
    else if (input.guestName.trim().length >= 2) guestId = (await db.guest.create({ data: { name: input.guestName.trim(), phone, tag: "BRIDE" } })).id;
    else return { ok: false, error: "Укажите имя новой гостьи" };
  }

  await db.dressBooking.create({ data: { dressId: dress.id, guestId, startsOn: asDate(input.startsOn), endsOn: asDate(endsOn) } });
  revalidatePath("/cms", "layout");
  return { ok: true };
}

export async function cancelDressBooking(id: string): Promise<Result> {
  await requireRental();
  await db.dressBooking.delete({ where: { id } });
  revalidatePath("/cms", "layout");
  return { ok: true };
}

export async function setDressStatus(id: string, status: "AVAILABLE" | "CLEANING"): Promise<Result> {
  await requireRental();
  if (status !== "AVAILABLE" && status !== "CLEANING") return { ok: false, error: "Неизвестный статус" };
  await db.dress.update({ where: { id }, data: { status } });
  revalidatePath("/cms/rental");
  return { ok: true };
}
