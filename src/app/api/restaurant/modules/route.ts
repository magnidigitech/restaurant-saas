import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || session.role !== "RESTAURANT_USER" || !session.activeRestaurantId) {
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

    // Retrieve modules enabled for this restaurant
    const tenantModules = await prisma.restaurantModule.findMany({
      where: {
        restaurantId: session.activeRestaurantId,
        status: "ACTIVE",
      },
      include: {
        module: true,
      },
    });

    return NextResponse.json({
      modules: tenantModules.map((tm) => ({
        key: tm.module.id,
        name: tm.module.name,
        description: tm.module.description,
        sortOrder: tm.module.sortOrder,
      })),
    });
  } catch (error: any) {
    console.error("List Tenant Modules Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
