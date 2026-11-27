import { NextRequest, NextResponse } from "next/server";
import { getPayrollActorContext } from "@/modules/payroll/authHelper";
import { PayrollService, PayrollError } from "@/modules/payroll/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getPayrollActorContext({ requireView: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const run = await PayrollService.getPayrollRunById(auth.ctx.restaurantId, id);
    if (
      auth.ctx.accessibleOutletIds !== null &&
      (!run.outletId || !auth.ctx.accessibleOutletIds.includes(run.outletId))
    ) {
      return NextResponse.json(
        { error: "Payroll run is outside your authorized outlet scope" },
        { status: 403 }
      );
    }

    if (req.nextUrl.searchParams.get("format") === "csv") {
      const headers = [
        "EmployeeCode",
        "EmployeeName",
        "RegularHours",
        "OvertimeHours",
        "BasePay",
        "Allowances",
        "PooledTips",
        "Deductions",
        "NetPay",
        "Currency",
        "Status",
      ];
      const rows = run.payslips.map((p) =>
        [
          p.employee.employeeCode,
          `"${p.employee.firstName} ${p.employee.lastName}"`,
          p.hoursWorked,
          p.overtimeHours,
          p.basePay,
          p.totalAllowances,
          p.pooledTipsAmount,
          p.totalDeductions,
          p.netPay,
          p.currency,
          p.status,
        ].join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="payroll-${run.id}.csv"`,
        },
      });
    }

    return NextResponse.json({
      run,
      actor: {
        canViewPayroll: auth.ctx.canViewPayroll,
        canRunPayroll: auth.ctx.canRunPayroll,
        canApprovePayroll: auth.ctx.canApprovePayroll,
      },
    });
  } catch (error: any) {
    const status = error instanceof PayrollError ? error.status : 404;
    return NextResponse.json({ error: error.message || "Not found" }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getPayrollActorContext({ requireRun: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const run = await PayrollService.getPayrollRunById(auth.ctx.restaurantId, id);
    if (
      auth.ctx.accessibleOutletIds !== null &&
      (!run.outletId || !auth.ctx.accessibleOutletIds.includes(run.outletId))
    ) {
      return NextResponse.json(
        { error: "Payroll run is outside your authorized outlet scope" },
        { status: 403 }
      );
    }

    await PayrollService.deletePayrollRun(auth.ctx.restaurantId, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error instanceof PayrollError ? error.status : 400;
    return NextResponse.json({ error: error.message || "Cannot delete" }, { status });
  }
}
