import { prisma } from "@/core/database/client";
import { UnitOfMeasure, RecipeComponentType } from "@prisma/client";
import {
  convertUnitCost,
  convertQuantity,
  calculateGrossQuantity,
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
  grossQuantity: number;
  baseUnit: UnitOfMeasure;
  baseUnitCost: number; // cost per base unit in inventory/sub-recipe
  effectiveUnitCost: number; // cost per recipe item's unitOfMeasure
  netCost: number; // quantity * effectiveUnitCost
  wastageCost: number; // (grossQuantity - quantity) * effectiveUnitCost
  totalCost: number; // grossQuantity * effectiveUnitCost
  packId?: string | null;
  packName?: string | null;
  packQuantity?: number | null;
  hasMissingCost: boolean;
  unitPricingMatrix: UnitEquivalentPricing[]; // Multi-unit conversion equivalents
  subComponents?: ComponentCostResult[];
}

export interface RecipeCostBreakdown {
  recipeId: string;
  name: string;
  type: "DISH" | "SUB_RECIPE";
  isDraft: boolean;
  yieldQuantity: number;
  yieldUnit: UnitOfMeasure;
  sellingPrice: number;
  totalCost: number;
  costPerUnit: number;
  grossMarginPercent: number;
  foodCostPercent: number;
  hasMissingCosts: boolean;
  unitPricingMatrix: UnitEquivalentPricing[]; // Multi-unit conversion equivalents for finished recipe
  items: ComponentCostResult[];
}

/**
 * Recursively calculates recipe cost breakdown, multi-unit pricing equivalents, and profit margin metrics.
 * Uses exact culinary shrinkage math: Gross Quantity = Usable Quantity ÷ (1 - Loss%).
 */
export async function calculateRecipeCost(
  recipeId: string,
  visited = new Set<string>(),
  visitedPath: string[] = []
): Promise<RecipeCostBreakdown> {
  if (visited.has(recipeId)) {
    const cycleStr = [...visitedPath, recipeId].join(" ➔ ");
    throw new Error(`Circular sub-recipe dependency detected: ${cycleStr}`);
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

  // Pre-fetch linked packs safely in memory
  const allPackIds = new Set<string>();
  for (const item of recipe.items) {
    if ((item as any).packId) allPackIds.add((item as any).packId);
    if (item.subRecipe && item.subRecipe.items) {
      for (const subItem of item.subRecipe.items) {
        if ((subItem as any).packId) allPackIds.add((subItem as any).packId);
      }
    }
  }

  let packsMap = new Map<string, any>();
  if (allPackIds.size > 0) {
    try {
      const packs = await prisma.itemPurchasePack.findMany({
        where: { id: { in: Array.from(allPackIds) } },
      });
      packsMap = new Map(packs.map((p) => [p.id, p]));
    } catch {
      // ignore if pack query fails
    }
  }

  const itemsCostResult: ComponentCostResult[] = [];
  let calculatedTotalCost = 0;
  let recipeHasMissingCosts = false;

  for (const item of recipe.items) {
    let usableQty = Number(item.quantity);
    let recipeUnit = item.unitOfMeasure;
    const waste = Number(item.wastagePercent || 0);

    const pack = (item as any).pack || (item.packId ? packsMap.get(item.packId) : null);

    // If item packaging definition is linked
    if (item.packId && pack) {
      if (item.packQuantity && Number(item.packQuantity) > 0) {
        const packFactor = Number(pack.netQuantityPerPack || pack.conversionFactor || 1);
        usableQty = Number(item.packQuantity) * packFactor;
        recipeUnit = pack.packUnit;
      }
    }

    // Exact culinary shrinkage formula
    const grossQty = calculateGrossQuantity(usableQty, waste);

    if (item.componentType === "INVENTORY_ITEM" && item.inventoryItem) {
      const baseUnit = item.inventoryItem.unitOfMeasure;
      const baseCost = Number(item.inventoryItem.costPerUnit || 0);
      if (baseCost <= 0) recipeHasMissingCosts = true;

      const effectiveUnitCost = convertUnitCost(baseCost, baseUnit, recipeUnit);
      const netCost = usableQty * effectiveUnitCost;
      const totalItemCost = grossQty * effectiveUnitCost;
      const wastageCost = totalItemCost - netCost;

      itemsCostResult.push({
        componentType: "INVENTORY_ITEM",
        id: item.inventoryItem.id,
        name: item.inventoryItem.name,
        quantity: usableQty,
        unitOfMeasure: recipeUnit,
        wastagePercent: waste,
        grossQuantity: grossQty,
        baseUnit,
        baseUnitCost: baseCost,
        effectiveUnitCost,
        netCost,
        wastageCost,
        totalCost: totalItemCost,
        packId: item.packId,
        packName: (pack as any)?.name || (item as any).pack?.name || null,
        packQuantity: item.packQuantity ? Number(item.packQuantity) : null,
        hasMissingCost: baseCost <= 0,
        unitPricingMatrix: getUnitPricingMatrix(baseCost, baseUnit),
      });

      calculatedTotalCost += totalItemCost;
    } else if (item.componentType === "SUB_RECIPE" && item.subRecipe) {
      // Recursively calculate sub-recipe cost with path tracing
      const subBreakdown = await calculateRecipeCost(
        item.subRecipe.id,
        new Set(visited),
        [...visitedPath, recipe.name]
      );
      if (subBreakdown.hasMissingCosts) recipeHasMissingCosts = true;

      const baseUnit = subBreakdown.yieldUnit;
      const baseCost = subBreakdown.costPerUnit; // cost per single yield unit of sub-recipe
      if (baseCost <= 0) recipeHasMissingCosts = true;

      const effectiveUnitCost = convertUnitCost(baseCost, baseUnit, recipeUnit);
      const netCost = usableQty * effectiveUnitCost;
      const totalItemCost = grossQty * effectiveUnitCost;
      const wastageCost = totalItemCost - netCost;

      itemsCostResult.push({
        componentType: "SUB_RECIPE",
        id: item.subRecipe.id,
        name: item.subRecipe.name,
        quantity: usableQty,
        unitOfMeasure: recipeUnit,
        wastagePercent: waste,
        grossQuantity: grossQty,
        baseUnit,
        baseUnitCost: baseCost,
        effectiveUnitCost,
        netCost,
        wastageCost,
        totalCost: totalItemCost,
        hasMissingCost: baseCost <= 0,
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
    isDraft: recipe.isDraft,
    yieldQuantity: yieldQty,
    yieldUnit: recipe.yieldUnit,
    sellingPrice,
    totalCost: calculatedTotalCost,
    costPerUnit,
    grossMarginPercent,
    foodCostPercent,
    hasMissingCosts: recipeHasMissingCosts,
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
