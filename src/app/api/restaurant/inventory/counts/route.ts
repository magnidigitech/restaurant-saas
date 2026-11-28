import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  assertInventoryOutletInScope,
  getInventoryActorContext,
} from "@/modules/inventory/authHelper";
import {
  listStockCounts,
  startOrResumeStockCount,
  StockCountError,
} from "@/modules/inventory/stockCountService";

const createCountSchema = z.object({
  outletId: z.string().min(1),
  cutoffAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  itemIds: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getInventoryActorContext({ requireView: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;
    const status = searchParams.get("status") || undefined;

    if (outletId && outletId !== "ALL") {
      const scope = assertInventoryOutletInScope(auth.ctx, outletId);
      if (!scope.ok) {
        return NextResponse.json({ error: scope.error }, { status: scope.status });
      }
    }

    const counts = await listStockCounts(auth.ctx.restaurantId, {
      outletId,
      accessibleOutletIds: auth.ctx.accessibleOutletIds,
      status,
    });

    return NextResponse.json({ success: true, counts });
  } catch (err: any) {
    const status = err instanceof StockCountError ? err.status : 500;
    return NextResponse.json(
      { error: err.message || "Failed to list stock counts" },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createCountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid stock count payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const auth = await getInventoryActorContext({
      requireManage: true,
      outletId: parsed.data.outletId,
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const count = await startOrResumeStockCount(auth.ctx.restaurantId, {
      outletId: parsed.data.outletId,
      userId: auth.ctx.userId,
      cutoffAt: parsed.data.cutoffAt ? new Date(parsed.data.cutoffAt) : undefined,
      notes: parsed.data.notes,
      itemIds: parsed.data.itemIds,
    });

    return NextResponse.json({ success: true, count });
  } catch (err: any) {
    const status = err instanceof StockCountError ? err.status : 400;
    return NextResponse.json(
      { error: err.message || "Failed to start stock count" },
      { status }
    );
  }
}
