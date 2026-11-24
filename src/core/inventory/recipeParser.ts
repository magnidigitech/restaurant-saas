import { UnitOfMeasure } from "@prisma/client";
import { UNIT_DEFINITIONS, canConvertUnits, convertQuantity } from "./units";

export interface ParsedIngredientLine {
  originalText: string;
  name: string;
  quantity: number | null;
  unitOfMeasure: UnitOfMeasure | null;
  statedUnitRaw?: string;
  statedQuantityRaw?: string;
  prepNotes?: string;
  prepLossPercent: number;
  isMultipack?: boolean;
  multipackCount?: number;
  multipackSize?: number;
  multipackUnit?: string;
  multipackContainer?: string;
  isRange?: boolean;
  rangeMin?: number;
  rangeMax?: number;
  isToTaste?: boolean;
  isUnresolved: boolean;
  unresolvedReason?: string;
  ladleInfo?: string;
}

export interface ParsedRecipeDocument {
  title: string;
  type: "DISH" | "SUB_RECIPE";
  yieldQuantity: number;
  yieldUnit: UnitOfMeasure;
  servingSize?: string;
  prepTimeMin?: number;
  ingredients: ParsedIngredientLine[];
  instructions: string;
  rawText: string;
}

// Map common unicode & kitchen fraction representations
const FRACTION_MAP: Record<string, number> = {
  "½": 0.5,
  "⅓": 0.3333,
  "⅔": 0.6667,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 0.1667,
  "⅚": 0.8333,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

// Unit aliases mapped to Prisma UnitOfMeasure enum
export const UNIT_ALIAS_MAP: Record<string, UnitOfMeasure> = {
  // Weight
  lb: "LB",
  lbs: "LB",
  pound: "LB",
  pounds: "LB",
  oz: "OZ",
  ounce: "OZ",
  ounces: "OZ",
  kg: "KG",
  kgs: "KG",
  kilogram: "KG",
  kilograms: "KG",
  g: "G",
  gm: "G",
  gms: "G",
  gram: "G",
  grams: "G",

  // Volume
  gal: "GAL",
  gallon: "GAL",
  gallons: "GAL",
  "us gal": "GAL",
  "imp gal": "IMP_GAL",
  "imperial gallon": "IMP_GAL",
  qt: "QT",
  quart: "QT",
  quarts: "QT",
  pt: "PT",
  pint: "PT",
  pints: "PT",
  cup: "CUP",
  cups: "CUP",
  c: "CUP",
  "fl oz": "FL_OZ",
  "fluid oz": "FL_OZ",
  "fluid ounce": "FL_OZ",
  "fluid ounces": "FL_OZ",
  floz: "FL_OZ",
  tbsp: "TBSP",
  tbs: "TBSP",
  tablespoon: "TBSP",
  tablespoons: "TBSP",
  tsp: "TSP",
  teaspoon: "TSP",
  teaspoons: "TSP",
  ladle: "LADLE",
  ladles: "LADLE",
  l: "L",
  liter: "L",
  liters: "L",
  litre: "L",
  litres: "L",
  ml: "ML",
  milliliter: "ML",
  milliliters: "ML",
  millilitre: "ML",
  millilitres: "ML",

  // Count & Portions
  piece: "PIECES",
  pieces: "PIECES",
  pc: "PIECES",
  pcs: "PIECES",
  each: "EACH",
  ea: "EACH",
  clove: "PIECES",
  cloves: "PIECES",
  slice: "PIECES",
  slices: "PIECES",
  bun: "PIECES",
  buns: "PIECES",
  patty: "PIECES",
  patties: "PIECES",
  sprig: "PIECES",
  sprigs: "PIECES",
  stalk: "PIECES",
  stalks: "PIECES",
  head: "PIECES",
  heads: "PIECES",
  doz: "DOZEN",
  dozen: "DOZEN",
  portion: "PORTION",
  portions: "PORTION",
  serving: "PORTION",
  servings: "PORTION",
  box: "BOX",
  boxes: "BOX",
  packet: "PACKET",
  packets: "PACKET",
  pkt: "PACKET",
  pkts: "PACKET",
};

/**
 * Parses numeric strings including decimals, mixed fractions ("1 1/2", "1½"), or raw fractions ("3/4").
 */
export function parseKitchenNumber(str: string): number | null {
  if (!str) return null;
  const s = str.trim();

  // Check unicode fractions alone or with whole number, e.g. "1½" or "½"
  for (const [char, val] of Object.entries(FRACTION_MAP)) {
    if (s.includes(char)) {
      const parts = s.split(char);
      const whole = parts[0].trim() ? parseFloat(parts[0]) : 0;
      if (!isNaN(whole)) {
        return whole + val;
      }
    }
  }

  // Check ASCII fractions e.g. "1 1/2" or "3/4"
  if (s.includes("/")) {
    const spaceParts = s.split(/\s+/);
    if (spaceParts.length === 2 && spaceParts[1].includes("/")) {
      const whole = parseFloat(spaceParts[0]);
      const [num, den] = spaceParts[1].split("/").map(Number);
      if (!isNaN(whole) && !isNaN(num) && !isNaN(den) && den !== 0) {
        return whole + num / den;
      }
    } else if (spaceParts.length === 1 && spaceParts[0].includes("/")) {
      const [num, den] = spaceParts[0].split("/").map(Number);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return num / den;
      }
    }
  }

  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

/**
 * Parses an individual ingredient line from a kitchen recipe.
 */
export function parseIngredientLine(rawLine: string): ParsedIngredientLine {
  const line = rawLine.trim().replace(/^[-*•]\s*/, ""); // Strip bullet points
  if (!line) {
    return {
      originalText: rawLine,
      name: "",
      quantity: null,
      unitOfMeasure: null,
      prepLossPercent: 0,
      isUnresolved: true,
      unresolvedReason: "Empty ingredient line",
    };
  }

  // 1. "to taste" check (e.g. "Salt to taste", "black pepper to taste")
  if (/\bto\s+taste\b/i.test(line)) {
    const cleanName = line.replace(/\bto\s+taste\b/gi, "").replace(/[,;]/g, "").trim();
    return {
      originalText: line,
      name: cleanName || line,
      quantity: null,
      unitOfMeasure: null,
      statedQuantityRaw: "to taste",
      isToTaste: true,
      prepLossPercent: 0,
      isUnresolved: true,
      unresolvedReason: '"to taste" requires an explicit quantity for inventory stock tracking and costing',
    };
  }

  // 2. Range check (e.g. "2–3 cloves garlic", "2-3 cloves garlic", "2 to 3 cloves garlic")
  const rangeMatch = line.match(/^(\d+[\u00BC-\u00BE\u2150-\u215E]|\d+\s+[\u00BC-\u00BE\u2150-\u215E]|[\u00BC-\u00BE\u2150-\u215E]|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(?:-|–|—|\bto\b)\s*(\d+[\u00BC-\u00BE\u2150-\u215E]|\d+\s+[\u00BC-\u00BE\u2150-\u215E]|[\u00BC-\u00BE\u2150-\u215E]|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s+(.*)$/i);
  if (rangeMatch) {
    const minVal = parseKitchenNumber(rangeMatch[1]);
    const maxVal = parseKitchenNumber(rangeMatch[2]);
    const remainder = rangeMatch[3].trim();

    // Check if remainder starts with a unit
    const words = remainder.split(/\s+/);
    const firstWord = words[0].toLowerCase().replace(/[,.:]$/, "");
    const matchedUnit = UNIT_ALIAS_MAP[firstWord] || null;
    const namePart = matchedUnit ? words.slice(1).join(" ") : remainder;

    return {
      originalText: line,
      name: namePart.trim() || remainder,
      quantity: null, // Range requires exact specification
      unitOfMeasure: matchedUnit,
      statedUnitRaw: matchedUnit ? firstWord : undefined,
      statedQuantityRaw: `${rangeMatch[1]}–${rangeMatch[2]}`,
      isRange: true,
      rangeMin: minVal || undefined,
      rangeMax: maxVal || undefined,
      prepLossPercent: 0,
      isUnresolved: true,
      unresolvedReason: `Quantity range "${rangeMatch[1]}–${rangeMatch[2]}" must be specified as an exact number for inventory depletion`,
    };
  }

  // 3. Multipack check (e.g. "2 x 400 g cans chopped tomatoes" or "2 × 400g can chopped tomatoes" or "3 x 15 oz cans black beans")
  const multiPackMatch = line.match(/^(\d+(?:[.,]\d+)?|\d*\s*[\u00BC-\u00BE\u2150-\u215E])\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?\s+(?:cans?|tins?|bags?|boxes?|jars?|packs?|cartons?)\s+(?:of\s+)?(.*)$/i);
  if (multiPackMatch) {
    const count = parseKitchenNumber(multiPackMatch[1]) || 1;
    const size = parseKitchenNumber(multiPackMatch[2]) || 0;
    const rawUnit = (multiPackMatch[3] || "G").toLowerCase();
    const resolvedUnit = UNIT_ALIAS_MAP[rawUnit] || "G";
    const totalQty = count * size;
    const ingredientName = multiPackMatch[4].trim();

    return {
      originalText: line,
      name: ingredientName,
      quantity: totalQty,
      unitOfMeasure: resolvedUnit,
      statedQuantityRaw: `${count} × ${size} ${rawUnit}`,
      statedUnitRaw: rawUnit,
      isMultipack: true,
      multipackCount: count,
      multipackSize: size,
      multipackUnit: resolvedUnit,
      multipackContainer: "can",
      prepLossPercent: 0,
      isUnresolved: false,
    };
  }

  // 4. Multi-Unit compound check (e.g. "1 cup + 2 tbsp cream" or "1 cup plus 2 tbsp cream")
  const compoundMatch = line.match(/^(\d+(?:[.,]\d+)?|\d*\s*[\u00BC-\u00BE\u2150-\u215E]|\d+\/\d+)\s*([a-zA-Z]+)\s*(?:\+|\bplus\b)\s*(\d+(?:[.,]\d+)?|\d*\s*[\u00BC-\u00BE\u2150-\u215E]|\d+\/\d+)\s*([a-zA-Z]+)\s+(.*)$/i);
  if (compoundMatch) {
    const q1 = parseKitchenNumber(compoundMatch[1]) || 0;
    const u1Raw = compoundMatch[2].toLowerCase();
    const u1 = UNIT_ALIAS_MAP[u1Raw];

    const q2 = parseKitchenNumber(compoundMatch[3]) || 0;
    const u2Raw = compoundMatch[4].toLowerCase();
    const u2 = UNIT_ALIAS_MAP[u2Raw];

    const ingName = compoundMatch[5].trim();

    if (u1 && u2 && canConvertUnits(u2, u1)) {
      const convertedQ2 = convertQuantity(q2, u2, u1);
      const combinedQty = Number((q1 + convertedQ2).toFixed(4));
      return {
        originalText: line,
        name: ingName,
        quantity: combinedQty,
        unitOfMeasure: u1,
        statedQuantityRaw: `${q1} ${u1Raw} + ${q2} ${u2Raw}`,
        statedUnitRaw: u1Raw,
        prepLossPercent: 0,
        isUnresolved: false,
      };
    }
  }

  // 5. Standard Kitchen Line Parsing (e.g. "1½ lb Roma tomatoes, diced" or "2 ladles house gravy")
  // Extract prep notes separated by comma if present (e.g. ", diced", ", peeled and minced")
  let prepNotes: string | undefined = undefined;
  let workingLine = line;
  if (workingLine.includes(",")) {
    const commaIndex = workingLine.indexOf(",");
    prepNotes = workingLine.slice(commaIndex + 1).trim();
    workingLine = workingLine.slice(0, commaIndex).trim();
  }

  // Match: Quantity (decimal, mixed fraction, unicode fraction) + optional unit + item name
  // Example matches: "1½ lb", "1 1/2 lb", "1.5 kg", "2 ladles", "2", "1/2 cup"
  const standardMatch = workingLine.match(/^(\d+[\u00BC-\u00BE\u2150-\u215E]|\d+\s+[\u00BC-\u00BE\u2150-\u215E]|[\u00BC-\u00BE\u2150-\u215E]|\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(.*)$/);

  if (!standardMatch) {
    // No leading quantity detected (e.g. "Fresh basil leaves")
    return {
      originalText: line,
      name: workingLine,
      quantity: null,
      unitOfMeasure: null,
      prepNotes,
      prepLossPercent: 0,
      isUnresolved: true,
      unresolvedReason: "No quantity detected on line; exact amount required for stock tracking",
    };
  }

  const rawQtyStr = standardMatch[1].trim();
  const parsedQty = parseKitchenNumber(rawQtyStr);
  const afterQty = standardMatch[2].trim();

  // Inspect first word of remainder for recognized unit
  const tokens = afterQty.split(/\s+/);
  const candidateUnit = tokens[0]?.toLowerCase().replace(/[,.:]$/, "");
  const matchedUOM = UNIT_ALIAS_MAP[candidateUnit];

  let finalName = "";
  let finalUOM: UnitOfMeasure | null = null;
  let statedUnitRaw: string | undefined = undefined;
  let ladleInfo: string | undefined = undefined;

  if (matchedUOM) {
    finalUOM = matchedUOM;
    statedUnitRaw = candidateUnit;
    finalName = tokens.slice(1).join(" ").trim();
    if (matchedUOM === "LADLE") {
      ladleInfo = "Configured kitchen ladle: 4 fl oz scoop (~118 ml / 32 ladles per US gallon)";
    }
  } else {
    // If no explicit unit word, default to PIECES (e.g. "2 eggs", "3 burger buns")
    finalUOM = "PIECES";
    statedUnitRaw = "pieces";
    finalName = afterQty;
  }

  return {
    originalText: line,
    name: finalName || workingLine,
    quantity: parsedQty,
    unitOfMeasure: finalUOM,
    statedQuantityRaw: rawQtyStr,
    statedUnitRaw,
    prepNotes,
    prepLossPercent: 0,
    isUnresolved: parsedQty === null || !finalName,
    unresolvedReason:
      parsedQty === null
        ? "Could not parse quantity"
        : !finalName
        ? "Missing ingredient name"
        : undefined,
    ladleInfo,
  };
}

/**
 * Parses an entire pasted recipe text block containing title, yield, ingredient lines, and instructions.
 */
export function parsePastedRecipeText(rawText: string): ParsedRecipeDocument {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim());
  let title = "Untitled Recipe";
  let yieldQty = 1;
  let yieldUnit: UnitOfMeasure = "PORTION";
  let prepTimeMin: number | undefined = undefined;
  const ingredients: ParsedIngredientLine[] = [];
  const instructionsLines: string[] = [];

  enum Section {
    HEADER,
    INGREDIENTS,
    INSTRUCTIONS,
  }

  let currentSection = Section.HEADER;
  let headerTitleFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Detect Section Headers
    if (/^(?:ingredients|formula|bill of materials|bom):?$/i.test(line)) {
      currentSection = Section.INGREDIENTS;
      continue;
    }
    if (/^(?:instructions|method|directions|preparation|steps|procedure):?$/i.test(line)) {
      currentSection = Section.INSTRUCTIONS;
      continue;
    }

    // Check for yield/servings
    const yieldMatch = line.match(/^(?:yield|servings|makes|portions):\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?/i);
    if (yieldMatch) {
      const q = parseFloat(yieldMatch[1]);
      if (!isNaN(q) && q > 0) yieldQty = q;
      const rawUnit = (yieldMatch[2] || "").toLowerCase();
      if (rawUnit && UNIT_ALIAS_MAP[rawUnit]) {
        yieldUnit = UNIT_ALIAS_MAP[rawUnit];
      }
      continue;
    }

    // Check for prep time
    const prepMatch = line.match(/^(?:prep time|prep|cooking time|time):\s*(\d+)\s*(?:min|mins|minutes)?/i);
    if (prepMatch) {
      const t = parseInt(prepMatch[1], 10);
      if (!isNaN(t)) prepTimeMin = t;
      continue;
    }

    if (currentSection === Section.HEADER) {
      if (!headerTitleFound) {
        title = line.replace(/^[#*]+\s*/, "").replace(/[:]+$/, "").trim();
        headerTitleFound = true;
      } else {
        // If it starts with a quantity or bullet point, transition to INGREDIENTS
        if (/^[-*•]|\d+/.test(line)) {
          currentSection = Section.INGREDIENTS;
          ingredients.push(parseIngredientLine(line));
        }
      }
    } else if (currentSection === Section.INGREDIENTS) {
      // If numbered instruction e.g. "1. Sear patties", switch to instructions
      if (/^\d+\.\s+[A-Z]/.test(line) && !/\b(?:lb|oz|g|kg|cup|tbsp|tsp|ladle|cans?)\b/i.test(line)) {
        currentSection = Section.INSTRUCTIONS;
        instructionsLines.push(line);
      } else {
        ingredients.push(parseIngredientLine(line));
      }
    } else if (currentSection === Section.INSTRUCTIONS) {
      instructionsLines.push(line);
    }
  }

  // Determine Recipe Type heuristic: if yieldUnit is PORTION or title says Dish, DISH; otherwise check
  const isPrep = /sauce|gravy|dressing|marinade|paste|stock|broth|batch|prep/i.test(title);
  const type = isPrep ? "SUB_RECIPE" : "DISH";

  return {
    title,
    type,
    yieldQuantity: yieldQty,
    yieldUnit,
    prepTimeMin,
    ingredients,
    instructions: instructionsLines.join("\n").trim(),
    rawText,
  };
}
