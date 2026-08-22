import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { PurchaseService } from "@/modules/inventory/purchase-service";
import { z } from "zod";

const createPOSchema = z.object({
  outletId: z.string().min(1, "Outlet is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  expectedDeliveryDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      orderedQuantity: z.number().positive("Quantity must be greater than 0"),
      unitCost: z.number().min(0, "Unit cost cannot be negative"),
    })
  ).min(1, "Purchase order must contain at least one item"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:view_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const rawStatus = searchParams.get("status");
    const status = rawStatus && rawStatus !== "ALL" && rawStatus.trim() !== "" ? rawStatus : undefined;
    const vendorId = searchParams.get("vendorId") || undefined;

    const purchaseOrders = await PurchaseService.getPurchaseOrders(session.activeRestaurantId, { search, status, vendorId });
    return NextResponse.json({ purchaseOrders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch purchase orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:manage_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = createPOSchema.safeParse(body);
    if (!result.success) {
      const issue = result.error.issues[0]?.message || "Invalid purchase order payload";
      return NextResponse.json({ error: issue }, { status: 400 });
    }

    const purchaseOrder = await PurchaseService.createPO(session.activeRestaurantId, session.userId, result.data);
    return NextResponse.json({ success: true, purchaseOrder }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create purchase order" }, { status: 400 });
  }
}
