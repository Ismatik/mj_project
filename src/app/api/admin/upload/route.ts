import { NextResponse, type NextRequest } from "next/server";
import { canUseSiteAdmin } from "@/lib/access";
import { getCurrentUser } from "@/server/auth";
import { saveUpload } from "@/server/media";

// Photo uploads for the site admin (kept out of server actions so their 1 MB limit stays in place elsewhere).
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canUseSiteAdmin(user.role)) return NextResponse.json({ ok: false, error: "Нет доступа" }, { status: 401 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 9 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Файл больше 8 МБ" }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const result = await saveUpload((form?.get("file") as File | null) ?? null);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
