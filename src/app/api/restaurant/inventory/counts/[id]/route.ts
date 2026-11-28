import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/core/database/client";
import {
  assertInventoryOutletInScope,
  getInventoryActorContext,
} from "@/modules/inventory/authHelper";
import {
  approveAndPostStockCount,
  getStockCountDetail,
  refreshStockCountReview,
  requestStockCountRecount,
  saveCountEntries,
  StockCountError,
  submitStockCount,
} from "@/modules/inventory/stockCountService";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SAVE_ENTRIES"),
    entries: z.array(
      z.object({
        itemId: z.string().min(1),
        isCounted: z.boolean(),
        baseQty: z.number().min(0).nullable().optional(),
        packs: z
          .array(
            z.object({
              packId: z.string().min(1),
              packCount: z.number().min(0),
            })
          )
          .optional(),
      })
    ),
  }),
  z.object({ action: z.literal("SUBMIT") }),
  z.object({ action: z.literal("REFRESH_REVIEW") }),
  z.object({
    action: z.literal("REQUEST_RECOUNT"),
    items: z.array(
      z.object({
        itemId: z.string().min(1),
        reason: z.string().optional(),
      })
    ),
  }),
  z.object({ action: z.literal("APPROVE") }),
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getInventoryActorContext({ requireView: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const count = await getStockCountDetail(auth.ctx.restaurantId, id);
    const scope = assertInventoryOutletInScope(auth.ctx, count.outletId);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    return NextResponse.json({ success: true, count });
  } catch (err: any) {
    const status = err instanceof StockCountError ? err.status : 404;
    return NextResponse.json(
      { error: err.message || "Stock count not found" },
      { status }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getInventoryActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const existing = await prisma.stockCount.findFirst({
      where: { id, restaurantId: auth.ctx.restaurantId },
      select: { id: true, outletId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Stock count not found" }, { status: 404 });
    }

    const scope = assertInventoryOutletInScope(auth.ctx, existing.outletId);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid stock count action", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let count;
    switch (parsed.data.action) {
      case "SAVE_ENTRIES":
        count = await saveCountEntries(
          auth.ctx.restaurantId,
          id,
          auth.ctx.userId,
          parsed.data.entries
        );
        break;
      case "SUBMIT":
        count = await submitStockCount(auth.ctx.restaurantId, id, auth.ctx.userId);
        break;
      case "REFRESH_REVIEW":
        count = await refreshStockCountReview(
          auth.ctx.restaurantId,
          id,
          auth.ctx.userId
        );
        break;
      case "REQUEST_RECOUNT":
        count = await requestStockCountRecount(
          auth.ctx.restaurantId,
          id,
          auth.ctx.userId,
          parsed.data.items
        );
        break;
      case "APPROVE":
        count = await approveAndPostStockCount(
          auth.ctx.restaurantId,
          id,
          auth.ctx.userId
        );
        break;
    }

    return NextResponse.json({ success: true, count });
  } catch (err: any) {
    const status = err instanceof StockCountError ? err.status : 400;
    return NextResponse.json(
      { error: err.message || "Failed to update stock count" },
      { status }
    );
  }
}
