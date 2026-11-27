import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPayrollActorContext } from "@/modules/payroll/authHelper";
import { z } from "zod";

const tipPoolRuleSchema = z.object({
  outletId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).default("Standard Restaurant Pool"),
  fohPercentage: z.number().min(0).max(100).default(70),
  bohPercentage: z.number().min(0).max(100).default(30),
  distributionMethod: z
    .enum(["HOURS_WORKED", "EQUAL_SPLIT", "ROLE_POINT_SYSTEM"])
    .default("HOURS_WORKED"),
  includeCashTips: z.boolean().default(true),
  includeCardTips: z.boolean().default(true),
  includeServiceCharges: z.boolean().default(false),
  deductRefunds: z.boolean().default(true),
  rolePointsJson: z.record(z.string(), z.number()).optional(),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;

    const auth = await getPayrollActorContext({ requireView: true, outletId });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rules = await prisma.tipPoolRule.findMany({
      where: {
        restaurantId: auth.ctx.restaurantId,
        isActive: true,
        ...(outletId ? { OR: [{ outletId }, { outletId: null }] } : {}),
      },
      orderBy: [{ outletId: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, rules });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = tipPoolRuleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid tip pool rule payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const auth = await getPayrollActorContext({
      requireRun: true,
      outletId: result.data.outletId ?? undefined,
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (Math.round(result.data.fohPercentage + result.data.bohPercentage) !== 100) {
      return NextResponse.json(
        { error: "FOH and BOH percentages must total 100%" },
        { status: 400 }
      );
    }

    const rule = await prisma.tipPoolRule.create({
      data: {
        restaurantId: auth.ctx.restaurantId,
        outletId: result.data.outletId || null,
        name: result.data.name,
        fohPercentage: result.data.fohPercentage,
        bohPercentage: result.data.bohPercentage,
        distributionMethod: result.data.distributionMethod,
        includeCashTips: result.data.includeCashTips,
        includeCardTips: result.data.includeCardTips,
        includeServiceCharges: result.data.includeServiceCharges,
        deductRefunds: result.data.deductRefunds,
        rolePointsJson: result.data.rolePointsJson || {},
        isActive: result.data.isActive,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
