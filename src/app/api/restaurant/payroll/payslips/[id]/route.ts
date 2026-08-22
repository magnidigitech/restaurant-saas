import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { PayrollService } from "@/modules/payroll/service";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "payroll", permissionKey: "payroll:view_payroll" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const payslip = await PayrollService.getPayslipById(session.activeRestaurantId, params.id);
    return NextResponse.json({ payslip });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 404 });
  }
}
