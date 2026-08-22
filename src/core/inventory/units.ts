import { UnitOfMeasure } from "@prisma/client";

export type UnitCategory = "WEIGHT" | "VOLUME" | "COUNT" | "PACKAGE";

export interface UnitInfo {
  label: string;
  shortLabel: string;
  category: UnitCategory;
  baseFactor: number; // Factor relative to category base (Base weight: KG, Base volume: L, Base count: PIECES)
  description?: string;
}

export const UNIT_DEFINITIONS: Record<UnitOfMeasure, UnitInfo> = {
  // --- Weight Units (Base: KG) ---
  KG: { label: "Kilograms", shortLabel: "kg", category: "WEIGHT", baseFactor: 1.0, description: "1,000 grams / 2.2046 lbs" },
  G: { label: "Grams", shortLabel: "g", category: "WEIGHT", baseFactor: 0.001, description: "1/1000th kg" },
  LB: { label: "Pounds", shortLabel: "lb", category: "WEIGHT", baseFactor: 0.45359237, description: "16 ounces / 453.59 grams" },
  OZ: { label: "Ounces", shortLabel: "oz", category: "WEIGHT", baseFactor: 0.028349523125, description: "1/16 lb / 28.35 grams" },

  // --- Volume & Culinary Kitchen Units (Base: Liter) ---
  L: { label: "Liters", shortLabel: "L", category: "VOLUME", baseFactor: 1.0, description: "1,000 milliliters" },
  ML: { label: "Milliliters", shortLabel: "ml", category: "VOLUME", baseFactor: 0.001, description: "1/1000th Liter" },
  GAL: { label: "Gallons (US)", shortLabel: "gal", category: "VOLUME", baseFactor: 3.785411784, description: "128 fluid ounces / 3.785 Liters" },
  QT: { label: "Quarts (US)", shortLabel: "qt", category: "VOLUME", baseFactor: 0.946352946, description: "32 fluid ounces / 4 cups" },
  PT: { label: "Pints (US)", shortLabel: "pt", category: "VOLUME", baseFactor: 0.473176473, description: "16 fluid ounces / 2 cups" },
  CUP: { label: "Cups", shortLabel: "cup", category: "VOLUME", baseFactor: 0.2365882365, description: "8 fluid ounces / 236.6 ml" },
  FL_OZ: { label: "Fluid Ounces", shortLabel: "fl oz", category: "VOLUME", baseFactor: 0.0295735295625, description: "29.57 ml / 2 tablespoons" },
  TBSP: { label: "Tablespoons", shortLabel: "tbsp", category: "VOLUME", baseFactor: 0.01478676478125, description: "0.5 fl oz / 15 ml / 3 teaspoons" },
  TSP: { label: "Teaspoons", shortLabel: "tsp", category: "VOLUME", baseFactor: 0.00492892159375, description: "1/3 tablespoon / ~5 ml" },
  LADLE: { label: "Ladles (4 oz scoop)", shortLabel: "ladle", category: "VOLUME", baseFactor: 0.11829411825, description: "Standard kitchen 4 fl oz ladle scoop (~118 ml)" },

  // --- Count & Portion Units (Base: PIECES) ---
  PIECES: { label: "Pieces", shortLabel: "pcs", category: "COUNT", baseFactor: 1.0, description: "Individual single unit count" },
  DOZEN: { label: "Dozen", shortLabel: "doz", category: "COUNT", baseFactor: 12.0, description: "12 pieces" },
  PORTION: { label: "Portions / Servings", shortLabel: "portion", category: "COUNT", baseFactor: 1.0, description: "Prepared culinary meal portion" },
  BOX: { label: "Boxes", shortLabel: "box", category: "PACKAGE", baseFactor: 1.0, description: "Packaged container unit" },
  PACKET: { label: "Packets", shortLabel: "pkt", category: "PACKAGE", baseFactor: 1.0, description: "Packaged dry pouch unit" },
};

/**
 * Checks whether two units belong to the same dimensional category and can be converted.
 */
export function canConvertUnits(from: UnitOfMeasure, to: UnitOfMeasure): boolean {
  if (from === to) return true;
  return UNIT_DEFINITIONS[from]?.category === UNIT_DEFINITIONS[to]?.category;
}

/**
 * Converts quantity from source unit to target unit.
 * Example: convertQuantity(1, 'LB', 'OZ') -> 16
 * Example: convertQuantity(1, 'LB', 'G') -> 453.592
 * Example: convertQuantity(1, 'GAL', 'LADLE') -> 32
 */
export function convertQuantity(quantity: number, from: UnitOfMeasure, to: UnitOfMeasure): number {
  if (from === to) return quantity;
  const fromDef = UNIT_DEFINITIONS[from];
  const toDef = UNIT_DEFINITIONS[to];

  if (!fromDef || !toDef || fromDef.category !== toDef.category) {
    return quantity;
  }

  const baseValue = quantity * fromDef.baseFactor;
  return baseValue / toDef.baseFactor;
}

/**
 * Converts cost per source unit to cost per target unit.
 * Example: If cost is $12.00 per LB:
 *   -> Cost per OZ is $0.75 / oz
 *   -> Cost per Gram is $0.026455 / g
 *   -> Cost per KG is $26.455 / kg
 */
export function convertUnitCost(costPerSourceUnit: number, from: UnitOfMeasure, to: UnitOfMeasure): number {
  if (from === to) return costPerSourceUnit;
  const fromDef = UNIT_DEFINITIONS[from];
  const toDef = UNIT_DEFINITIONS[to];

  if (!fromDef || !toDef || fromDef.category !== toDef.category) {
    return costPerSourceUnit;
  }

  // Cost per base unit = costPerSourceUnit / fromDef.baseFactor
  // Cost per target unit = (costPerSourceUnit / fromDef.baseFactor) * toDef.baseFactor
  const costPerBase = costPerSourceUnit / fromDef.baseFactor;
  return costPerBase * toDef.baseFactor;
}

/**
 * Returns all units compatible with the provided unit.
 */
export function getCompatibleUnits(unit: UnitOfMeasure): UnitOfMeasure[] {
  const category = UNIT_DEFINITIONS[unit]?.category;
  if (!category) return [unit];

  return (Object.keys(UNIT_DEFINITIONS) as UnitOfMeasure[]).filter(
    (u) => UNIT_DEFINITIONS[u].category === category
  );
}

/**
 * Formats a unit label with standardized abbreviations.
 */
export function formatUnit(unit: UnitOfMeasure): string {
  return UNIT_DEFINITIONS[unit]?.shortLabel ?? unit;
}

/**
 * Formats cost per unit into readable string (e.g. "$12.50 / lb", "$0.75 / oz", "$0.0265 / g").
 */
export function formatUnitPricing(cost: number, unit: UnitOfMeasure, currencySymbol = "$"): string {
  let formattedCost: string;
  if (cost === 0) {
    formattedCost = "0.00";
  } else if (cost < 0.01) {
    formattedCost = cost.toFixed(4);
  } else if (cost < 1) {
    formattedCost = cost.toFixed(3);
  } else {
    formattedCost = cost.toFixed(2);
  }
  return `${currencySymbol}${formattedCost} / ${formatUnit(unit)}`;
}

export interface UnitEquivalentPricing {
  unit: UnitOfMeasure;
  label: string;
  shortLabel: string;
  unitCost: number;
  formattedPricing: string;
  description?: string;
  isPrimary?: boolean;
}

/**
 * Generates the complete Multi-Unit Equivalents Matrix for any cost and base unit.
 * Example: Input $16.00 / LB -> returns pricing for LB, OZ, G, KG with clean human-readable conversions.
 */
export function getUnitPricingMatrix(
  costPerBaseUnit: number,
  baseUnit: UnitOfMeasure,
  currencySymbol = "$"
): UnitEquivalentPricing[] {
  const category = UNIT_DEFINITIONS[baseUnit]?.category;
  if (!category) {
    return [
      {
        unit: baseUnit,
        label: UNIT_DEFINITIONS[baseUnit]?.label || baseUnit,
        shortLabel: formatUnit(baseUnit),
        unitCost: costPerBaseUnit,
        formattedPricing: formatUnitPricing(costPerBaseUnit, baseUnit, currencySymbol),
        isPrimary: true,
      },
    ];
  }

  // Define preferred display order per category
  let targetUnits: UnitOfMeasure[] = [];
  if (category === "WEIGHT") {
    targetUnits = ["LB", "OZ", "G", "KG"];
  } else if (category === "VOLUME") {
    targetUnits = ["LADLE", "CUP", "FL_OZ", "TBSP", "TSP", "L", "ML", "GAL", "QT", "PT"];
  } else if (category === "COUNT") {
    targetUnits = ["PIECES", "DOZEN", "PORTION"];
  } else {
    targetUnits = [baseUnit];
  }

  return targetUnits.map((targetUnit) => {
    const cost = convertUnitCost(costPerBaseUnit, baseUnit, targetUnit);
    const def = UNIT_DEFINITIONS[targetUnit];
    return {
      unit: targetUnit,
      label: def?.label || targetUnit,
      shortLabel: def?.shortLabel || targetUnit,
      unitCost: cost,
      formattedPricing: formatUnitPricing(cost, targetUnit, currencySymbol),
      description: def?.description,
      isPrimary: targetUnit === baseUnit,
    };
  });
}
