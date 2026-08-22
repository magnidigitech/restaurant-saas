import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { PayrollService } from "@/modules/payroll/service";
import { z } from "zod";

const upsertSalaryStructureSchema = z.object({
  employeeId: z.string().uuid(),
  payFrequency: z.enum(["MONTHLY", "BI_WEEKLY", "WEEKLY", "HOURLY"]).optional(),
  currency: z.string().optional(),
  baseSalary: z.number().min(0),
  hourlyRate: z.number().min(0).optional(),
  allowances: z
    .array(
      z.object({
        name: z.string(),
        amount: z.number().min(0),
        isPercentage: z.boolean().optional(),
      })
    )
    .optional(),
  deductions: z
    .array(
      z.object({
        name: z.string(),
        amount: z.number().min(0),
        isPercentage: z.boolean().optional(),
        type: z.enum(["TAX", "RETIREMENT", "HEALTH", "UNPAID_LEAVE", "LOAN", "OTHER"]).optional(),
      })
    )
    .optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "payroll", permissionKey: "payroll:view_payroll" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const structures = await PayrollService.getSalaryStructures(session.activeRestaurantId);
    return NextResponse.json({ structures });
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
    const result = upsertSalaryStructureSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const structure = await PayrollService.upsertSalaryStructure(session.activeRestaurantId, result.data as any);
    return NextResponse.json({ success: true, structure });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
