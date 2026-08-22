import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { PayrollService } from "@/modules/payroll/service";
import { z } from "zod";

const paySchema = z.object({
  paymentMethod: z.enum(["BANK_TRANSFER", "CHECK", "CASH", "DIRECT_DEPOSIT", "OTHER"]).optional(),
});

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "payroll", permissionKey: "payroll:run_payroll" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json().catch(() => ({}));
    const result = paySchema.safeParse(body);
    const paymentMethod = result.success ? result.data.paymentMethod : undefined;

    const run = await PayrollService.markPayrollPaid(session.activeRestaurantId, params.id, paymentMethod as any);
    return NextResponse.json({ success: true, run });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
