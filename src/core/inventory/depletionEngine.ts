import { prisma } from "@/core/database/client";
import { UnitOfMeasure } from "@prisma/client";
import { convertQuantity, calculateGrossQuantity, formatUnit } from "./units";

export interface DepletedIngredientSummary {
  inventoryItemId: string;
  itemName: string;
  deductedQuantity: number;
  unitOfMeasure: UnitOfMeasure;
  wastageAdjusted: boolean;
  notes?: string;
}

export interface OrderDepletionResult {
  orderId: string;
  orderNumber: string;
  outletId: string;
  depletedItemsCount: number;
  deductions: DepletedIngredientSummary[];
}

/**
 * Recursively explodes a recipe (and any sub-recipes it contains) into base raw inventory ingredients.
 * Uses exact culinary shrinkage math: Gross Quantity = Usable Quantity ÷ (1 - Loss%).
 * Resolves item-specific purchase packs and blocks draft recipes from depletion.
 */
export async function explodeRecipeToRawIngredients(
  recipeId: string,
  multiplier = 1,
  visited = new Set<string>(),
  visitedPath: string[] = []
): Promise<Map<string, { itemId: string; name: string; quantity: number; unit: UnitOfMeasure; wastageIncluded: boolean }>> {
  if (visited.has(recipeId)) {
    const cycleStr = [...visitedPath, recipeId].join(" ➔ ");
    throw new Error(`Circular recipe dependency in depletion explosion: ${cycleStr}`);
  }
  visited.add(recipeId);

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      items: {
        include: {
          inventoryItem: true,
          pack: true,
          subRecipe: true,
        },
      },
    },
  });

  const rawMap = new Map<string, { itemId: string; name: string; quantity: number; unit: UnitOfMeasure; wastageIncluded: boolean }>();
  if (!recipe) return rawMap;

  if (recipe.isDraft) {
    throw new Error(
      `Cannot deplete inventory for draft recipe "${recipe.name}". Only published recipes can be used in POS or Catering.`
    );
  }

  const recipeYield = Number(recipe.yieldQuantity || 1);
  const effectiveBatchMultiplier = multiplier / (recipeYield > 0 ? recipeYield : 1);

  for (const item of recipe.items) {
    if (item.isUnresolved) {
      throw new Error(
        `Cannot deplete recipe "${recipe.name}" because ingredient "${item.originalText || "Unknown"}" is unresolved (${item.unresolvedReason || "unspecified"}).`
      );
    }

    let usableQty = Number(item.quantity);
    let recipeUnit = item.unitOfMeasure;

    // Resolve item-specific purchase packaging
    if (item.packId && item.pack) {
      if (item.packQuantity && Number(item.packQuantity) > 0) {
        const packFactor = Number(item.pack.netQuantityPerPack || item.pack.conversionFactor || 1);
        usableQty = Number(item.packQuantity) * packFactor;
        recipeUnit = item.pack.packUnit;
      }
    }

    // Exact culinary gross quantity
    const grossQty = calculateGrossQuantity(usableQty, Number(item.wastagePercent || 0)) * effectiveBatchMultiplier;

    if (item.componentType === "INVENTORY_ITEM" && item.inventoryItem) {
      const targetBaseUnit = item.inventoryItem.unitOfMeasure;
      const convertedQty = convertQuantity(grossQty, recipeUnit, targetBaseUnit);

      const existing = rawMap.get(item.inventoryItem.id);
      if (existing) {
        existing.quantity += convertedQty;
      } else {
        rawMap.set(item.inventoryItem.id, {
          itemId: item.inventoryItem.id,
          name: item.inventoryItem.name,
          quantity: convertedQty,
          unit: targetBaseUnit,
          wastageIncluded: Number(item.wastagePercent || 0) > 0,
        });
      }
    } else if (item.componentType === "SUB_RECIPE" && item.subRecipe) {
      // Sub-recipe explosion: convert requested itemQty into sub-recipe yield unit, then explode
      const subUnitQty = convertQuantity(grossQty, recipeUnit, item.subRecipe.yieldUnit);
      const subExplosion = await explodeRecipeToRawIngredients(
        item.subRecipe.id,
        subUnitQty,
        new Set(visited),
        [...visitedPath, recipe.name]
      );

      for (const [invId, subComp] of subExplosion.entries()) {
        const existing = rawMap.get(invId);
        if (existing) {
          existing.quantity += subComp.quantity;
        } else {
          rawMap.set(invId, { ...subComp });
        }
      }
    }
  }

  return rawMap;
}

/**
 * Executes atomic POS inventory depletion for an order.
 * Safe and idempotent: retrying the same order does not deduct inventory twice.
 */
export async function depleteOrderInventory(
  orderId: string,
  recordedByUserId: string
): Promise<OrderDepletionResult> {
  const order = await prisma.posOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      restaurant: true,
    },
  });

  if (!order) {
    throw new Error(`POS Order not found: ${orderId}`);
  }

  if (order.depletedAt) {
    // Already depleted - return safe idempotent response
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      outletId: order.outletId,
      depletedItemsCount: 0,
      deductions: [],
    };
  }

  // Aggregate all raw ingredient deductions across all order line items
  const aggregatedIngredients = new Map<string, { itemId: string; name: string; quantity: number; unit: UnitOfMeasure; wastageIncluded: boolean }>();

  for (const orderItem of order.items) {
    if (!orderItem.recipeId) continue;

    const exploded = await explodeRecipeToRawIngredients(orderItem.recipeId, orderItem.quantity);
    for (const [invId, comp] of exploded.entries()) {
      const existing = aggregatedIngredients.get(invId);
      if (existing) {
        existing.quantity += comp.quantity;
      } else {
        aggregatedIngredients.set(invId, { ...comp });
      }
    }
  }

  const deductionsSummary: DepletedIngredientSummary[] = [];

  // Execute database transaction to record negative stock ledger movements
  await prisma.$transaction(async (tx) => {
    for (const [, ing] of aggregatedIngredients.entries()) {
      if (ing.quantity <= 0) continue;

      // Negative quantity represents stock consumption/outflow
      const negativeDelta = -Math.abs(Number(ing.quantity.toFixed(4)));

      await tx.stockLedger.create({
        data: {
          restaurantId: order.restaurantId,
          outletId: order.outletId,
          itemId: ing.itemId,
          movementType: "CONSUMPTION",
          quantity: negativeDelta,
          referenceId: order.id,
          notes: `POS Order #${order.orderNumber} auto-depletion`,
          recordedBy: recordedByUserId,
        },
      });

      deductionsSummary.push({
        inventoryItemId: ing.itemId,
        itemName: ing.name,
        deductedQuantity: Math.abs(negativeDelta),
        unitOfMeasure: ing.unit,
        wastageAdjusted: ing.wastageIncluded,
      });
    }

    await tx.posOrder.update({
      where: { id: order.id },
      data: {
        depletedAt: new Date(),
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: recordedByUserId },
      select: { email: true },
    });

    await tx.auditLog.create({
      data: {
        restaurantId: order.restaurantId,
        userId: recordedByUserId,
        userEmail: user?.email || "pos@system",
        action: "POS_ORDER_DEPLETED",
        entityType: "PosOrder",
        entityId: order.id,
        newValues: JSON.stringify({
          orderNumber: order.orderNumber,
          deductionsCount: deductionsSummary.length,
          deductions: deductionsSummary,
        }),
      },
    });
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    outletId: order.outletId,
    depletedItemsCount: deductionsSummary.length,
    deductions: deductionsSummary,
  };
}

/**
 * Reverses inventory depletion for a cancelled or refunded POS order.
 * Restores exactly the quantities recorded in the original stock ledger.
 */
export async function reverseOrderDepletion(
  orderId: string,
  recordedByUserId: string,
  reason = "Order Cancelled / Refunded"
): Promise<{ orderId: string; restoredItemsCount: number }> {
  const originalLedgers = await prisma.stockLedger.findMany({
    where: {
      referenceId: orderId,
      movementType: "CONSUMPTION",
    },
  });

  if (originalLedgers.length === 0) {
    return { orderId, restoredItemsCount: 0 };
  }

  await prisma.$transaction(async (tx) => {
    for (const orig of originalLedgers) {
      const positiveDelta = Math.abs(Number(orig.quantity));
      await tx.stockLedger.create({
        data: {
          restaurantId: orig.restaurantId,
          outletId: orig.outletId,
          itemId: orig.itemId,
          movementType: "RETURN",
          quantity: positiveDelta,
          referenceId: `REV-${orderId}`,
          notes: `Reversal of POS Order #${orderId}: ${reason}`,
          recordedBy: recordedByUserId,
        },
      });
    }

    await tx.posOrder.update({
      where: { id: orderId },
      data: {
        depletedAt: null,
      },
    });
  });

  return { orderId, restoredItemsCount: originalLedgers.length };
}

/**
 * Executes atomic catering event inventory depletion.
 * Deducts all raw ingredients across all booked dishes for the planned guest count.
 */
export async function depleteCateringOrderInventory(
  cateringOrderId: string,
  recordedByUserId: string,
  outletId?: string
): Promise<OrderDepletionResult> {
  const order = await prisma.cateringOrder.findUnique({
    where: { id: cateringOrderId },
    include: {
      items: {
        include: {
          recipe: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Catering Order not found: ${cateringOrderId}`);
  }

  const effectiveOutletId = outletId || order.outletId;
  if (!effectiveOutletId) {
    throw new Error(`Catering Order #${order.orderNumber} has no assigned outlet for stock depletion.`);
  }

  // Idempotency check: see if already depleted by checking referenceId in stock ledger
  const existingDepletion = await prisma.stockLedger.findFirst({
    where: {
      referenceId: `CAT-${order.id}`,
      movementType: "CONSUMPTION",
    },
  });

  if (existingDepletion) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      outletId: effectiveOutletId,
      depletedItemsCount: 0,
      deductions: [],
    };
  }

  const aggregatedIngredients = new Map<string, { itemId: string; name: string; quantity: number; unit: UnitOfMeasure; wastageIncluded: boolean }>();

  for (const item of order.items) {
    if (!item.recipeId) continue;
    const itemQuantity = Number(item.quantity || order.guestCount || 1);

    const exploded = await explodeRecipeToRawIngredients(item.recipeId, itemQuantity);
    for (const [invId, comp] of exploded.entries()) {
      const existing = aggregatedIngredients.get(invId);
      if (existing) {
        existing.quantity += comp.quantity;
      } else {
        aggregatedIngredients.set(invId, { ...comp });
      }
    }
  }

  const deductionsSummary: DepletedIngredientSummary[] = [];

  await prisma.$transaction(async (tx) => {
    for (const [, ing] of aggregatedIngredients.entries()) {
      if (ing.quantity <= 0) continue;
      const negativeDelta = -Math.abs(Number(ing.quantity.toFixed(4)));

      await tx.stockLedger.create({
        data: {
          restaurantId: order.restaurantId,
          outletId: effectiveOutletId,
          itemId: ing.itemId,
          movementType: "CONSUMPTION",
          quantity: negativeDelta,
          referenceId: `CAT-${order.id}`,
          notes: `Catering Event #${order.orderNumber} (${order.eventName}) depletion`,
          recordedBy: recordedByUserId,
        },
      });

      deductionsSummary.push({
        inventoryItemId: ing.itemId,
        itemName: ing.name,
        deductedQuantity: Math.abs(negativeDelta),
        unitOfMeasure: ing.unit,
        wastageAdjusted: ing.wastageIncluded,
      });
    }
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    outletId: effectiveOutletId,
    depletedItemsCount: deductionsSummary.length,
    deductions: deductionsSummary,
  };
}
