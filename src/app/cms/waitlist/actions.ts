"use server";

import { revalidatePath } from "next/cache";
import { canOpen } from "@/lib/access";
import { getCurrentUser } from "@/server/auth";
import { addEntry, addWalkIn, offerNow, seatWalkIn, setEntryStatus } from "@/server/waitlist/admin";

async function staff() {
  const user = await getCurrentUser();
  return user && canOpen(user.role, "waitlist") ? user : null;
}
const NO = { ok: false as const, error: "Нет доступа" };
function done<T extends { ok: boolean }>(res: T) {
  if (res.ok) revalidatePath("/cms", "layout");
  return res;
}
const str = (v: unknown) => String(v ?? "");

export async function newWalkIn(input: { name: string; phone: string; serviceId: string; staffId: string | null; note: string }) {
  const user = await staff();
  if (!user) return NO;
  return done(await addWalkIn({ name: str(input.name), phone: str(input.phone), serviceId: str(input.serviceId), staffId: input.staffId ? str(input.staffId) : null, note: str(input.note) }, user.name));
}

export async function seat(entryId: string, staffId: string | null) {
  const user = await staff();
  if (!user) return NO;
  return done(await seatWalkIn(str(entryId), staffId ? str(staffId) : null, user.name));
}

export async function closeEntry(entryId: string, status: "LEFT" | "CANCELLED") {
  if (!(await staff())) return NO;
  return done(await setEntryStatus(str(entryId), status === "LEFT" ? "LEFT" : "CANCELLED"));
}

export async function newEntry(input: { name: string; phone: string; serviceId: string; staffId: string | null; date: string; timeFrom: string; timeTo: string; note: string }) {
  const user = await staff();
  if (!user) return NO;
  return done(
    await addEntry(
      { name: str(input.name), phone: str(input.phone), serviceId: str(input.serviceId), staffId: input.staffId ? str(input.staffId) : null, date: str(input.date), timeFrom: str(input.timeFrom), timeTo: str(input.timeTo), note: str(input.note) },
      user.name,
    ),
  );
}

export async function findTime(entryId: string) {
  if (!(await staff())) return NO;
  return done(await offerNow(str(entryId)));
}
