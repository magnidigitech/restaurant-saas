import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { InventoryService } from "@/modules/inventory/service";
import { z } from "zod";

const bulkRowSchema = z.object({
  rowNumber: z.number().optional(),
  name: z.string().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  unitOfMeasure: z.string().optional(),
  costPerUnit: z.union([z.number(), z.string()]).optional(),
  reorderPoint: z.union([z.number(), z.string()]).optional(),
  parLevel: z.union([z.number(), z.string()]).optional(),
  description: z.string().optional(),
});

const bulkImportSchema = z.object({
  items: z.array(bulkRowSchema),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
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
    const result = bulkImportSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid bulk import payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const report = await InventoryService.bulkImportItems(
      session.activeRestaurantId,
      result.data.items
    );

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error("Bulk Import Inventory Items Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
