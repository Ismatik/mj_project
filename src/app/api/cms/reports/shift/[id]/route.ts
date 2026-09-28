import { NextResponse } from "next/server";
import { shiftPdf } from "@/server/reports/export";
import { denied, fileResponse, reportUser } from "@/server/reports/respond";
import { getShift } from "@/server/shift";

/** Z-report of a closed shift as a PDF (reception and owner). */
export async function GET(_req: Request, ctx: RouteContext<"/api/cms/reports/shift/[id]">) {
  if (!(await reportUser("pos"))) return denied();
  const shift = await getShift((await ctx.params).id);
  if (!shift) return NextResponse.json({ ok: false }, { status: 404 });
  return fileResponse(await shiftPdf(shift), `MJ-смена-${shift.ymd}.pdf`, "pdf", `MJ-shift-${shift.ymd}.pdf`);
}
