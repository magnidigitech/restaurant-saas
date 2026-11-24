import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { reverseOrderDepletion } from "@/core/inventory/depletionEngine";
import { z } from "zod";

const updateOrderSchema = z.object({
  status: z.enum(["CANCELLED", "REFUNDED", "COMPLETED"]).optional(),
  reason: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const { id } = await params;
    const order = await prisma.posOrder.findFirst({
      where: { id, restaurantId: session.activeRestaurantId },
      include: {
        items: {
          include: {
            recipe: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      { moduleKey: "pos" },
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.posOrder.findFirst({
      where: { id, restaurantId: session.activeRestaurantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let reversalResult = null;
    const targetStatus = parsed.data.status;

    if (targetStatus === "CANCELLED" || targetStatus === "REFUNDED") {
      // Execute stock depletion reversal using historical ledger records
      reversalResult = await reverseOrderDepletion(id, session.userId, parsed.data.reason || `POS Order ${targetStatus}`);
      await prisma.posOrder.update({
        where: { id },
        data: {
          status: "CANCELLED",
          ...(targetStatus === "REFUNDED" ? { paymentStatus: "REFUNDED" } : {}),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Order status updated to ${targetStatus}`,
      reversal: reversalResult,
    });
  } catch (error: any) {
    console.error("Update POS Order Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
