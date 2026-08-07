import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { VendorService } from "@/modules/inventory/vendor-service";
import { z } from "zod";

const linkVendorItemSchema = z.object({
  vendorId: z.string().min(1),
  itemId: z.string().optional(),
  vendorSku: z.string().optional().or(z.literal("")),
  unitCost: z.number().min(0).optional(),
  leadTimeDays: z.number().min(0).optional(),
  isPreferred: z.boolean().optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        vendorSku: z.string().optional().or(z.literal("")),
        unitCost: z.number().min(0).optional(),
        leadTimeDays: z.number().min(0).optional(),
        isPreferred: z.boolean().optional(),
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
    const vendorId = searchParams.get("vendorId") || undefined;
    const itemId = searchParams.get("itemId") || undefined;

    const vendorItems = await VendorService.getVendorItems(session.activeRestaurantId, vendorId, itemId);
    return NextResponse.json({ vendorItems });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch vendor items" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:manage_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = linkVendorItemSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    if (result.data.items && result.data.items.length > 0) {
      const vendorItems = await VendorService.linkVendorItemsBulk(
        session.activeRestaurantId,
        result.data.vendorId,
        result.data.items
      );
      return NextResponse.json({ success: true, count: vendorItems.length, vendorItems }, { status: 201 });
    }

    if (!result.data.itemId) {
      return NextResponse.json({ error: "itemId or items array is required" }, { status: 400 });
    }

    const vendorItem = await VendorService.linkVendorItem(session.activeRestaurantId, {
      vendorId: result.data.vendorId,
      itemId: result.data.itemId,
      vendorSku: result.data.vendorSku,
      unitCost: result.data.unitCost,
      leadTimeDays: result.data.leadTimeDays,
      isPreferred: result.data.isPreferred,
    });
    return NextResponse.json({ success: true, vendorItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to link items to vendor" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:manage_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");
    const itemId = searchParams.get("itemId");

    if (!vendorId || !itemId) {
      return NextResponse.json({ error: "vendorId and itemId are required" }, { status: 400 });
    }

    await VendorService.unlinkVendorItem(session.activeRestaurantId, vendorId, itemId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to unlink item from vendor" }, { status: 400 });
  }
}
