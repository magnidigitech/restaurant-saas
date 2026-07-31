import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const updateOutletSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().nullable().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
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
    const result = updateOutletSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    // Verify ownership
    const existing = await prisma.restaurantOutlet.findFirst({
      where: { id, restaurantId: session.activeRestaurantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Outlet not found or access denied" }, { status: 404 });
    }

    const updated = await prisma.restaurantOutlet.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.timezone && { timezone: data.timezone }),
        ...(data.currency && { currency: data.currency }),
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
        userEmail: session.email,
        action: "OUTLET_UPDATED",
        entityType: "RestaurantOutlet",
        entityId: id,
        previousValues: JSON.stringify(existing),
        newValues: JSON.stringify(updated),
      },
    });

    return NextResponse.json({ success: true, outlet: updated });
  } catch (error: any) {
    console.error("Update Outlet Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
