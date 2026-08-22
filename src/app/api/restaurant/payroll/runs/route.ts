import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { PayrollService } from "@/modules/payroll/service";
import { z } from "zod";

const createPayrollRunSchema = z.object({
  outletId: z.string().uuid().nullable().optional().or(z.literal("")),
  title: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  periodStart: z.string().optional(),
  startDate: z.string().optional(),
  periodEnd: z.string().optional(),
  endDate: z.string().optional(),
  paymentDate: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "payroll", permissionKey: "payroll:view_payroll" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;

    const runs = await PayrollService.getPayrollRuns(session.activeRestaurantId, outletId);
    return NextResponse.json({ runs });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "payroll", permissionKey: "payroll:run_payroll" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = createPayrollRunSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const title = result.data.title || result.data.name;
    const periodStart = result.data.periodStart || result.data.startDate;
    const periodEnd = result.data.periodEnd || result.data.endDate;

    if (!title || !periodStart || !periodEnd) {
      return NextResponse.json({ error: "Missing required fields: title, periodStart, periodEnd" }, { status: 400 });
    }

    const run = await PayrollService.createPayrollRun(session.activeRestaurantId, {
      outletId: result.data.outletId && result.data.outletId !== "" ? result.data.outletId : undefined,
      title,
      periodStart,
      periodEnd,
      paymentDate: result.data.paymentDate,
      notes: result.data.notes || undefined,
    });
    return NextResponse.json({ success: true, run });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
