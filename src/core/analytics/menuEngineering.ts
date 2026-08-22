import { prisma } from "@/core/database/client";

export type MenuEngineeringCategory = "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG";

export interface DishEngineeringMetric {
  recipeId: string;
  name: string;
  sellingPrice: number;
  costPerUnit: number;
  contributionMargin: number; // sellingPrice - costPerUnit
  foodCostPercent: number; // (costPerUnit / sellingPrice) * 100
  totalQuantitySold: number;
  totalRevenue: number; // totalQuantitySold * sellingPrice
  totalCostOfGoods: number; // totalQuantitySold * costPerUnit
  totalGrossProfit: number; // totalRevenue - totalCostOfGoods
  salesMixPercent: number; // (totalQuantitySold / totalItemsSold) * 100
  profitabilityScore: "HIGH" | "LOW";
  popularityScore: "HIGH" | "LOW";
  classification: MenuEngineeringCategory;
  recommendation: string;
}

export interface MenuEngineeringSummary {
  totalDishesCount: number;
  totalUnitsSold: number;
  totalRevenue: number;
  totalGrossProfit: number;
  averageContributionMargin: number;
  averagePopularityThreshold: number; // (1 / totalDishes) * 0.70 (Standard 70% rule)
  averageFoodCostPercent: number;
  stars: DishEngineeringMetric[];
  plowhorses: DishEngineeringMetric[];
  puzzles: DishEngineeringMetric[];
  dogs: DishEngineeringMetric[];
  allDishes: DishEngineeringMetric[];
}

/**
 * Computes Kasavana-Smith Menu Engineering Matrix across all recipes for a tenant.
 */
export async function computeMenuEngineering(
  restaurantId: string,
  options?: { outletId?: string; startDate?: Date; endDate?: Date }
): Promise<MenuEngineeringSummary> {
  const whereOrder: any = {
    restaurantId,
    status: { not: "CANCELLED" },
  };

  if (options?.outletId) {
    whereOrder.outletId = options.outletId;
  }

  if (options?.startDate || options?.endDate) {
    whereOrder.createdAt = {};
    if (options?.startDate) whereOrder.createdAt.gte = options.startDate;
    if (options?.endDate) whereOrder.createdAt.lte = options.endDate;
  }

  // Fetch all sellable recipes (DISH)
  const recipes = await prisma.recipe.findMany({
    where: {
      restaurantId,
      type: "DISH",
      archivedAt: null,
    },
  });

  // Aggregate POS sales by recipeId
  const orderItems = await prisma.posOrderItem.groupBy({
    by: ["recipeId"],
    where: {
      order: whereOrder,
      recipeId: { not: null },
    },
    _sum: {
      quantity: true,
      totalPrice: true,
    },
  });

  const salesMap = new Map<string, { quantity: number; revenue: number }>();
  let totalUnitsSold = 0;
  let totalRevenue = 0;
  let totalGrossProfit = 0;

  for (const item of orderItems) {
    if (item.recipeId) {
      const qty = item._sum.quantity || 0;
      const rev = Number(item._sum.totalPrice || 0);
      salesMap.set(item.recipeId, { quantity: qty, revenue: rev });
      totalUnitsSold += qty;
      totalRevenue += rev;
    }
  }

  const numRecipes = Math.max(1, recipes.length);
  // Kasavana-Smith Popularity Benchmark: (100% / N) * 70%
  const popularityThresholdPercent = (100 / numRecipes) * 0.7;

  // Calculate preliminary metrics per dish
  const initialDishes: {
    recipe: typeof recipes[0];
    soldQty: number;
    revenue: number;
    sellingPrice: number;
    costPerUnit: number;
    margin: number;
    foodCostPct: number;
    grossProfit: number;
    mixPct: number;
  }[] = [];

  let sumContributionMargins = 0;

  for (const r of recipes) {
    const s = salesMap.get(r.id) || { quantity: 0, revenue: 0 };
    const sellingPrice = Number(r.sellingPrice || 0);
    const costPerUnit = Number(r.costPerUnit || 0);
    const margin = Math.max(0, sellingPrice - costPerUnit);
    const foodCostPct = sellingPrice > 0 ? (costPerUnit / sellingPrice) * 100 : 0;
    const grossProfit = s.quantity * margin;
    const mixPct = totalUnitsSold > 0 ? (s.quantity / totalUnitsSold) * 100 : 0;

    sumContributionMargins += margin;
    totalGrossProfit += grossProfit;

    initialDishes.push({
      recipe: r,
      soldQty: s.quantity,
      revenue: s.revenue,
      sellingPrice,
      costPerUnit,
      margin,
      foodCostPct,
      grossProfit,
      mixPct,
    });
  }

  const averageContributionMargin = numRecipes > 0 ? sumContributionMargins / numRecipes : 0;
  const averageFoodCostPercent = totalRevenue > 0 ? ((totalRevenue - totalGrossProfit) / totalRevenue) * 100 : 0;

  const stars: DishEngineeringMetric[] = [];
  const plowhorses: DishEngineeringMetric[] = [];
  const puzzles: DishEngineeringMetric[] = [];
  const dogs: DishEngineeringMetric[] = [];
  const allDishes: DishEngineeringMetric[] = [];

  for (const d of initialDishes) {
    const isHighProfit = d.margin >= averageContributionMargin;
    const isHighPopularity = d.mixPct >= popularityThresholdPercent;

    let classification: MenuEngineeringCategory;
    let recommendation = "";

    if (isHighProfit && isHighPopularity) {
      classification = "STAR";
      recommendation = "Maintain high quality standards, protect recipe consistency, and feature prominently on menu.";
    } else if (!isHighProfit && isHighPopularity) {
      classification = "PLOWHORSE";
      recommendation = "Highly popular customer staple. Re-engineer ingredients to reduce portion cost or test modest $0.50-$1.00 price increase.";
    } else if (isHighProfit && !isHighPopularity) {
      classification = "PUZZLE";
      recommendation = "High margin hidden gem. Reposition on menu, feature as Chef's Special, or train front-of-house staff to recommend.";
    } else {
      classification = "DOG";
      recommendation = "Low margin and low sales volume. Consider removing from menu or reinventing recipe concept completely.";
    }

    const metric: DishEngineeringMetric = {
      recipeId: d.recipe.id,
      name: d.recipe.name,
      sellingPrice: d.sellingPrice,
      costPerUnit: d.costPerUnit,
      contributionMargin: d.margin,
      foodCostPercent: d.foodCostPct,
      totalQuantitySold: d.soldQty,
      totalRevenue: d.revenue,
      totalCostOfGoods: d.soldQty * d.costPerUnit,
      totalGrossProfit: d.grossProfit,
      salesMixPercent: d.mixPct,
      profitabilityScore: isHighProfit ? "HIGH" : "LOW",
      popularityScore: isHighPopularity ? "HIGH" : "LOW",
      classification,
      recommendation,
    };

    allDishes.push(metric);
    if (classification === "STAR") stars.push(metric);
    else if (classification === "PLOWHORSE") plowhorses.push(metric);
    else if (classification === "PUZZLE") puzzles.push(metric);
    else dogs.push(metric);
  }

  // Sort within categories by gross profit descending
  stars.sort((a, b) => b.totalGrossProfit - a.totalGrossProfit);
  plowhorses.sort((a, b) => b.totalQuantitySold - a.totalQuantitySold);
  puzzles.sort((a, b) => b.contributionMargin - a.contributionMargin);
  dogs.sort((a, b) => a.totalGrossProfit - b.totalGrossProfit);

  return {
    totalDishesCount: recipes.length,
    totalUnitsSold,
    totalRevenue,
    totalGrossProfit,
    averageContributionMargin,
    averagePopularityThreshold: popularityThresholdPercent,
    averageFoodCostPercent,
    stars,
    plowhorses,
    puzzles,
    dogs,
    allDishes,
  };
}
