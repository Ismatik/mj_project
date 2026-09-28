"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth";
import { addFormula, deleteFormula, deletePhoto } from "@/server/guest-card";

// Colour formulas and photos, from the guest card (reception, owner) and the calendar (the master of the visit).

export async function saveFormula(input: { guestId: string; appointmentId?: string | null; title: string; formula: string; note?: string }) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Войдите заново" };
  const res = await addFormula(user, {
    guestId: String(input.guestId),
    appointmentId: input.appointmentId ? String(input.appointmentId) : null,
    title: String(input.title ?? ""),
    formula: String(input.formula ?? ""),
    note: String(input.note ?? ""),
  });
  if (res.ok) revalidatePath("/cms", "layout");
  return res;
}

export async function removeFormula(id: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Войдите заново" };
  const res = await deleteFormula(user, String(id));
  if (res.ok) revalidatePath("/cms", "layout");
  return res;
}

export async function removePhoto(id: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Войдите заново" };
  const res = await deletePhoto(user, String(id));
  if (res.ok) revalidatePath("/cms", "layout");
  return res;
}
