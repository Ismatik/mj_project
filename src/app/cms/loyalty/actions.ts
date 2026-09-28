"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { normalizePromoCode, normalizeRules, type BonusRules } from "@/lib/loyalty";
import { getCurrentUser } from "@/server/auth";
import { addPoints, RULES_SETTING } from "@/server/loyalty/core";
import type { PromotionForm } from "@/server/loyalty/admin";

async function owner() {
  const user = await getCurrentUser();
  return user?.role === "OWNER" ? user : null;
}

export async function saveRules(input: BonusRules): Promise<{ ok: true; rules: BonusRules } | { ok: false; error: string }> {
  if (!(await owner())) return { ok: false, error: "Только для владелицы" };
  const rules = normalizeRules(input);
  const value = rules as unknown as Prisma.InputJsonValue;
  await db.setting.upsert({ where: { key: RULES_SETTING }, update: { value }, create: { key: RULES_SETTING, value } });
  revalidatePath("/", "layout");
  return { ok: true, rules };
}

const ymd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function savePromotion(input: Omit<PromotionForm, "usedCount" | "id"> & { id?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await owner())) return { ok: false, error: "Только для владелицы" };
  const title = String(input.title ?? "").trim().slice(0, 80);
  if (title.length < 3) return { ok: false, error: "Название акции — хотя бы 3 буквы" };
  const kind = input.kind === "FIXED" ? "FIXED" : "PERCENT";
  const value = Math.round(Number(input.value));
  if (!Number.isFinite(value) || value <= 0 || (kind === "PERCENT" && value > 90) || value > 100000) return { ok: false, error: kind === "PERCENT" ? "Скидка от 1 до 90 %" : "Скидка в сомони — больше нуля" };
  if (!ymd(input.startsOn) || !ymd(input.endsOn) || input.endsOn < input.startsOn) return { ok: false, error: "Проверьте даты акции" };
  const code = input.code ? normalizePromoCode(input.code) : null;
  if (input.code && (!code || code.length < 3)) return { ok: false, error: "Промокод — от 3 букв и цифр" };
  if (code) {
    const same = await db.promotion.findUnique({ where: { code } });
    if (same && same.id !== input.id) return { ok: false, error: `Промокод ${code} уже есть` };
  }
  const serviceIds = (Array.isArray(input.serviceIds) ? input.serviceIds : []).map(String).slice(0, 50);
  const limit = input.usageLimit ? Math.round(Number(input.usageLimit)) : null;
  const clip = (v: string, n: number) => String(v ?? "").trim().slice(0, n) || null;
  const data = {
    title,
    titleTg: clip(input.titleTg, 80),
    titleEn: clip(input.titleEn, 80),
    description: clip(input.description, 300),
    descriptionTg: clip(input.descriptionTg, 300),
    descriptionEn: clip(input.descriptionEn, 300),
    kind,
    value,
    serviceIds,
    startsOn: new Date(`${input.startsOn}T00:00:00Z`),
    endsOn: new Date(`${input.endsOn}T00:00:00Z`),
    code,
    active: !!input.active,
    showOnSite: !!input.showOnSite,
    usageLimit: limit && limit > 0 ? limit : null,
  } as const;
  if (input.id) await db.promotion.update({ where: { id: input.id }, data });
  else await db.promotion.create({ data });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Owner: add or take points by hand (a compliment, a correction). */
export async function adjustPoints(guestId: string, delta: number, note: string): Promise<{ ok: boolean; error?: string }> {
  const user = await owner();
  if (!user) return { ok: false, error: "Только для владелицы" };
  const d = Math.round(Number(delta));
  if (!d || Math.abs(d) > 100000) return { ok: false, error: "Укажите количество бонусов" };
  const ok = await addPoints(db, String(guestId), d, "MANUAL", { note: String(note ?? "").trim().slice(0, 120) || undefined, by: user.name });
  revalidatePath("/cms", "layout");
  return ok ? { ok: true } : { ok: false, error: "На счёте меньше бонусов" };
}
