"use server";

import { revalidatePath } from "next/cache";
import { canOpen } from "@/lib/access";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { getCurrentUser } from "@/server/auth";

export type GuestForm = { id: string; name: string; phone: string; tag: string; birthday: string; notes: string; allergies: string };
export type GuestSaveResult = { ok: true } | { ok: false; errors: Partial<Record<keyof GuestForm, string>> };

const TAGS = ["NEW", "REGULAR", "VIP", "BRIDE"] as const;

export async function saveGuest(form: GuestForm): Promise<GuestSaveResult> {
  const user = await getCurrentUser();
  if (!user || !canOpen(user.role, "guests")) return { ok: false, errors: { name: "Нет доступа" } };

  const errors: Partial<Record<keyof GuestForm, string>> = {};
  const name = String(form.name ?? "").trim().slice(0, 80);
  const phone = normalizePhone(String(form.phone ?? ""));
  const tag = TAGS.find((t) => t === form.tag);
  const birthday = String(form.birthday ?? "");
  if (name.length < 2) errors.name = "Как зовут гостью?";
  if (!phone) errors.phone = "Нужно 9 цифр, например 98 103 11 11";
  if (!tag) errors.tag = "Выберите статус";
  if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) errors.birthday = "Дата в формате ГГГГ-ММ-ДД";
  if (phone) {
    const other = await db.guest.findUnique({ where: { phone } });
    if (other && other.id !== form.id) errors.phone = `Этот номер уже у гостьи «${other.name}»`;
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  await db.guest.update({
    where: { id: form.id },
    data: {
      name,
      phone: phone!,
      tag: tag!,
      birthday: birthday ? new Date(`${birthday}T00:00:00Z`) : null,
      notes: String(form.notes ?? "").trim().slice(0, 2000) || null,
      allergies: String(form.allergies ?? "").trim().slice(0, 500) || null,
    },
  });
  revalidatePath("/cms/guests");
  return { ok: true };
}
