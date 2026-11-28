import { prisma } from "@/core/database/client";
import { explodeRecipeToRawIngredients } from "@/core/inventory/depletionEngine";

function roundQty4(val: number): number {
  return Math.round(val * 10000) / 10000;
}

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
  packagingReviewRequired?: boolean;
}

/**
 * Applies recorded-ledger delta inventory movements for an imported POS order.
 * - Requires `integration.stockPostingEnabled === true` and `order.createdAt >= effectiveStart`.
 * - Respects per-mapping `effectiveFrom` so newly mapped items stay forward-only.
 * - Historical backfills are reporting-only and never move stock.
 * - Computes exact per-ingredient delta against recorded `StockLedger` entries (`referenceId = order.id`)
 *   so retries, quantity edits, order-type changes (e.g. TAKEAWAY -> DINE_IN), and voids post only the difference.
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

  // Load mappings for items in this order to check per-mapping effectiveFrom
  const mappings = await prisma.posMenuItemMapping.findMany({
    where: {
      restaurantId: params.restaurantId,
      outletId: params.outletId,
      provider: order.provider,
      recipeId: { not: null },
      isIgnored: false,
    },
    select: {
      externalItemId: true,
      externalVariantId: true,
      recipeId: true,
      effectiveFrom: true,
    },
  });

  const mappingMap = new Map(
    mappings.map((m) => [`${m.externalItemId}::${m.externalVariantId || ""}`, m])
  );

  // Compute target net consumption per ingredient (positive = desired consumption)
  const targetConsumptionByItem = new Map<string, { name: string; qty: number }>();
  const targetDepletedQtyByOrderItem = new Map<string, number>();
  const skippedPackagingNames = new Set<string>();
  let packagingReviewRequired = false;

  for (const item of order.items) {
    if (!item.recipeId || order.status === "CANCELLED" || item.isVoided) {
      targetDepletedQtyByOrderItem.set(item.id, 0);
      continue;
    }

    const extItemId = item.posMenuItemId || item.name;
    const extVarId = item.externalVariantId || "";
    const mapping = mappingMap.get(`${extItemId}::${extVarId}`);
    if (mapping?.effectiveFrom && order.createdAt < mapping.effectiveFrom) {
      targetDepletedQtyByOrderItem.set(item.id, 0);
      continue;
    }

    targetDepletedQtyByOrderItem.set(item.id, item.quantity);

    const exploded = await explodeRecipeToRawIngredients(
      item.recipeId,
      item.quantity,
      new Set(),
      [],
      {
        orderType: order.orderType,
        onPackagingSkippedForUnknown: (pkgName) => {
          packagingReviewRequired = true;
          skippedPackagingNames.add(pkgName);
        },
      }
    );

    for (const [ingId, ing] of exploded.entries()) {
      if (ing.quantity <= 0) continue;
      const cur = targetConsumptionByItem.get(ingId);
      if (cur) {
        cur.qty += ing.quantity;
      } else {
        targetConsumptionByItem.set(ingId, { name: ing.name, qty: ing.quantity });
      }
    }
  }

  let ledgerEntriesCreated = 0;

  await prisma.$transaction(async (tx) => {
    const recordedAggs = await tx.stockLedger.groupBy({
      by: ["itemId"],
      where: {
        restaurantId: params.restaurantId,
        outletId: params.outletId,
        referenceId: order.id,
      },
      _sum: { quantity: true },
    });

    const recordedNetByItem = new Map<string, number>();
    for (const agg of recordedAggs) {
      recordedNetByItem.set(agg.itemId, roundQty4(Number(agg._sum.quantity || 0)));
    }

    const allIngredientIds = new Set<string>([
      ...targetConsumptionByItem.keys(),
      ...recordedNetByItem.keys(),
    ]);

    for (const ingId of allIngredientIds) {
      const targetCons = roundQty4(targetConsumptionByItem.get(ingId)?.qty || 0);
      const targetLedgerNet = targetCons > 0 ? -targetCons : 0; // consumption is negative in ledger
      const recordedLedgerNet = recordedNetByItem.get(ingId) || 0;
      const delta = roundQty4(targetLedgerNet - recordedLedgerNet);

      if (Math.abs(delta) < 0.0001) continue;

      const ingName = targetConsumptionByItem.get(ingId)?.name || ingId;
      await tx.stockLedger.create({
        data: {
          restaurantId: params.restaurantId,
          outletId: params.outletId,
          itemId: ingId,
          movementType: delta < 0 ? "CONSUMPTION" : "ADJUSTMENT",
          quantity: delta,
          referenceId: order.id,
          notes: `POS ${order.orderNumber} (${order.orderType}) delta ${delta > 0 ? "+" : ""}${delta} [${ingName}]`,
          recordedBy: params.userId || "POS_SYNC",
        },
      });
      ledgerEntriesCreated += 1;
    }

    for (const item of order.items) {
      const nextDepletedQty = targetDepletedQtyByOrderItem.get(item.id) ?? 0;
      if (item.depletedQuantity !== nextDepletedQty) {
        await tx.posOrderItem.update({
          where: { id: item.id },
          data: { depletedQuantity: nextDepletedQty },
        });
      }
    }

    await tx.posOrder.update({
      where: { id: order.id },
      data: {
        ...(ledgerEntriesCreated > 0 && !order.depletedAt ? { depletedAt: new Date() } : {}),
        packagingReviewRequired,
        packagingReviewReason: packagingReviewRequired
          ? `Unknown order type: skipped conditional packaging (${Array.from(skippedPackagingNames).join(", ")})`
          : null,
      },
    });
  });

  return {
    posted: ledgerEntriesCreated > 0,
    ledgerEntriesCreated,
    packagingReviewRequired,
  };
}
