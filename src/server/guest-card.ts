import "server-only";
import { canOpen } from "@/lib/access";
import { db } from "@/lib/db";
import type { CurrentUser } from "./auth";
import { removePrivateMedia } from "./media";

// Guest card extras: colour formulas and before/after photos. Reception and the owner see every guest;
// a master sees the card extras of guests she has served or is booked with.

export async function canSeeGuest(user: CurrentUser | null, guestId: string): Promise<boolean> {
  if (!user) return false;
  if (canOpen(user.role, "guests")) return true;
  if (user.role !== "MASTER" || !user.staffId) return false;
  return !!(await db.appointment.findFirst({ where: { guestId, staff: { some: { staffId: user.staffId } } }, select: { id: true } }));
}

export async function addFormula(user: CurrentUser, input: { guestId: string; appointmentId?: string | null; title: string; formula: string; note?: string }) {
  if (!(await canSeeGuest(user, input.guestId))) return { ok: false as const, error: "Нет доступа" };
  const title = input.title.trim().slice(0, 80);
  const formula = input.formula.trim().slice(0, 500);
  if (!title) return { ok: false as const, error: "Для чего формула? Например «Окрашивание корней»" };
  if (formula.length < 3) return { ok: false as const, error: "Запишите состав: краситель, оксид, время" };
  let appointmentId: string | null = null;
  let staffId = user.staffId ?? null;
  if (input.appointmentId) {
    const a = await db.appointment.findFirst({ where: { id: input.appointmentId, guestId: input.guestId }, include: { staff: true } });
    if (a) {
      appointmentId = a.id;
      staffId = staffId && a.staff.some((s) => s.staffId === staffId) ? staffId : (a.staff[0]?.staffId ?? staffId);
    }
  }
  await db.colourFormula.create({ data: { guestId: input.guestId, appointmentId, staffId, title, formula, note: input.note?.trim().slice(0, 200) || null, createdBy: user.name } });
  return { ok: true as const };
}

export async function deleteFormula(user: CurrentUser, id: string) {
  const f = await db.colourFormula.findUnique({ where: { id } });
  if (!f) return { ok: true as const };
  // A master may remove only her own formulas
  if (!canOpen(user.role, "guests") && f.staffId !== user.staffId) return { ok: false as const, error: "Можно удалить только свою формулу" };
  await db.colourFormula.delete({ where: { id } });
  return { ok: true as const };
}

export async function deletePhoto(user: CurrentUser, id: string) {
  const p = await db.guestPhoto.findUnique({ where: { id } });
  if (!p) return { ok: true as const };
  if (!(await canSeeGuest(user, p.guestId))) return { ok: false as const, error: "Нет доступа" };
  await db.guestPhoto.delete({ where: { id } });
  await removePrivateMedia(p.file);
  return { ok: true as const };
}

/** Allergies and the latest formulas, for the calendar panel and the till */
export async function guestAlerts(guestId: string) {
  const [g, formulas] = await Promise.all([
    db.guest.findUnique({ where: { id: guestId }, select: { allergies: true } }),
    db.colourFormula.findMany({ where: { guestId }, orderBy: { createdAt: "desc" }, take: 3, include: { staff: { select: { name: true } } } }),
  ]);
  return {
    allergies: g?.allergies ?? null,
    formulas: formulas.map((f) => ({ id: f.id, title: f.title, formula: f.formula, note: f.note, master: f.staff?.name ?? null, at: f.createdAt })),
  };
}
