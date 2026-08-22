import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { InventoryService } from "@/modules/inventory/service";
import { z } from "zod";

import { UnitOfMeasure } from "@prisma/client";

const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  unitOfMeasure: z.nativeEnum(UnitOfMeasure).optional(),
  reorderPoint: z.number().min(0).optional(),
  parLevel: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:view_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const item = await InventoryService.getItemById(session.activeRestaurantId, id);
    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Not found" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:manage_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = updateItemSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const item = await InventoryService.updateItem(session.activeRestaurantId, id, result.data);
    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:manage_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    await InventoryService.archiveItem(session.activeRestaurantId, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
