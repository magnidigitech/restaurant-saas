import { NextRequest, NextResponse } from "next/server";
import { getPayrollActorContext } from "@/modules/payroll/authHelper";
import { PayrollService, PayrollError } from "@/modules/payroll/service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getPayrollActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { ctx } = auth;

    const payrollRunId = req.nextUrl.searchParams.get("payrollRunId") || undefined;
    const requestedEmpId = req.nextUrl.searchParams.get("employeeId") || undefined;

    if (!ctx.canViewPayroll) {
      if (!ctx.employeeId) {
        return NextResponse.json({ payslips: [] });
      }
      const payslips = await PayrollService.getPayslips(ctx.restaurantId, {
        payrollRunId,
        employeeId: ctx.employeeId,
        onlyIssued: true,
      });
      return NextResponse.json({ payslips });
    }

    const payslips = await PayrollService.getPayslips(ctx.restaurantId, {
      payrollRunId,
      employeeId: requestedEmpId,
      accessibleOutletIds: ctx.accessibleOutletIds,
    });
    return NextResponse.json({ payslips });
  } catch (error: any) {
    const status = error instanceof PayrollError ? error.status : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}
