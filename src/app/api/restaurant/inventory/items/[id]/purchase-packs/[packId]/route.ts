import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { InventoryService } from "@/modules/inventory/service";
import { z } from "zod";

const updatePackSchema = z.object({
  name: z.string().min(1).optional(),
  packType: z.string().min(1).optional(),
  customTypeLabel: z.string().optional().nullable(),
  innerPackType: z.string().optional().nullable(),
  innerCustomTypeLabel: z.string().optional().nullable(),
  innerPackCount: z.number().optional().nullable(),
  unitsPerInner: z.number().optional().nullable(),
  packUnit: z.string().optional(),
  netQuantityPerPack: z.number().positive().optional(),
  conversionFactor: z.number().positive().optional(),
  isVariableWeight: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; packId: string }> }
) {
  try {
    const { packId } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:manage_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = updatePackSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const pack = await InventoryService.updateItemPurchasePack(session.activeRestaurantId, packId, result.data as any);
    return NextResponse.json({ success: true, pack });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update purchase pack" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; packId: string }> }
) {
  try {
    const { packId } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:manage_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    await InventoryService.deleteItemPurchasePack(session.activeRestaurantId, packId);
    return NextResponse.json({ success: true, message: "Purchase pack removed/deactivated successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete purchase pack" }, { status: 400 });
  }
}
