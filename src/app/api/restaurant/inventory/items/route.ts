import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { InventoryService } from "@/modules/inventory/service";
import { z } from "zod";

import { UnitOfMeasure } from "@prisma/client";

const createItemSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unitOfMeasure: z.nativeEnum(UnitOfMeasure).optional(),
  reorderPoint: z.number().min(0).optional(),
  parLevel: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
  purchasePacks: z
    .array(
      z.object({
        name: z.string().min(1),
        packType: z.string().min(1),
        customTypeLabel: z.string().optional().nullable(),
        innerPackType: z.string().optional().nullable(),
        innerCustomTypeLabel: z.string().optional().nullable(),
        innerPackCount: z.number().optional().nullable(),
        unitsPerInner: z.number().optional().nullable(),
        packUnit: z.string(),
        netQuantityPerPack: z.number(),
        conversionFactor: z.number(),
        isVariableWeight: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:view_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const includeArchived = searchParams.get("includeArchived") === "true";

    const items = await InventoryService.getItems(session.activeRestaurantId, { search, categoryId });
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:manage_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = createItemSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const item = await InventoryService.createItem(session.activeRestaurantId, result.data as any);
    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
