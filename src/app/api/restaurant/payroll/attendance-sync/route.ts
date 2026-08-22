import { NextRequest, NextResponse } from "next/server";
import { PayrollService } from "@/modules/payroll/service";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const syncSchema = z.object({
  payrollRunId: z.string().min(1),
  customTipTotal: z.number().min(0).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      { moduleKey: "payroll", permissionKey: "payroll:run_payroll" },
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = syncSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid sync payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { payrollRunId } = result.data;

    const run = await PayrollService.executePayrollCalculation(
      session.activeRestaurantId,
      payrollRunId,
      session.userId
    );

    const totalRegularHours = run.payslips.reduce((sum, p) => sum + Number(p.hoursWorked || 0), 0);
    const totalOvertimeHours = run.payslips.reduce((sum, p) => sum + Number(p.overtimeHours || 0), 0);
    const totalTipsDistributed = run.payslips.reduce((sum, p) => sum + Number((p as any).pooledTipsAmount || 0), 0);

    return NextResponse.json({
      success: true,
      message: `Synced ${run.payslips.length} employees with ${totalRegularHours.toFixed(2)} regular hours & ${totalOvertimeHours.toFixed(2)} overtime hours.`,
      result: {
        totalSyncedEmployees: run.payslips.length,
        totalRegularHours,
        totalOvertimeHours,
        totalTipsDistributed,
      },
      run,
    });
  } catch (error: any) {
    console.error("Attendance Sync Error:", error);
    return NextResponse.json({ error: error.message || "Failed to sync attendance to payroll" }, { status: 400 });
  }
}
