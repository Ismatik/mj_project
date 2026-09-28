import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";
import { canSeeGuest } from "@/server/guest-card";
import { readPrivateMedia } from "@/server/media";

/** A guest photo, only for staff allowed to see that guest. Never cached publicly. */
export async function GET(_req: Request, ctx: RouteContext<"/api/cms/guest-photos/[id]">) {
  const { id } = await ctx.params;
  const photo = await db.guestPhoto.findUnique({ where: { id } });
  if (!photo || !(await canSeeGuest(await getCurrentUser(), photo.guestId))) return NextResponse.json({ ok: false }, { status: 404 });
  const file = await readPrivateMedia(photo.file);
  if (!file) return NextResponse.json({ ok: false }, { status: 404 });
  return new NextResponse(new Uint8Array(file.body), { headers: { "Content-Type": file.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
