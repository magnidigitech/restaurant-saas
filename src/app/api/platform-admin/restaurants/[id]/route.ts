import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// DELETE /api/platform-admin/restaurants/[id] - Permanently delete a tenant instance
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Platform Admin privilege required" }, { status: 401 });
    }

    const { id } = await params;

    // Check if restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        memberships: {
          select: { userId: true },
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant tenant not found" }, { status: 404 });
    }

    // Collect user IDs to check for orphaned accounts after cascade
    const tenantUserIds = restaurant.memberships.map((m) => m.userId);

    // Delete restaurant (PostgreSQL foreign keys CASCADE all child records cleanly)
    await prisma.restaurant.delete({
      where: { id },
    });

    // Clean up any orphaned users who had accounts only in this restaurant
    for (const userId of tenantUserIds) {
      try {
        const otherMemberships = await prisma.restaurantMembership.count({
          where: { userId },
        });
        if (otherMemberships === 0) {
          await prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      } catch {
        // Silently continue if user cleanup is already complete
      }
    }

    // Log platform audit record (restaurantId is null since the tenant is deleted)
    try {
      await prisma.auditLog.create({
        data: {
          restaurantId: null,
          userId: session.userId,
          userEmail: session.email,
          action: "TENANT_DELETED",
          entityType: "Restaurant",
          entityId: id,
          newValues: JSON.stringify({
            name: restaurant.name,
            subdomain: restaurant.subdomain,
            deletedBy: session.email,
            deletedAt: new Date().toISOString(),
          }),
        },
      });
    } catch (auditErr) {
      console.warn("Failed to write platform audit log for deleted tenant:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Tenant "${restaurant.name}" (${restaurant.subdomain}) was permanently deleted`,
      deletedRestaurantId: id,
      name: restaurant.name,
    });
  } catch (error: any) {
    console.error("Delete Tenant Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error while deleting tenant" },
      { status: 500 }
    );
  }
}
