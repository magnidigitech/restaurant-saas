import { UnitOfMeasure } from "@prisma/client";
import { ParsedIngredientLine } from "./recipeParser";
import { canConvertUnits, convertQuantity } from "./units";

export interface MatchedComponentResult {
  componentType: "INVENTORY_ITEM" | "SUB_RECIPE";
  id: string;
  name: string;
  sku?: string;
  unitOfMeasure: UnitOfMeasure;
  costPerUnit: number;
  confidence: number; // 0 to 1
  matchReason: string;
  availablePacks?: Array<{
    id: string;
    name: string;
    packType: string;
    packUnit: UnitOfMeasure;
    conversionFactor: number;
    netQuantityPerPack: number;
  }>;
  selectedPackId?: string;
  selectedPackName?: string;
  packQuantity?: number;
  packConflictWarning?: string;
  isUnitCompatible: boolean;
  unitCompatibilityError?: string;
}

export interface InventoryItemLookup {
  id: string;
  name: string;
  sku?: string | null;
  unitOfMeasure: UnitOfMeasure;
  costPerUnit: number;
  purchasePacks?: Array<{
    id: string;
    name: string;
    packType: string;
    packUnit: UnitOfMeasure;
    conversionFactor: number;
    netQuantityPerPack: number;
  }>;
}

export interface SubRecipeLookup {
  id: string;
  name: string;
  yieldQuantity: number;
  yieldUnit: UnitOfMeasure;
  costPerUnit: number;
}

/**
 * Normalizes text for reliable culinary token matching (stripping punctuation, plurals, and adjectives).
 */
export function normalizeCulinaryToken(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(?:fresh|diced|chopped|peeled|minced|raw|organic|canned|house|premium|select|usda)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Evaluates candidate match against inventory catalogue and sub-recipes.
 */
export function matchIngredientToCatalogue(
  parsedLine: ParsedIngredientLine,
  inventoryItems: InventoryItemLookup[],
  subRecipes: SubRecipeLookup[]
): MatchedComponentResult | null {
  const rawTarget = parsedLine.name.trim().toLowerCase();
  const normalizedTarget = normalizeCulinaryToken(parsedLine.name);

  if (!rawTarget && !normalizedTarget) return null;

  // 1. Exact SKU match
  const skuMatch = inventoryItems.find(
    (i) => i.sku && i.sku.trim().toLowerCase() === rawTarget
  );
  if (skuMatch) {
    return buildMatchResult(parsedLine, "INVENTORY_ITEM", skuMatch, 1.0, "Exact SKU match");
  }

  // 2. Exact Name match on Inventory Item
  const exactItemMatch = inventoryItems.find(
    (i) => i.name.trim().toLowerCase() === rawTarget
  );
  if (exactItemMatch) {
    return buildMatchResult(parsedLine, "INVENTORY_ITEM", exactItemMatch, 1.0, "Exact item name match");
  }

  // 3. Exact Name match on Sub-Recipe
  const exactSubMatch = subRecipes.find(
    (s) => s.name.trim().toLowerCase() === rawTarget
  );
  if (exactSubMatch) {
    return buildSubRecipeMatchResult(parsedLine, exactSubMatch, 1.0, "Exact sub-recipe name match");
  }

  // 4. Normalized Name match on Inventory Item
  const normalizedItemMatch = inventoryItems.find((i) => {
    const itemNorm = normalizeCulinaryToken(i.name);
    return (
      itemNorm === normalizedTarget ||
      itemNorm.includes(normalizedTarget) ||
      normalizedTarget.includes(itemNorm)
    );
  });
  if (normalizedItemMatch) {
    return buildMatchResult(
      parsedLine,
      "INVENTORY_ITEM",
      normalizedItemMatch,
      0.85,
      "Fuzzy culinary name match"
    );
  }

  // 5. Normalized Name match on Sub-Recipe
  const normalizedSubMatch = subRecipes.find((s) => {
    const subNorm = normalizeCulinaryToken(s.name);
    return (
      subNorm === normalizedTarget ||
      subNorm.includes(normalizedTarget) ||
      normalizedTarget.includes(subNorm)
    );
  });
  if (normalizedSubMatch) {
    return buildSubRecipeMatchResult(
      parsedLine,
      normalizedSubMatch,
      0.85,
      "Fuzzy sub-recipe name match"
    );
  }

  // 6. Word-level token match (e.g. "Roma tomatoes" matches "Tomatoes (Roma Fresh)")
  const targetWords = normalizedTarget.split(" ").filter((w) => w.length > 2);
  if (targetWords.length > 0) {
    let bestItem: InventoryItemLookup | null = null;
    let maxOverlap = 0;

    for (const item of inventoryItems) {
      const itemNormWords = normalizeCulinaryToken(item.name).split(" ");
      const overlap = targetWords.filter((w) => itemNormWords.includes(w)).length;
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestItem = item;
      }
    }

    if (bestItem && maxOverlap > 0) {
      const score = Math.min(0.75, maxOverlap / targetWords.length);
      return buildMatchResult(
        parsedLine,
        "INVENTORY_ITEM",
        bestItem,
        score,
        `Token overlap match (${maxOverlap} words matched)`
      );
    }
  }

  return null;
}

function buildMatchResult(
  parsedLine: ParsedIngredientLine,
  componentType: "INVENTORY_ITEM",
  item: InventoryItemLookup,
  confidence: number,
  matchReason: string
): MatchedComponentResult {
  const reqUnit = parsedLine.unitOfMeasure || item.unitOfMeasure;
  const isCompatible = canConvertUnits(reqUnit, item.unitOfMeasure);
  const unitError = !isCompatible
    ? `Cannot convert ${reqUnit} to item's inventory tracking unit ${item.unitOfMeasure}`
    : undefined;

  let selectedPackId: string | undefined = undefined;
  let selectedPackName: string | undefined = undefined;
  let packQuantity: number | undefined = undefined;
  let packConflictWarning: string | undefined = undefined;

  // Check packaging match if parsed line specifies a container (e.g. "can", "box", "case", "bag")
  if (item.purchasePacks && item.purchasePacks.length > 0) {
    if (parsedLine.isMultipack && parsedLine.multipackContainer) {
      // Find pack matching container type (e.g. "Can")
      const matchingPack = item.purchasePacks.find(
        (p) => p.packType.toLowerCase() === parsedLine.multipackContainer!.toLowerCase()
      );

      if (matchingPack) {
        selectedPackId = matchingPack.id;
        selectedPackName = matchingPack.name;
        packQuantity = parsedLine.multipackCount || 1;

        // Verify if pack size matches stated size (e.g. 400g stated vs 400g pack)
        if (parsedLine.multipackSize && parsedLine.multipackUnit) {
          const statedUnit = parsedLine.multipackUnit as UnitOfMeasure;
          if (canConvertUnits(statedUnit, matchingPack.packUnit)) {
            const packCapacityInStatedUnit = convertQuantity(
              matchingPack.netQuantityPerPack,
              matchingPack.packUnit,
              statedUnit
            );
            const sizeDiff = Math.abs(packCapacityInStatedUnit - parsedLine.multipackSize);
            if (sizeDiff > 0.05 * parsedLine.multipackSize) {
              packConflictWarning = `Warning: Stated ${parsedLine.multipackContainer} size (${parsedLine.multipackSize} ${statedUnit}) differs from inventory pack size (${packCapacityInStatedUnit} ${statedUnit})`;
            }
          }
        }
      }
    } else if (parsedLine.statedUnitRaw && ["box", "case", "bag", "sack", "crate", "can"].includes(parsedLine.statedUnitRaw.toLowerCase())) {
      const containerWord = parsedLine.statedUnitRaw.toLowerCase();
      const matchingPack = item.purchasePacks.find(
        (p) => p.packType.toLowerCase() === containerWord
      );
      if (matchingPack) {
        selectedPackId = matchingPack.id;
        selectedPackName = matchingPack.name;
        packQuantity = parsedLine.quantity || 1;
      }
    }
  }

  return {
    componentType,
    id: item.id,
    name: item.name,
    sku: item.sku || undefined,
    unitOfMeasure: item.unitOfMeasure,
    costPerUnit: Number(item.costPerUnit || 0),
    confidence,
    matchReason,
    availablePacks: item.purchasePacks,
    selectedPackId,
    selectedPackName,
    packQuantity,
    packConflictWarning,
    isUnitCompatible: isCompatible,
    unitCompatibilityError: unitError,
  };
}

function buildSubRecipeMatchResult(
  parsedLine: ParsedIngredientLine,
  sub: SubRecipeLookup,
  confidence: number,
  matchReason: string
): MatchedComponentResult {
  const reqUnit = parsedLine.unitOfMeasure || sub.yieldUnit;
  const isCompatible = canConvertUnits(reqUnit, sub.yieldUnit);
  const unitError = !isCompatible
    ? `Cannot convert ${reqUnit} to sub-recipe yield unit ${sub.yieldUnit}`
    : undefined;

  return {
    componentType: "SUB_RECIPE",
    id: sub.id,
    name: sub.name,
    unitOfMeasure: sub.yieldUnit,
    costPerUnit: Number(sub.costPerUnit || 0),
    confidence,
    matchReason,
    isUnitCompatible: isCompatible,
    unitCompatibilityError: unitError,
  };
}
