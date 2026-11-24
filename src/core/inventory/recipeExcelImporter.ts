import * as XLSX from "xlsx";
import { UnitOfMeasure } from "@prisma/client";
import { UNIT_ALIAS_MAP, parseKitchenNumber } from "./recipeParser";
import {
  InventoryItemLookup,
  SubRecipeLookup,
  matchIngredientToCatalogue,
  MatchedComponentResult,
} from "./recipeMatcher";

export interface ExcelImportRow {
  sheetName: string;
  rowNumber: number;
  recipeName: string;
  recipeType: "DISH" | "SUB_RECIPE";
  batchYield: number;
  yieldUnit: UnitOfMeasure;
  ingredientNameOrSku: string;
  quantity: number;
  unit: UnitOfMeasure;
  prepLossPercent: number;
  notes?: string;
  matchedComponent?: MatchedComponentResult | null;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GroupedRecipeImport {
  recipeName: string;
  recipeType: "DISH" | "SUB_RECIPE";
  batchYield: number;
  yieldUnit: UnitOfMeasure;
  rows: ExcelImportRow[];
  isValid: boolean;
  isExisting: boolean;
  existingRecipeId?: string;
}

export interface ExcelImportResult {
  sheetNames: string[];
  selectedSheet: string;
  totalRowsProcessed: number;
  groupedRecipes: GroupedRecipeImport[];
  globalErrors: string[];
}

/**
 * Generates a downloadable standardized XLSX template buffer.
 */
export function generateRecipeImportTemplate(): Buffer {
  const wb = XLSX.utils.book_new();

  // Instructions Sheet
  const instructionsData = [
    ["Resto Bird Recipe Import Template Guide"],
    [""],
    ["Field Name", "Required", "Allowed Values / Examples", "Description"],
    ["Recipe Name", "Yes", "e.g. Signature Truffle Burger, House Gravy", "Name of the dish or prep batch."],
    ["Recipe Type", "Yes", "DISH or SUB_RECIPE", "DISH: Sold in POS/Catering. SUB_RECIPE: Prep batch used in other recipes."],
    ["Batch Yield", "Yes", "e.g. 1, 4, 10, 25", "Total yield produced by this formula."],
    ["Yield Unit", "Yes", "PORTION, PIECES, KG, LB, L, GAL", "Unit of the finished batch yield."],
    ["Ingredient / SKU", "Yes", "e.g. DRY-RICE-003 or Roma Tomatoes", "SKU or name of raw ingredient or sub-recipe."],
    ["Quantity", "Yes", "e.g. 1.5, 2, 400, 1/2", "Usable quantity required for the recipe."],
    ["Unit", "Yes", "LB, OZ, KG, G, CUP, TBSP, TSP, LADLE, GAL, L, ML, PIECES", "Culinary or standard unit of measure."],
    ["Prep Loss %", "No", "e.g. 10 (for 10% peeling/trim loss)", "Fraction of raw ingredient lost during prep."],
    ["Notes", "No", "e.g. Diced, peeled, freshly chopped", "Culinary preparation notes or instructions."],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

  // Sample Recipe Data Sheet
  const recipeData = [
    [
      "Recipe Name",
      "Recipe Type",
      "Batch Yield",
      "Yield Unit",
      "Ingredient / SKU",
      "Quantity",
      "Unit",
      "Prep Loss %",
      "Notes",
    ],
    // Dish 1
    ["Signature Truffle Burger", "DISH", 1, "PORTION", "USDA Prime Ribeye Beef", 0.5, "LB", 5, "Ground for patty"],
    ["Signature Truffle Burger", "DISH", 1, "PORTION", "Artisan Brioche Buns", 1, "PIECES", 0, "Toasted with butter"],
    ["Signature Truffle Burger", "DISH", 1, "PORTION", "House Truffle Butter Marinade", 1, "LADLE", 0, "Drizzled over burger"],
    ["Signature Truffle Burger", "DISH", 1, "PORTION", "Roma Tomatoes", 2, "OZ", 10, "Sliced thin"],
    // Sub-Recipe 1
    ["House Truffle Butter Marinade", "SUB_RECIPE", 1, "GAL", "Unsalted Butter", 4, "LB", 0, "Clarified"],
    ["House Truffle Butter Marinade", "SUB_RECIPE", 1, "GAL", "Black Truffle Oil", 16, "FL_OZ", 0, "Whisked into warm butter"],
    ["House Truffle Butter Marinade", "SUB_RECIPE", 1, "GAL", "Garlic Cloves", 8, "OZ", 15, "Peeled and minced"],
  ];
  const wsData = XLSX.utils.aoa_to_sheet(recipeData);
  XLSX.utils.book_append_sheet(wb, wsData, "Recipes");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * Parses an Excel or CSV file buffer and maps it into structured recipes.
 */
export function parseRecipeExcelFile(
  fileBuffer: Buffer | ArrayBuffer,
  options: {
    sheetName?: string;
    inventoryItems: InventoryItemLookup[];
    subRecipes: SubRecipeLookup[];
    existingRecipeNames: Set<string>;
    columnMapping?: Record<string, string>;
  }
): ExcelImportResult {
  const wb = XLSX.read(fileBuffer, { type: "buffer", cellFormula: false });
  const sheetNames = wb.SheetNames;
  const targetSheet = options.sheetName && sheetNames.includes(options.sheetName)
    ? options.sheetName
    : sheetNames.includes("Recipes")
    ? "Recipes"
    : sheetNames[0];

  const ws = wb.Sheets[targetSheet];
  if (!ws) {
    return {
      sheetNames,
      selectedSheet: targetSheet,
      totalRowsProcessed: 0,
      groupedRecipes: [],
      globalErrors: [`Sheet "${targetSheet}" not found in uploaded file`],
    };
  }

  // Convert sheet to JSON rows safely
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
  const importRows: ExcelImportRow[] = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const raw = rawRows[idx];
    const rowNum = idx + 2; // 1-indexed, skipping header row

    // Find column values using column mapping or exact/fuzzy column keys
    const getVal = (logicalKey: string, keyAliases: string[]): string => {
      if (options.columnMapping && options.columnMapping[logicalKey]) {
        const mappedCol = options.columnMapping[logicalKey];
        if (raw[mappedCol] !== undefined && raw[mappedCol] !== "") {
          return String(raw[mappedCol]).trim();
        }
      }

      for (const k of Object.keys(raw)) {
        const cleanK = k.toLowerCase().replace(/[^\w]/g, "");
        for (const alias of keyAliases) {
          if (cleanK === alias.toLowerCase().replace(/[^\w]/g, "")) {
            return String(raw[k]).trim();
          }
        }
      }
      return "";
    };

    const recipeName = getVal("recipeName", ["Recipe Name", "Recipe", "Name", "Dish", "Formula", "Formula Name"]);
    const rawType = getVal("recipeType", ["Recipe Type", "Type", "Category"]).toUpperCase();
    const recipeType: "DISH" | "SUB_RECIPE" =
      rawType.includes("SUB") || rawType.includes("PREP") ? "SUB_RECIPE" : "DISH";

    const rawYield = getVal("yieldQuantity", ["Batch Yield", "Yield", "Yield Qty", "Servings"]);
    const batchYield = parseKitchenNumber(rawYield) || 1;

    const rawYieldUnit = getVal("yieldUnit", ["Yield Unit", "Yield UOM", "Portion Unit"]).toLowerCase();
    const yieldUnit: UnitOfMeasure = UNIT_ALIAS_MAP[rawYieldUnit] || "PORTION";

    const ingredientNameOrSku = getVal("ingredientIdentifier", [
      "Ingredient / SKU",
      "Ingredient",
      "SKU",
      "Item",
      "Ingredient Name",
      "Raw Item SKU / Name",
    ]);

    const rawQty = getVal("quantity", ["Quantity", "Qty", "Amount", "Required Qty"]);
    const quantity = parseKitchenNumber(rawQty) || 0;

    const rawUnit = getVal("unit", ["Unit", "Unit of Measure", "UOM", "UoM"]).toLowerCase();
    const unit: UnitOfMeasure = UNIT_ALIAS_MAP[rawUnit] || "PIECES";

    const rawLoss = getVal("prepLossPercent", ["Prep Loss %", "Prep Loss", "Wastage", "Loss %", "Waste %", "Trim Loss %"]);
    const prepLossPercent = Math.min(99.9, Math.max(0, parseFloat(rawLoss) || 0));

    const notes = getVal("notes", ["Notes", "Preparation Notes", "Instructions", "Line Notes"]);

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!recipeName) errors.push("Missing Recipe Name");
    if (!ingredientNameOrSku) errors.push("Missing Ingredient Name or SKU");
    if (quantity <= 0) errors.push("Quantity must be greater than 0");

    // Match ingredient against catalogue
    let matchedComponent: MatchedComponentResult | null = null;
    if (ingredientNameOrSku) {
      matchedComponent = matchIngredientToCatalogue(
        {
          originalText: `${quantity} ${unit} ${ingredientNameOrSku}`,
          name: ingredientNameOrSku,
          quantity,
          unitOfMeasure: unit,
          prepLossPercent,
          isUnresolved: false,
        },
        options.inventoryItems,
        options.subRecipes
      );

      if (!matchedComponent) {
        warnings.push(`Unmatched ingredient "${ingredientNameOrSku}". Will require manual mapping before publish.`);
      } else if (!matchedComponent.isUnitCompatible) {
        errors.push(matchedComponent.unitCompatibilityError || "Incompatible unit of measure");
      }
    }

    importRows.push({
      sheetName: targetSheet,
      rowNumber: rowNum,
      recipeName: recipeName || "Untitled Recipe",
      recipeType,
      batchYield,
      yieldUnit,
      ingredientNameOrSku,
      quantity,
      unit,
      prepLossPercent,
      notes: notes || undefined,
      matchedComponent,
      isValid: errors.length === 0,
      errors,
      warnings,
    });
  }

  // Group rows by Recipe Name
  const groupsMap = new Map<string, ExcelImportRow[]>();
  for (const row of importRows) {
    const list = groupsMap.get(row.recipeName) || [];
    list.push(row);
    groupsMap.set(row.recipeName, list);
  }

  const groupedRecipes: GroupedRecipeImport[] = [];
  const normalizedExisting = new Set(
    Array.from(options.existingRecipeNames).map((n) => n.trim().toLowerCase())
  );
  for (const [rName, rRows] of groupsMap.entries()) {
    const firstRow = rRows[0];
    const isExisting = normalizedExisting.has(rName.trim().toLowerCase());
    const hasRowErrors = rRows.some((r) => !r.isValid);

    groupedRecipes.push({
      recipeName: rName,
      recipeType: firstRow.recipeType,
      batchYield: firstRow.batchYield,
      yieldUnit: firstRow.yieldUnit,
      rows: rRows,
      isValid: !hasRowErrors && rRows.length > 0,
      isExisting,
    });
  }

  return {
    sheetNames,
    selectedSheet: targetSheet,
    totalRowsProcessed: importRows.length,
    groupedRecipes,
    globalErrors: [],
  };
}
