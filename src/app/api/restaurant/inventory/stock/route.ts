import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { InventoryService } from "@/modules/inventory/service";
import { z } from "zod";

const movementSchema = z.object({
  outletId: z.string().min(1),
  itemId: z.string().min(1),
  movementType: z.enum(["PURCHASE", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT", "CONSUMPTION", "WASTAGE", "RETURN"]),
  quantity: z.number(),
  packId: z.string().optional(),
  packCount: z.number().positive().optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

const transferSchema = z.object({
  action: z.literal("TRANSFER"),
  fromOutletId: z.string().min(1),
  toOutletId: z.string().min(1),
  itemId: z.string().min(1),
  quantity: z.number().positive(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "inventory", permissionKey: "inventory:view_items" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;

    const stock = await InventoryService.getStockByOutlet(session.activeRestaurantId, outletId);
    return NextResponse.json({ stock });
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
    if (body?.action === "TRANSFER") {
      const parsedTransfer = transferSchema.safeParse(body);
      if (!parsedTransfer.success) {
        return NextResponse.json({ error: "Invalid transfer payload", details: parsedTransfer.error.flatten() }, { status: 400 });
      }
      const transfer = await InventoryService.transferStockBetweenOutlets(session.activeRestaurantId, {
        ...parsedTransfer.data,
        recordedBy: session.userId,
      });
      return NextResponse.json({ success: true, transfer });
    }

    const result = movementSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const ledger = await InventoryService.addStockMovement(session.activeRestaurantId, {
      ...result.data,
      recordedBy: session.userId,
    });
    return NextResponse.json({ success: true, ledger });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
