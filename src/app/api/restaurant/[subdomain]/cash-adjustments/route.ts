import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createAdjustmentSchema = z.object({
  outletId: z.string().min(1, "Outlet ID is required"),
  adjustmentType: z.enum(["CASH_IN", "CASH_OUT"]),
  category: z.string().min(1, "Category is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  reason: z.string().min(1, "Reason is required"),
  receiptUrl: z.string().optional(),
  adjustmentDate: z.string().optional(),
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

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");
    const adjustmentType = searchParams.get("adjustmentType");
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const approvalStatus = searchParams.get("approvalStatus");

    const where: any = { restaurantId: session.activeRestaurantId };

    if (outletId) where.outletId = outletId;
    if (adjustmentType) where.adjustmentType = adjustmentType;
    if (category) where.category = category;
    if (approvalStatus) where.approvalStatus = approvalStatus;

    if (startDate && endDate) {
      where.adjustmentDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      where.adjustmentDate = { gte: new Date(startDate) };
    }

    const adjustments = await prisma.cashAdjustment.findMany({
      where,
      include: {
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { adjustmentDate: "desc" },
      take: 200,
    });

    return NextResponse.json({ success: true, adjustments });
  } catch (error: any) {
    console.error("Get Cash Adjustments Error:", error);
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
    const result = createAdjustmentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid adjustment payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    const isPersonalUse =
      data.category.toLowerCase().includes("personal") ||
      data.category.toLowerCase().includes("owner") ||
      data.category.toLowerCase().includes("draw");

    const approvalStatus = isPersonalUse && data.adjustmentType === "CASH_OUT" ? "PENDING" : "NOT_REQUIRED";

    const adjustment = await prisma.cashAdjustment.create({
      data: {
        restaurantId: session.activeRestaurantId,
        outletId: data.outletId,
        adjustmentType: data.adjustmentType,
        category: data.category,
        amount: data.amount,
        reason: data.reason,
        receiptUrl: data.receiptUrl || null,
        enteredBy: session.userId,
        approvalStatus,
        adjustmentDate: data.adjustmentDate ? new Date(data.adjustmentDate) : new Date(),
      },
    });

    return NextResponse.json({ success: true, adjustment }, { status: 201 });
  } catch (error: any) {
    console.error("Create Cash Adjustment Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
