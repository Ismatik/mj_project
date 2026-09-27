import { NextResponse, type NextRequest } from "next/server";
import { canUseCms } from "@/lib/access";
import { getCurrentUser } from "@/server/auth";
import { searchCms } from "@/server/search";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !canUseCms(user.role)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const only = request.nextUrl.searchParams.get("only") === "guests" ? "guests" : undefined;
  return NextResponse.json(await searchCms(q, user, only), { headers: { "Cache-Control": "no-store" } });
}
