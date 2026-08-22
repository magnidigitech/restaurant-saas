import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const reviewLeaveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
  managerNotes: z.string().optional(),
});

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
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { id } = await params;
    const body = await req.json();
    const result = reviewLeaveSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid review payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;

    const leave = await prisma.leaveRequest.update({
      where: {
        id,
        restaurantId: session.activeRestaurantId,
      },
      data: {
        status: data.status,
        managerNotes: data.managerNotes || null,
        reviewedBy: session.userId,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, leave });
  } catch (error: any) {
    console.error("Review Leave Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
