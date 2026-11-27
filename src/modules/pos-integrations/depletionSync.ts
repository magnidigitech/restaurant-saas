import { prisma } from "@/core/database/client";
import { explodeRecipeToRawIngredients } from "@/core/inventory/depletionEngine";

export interface MappingResolutionResult {
  mappedCount: number;
  unmappedQueuedCount: number;
}

/**
 * Ensures external POS items have outlet-scoped PosMenuItemMapping records
 * (queuing unmapped items for review) and links mapped recipeIds onto PosOrderItem.
 * Does NOT move stock.
 */
export async function resolveOrderItemMappings(params: {
  restaurantId: string;
  outletId: string;
  provider: string;
  orderId: string;
}): Promise<MappingResolutionResult> {
  const items = await prisma.posOrderItem.findMany({
    where: { orderId: params.orderId },
    select: {
      id: true,
      posMenuItemId: true,
      externalVariantId: true,
      name: true,
      recipeId: true,
    },
  });

  let mappedCount = 0;
  let unmappedQueuedCount = 0;

  for (const item of items) {
    const extItemId = item.posMenuItemId || item.name;
    const extVarId = item.externalVariantId || "";

    const existingMapping = await prisma.posMenuItemMapping.findUnique({
      where: {
        restaurantId_outletId_provider_externalItemId_externalVariantId: {
          restaurantId: params.restaurantId,
          outletId: params.outletId,
          provider: params.provider,
          externalItemId: extItemId,
          externalVariantId: extVarId,
        },
      },
    });

    if (!existingMapping) {
      await prisma.posMenuItemMapping.create({
        data: {
          restaurantId: params.restaurantId,
          outletId: params.outletId,
          provider: params.provider,
          externalItemId: extItemId,
          externalItemName: item.name,
          externalVariantId: extVarId,
          recipeId: null,
          isIgnored: false,
        },
      });
      unmappedQueuedCount += 1;
      continue;
    }

    if (existingMapping.recipeId && !existingMapping.isIgnored) {
      if (item.recipeId !== existingMapping.recipeId) {
        await prisma.posOrderItem.update({
          where: { id: item.id },
          data: { recipeId: existingMapping.recipeId },
        });
      }
      mappedCount += 1;
    }
  }

  return { mappedCount, unmappedQueuedCount };
}

export interface DeltaDepletionResult {
  posted: boolean;
  reason?: string;
  ledgerEntriesCreated: number;
}

/**
 * Applies delta-based inventory movements for an imported POS order using StockLedger.
 * - Requires `integration.stockPostingEnabled === true` and `order.createdAt >= stockPostingEffectiveFrom`.
 * - Historical backfills are reporting-only and never move stock.
 * - Tracks `PosOrderItem.depletedQuantity` so retries, qty edits, and voids post exact deltas.
 * - Financial refunds alone do NOT restore stock.
 */
export async function applyDeltaDepletionForOrder(params: {
  restaurantId: string;
  outletId: string;
  orderId: string;
  runType: "BACKFILL" | "INCREMENTAL" | "WEBHOOK" | "MANUAL";
  stockPostingEnabled: boolean;
  stockPostingEffectiveFrom: Date | null;
  userId?: string;
}): Promise<DeltaDepletionResult> {
  if (params.runType === "BACKFILL") {
    return {
      posted: false,
      reason: "Historical backfill is reporting-only",
      ledgerEntriesCreated: 0,
    };
  }

  if (!params.stockPostingEnabled) {
    return {
      posted: false,
      reason: "Stock posting is disabled on this connection",
      ledgerEntriesCreated: 0,
    };
  }

  if (!params.stockPostingEffectiveFrom) {
    return {
      posted: false,
      reason: "Stock posting effective start time is not set",
      ledgerEntriesCreated: 0,
    };
  }

  const order = await prisma.posOrder.findFirst({
    where: { id: params.orderId, restaurantId: params.restaurantId },
    include: { items: true },
  });

  if (!order) {
    return { posted: false, reason: "Order not found", ledgerEntriesCreated: 0 };
  }

  if (order.createdAt < params.stockPostingEffectiveFrom) {
    return {
      posted: false,
      reason: "Order predates stock posting effective start time",
      ledgerEntriesCreated: 0,
    };
  }

  let ledgerEntriesCreated = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      if (!item.recipeId) continue;

      // Voided items or cancelled orders target 0; financial refunds do NOT restore stock.
      const targetQty =
        order.status === "CANCELLED" || item.isVoided ? 0 : item.quantity;
      const delta = targetQty - item.depletedQuantity;
      if (delta === 0) continue;

      const explodedMap = await explodeRecipeToRawIngredients(
        item.recipeId,
        Math.abs(delta)
      );

      for (const [, ing] of explodedMap.entries()) {
        if (ing.quantity <= 0) continue;
        const stockChange = delta > 0 ? -Math.abs(ing.quantity) : Math.abs(ing.quantity);

        await tx.stockLedger.create({
          data: {
            restaurantId: params.restaurantId,
            outletId: params.outletId,
            itemId: ing.itemId,
            movementType: delta > 0 ? "CONSUMPTION" : "ADJUSTMENT",
            quantity: Number(stockChange.toFixed(4)),
            referenceId: order.id,
            notes: `POS ${order.orderNumber} (${item.name}) delta ${delta > 0 ? "+" : ""}${delta}`,
            recordedBy: params.userId || "POS_SYNC",
          },
        });

        ledgerEntriesCreated += 1;
      }

      await tx.posOrderItem.update({
        where: { id: item.id },
        data: { depletedQuantity: targetQty },
      });
    }

    if (ledgerEntriesCreated > 0 && !order.depletedAt) {
      await tx.posOrder.update({
        where: { id: order.id },
        data: { depletedAt: new Date() },
      });
    }
  });

  return {
    posted: ledgerEntriesCreated > 0,
    ledgerEntriesCreated,
  };
}
