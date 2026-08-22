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

export async function DELETE(
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

    // Verify ownership
    const existing = await prisma.restaurantOutlet.findFirst({
      where: { id, restaurantId: session.activeRestaurantId },
      include: {
        _count: {
          select: {
            employmentRecords: true,
            outletAssignments: true,
            shiftAssignments: true,
            shiftRosters: true,
            stockLedger: true,
            purchaseOrders: true,
            payrollRuns: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Outlet not found or access denied" }, { status: 404 });
    }

    // Check count of outlets
    const totalOutlets = await prisma.restaurantOutlet.count({
      where: { restaurantId: session.activeRestaurantId },
    });

    if (totalOutlets <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the only remaining branch outlet. A restaurant must have at least one active location." },
        { status: 400 }
      );
    }

    // Check for blocking relations
    const count = existing._count;
    const dependencies = [];
    if (count.employmentRecords > 0) dependencies.push(`${count.employmentRecords} employee primary assignments`);
    if (count.outletAssignments > 0) dependencies.push(`${count.outletAssignments} secondary outlet assignments`);
    if (count.shiftRosters > 0) dependencies.push(`${count.shiftRosters} shift rosters`);
    if (count.shiftAssignments > 0) dependencies.push(`${count.shiftAssignments} shift assignments`);
    if (count.stockLedger > 0) dependencies.push(`${count.stockLedger} stock movement ledgers`);
    if (count.purchaseOrders > 0) dependencies.push(`${count.purchaseOrders} purchase orders`);
    if (count.payrollRuns > 0) dependencies.push(`${count.payrollRuns} payroll runs`);

    if (dependencies.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot remove outlet "${existing.name}" because active operational records exist: ${dependencies.join(", ")}. Please reassign or close these records first.`,
        },
        { status: 400 }
      );
    }

    // Clean up auxiliary relations like accessGrants or staffInvitations before delete
    await prisma.$transaction([
      prisma.accessGrant.deleteMany({
        where: { outletId: id },
      }),
      prisma.staffInvitation.deleteMany({
        where: { outletId: id },
      }),
      prisma.restaurantOutlet.delete({
        where: { id },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
        userEmail: session.email,
        action: "OUTLET_DELETED",
        entityType: "RestaurantOutlet",
        entityId: id,
        previousValues: JSON.stringify(existing),
      },
    });

    return NextResponse.json({ success: true, message: "Outlet successfully removed" });
  } catch (error: any) {
    console.error("Delete Outlet Error:", error);
    return NextResponse.json({ error: error.message || "Failed to remove outlet" }, { status: 500 });
  }
}
