import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const approveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string; id: string }> }
) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const { id } = await params;

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
    const result = approveSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid approval payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.cashAdjustment.findFirst({
      where: { id, restaurantId: session.activeRestaurantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Cash adjustment not found" }, { status: 404 });
    }

    const updated = await prisma.cashAdjustment.update({
      where: { id },
      data: {
        approvalStatus: result.data.status,
        approvedBy: session.userId,
      },
    });

    return NextResponse.json({ success: true, adjustment: updated });
  } catch (error: any) {
    console.error("Approve Cash Adjustment Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
