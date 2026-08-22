import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { PurchaseService } from "@/modules/inventory/purchase-service";
import { z } from "zod";

const updatePOSchema = z.object({
  action: z.enum(["update_status", "receive", "receive_items"]),
  status: z.enum(["DRAFT", "SENT", "CANCELLED"]).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string(),
        receivedQuantity: z.number().min(0),
        unitCost: z.number().min(0).optional(),
      })
    )
    .optional(),
  receiveData: z
    .object({
      status: z.enum(["RECEIVED", "PARTIALLY_RECEIVED"]).optional(),
      items: z
        .array(
          z.object({
            itemId: z.string(),
            receivedQuantity: z.number().min(0),
            unitCost: z.number().min(0).optional(),
          })
        )
        .optional(),
    })
    .optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:view_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const purchaseOrder = await PurchaseService.getPOById(session.activeRestaurantId, id);
    return NextResponse.json({ purchaseOrder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Purchase order not found" }, { status: 404 });
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
    const result = updatePOSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    if (result.data.action === "receive" || result.data.action === "receive_items") {
      const itemsToReceive = result.data.items || result.data.receiveData?.items;
      const purchaseOrder = await PurchaseService.receivePOItems(
        session.activeRestaurantId,
        session.userId,
        id,
        {
          status: result.data.receiveData?.status,
          items: itemsToReceive,
        }
      );
      return NextResponse.json({ success: true, purchaseOrder, message: "Inventory stock updated successfully via PO receiving." });
    }

    if (result.data.action === "update_status" && result.data.status) {
      const purchaseOrder = await PurchaseService.updatePOStatus(session.activeRestaurantId, id, result.data.status);
      return NextResponse.json({ success: true, purchaseOrder });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update purchase order" }, { status: 400 });
  }
}
