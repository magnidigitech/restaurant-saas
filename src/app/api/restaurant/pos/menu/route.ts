import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

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
    const search = searchParams.get("search");

    const whereClause: any = {
      restaurantId: session.activeRestaurantId,
      type: "DISH",
      archivedAt: null,
    };

    if (search) {
      whereClause.name = { contains: search, mode: "insensitive" };
    }

    const menuItems = await prisma.recipe.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            inventoryItem: true,
            subRecipe: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, menuItems });
  } catch (error: any) {
    console.error("List POS Menu Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
