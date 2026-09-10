import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { InventoryService } from "@/modules/inventory/service";
import { z } from "zod";

const moveItemsSchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one item must be selected"),
  targetCategoryId: z.string().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      { moduleKey: "inventory", permissionKey: "inventory:manage_items" },
      session.tokenVersion
    );

    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await req.json();
    const result = moveItemsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const updateRes = await InventoryService.moveItemsCategory(
      session.activeRestaurantId,
      result.data.itemIds,
      result.data.targetCategoryId
    );

    return NextResponse.json({
      success: true,
      count: updateRes.count,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to move items" },
      { status: 400 }
    );
  }
}
