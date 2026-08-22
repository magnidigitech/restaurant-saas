import { prisma } from "@/core/database/client";
import { UnitOfMeasure } from "@prisma/client";
import { convertQuantity, formatUnit } from "./units";

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
 * Computes exact required quantities in each raw inventory item's base unit of measure.
 */
export async function explodeRecipeToRawIngredients(
  recipeId: string,
  multiplier = 1,
  visited = new Set<string>()
): Promise<Map<string, { itemId: string; name: string; quantity: number; unit: UnitOfMeasure; wastageIncluded: boolean }>> {
  if (visited.has(recipeId)) {
    throw new Error(`Circular recipe dependency in depletion explosion: ${recipeId}`);
  }
  visited.add(recipeId);

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      items: {
        include: {
          inventoryItem: true,
          subRecipe: true,
        },
      },
    },
  });

  const rawMap = new Map<string, { itemId: string; name: string; quantity: number; unit: UnitOfMeasure; wastageIncluded: boolean }>();
  if (!recipe) return rawMap;

  const recipeYield = Number(recipe.yieldQuantity || 1);
  const effectiveBatchMultiplier = multiplier / (recipeYield > 0 ? recipeYield : 1);

  for (const item of recipe.items) {
    const itemQty = Number(item.quantity) * (1 + Number(item.wastagePercent || 0) / 100) * effectiveBatchMultiplier;

    if (item.componentType === "INVENTORY_ITEM" && item.inventoryItem) {
      const targetBaseUnit = item.inventoryItem.unitOfMeasure;
      const convertedQty = convertQuantity(itemQty, item.unitOfMeasure, targetBaseUnit);

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
      const subUnitQty = convertQuantity(itemQty, item.unitOfMeasure, item.subRecipe.yieldUnit);
      const subExplosion = await explodeRecipeToRawIngredients(item.subRecipe.id, subUnitQty, new Set(visited));

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
    // Already depleted
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
