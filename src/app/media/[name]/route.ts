import { NextResponse } from "next/server";
import { readMedia } from "@/server/media";

/**
 * Photos uploaded in the site admin. saveUpload() hands back /media/<uuid>.<ext> and writes the
 * file into MEDIA_DIR, so without this route every picture the salon uploads is a 404.
 *
 * Public on purpose - these are the website's own images. Guest before/after photos are private
 * and live in MEDIA_DIR/private, which readMedia() cannot reach: MEDIA_NAME admits a bare uuid
 * plus extension, so "private/x.jpg" and "../.env" never match.
 */
export async function GET(_req: Request, ctx: RouteContext<"/media/[name]">) {
  const { name } = await ctx.params;
  const file = await readMedia(name);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.mime,
      // The name is a uuid, so the bytes behind it never change.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
