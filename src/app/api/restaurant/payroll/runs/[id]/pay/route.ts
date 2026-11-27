import { NextRequest, NextResponse } from "next/server";
import { getPayrollActorContext } from "@/modules/payroll/authHelper";
import { PayrollService, PayrollError } from "@/modules/payroll/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getPayrollActorContext({ requireApprove: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const existing = await PayrollService.getPayrollRunById(auth.ctx.restaurantId, id);
    if (
      auth.ctx.accessibleOutletIds !== null &&
      (!existing.outletId || !auth.ctx.accessibleOutletIds.includes(existing.outletId))
    ) {
      return NextResponse.json(
        { error: "Payroll run is outside your authorized outlet scope" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const run = await PayrollService.markPayrollPaid(
      auth.ctx.restaurantId,
      id,
      body?.paymentMethod
    );
    return NextResponse.json({ success: true, run });
  } catch (error: any) {
    const status = error instanceof PayrollError ? error.status : 400;
    return NextResponse.json({ error: error.message || "Payment update failed" }, { status });
  }
}
