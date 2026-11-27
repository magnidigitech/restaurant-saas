import { NextRequest, NextResponse } from "next/server";
import { getPayrollActorContext } from "@/modules/payroll/authHelper";
import { PayrollService, PayrollError } from "@/modules/payroll/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getPayrollActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { ctx } = auth;

    const payslip = await PayrollService.getPayslipById(ctx.restaurantId, id);

    const isOwnIssued = Boolean(
      ctx.employeeId &&
        payslip.employeeId === ctx.employeeId &&
        payslip.status !== "DRAFT"
    );

    const isScopedManager =
      ctx.canViewPayroll &&
      (ctx.accessibleOutletIds === null ||
        (payslip.payrollRun?.outletId &&
          ctx.accessibleOutletIds.includes(payslip.payrollRun.outletId)));

    if (!isOwnIssued && !isScopedManager) {
      return NextResponse.json(
        { error: "You are not authorized to view this payslip" },
        { status: 403 }
      );
    }

    return NextResponse.json({ payslip });
  } catch (error: any) {
    const status = error instanceof PayrollError ? error.status : 404;
    return NextResponse.json({ error: error.message || "Payslip not found" }, { status });
  }
}
