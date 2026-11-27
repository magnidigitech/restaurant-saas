import { NextRequest, NextResponse } from "next/server";
import { getPayrollActorContext } from "@/modules/payroll/authHelper";
import { PayrollService, PayrollError } from "@/modules/payroll/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

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

    if (body?.action === "CORRECT") {
      const correction = await PayrollService.createCorrectionRun(
        auth.ctx.restaurantId,
        id,
        auth.ctx.userId,
        auth.ctx.userEmail,
        body.notes
      );
      return NextResponse.json({ success: true, correction });
    }

    const result = await PayrollService.finalizePayrollRun(
      auth.ctx.restaurantId,
      id,
      auth.ctx.userId,
      auth.ctx.userEmail,
      body?.expectedPreviewHash
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const status = error instanceof PayrollError ? error.status : 400;
    return NextResponse.json(
      { error: error.message || "Finalization failed", code: error.code, details: error.details },
      { status }
    );
  }
}
