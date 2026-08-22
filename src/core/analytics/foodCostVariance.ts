import { prisma } from "@/core/database/client";
import { UnitOfMeasure } from "@prisma/client";
import { explodeRecipeToRawIngredients } from "../inventory/depletionEngine";
import { formatUnit } from "../inventory/units";

export interface IngredientVarianceResult {
  itemId: string;
  name: string;
  unitOfMeasure: UnitOfMeasure;
  costPerUnit: number;
  theoreticalUsage: number;
  actualUsage: number;
  varianceQuantity: number; // actualUsage - theoreticalUsage (positive means loss/shrinkage)
  varianceCost: number; // varianceQuantity * costPerUnit
  variancePercent: number; // (varianceQuantity / theoreticalUsage) * 100
  riskLevel: "CRITICAL" | "WARNING" | "NORMAL";
  explanation: string;
}

export interface FoodCostVarianceSummary {
  totalTheoreticalCost: number;
  totalActualCost: number;
  netVarianceCost: number;
  netVariancePercent: number;
  criticalLeakItemsCount: number;
  items: IngredientVarianceResult[];
}

/**
 * Computes Theoretical vs. Actual (TvA) inventory consumption variance.
 */
export async function computeFoodCostVariance(
  restaurantId: string,
  options?: { outletId?: string; startDate?: Date; endDate?: Date }
): Promise<FoodCostVarianceSummary> {
  const whereOrder: any = {
    restaurantId,
    status: { not: "CANCELLED" },
  };

  const whereLedger: any = {
    restaurantId,
    movementType: { in: ["CONSUMPTION", "WASTAGE"] },
  };

  if (options?.outletId) {
    whereOrder.outletId = options.outletId;
    whereLedger.outletId = options.outletId;
  }

  if (options?.startDate || options?.endDate) {
    whereOrder.createdAt = {};
    whereLedger.createdAt = {};
    if (options?.startDate) {
      whereOrder.createdAt.gte = options.startDate;
      whereLedger.createdAt.gte = options.startDate;
    }
    if (options?.endDate) {
      whereOrder.createdAt.lte = options.endDate;
      whereLedger.createdAt.lte = options.endDate;
    }
  }

  // 1. Fetch all Inventory Items for this restaurant
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { restaurantId, archivedAt: null },
  });

  const itemMap = new Map(inventoryItems.map((i) => [i.id, i]));

  // 2. Fetch POS Order items and explode to theoretical ingredients
  const orderItems = await prisma.posOrderItem.findMany({
    where: {
      order: whereOrder,
      recipeId: { not: null },
    },
    select: {
      recipeId: true,
      quantity: true,
    },
  });

  const theoreticalMap = new Map<string, number>();

  for (const oi of orderItems) {
    if (!oi.recipeId) continue;
    try {
      const exploded = await explodeRecipeToRawIngredients(oi.recipeId, oi.quantity);
      for (const [invId, comp] of exploded.entries()) {
        const current = theoreticalMap.get(invId) || 0;
        theoreticalMap.set(invId, current + comp.quantity);
      }
    } catch {
      // ignore individual recipe explosion errors
    }
  }

  // 3. Fetch actual stock ledger movements
  const ledgerEntries = await prisma.stockLedger.groupBy({
    by: ["itemId"],
    where: whereLedger,
    _sum: {
      quantity: true,
    },
  });

  const actualMap = new Map<string, number>();
  for (const l of ledgerEntries) {
    // Note: in stockLedger, consumption is negative, so we take absolute value
    const val = Math.abs(Number(l._sum.quantity || 0));
    actualMap.set(l.itemId, val);
  }

  // 4. Compute ingredient variances
  const results: IngredientVarianceResult[] = [];
  let totalTheoreticalCost = 0;
  let totalActualCost = 0;
  let criticalCount = 0;

  for (const item of inventoryItems) {
    const theoQty = theoreticalMap.get(item.id) || 0;
    const actQty = actualMap.get(item.id) || 0;

    // Skip items that had zero activity
    if (theoQty === 0 && actQty === 0) continue;

    const unitCost = Number(item.costPerUnit || 0);
    const varianceQty = actQty - theoQty;
    const varianceCost = varianceQty * unitCost;
    const theoCost = theoQty * unitCost;
    const actCost = actQty * unitCost;

    totalTheoreticalCost += theoCost;
    totalActualCost += actCost;

    let variancePercent = 0;
    if (theoQty > 0) {
      variancePercent = (varianceQty / theoQty) * 100;
    } else if (actQty > 0) {
      variancePercent = 100; // 100% unplanned usage
    }

    let riskLevel: "CRITICAL" | "WARNING" | "NORMAL" = "NORMAL";
    let explanation = "Stock usage closely aligned with recipe specs.";

    if (variancePercent > 15 || varianceCost > 50) {
      riskLevel = "CRITICAL";
      explanation = `High variance (${variancePercent.toFixed(1)}%). Potential portion control issue, prep spillage, or unrecorded waste.`;
      criticalCount++;
    } else if (variancePercent > 5 || varianceCost > 15) {
      riskLevel = "WARNING";
      explanation = `Moderate variance (${variancePercent.toFixed(1)}%). Monitor kitchen portion scoops.`;
    } else if (variancePercent < -5) {
      explanation = `Under-usage detected (${Math.abs(variancePercent).toFixed(1)}% less). Verify recipe portion compliance.`;
    }

    results.push({
      itemId: item.id,
      name: item.name,
      unitOfMeasure: item.unitOfMeasure,
      costPerUnit: unitCost,
      theoreticalUsage: Number(theoQty.toFixed(3)),
      actualUsage: Number(actQty.toFixed(3)),
      varianceQuantity: Number(varianceQty.toFixed(3)),
      varianceCost: Number(varianceCost.toFixed(2)),
      variancePercent: Number(variancePercent.toFixed(1)),
      riskLevel,
      explanation,
    });
  }

  // Sort by dollar variance loss descending
  results.sort((a, b) => b.varianceCost - a.varianceCost);

  const netVarianceCost = totalActualCost - totalTheoreticalCost;
  const netVariancePercent = totalTheoreticalCost > 0 ? (netVarianceCost / totalTheoreticalCost) * 100 : 0;

  return {
    totalTheoreticalCost: Number(totalTheoreticalCost.toFixed(2)),
    totalActualCost: Number(totalActualCost.toFixed(2)),
    netVarianceCost: Number(netVarianceCost.toFixed(2)),
    netVariancePercent: Number(netVariancePercent.toFixed(1)),
    criticalLeakItemsCount: criticalCount,
    items: results,
  };
}
