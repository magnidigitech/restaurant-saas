import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { reverseOrderDepletion } from "@/core/inventory/depletionEngine";
import {
  assertPosOutletInScope,
  getPosActorContext,
} from "@/modules/pos-integrations/authHelper";
import { z } from "zod";

const updateOrderSchema = z.object({
  status: z.enum(["CANCELLED", "REFUNDED", "COMPLETED"]).optional(),
  reason: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getPosActorContext({ requireView: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const order = await prisma.posOrder.findFirst({
      where: { id, restaurantId: auth.ctx.restaurantId },
      include: {
        outlet: { select: { id: true, name: true } },
        items: {
          include: {
            recipe: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const scope = assertPosOutletInScope(auth.ctx, order.outletId);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
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
    const auth = await getPosActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.posOrder.findFirst({
      where: { id, restaurantId: auth.ctx.restaurantId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const scope = assertPosOutletInScope(auth.ctx, existing.outletId);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    let reversalResult = null;
    const targetStatus = parsed.data.status;

    if (targetStatus === "CANCELLED" || targetStatus === "REFUNDED") {
      reversalResult = await reverseOrderDepletion(
        id,
        auth.ctx.userId,
        parsed.data.reason || `POS Order ${targetStatus}`
      );
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
