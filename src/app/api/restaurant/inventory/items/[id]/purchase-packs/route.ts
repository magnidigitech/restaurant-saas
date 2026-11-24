import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { InventoryService } from "@/modules/inventory/service";
import { z } from "zod";

const packSchema = z.object({
  name: z.string().min(1, "Pack name is required"),
  packType: z.string().min(1, "Packaging type is required"),
  customTypeLabel: z.string().optional().nullable(),
  innerPackType: z.string().optional().nullable(),
  innerCustomTypeLabel: z.string().optional().nullable(),
  innerPackCount: z.number().optional().nullable(),
  unitsPerInner: z.number().optional().nullable(),
  packUnit: z.string().min(1, "Pack unit is required"),
  netQuantityPerPack: z.number().positive("Net quantity must be positive"),
  conversionFactor: z.number().positive("Conversion factor must be positive"),
  isVariableWeight: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: itemId } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:view_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const packs = await InventoryService.getItemPurchasePacks(session.activeRestaurantId, itemId, includeInactive);
    return NextResponse.json({ success: true, packs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch purchase packs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: itemId } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:manage_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = packSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid packaging payload", details: result.error.flatten() }, { status: 400 });
    }

    const pack = await InventoryService.createItemPurchasePack(session.activeRestaurantId, itemId, result.data as any);
    return NextResponse.json({ success: true, pack }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create purchase pack" }, { status: 400 });
  }
}
