import "server-only";
import { NextResponse } from "next/server";
import { canOpen, type CmsPageId } from "@/lib/access";
import { getCurrentUser } from "../auth";

// Downloads for the CMS: checks the page access and sends the file.

export async function reportUser(page: CmsPageId) {
  const user = await getCurrentUser();
  return user && canOpen(user.role, page) ? user : null;
}

export const denied = () => NextResponse.json({ ok: false, error: "Нет доступа" }, { status: 403 });
export const badRequest = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });

const TYPES = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" } as const;

/** `name` is what the user sees; `ascii` is the fallback for old clients */
export function fileResponse(body: Uint8Array, name: string, format: keyof typeof TYPES, ascii = name) {
  return new NextResponse(Buffer.from(body), {
    headers: {
      "Content-Type": TYPES[format],
      // ASCII fallback name plus the UTF-8 one
      "Content-Disposition": `${format === "pdf" ? "inline" : "attachment"}; filename="${ascii.replace(/[^\w.-]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export const formatOf = (req: Request) => (new URL(req.url).searchParams.get("format") === "pdf" ? "pdf" : "xlsx");
