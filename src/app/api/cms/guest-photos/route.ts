import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";
import { canSeeGuest } from "@/server/guest-card";
import { savePrivateUpload } from "@/server/media";

const KINDS = ["BEFORE", "AFTER", "OTHER"] as const;

/** Before/after photo for a guest card (form fields: guestId, kind, caption, appointmentId?, file). */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 9 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Файл больше 8 МБ" }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const guestId = String(form?.get("guestId") ?? "");
  if (!user || !(await canSeeGuest(user, guestId))) return NextResponse.json({ ok: false, error: "Нет доступа" }, { status: 403 });
  const saved = await savePrivateUpload((form?.get("file") as File | null) ?? null);
  if (!saved.ok) return NextResponse.json(saved, { status: 400 });
  const kind = KINDS.find((k) => k === form?.get("kind")) ?? "OTHER";
  const apptId = String(form?.get("appointmentId") ?? "");
  const appt = apptId ? await db.appointment.findFirst({ where: { id: apptId, guestId }, select: { id: true } }) : null;
  const photo = await db.guestPhoto.create({
    data: { guestId, kind, file: saved.name, caption: String(form?.get("caption") ?? "").trim().slice(0, 120) || null, appointmentId: appt?.id ?? null, createdBy: user.name },
  });
  return NextResponse.json({ ok: true, id: photo.id });
}
