import { isMonth, monthOf } from "@/lib/payroll";
import { todayYmd } from "@/lib/time";
import { getPayroll } from "@/server/payroll";
import { payrollPdf, payrollXlsx } from "@/server/reports/export";
import { denied, fileResponse, formatOf, reportUser } from "@/server/reports/respond";

/** Payroll for a month: ?month=YYYY-MM&format=xlsx|pdf. The owner gets everyone, a master only herself. */
export async function GET(req: Request) {
  const user = await reportUser("payroll");
  if (!user) return denied();
  const m = new URL(req.url).searchParams.get("month");
  const month = isMonth(m) ? m : monthOf(todayYmd());
  const payroll = await getPayroll(month, user.role === "OWNER" ? null : (user.staffId ?? "none"));
  const format = formatOf(req);
  return fileResponse(format === "pdf" ? await payrollPdf(payroll) : payrollXlsx(payroll), `MJ-зарплата-${month}.${format}`, format, `MJ-payroll-${month}.${format}`);
}
