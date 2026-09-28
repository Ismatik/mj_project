"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";

export type ServiceInput = {
  id?: string;
  categoryId: string;
  name: string;
  durationMin: number;
  price: number;
  showOnSite: boolean;
  showInPos: boolean;
  /** Prepayment for online bookings, % of the price */
  depositPercent: number;
  staffIds: string[];
};
export type ServiceResult = { ok: true } | { ok: false; error: string };

async function requireOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") throw new Error("Цены меняет только владелица");
}

function check(input: ServiceInput): string | null {
  if (String(input.name ?? "").trim().length < 2) return "Название услуги слишком короткое";
  if (!Number.isInteger(input.durationMin) || input.durationMin < 5 || input.durationMin > 600) return "Длительность от 5 до 600 минут";
  if (!Number.isInteger(input.price) || input.price < 0 || input.price > 100000) return "Цена в сомони, целое число";
  if (!Array.isArray(input.staffIds) || input.staffIds.length === 0) return "Отметьте хотя бы одного мастера";
  if (!Number.isInteger(input.depositPercent) || input.depositPercent < 0 || input.depositPercent > 100) return "Предоплата — от 0 до 100 %";
  return null;
}

export async function saveService(input: ServiceInput): Promise<ServiceResult> {
  await requireOwner();
  const error = check(input);
  if (error) return { ok: false, error };
  const data = {
    name: input.name.trim().slice(0, 80),
    durationMin: input.durationMin,
    price: input.price,
    showOnSite: !!input.showOnSite,
    showInPos: !!input.showInPos,
    depositPercent: input.depositPercent,
    staff: { set: input.staffIds.slice(0, 20).map((id) => ({ id })) },
  };
  if (input.id) {
    await db.service.update({ where: { id: input.id }, data });
  } else {
    const count = await db.service.count({ where: { categoryId: input.categoryId } });
    await db.service.create({
      data: { ...data, categoryId: input.categoryId, sortOrder: count, staff: { connect: input.staffIds.map((id) => ({ id })) } },
    });
  }
  revalidatePath("/cms", "layout");
  return { ok: true };
}

/** Hidden from menus and booking; history stays intact. */
export async function archiveService(id: string): Promise<ServiceResult> {
  await requireOwner();
  await db.service.update({ where: { id }, data: { active: false, showOnSite: false, showInPos: false } });
  revalidatePath("/cms", "layout");
  return { ok: true };
}
