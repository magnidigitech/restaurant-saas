import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const tipPoolRuleSchema = z.object({
  name: z.string().min(1).default("Standard Restaurant Pool"),
  fohPercentage: z.number().min(0).max(100).default(70),
  bohPercentage: z.number().min(0).max(100).default(30),
  distributionMethod: z.enum(["HOURS_WORKED", "EQUAL_SPLIT", "ROLE_POINT_SYSTEM"]).default("HOURS_WORKED"),
  rolePointsJson: z.record(z.string(), z.number()).optional(),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const rules = await prisma.tipPoolRule.findMany({
      where: { restaurantId: session.activeRestaurantId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, rules });
  } catch (error: any) {
    console.error("Get Tip Pool Rules Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = tipPoolRuleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid tip pool rule payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;

    // If active, set other rules for this restaurant to inactive
    if (data.isActive) {
      await prisma.tipPoolRule.updateMany({
        where: { restaurantId: session.activeRestaurantId },
        data: { isActive: false },
      });
    }

    const rule = await prisma.tipPoolRule.create({
      data: {
        restaurantId: session.activeRestaurantId,
        name: data.name,
        fohPercentage: data.fohPercentage,
        bohPercentage: data.bohPercentage,
        distributionMethod: data.distributionMethod,
        rolePointsJson: data.rolePointsJson || undefined,
        isActive: data.isActive,
      },
    });

    return NextResponse.json({ success: true, rule }, { status: 201 });
  } catch (error: any) {
    console.error("Create Tip Pool Rule Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
