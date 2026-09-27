"use server";

import { revalidatePath } from "next/cache";
import { canOpen } from "@/lib/access";
import { db } from "@/lib/db";
import { somoni } from "@/lib/format";
import { paymentMethod } from "@/lib/labels";
import { getCurrentUser } from "@/server/auth";

export type SaleLine = { serviceId: string; appointmentId?: string | null };
export type PayInput = { lines: SaleLine[]; method: "CASH" | "CARD" | "QR"; guestId?: string | null; staffId?: string | null };
export type PayResult = { ok: true; number: number; total: number; message: string } | { ok: false; error: string };

/**
 * Records a paid receipt. Prices come from the database, never from the browser:
 * a line from a booking uses the booked price, a line from the quick menu uses the menu price.
 */
export async function paySale(input: PayInput): Promise<PayResult> {
  const user = await getCurrentUser();
  if (!user || !canOpen(user.role, "pos")) return { ok: false, error: "Нет доступа к кассе" };
  if (!["CASH", "CARD", "QR"].includes(input.method)) return { ok: false, error: "Неизвестный способ оплаты" };
  const lines = (input.lines ?? []).slice(0, 30);
  if (!lines.length) return { ok: false, error: "Добавьте услугу в чек" };

  const serviceIds = [...new Set(lines.map((l) => String(l.serviceId)))];
  const apptIds = [...new Set(lines.map((l) => l.appointmentId).filter(Boolean) as string[])];
  const [services, appts] = await Promise.all([
    db.service.findMany({ where: { id: { in: serviceIds } } }),
    db.appointment.findMany({ where: { id: { in: apptIds }, status: { in: ["PENDING", "CONFIRMED", "IN_CHAIR"] } } }),
  ]);
  const svc = new Map(services.map((x) => [x.id, x]));
  const appt = new Map(appts.map((x) => [x.id, x]));

  const items: { serviceId: string; name: string; price: number }[] = [];
  for (const l of lines) {
    const service = svc.get(String(l.serviceId));
    if (!service) return { ok: false, error: "Услуга не найдена — обновите страницу" };
    if (l.appointmentId) {
      const a = appt.get(l.appointmentId);
      if (!a) return { ok: false, error: "Эта запись уже оплачена или отменена" };
      items.push({ serviceId: service.id, name: a.serviceLabel, price: a.price });
    } else {
      items.push({ serviceId: service.id, name: service.name, price: service.price });
    }
  }
  const total = items.reduce((sum, i) => sum + i.price, 0);

  const guestId = input.guestId ? (await db.guest.findUnique({ where: { id: input.guestId } }))?.id ?? null : null;
  const staffId = input.staffId ? (await db.staff.findUnique({ where: { id: input.staffId } }))?.id ?? null : null;

  const sale = await db.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: { total, method: input.method, guestId, staffId, items: { create: items } },
    });
    if (apptIds.length) await tx.appointment.updateMany({ where: { id: { in: apptIds } }, data: { status: "DONE" } });
    return created;
  });

  revalidatePath("/cms", "layout");
  return { ok: true, number: sale.number, total, message: `Оплата ${somoni(total)} принята · ${paymentMethod[input.method]}` };
}
