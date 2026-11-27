import { NextRequest, NextResponse } from "next/server";
import { getPayrollActorContext } from "@/modules/payroll/authHelper";
import { PayrollService, PayrollError } from "@/modules/payroll/service";
import { z } from "zod";

const createPayrollRunSchema = z.object({
  outletId: z.string().uuid().optional().nullable(),
  title: z.string().min(2),
  periodStart: z.string(),
  periodEnd: z.string(),
  paymentDate: z.string(),
  overtimeMultiplier: z.number().min(1).max(3).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const outletId = req.nextUrl.searchParams.get("outletId") || undefined;
    const auth = await getPayrollActorContext({ requireView: true, outletId });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const runs = await PayrollService.getPayrollRuns(auth.ctx.restaurantId, {
      outletId,
      accessibleOutletIds: auth.ctx.accessibleOutletIds,
    });
    return NextResponse.json({
      runs,
      actor: {
        canViewPayroll: auth.ctx.canViewPayroll,
        canRunPayroll: auth.ctx.canRunPayroll,
        canApprovePayroll: auth.ctx.canApprovePayroll,
        accessibleOutletIds: auth.ctx.accessibleOutletIds,
      },
    });
  } catch (error: any) {
    const status = error instanceof PayrollError ? error.status : 500;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = createPayrollRunSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const auth = await getPayrollActorContext({
      requireRun: true,
      outletId: result.data.outletId ?? null,
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const run = await PayrollService.createPayrollRun(auth.ctx.restaurantId, {
      outletId: result.data.outletId || undefined,
      title: result.data.title,
      periodStart: result.data.periodStart,
      periodEnd: result.data.periodEnd,
      paymentDate: result.data.paymentDate,
      overtimeMultiplier: result.data.overtimeMultiplier,
      notes: result.data.notes,
    });
    return NextResponse.json({ success: true, run });
  } catch (error: any) {
    const status = error instanceof PayrollError ? error.status : 400;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}
