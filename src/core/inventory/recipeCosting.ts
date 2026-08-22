import { prisma } from "@/core/database/client";
import { UnitOfMeasure, RecipeComponentType } from "@prisma/client";
import {
  convertUnitCost,
  convertQuantity,
  formatUnitPricing,
  getUnitPricingMatrix,
  UnitEquivalentPricing,
} from "./units";

export interface ComponentCostResult {
  componentType: RecipeComponentType;
  id: string; // inventoryItemId or subRecipeId
  name: string;
  quantity: number;
  unitOfMeasure: UnitOfMeasure;
  wastagePercent: number;
  baseUnit: UnitOfMeasure;
  baseUnitCost: number; // cost per base unit in inventory/sub-recipe
  effectiveUnitCost: number; // cost per recipe item's unitOfMeasure
  netCost: number; // quantity * effectiveUnitCost
  wastageCost: number; // netCost * (wastagePercent / 100)
  totalCost: number; // netCost + wastageCost
  unitPricingMatrix: UnitEquivalentPricing[]; // Multi-unit conversion equivalents (per OZ, per LB, per G, per KG, per Ladle, etc.)
  subComponents?: ComponentCostResult[];
}

export interface RecipeCostBreakdown {
  recipeId: string;
  name: string;
  type: "DISH" | "SUB_RECIPE";
  yieldQuantity: number;
  yieldUnit: UnitOfMeasure;
  sellingPrice: number;
  totalCost: number;
  costPerUnit: number;
  grossMarginPercent: number;
  foodCostPercent: number;
  unitPricingMatrix: UnitEquivalentPricing[]; // Multi-unit conversion equivalents for the finished recipe / sub-recipe
  items: ComponentCostResult[];
}

/**
 * Recursively calculates recipe cost breakdown, multi-unit pricing equivalents, and profit margin metrics.
 */
export async function calculateRecipeCost(
  recipeId: string,
  visited = new Set<string>()
): Promise<RecipeCostBreakdown> {
  if (visited.has(recipeId)) {
    throw new Error(`Circular sub-recipe dependency detected on recipe ID: ${recipeId}`);
  }
  visited.add(recipeId);

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      items: {
        include: {
          inventoryItem: true,
          subRecipe: {
            include: {
              items: {
                include: {
                  inventoryItem: true,
                  subRecipe: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }

  const itemsCostResult: ComponentCostResult[] = [];
  let calculatedTotalCost = 0;

  for (const item of recipe.items) {
    const qty = Number(item.quantity);
    const waste = Number(item.wastagePercent || 0);
    const recipeUnit = item.unitOfMeasure;

    if (item.componentType === "INVENTORY_ITEM" && item.inventoryItem) {
      const baseUnit = item.inventoryItem.unitOfMeasure;
      const baseCost = Number(item.inventoryItem.costPerUnit || 0);
      const effectiveUnitCost = convertUnitCost(baseCost, baseUnit, recipeUnit);
      const netCost = qty * effectiveUnitCost;
      const totalItemCost = netCost * (1 + waste / 100);

      itemsCostResult.push({
        componentType: "INVENTORY_ITEM",
        id: item.inventoryItem.id,
        name: item.inventoryItem.name,
        quantity: qty,
        unitOfMeasure: recipeUnit,
        wastagePercent: waste,
        baseUnit,
        baseUnitCost: baseCost,
        effectiveUnitCost,
        netCost,
        wastageCost: totalItemCost - netCost,
        totalCost: totalItemCost,
        unitPricingMatrix: getUnitPricingMatrix(baseCost, baseUnit),
      });

      calculatedTotalCost += totalItemCost;
    } else if (item.componentType === "SUB_RECIPE" && item.subRecipe) {
      // Recursively calculate sub-recipe cost
      const subBreakdown = await calculateRecipeCost(item.subRecipe.id, new Set(visited));
      const baseUnit = subBreakdown.yieldUnit;
      const baseCost = subBreakdown.costPerUnit; // cost per single yield unit of sub-recipe
      const effectiveUnitCost = convertUnitCost(baseCost, baseUnit, recipeUnit);
      const netCost = qty * effectiveUnitCost;
      const totalItemCost = netCost * (1 + waste / 100);

      itemsCostResult.push({
        componentType: "SUB_RECIPE",
        id: item.subRecipe.id,
        name: item.subRecipe.name,
        quantity: qty,
        unitOfMeasure: recipeUnit,
        wastagePercent: waste,
        baseUnit,
        baseUnitCost: baseCost,
        effectiveUnitCost,
        netCost,
        wastageCost: totalItemCost - netCost,
        totalCost: totalItemCost,
        unitPricingMatrix: getUnitPricingMatrix(baseCost, baseUnit),
        subComponents: subBreakdown.items,
      });

      calculatedTotalCost += totalItemCost;
    }
  }

  const yieldQty = Number(recipe.yieldQuantity || 1);
  const costPerUnit = yieldQty > 0 ? calculatedTotalCost / yieldQty : calculatedTotalCost;
  const sellingPrice = Number(recipe.sellingPrice || 0);

  let grossMarginPercent = 0;
  let foodCostPercent = 0;

  if (sellingPrice > 0) {
    grossMarginPercent = Math.max(0, ((sellingPrice - costPerUnit) / sellingPrice) * 100);
    foodCostPercent = Math.min(100, (costPerUnit / sellingPrice) * 100);
  }

  return {
    recipeId: recipe.id,
    name: recipe.name,
    type: recipe.type,
    yieldQuantity: yieldQty,
    yieldUnit: recipe.yieldUnit,
    sellingPrice,
    totalCost: calculatedTotalCost,
    costPerUnit,
    grossMarginPercent,
    foodCostPercent,
    unitPricingMatrix: getUnitPricingMatrix(costPerUnit, recipe.yieldUnit),
    items: itemsCostResult,
  };
}

/**
 * Recalculates and persists costPerUnit, totalCost, and grossMarginPercent on a Recipe record.
 */
export async function syncRecipeCosting(recipeId: string): Promise<RecipeCostBreakdown> {
  const breakdown = await calculateRecipeCost(recipeId);

  await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      totalCost: breakdown.totalCost,
      costPerUnit: breakdown.costPerUnit,
      grossMarginPercent: breakdown.grossMarginPercent,
    },
  });

  // Update RecipeItem unitCost and totalCost for persistent caching
  for (const item of breakdown.items) {
    await prisma.recipeItem.updateMany({
      where: {
        recipeId,
        ...(item.componentType === "INVENTORY_ITEM"
          ? { inventoryItemId: item.id }
          : { subRecipeId: item.id }),
      },
      data: {
        unitCost: item.effectiveUnitCost,
        totalCost: item.totalCost,
      },
    });
  }

  // Also cascade sync parent recipes that use this recipe as a sub-recipe
  const parentUsages = await prisma.recipeItem.findMany({
    where: { subRecipeId: recipeId },
    select: { recipeId: true },
  });

  for (const parent of parentUsages) {
    try {
      await syncRecipeCosting(parent.recipeId);
    } catch {
      // ignore
    }
  }

  return breakdown;
}
