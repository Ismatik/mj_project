import { getPeriodReport, periodFrom } from "@/server/reports/period";
import { periodPdf, periodXlsx } from "@/server/reports/export";
import { badRequest, denied, fileResponse, formatOf, reportUser } from "@/server/reports/respond";

/** Report for a period: ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive)&format=xlsx|pdf. Owner only. */
export async function GET(req: Request) {
  if (!(await reportUser("reports"))) return denied();
  const sp = new URL(req.url).searchParams;
  const period = periodFrom({ from: sp.get("from"), to: sp.get("to") });
  if (!period) return badRequest("Период — не больше года");
  const report = await getPeriodReport(period.from, period.to);
  const format = formatOf(req);
  const name = `MJ-отчёт-${period.from}_${period.toIncl}.${format}`;
  return fileResponse(format === "pdf" ? await periodPdf(report) : periodXlsx(report), name, format, `MJ-report-${period.from}_${period.toIncl}.${format}`);
}
