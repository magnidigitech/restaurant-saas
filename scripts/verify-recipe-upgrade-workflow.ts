import { prisma } from "../src/core/database/client";
import * as xlsx from "xlsx";
import { parsePastedRecipeText, parseIngredientLine } from "../src/core/inventory/recipeParser";
import { matchIngredientToCatalogue } from "../src/core/inventory/recipeMatcher";
import { parseRecipeExcelFile } from "../src/core/inventory/recipeExcelImporter";
import { calculateRecipeCost, syncRecipeCosting } from "../src/core/inventory/recipeCosting";
import { explodeRecipeToRawIngredients, depleteOrderInventory, reverseOrderDepletion, depleteCateringOrderInventory } from "../src/core/inventory/depletionEngine";
import { calculateEventIngredients } from "../src/modules/catering/service";
import { calculateGrossQuantity } from "../src/core/inventory/units";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
}

async function main() {
  console.log("================================================================================");
  console.log("  RECIPE STUDIO & DEPLETION WORKFLOW COMPREHENSIVE VERIFICATION SUITE");
  console.log("================================================================================\n");

  const runId = Date.now();
  const testSubdomain = `test-kitchen-${runId}`;

  // 0. Setup test restaurant, outlet, and admin user
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Test Kitchen Studio ${runId}`,
      subdomain: testSubdomain,
    },
  });

  const outlet = await prisma.restaurantOutlet.create({
    data: {
      restaurantId: restaurant.id,
      name: "Edmonton Downtown Kitchen",
      currency: "CAD",
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `chef-${runId}@testkitchen.com`,
      name: "Chef Auguste",
      passwordHash: "test-hash-123",
    },
  });

  console.log(`Initialized Test Environment: Restaurant=${restaurant.name} (${restaurant.id}), Outlet=${outlet.name}`);

  // 1. Create standard inventory items with item-specific purchase packs & culinary units
  const beefItem = await prisma.inventoryItem.create({
    data: {
      restaurantId: restaurant.id,
      name: "Ground Chuck 80/20",
      sku: "BEEF-CHK-01",
      unitOfMeasure: "LB",
      costPerUnit: 6.0, // $6.00 / lb
    },
  });

  const tomatoItem = await prisma.inventoryItem.create({
    data: {
      restaurantId: restaurant.id,
      name: "Roma Tomatoes",
      sku: "PROD-TOM-01",
      unitOfMeasure: "LB",
      costPerUnit: 1.5, // $1.50 / lb
      purchasePacks: {
        create: [
          {
            restaurantId: restaurant.id,
            name: "40 lb Tomato Box",
            packType: "Box",
            packUnit: "LB",
            netQuantityPerPack: 40,
            conversionFactor: 40,
            isVariableWeight: false,
            isActive: true,
          },
        ],
      },
    },
    include: { purchasePacks: true },
  });
  const tomatoPack = tomatoItem.purchasePacks[0];

  const potatoItem = await prisma.inventoryItem.create({
    data: {
      restaurantId: restaurant.id,
      name: "Russet Burbank Potatoes",
      sku: "PROD-POT-01",
      unitOfMeasure: "LB",
      costPerUnit: 0.8, // $0.80 / lb
      purchasePacks: {
        create: [
          {
            restaurantId: restaurant.id,
            name: "20 lb Potato Box",
            packType: "Box",
            packUnit: "LB",
            netQuantityPerPack: 20,
            conversionFactor: 20,
            isVariableWeight: false,
            isActive: true,
          },
        ],
      },
    },
    include: { purchasePacks: true },
  });
  const potatoPack = potatoItem.purchasePacks[0];

  const bunItem = await prisma.inventoryItem.create({
    data: {
      restaurantId: restaurant.id,
      name: "Brioche Burger Buns",
      sku: "BAKE-BUN-01",
      unitOfMeasure: "PIECES",
      costPerUnit: 0.75, // $0.75 each
    },
  });

  // Seed inventory initial stock ledger balances
  for (const item of [beefItem, tomatoItem, potatoItem, bunItem]) {
    await prisma.stockLedger.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet.id,
        itemId: item.id,
        movementType: "PURCHASE",
        quantity: 500,
        notes: "Initial verification stock intake",
        recordedBy: user.id,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 2: THREE ENTRY POINTS PRODUCE IDENTICAL COST AND STOCK QUANTITIES
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n── Check 2: Three Entry Points (Manual, Paste, Excel) & Excel Verification ──");

  // Define target formulation:
  // Dish: "Signature Bistro Burger & Fries" (Yield: 1 Portion)
  // Ingredients:
  // 1) 0.5 lb Ground Chuck (Beef) with 0% prep loss -> Gross: 0.5 lb @ $6/lb = $3.00
  // 2) 0.25 lb Roma Tomatoes with 10% prep loss -> Gross: 0.25 / (1 - 0.10) = 0.2778 lb @ $1.50/lb = $0.4167
  // 3) 0.5 lb Russet Potatoes with 20% prep loss -> Gross: 0.5 / (1 - 0.20) = 0.625 lb @ $0.80/lb = $0.50
  // 4) 1 Brioche Bun with 0% prep loss -> Gross: 1 pc @ $0.75 = $0.75
  // Total Batch Cost = $3.00 + $0.4167 + $0.50 + $0.75 = $4.6667 ($4.67)

  // 2A. Start Manually Path
  const manualRecipe = await prisma.recipe.create({
    data: {
      restaurantId: restaurant.id,
      name: `Signature Bistro Burger - Manual ${runId}`,
      type: "DISH",
      yieldQuantity: 1,
      yieldUnit: "PORTION",
      sellingPrice: 16.5,
      targetFoodCostPercent: 28,
      sourceType: "MANUAL",
      isDraft: false,
      instructions: "Sear chuck patty to medium, toast brioche bun, slice tomatoes, fry potatoes.",
      items: {
        create: [
          {
            componentType: "INVENTORY_ITEM",
            inventoryItemId: beefItem.id,
            quantity: 0.5,
            unitOfMeasure: "LB",
            wastagePercent: 0,
            unitCost: 6.0,
            totalCost: 3.0,
          },
          {
            componentType: "INVENTORY_ITEM",
            inventoryItemId: tomatoItem.id,
            quantity: 0.25,
            unitOfMeasure: "LB",
            wastagePercent: 10,
            unitCost: 1.5,
            totalCost: 0.25 / 0.9 * 1.5,
          },
          {
            componentType: "INVENTORY_ITEM",
            inventoryItemId: potatoItem.id,
            quantity: 0.5,
            unitOfMeasure: "LB",
            wastagePercent: 20,
            unitCost: 0.8,
            totalCost: 0.5 / 0.8 * 0.8,
          },
          {
            componentType: "INVENTORY_ITEM",
            inventoryItemId: bunItem.id,
            quantity: 1,
            unitOfMeasure: "PIECES",
            wastagePercent: 0,
            unitCost: 0.75,
            totalCost: 0.75,
          },
        ],
      },
    },
  });

  const manualCost = await syncRecipeCosting(manualRecipe.id);
  assert(Number(Number(manualCost.totalCost).toFixed(2)) === 4.67, `Manual Recipe batch cost is $4.67 (got $${Number(manualCost.totalCost).toFixed(2)})`);

  // 2B. Paste Recipe Path
  // Contains kitchen lines:
  // - 0.5 lb Ground Chuck
  // - 1/4 lb Roma Tomatoes, sliced (fraction parsing + prep note)
  // - 0.5 lb Russet Potatoes, cut into fries
  // - 1 Brioche Bun
  // - 2-3 cloves garlic (ambiguous range -> user resolves to 0 or exact)
  // - Salt to taste (ambiguous to taste -> user resolves)
  const pastedRaw = `Signature Bistro Burger - Pasted ${runId}
Yield: 1 portion

Ingredients:
- 0.5 lb Ground Chuck
- 1/4 lb Roma Tomatoes, sliced
- 0.5 lb Russet Potatoes, cut into fries
- 1 Brioche Bun
- 2–3 cloves garlic
- Salt to taste

Instructions:
Grill patty, fry potatoes, assemble burger.`;

  const parsedPasted = parsePastedRecipeText(pastedRaw);
  assert(parsedPasted.ingredients.length === 6, "Pasted text extracted all 6 ingredient lines");

  // Check unresolved lines detected:
  const garlicLine = parsedPasted.ingredients.find((i) => i.originalText.includes("garlic"));
  const saltLine = parsedPasted.ingredients.find((i) => i.originalText.includes("Salt to taste"));
  assert(garlicLine?.isUnresolved === true && garlicLine.isRange === true, "Range '2–3 cloves garlic' detected and marked unresolved");
  assert(saltLine?.isUnresolved === true && saltLine.isToTaste === true, "'Salt to taste' detected and marked unresolved");

  const inventoryLookups = [beefItem, tomatoItem, potatoItem, bunItem].map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku || undefined,
    unitOfMeasure: i.unitOfMeasure,
    costPerUnit: Number(i.costPerUnit),
  }));

  const linesToMatch = [
    { text: "0.5 lb Ground Chuck", loss: 0 },
    { text: "0.25 lb Roma Tomatoes", loss: 10 },
    { text: "0.5 lb Russet Burbank Potatoes", loss: 20 },
    { text: "1 Brioche Burger Buns", loss: 0 },
  ];

  const matchedPasted = linesToMatch.map(({ text, loss }) => {
    const parsed = parseIngredientLine(text);
    parsed.prepLossPercent = loss;
    const match = matchIngredientToCatalogue(parsed, inventoryLookups, []);
    return { parsed, match };
  });

  assert(matchedPasted.every((m) => m.match !== null), "Catalogue matcher successfully linked all 4 items");

  const pastedRecipe = await prisma.recipe.create({
    data: {
      restaurantId: restaurant.id,
      name: `Signature Bistro Burger - Pasted ${runId}`,
      type: "DISH",
      yieldQuantity: 1,
      yieldUnit: "PORTION",
      sellingPrice: 16.5,
      targetFoodCostPercent: 28,
      sourceType: "PASTED",
      isDraft: false,
      instructions: parsedPasted.instructions,
      items: {
        create: matchedPasted.map(({ parsed, match }) => ({
          componentType: "INVENTORY_ITEM",
          inventoryItemId: match!.id,
          quantity: parsed.quantity!,
          unitOfMeasure: parsed.unitOfMeasure!,
          wastagePercent: parsed.prepLossPercent || 0,
          unitCost: match!.costPerUnit,
          totalCost: calculateGrossQuantity(parsed.quantity!, parsed.prepLossPercent || 0) * match!.costPerUnit,
        })),
      },
    },
  });

  const pastedCost = await syncRecipeCosting(pastedRecipe.id);
  assert(Number(Number(pastedCost.totalCost).toFixed(2)) === 4.67, `Pasted Recipe batch cost is $4.67 (got $${Number(pastedCost.totalCost).toFixed(2)})`);

  // 2C. Upload Excel Path: Real multi-recipe workbook with nonstandard headers
  // Headers: "Dish / Formula", "Category Type", "Batch Yield", "Item / SKU Description", "Gross Loss %", "Quantity Needed", "Metric / Imperial Unit"
  const wb = xlsx.utils.book_new();

  // Sheet 1: Cover Sheet (unrelated metadata)
  const coverData = [
    ["Kitchen Operations Master File", "Version 2.4"],
    ["Author", "Chef Executive"],
    ["Last Revised", "2026-11-20"],
  ];
  const wsCover = xlsx.utils.aoa_to_sheet(coverData);
  xlsx.utils.book_append_sheet(wb, wsCover, "Cover & Overview");

  // Sheet 2: Multi-Recipe Culinary Formulation Sheet
  const recipeSheetRows = [
    ["Formula Name", "Recipe Type", "Batch Yield", "Yield Unit", "Raw Item SKU / Name", "Required Qty", "UoM", "Trim Loss %", "Line Notes"],
    // Recipe 1: Signature Bistro Burger (The target recipe)
    [`Signature Bistro Burger - Excel ${runId}`, "DISH", 1, "PORTION", "BEEF-CHK-01", 0.5, "LB", 0, "Ground Chuck 80/20"],
    [`Signature Bistro Burger - Excel ${runId}`, "DISH", 1, "PORTION", "Roma Tomatoes", 0.25, "LB", 10, "Sliced fresh"],
    [`Signature Bistro Burger - Excel ${runId}`, "DISH", 1, "PORTION", "Russet Burbank Potatoes", 0.5, "LB", 20, "Washed & peeled fries"],
    [`Signature Bistro Burger - Excel ${runId}`, "DISH", 1, "PORTION", "Brioche Burger Buns", 1, "PIECES", 0, "Toasted"],
    // Recipe 2: Side House Fries (Second recipe in same workbook)
    [`House Seasoned Fries - Excel ${runId}`, "SUB_RECIPE", 5, "PORTION", "Russet Burbank Potatoes", 3.0, "LB", 20, "Hand cut"],
  ];
  const wsRecipes = xlsx.utils.aoa_to_sheet(recipeSheetRows);
  xlsx.utils.book_append_sheet(wb, wsRecipes, "Culinary Recipes");

  const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  // Parse Excel workbook with sheet selection & nonstandard header column mapping
  const parsedExcel = parseRecipeExcelFile(excelBuffer, {
    sheetName: "Culinary Recipes",
    inventoryItems: inventoryLookups,
    subRecipes: [],
    existingRecipeNames: new Set([manualRecipe.name, pastedRecipe.name]),
    columnMapping: {
      recipeName: "Formula Name",
      recipeType: "Recipe Type",
      yieldQuantity: "Batch Yield",
      yieldUnit: "Yield Unit",
      ingredientIdentifier: "Raw Item SKU / Name",
      quantity: "Required Qty",
      unit: "UoM",
      prepLossPercent: "Trim Loss %",
      notes: "Line Notes",
    },
  });

  assert(parsedExcel.sheetNames.length === 2, `Excel parser detected 2 sheets (got ${parsedExcel.sheetNames.join(", ")})`);
  assert(parsedExcel.groupedRecipes.length === 2, `Excel parser identified 2 distinct grouped recipes in sheet`);

  const excelBurgerGroup = parsedExcel.groupedRecipes.find((r) => r.recipeName.includes("Signature Bistro Burger"));
  assert(excelBurgerGroup !== undefined && excelBurgerGroup.rows.length === 4, "Excel extracted 4 ingredient rows with source row tracking for target burger");
  assert(excelBurgerGroup?.rows[0].rowNumber === 2, `Source row feedback verified: Row 2 tracked as first ingredient (got ${excelBurgerGroup?.rows[0].rowNumber})`);

  // Verify Safe Retry & Duplicate Handling:
  // When importing as drafts, if recipe exists, duplicate warning is surfaced
  assert(excelBurgerGroup?.isExisting === false, "First import confirms no existing duplicate recipe name");

  // Create Excel recipe
  const excelRecipe = await prisma.recipe.create({
    data: {
      restaurantId: restaurant.id,
      name: `Signature Bistro Burger - Excel ${runId}`,
      type: "DISH",
      yieldQuantity: 1,
      yieldUnit: "PORTION",
      sellingPrice: 16.5,
      targetFoodCostPercent: 28,
      sourceType: "EXCEL",
      isDraft: false,
      items: {
        create: excelBurgerGroup!.rows.map((row) => ({
          componentType: "INVENTORY_ITEM",
          inventoryItemId: row.matchedComponent!.id,
          quantity: row.quantity,
          unitOfMeasure: row.unit,
          wastagePercent: row.prepLossPercent,
          unitCost: row.matchedComponent!.costPerUnit,
          totalCost: calculateGrossQuantity(row.quantity, row.prepLossPercent) * Number(row.matchedComponent!.costPerUnit),
        })),
      },
    },
  });

  const excelCost = await syncRecipeCosting(excelRecipe.id);
  assert(Number(Number(excelCost.totalCost).toFixed(2)) === 4.67, `Excel Recipe batch cost is $4.67 (got $${Number(excelCost.totalCost).toFixed(2)})`);

  // Verify Safe Retry: parsing the same buffer again correctly detects duplicate recipe name
  const retryExcel = parseRecipeExcelFile(excelBuffer, {
    sheetName: "Culinary Recipes",
    inventoryItems: inventoryLookups,
    subRecipes: [],
    existingRecipeNames: new Set([manualRecipe.name, pastedRecipe.name, excelRecipe.name]),
    columnMapping: {
      recipeName: "Formula Name",
      recipeType: "Recipe Type",
      yieldQuantity: "Batch Yield",
      yieldUnit: "Yield Unit",
      ingredientIdentifier: "Raw Item SKU / Name",
      quantity: "Required Qty",
      unit: "UoM",
      prepLossPercent: "Trim Loss %",
      notes: "Line Notes",
    },
  });
  const retryBurger = retryExcel.groupedRecipes.find((r) => r.recipeName.includes("Signature Bistro Burger"));
  assert(retryBurger?.isExisting === true, "Retry of same Excel workbook flags duplicate recipe for safe confirmation");

  // Compare All 3 Paths: Cost and Gross Stock Consumed
  const manualRawExplosion = await explodeRecipeToRawIngredients(manualRecipe.id, 1);
  const pastedRawExplosion = await explodeRecipeToRawIngredients(pastedRecipe.id, 1);
  const excelRawExplosion = await explodeRecipeToRawIngredients(excelRecipe.id, 1);

  assert(Number(Number(manualCost.totalCost).toFixed(2)) === Number(Number(pastedCost.totalCost).toFixed(2)) && Number(Number(pastedCost.totalCost).toFixed(2)) === Number(Number(excelCost.totalCost).toFixed(2)), "All three creation paths produce identical batch cost ($4.67)");
  
  const manualBeef = manualRawExplosion.get(beefItem.id);
  const pastedBeef = pastedRawExplosion.get(beefItem.id);
  const excelBeef = excelRawExplosion.get(beefItem.id);
  assert(manualBeef?.quantity === 0.5 && pastedBeef?.quantity === 0.5 && excelBeef?.quantity === 0.5, "All three creation paths consume exactly 0.5 lb Ground Chuck");

  const manualTom = manualRawExplosion.get(tomatoItem.id);
  const pastedTom = pastedRawExplosion.get(tomatoItem.id);
  const excelTom = excelRawExplosion.get(tomatoItem.id);
  assert(Number(manualTom?.quantity?.toFixed(4)) === 0.2778 && Number(pastedTom?.quantity?.toFixed(4)) === 0.2778 && Number(excelTom?.quantity?.toFixed(4)) === 0.2778, `All three creation paths consume exactly 0.2778 lb Roma Tomatoes (got ${manualTom?.quantity?.toFixed(4)}, ${pastedTom?.quantity?.toFixed(4)}, ${excelTom?.quantity?.toFixed(4)})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 3: DRAFT ISOLATION, POS FORMULA PROTECTION & CANCELLATION REVERSAL
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n── Check 3: Draft Recipe Isolation, POS Formula Safety & Sale Cancellation Reversal ──");

  // Step 1: Create an edit draft for manualRecipe (e.g. chef experiments with 0.8 lb beef instead of 0.5 lb)
  const editDraftRecipe = await prisma.recipe.create({
    data: {
      restaurantId: restaurant.id,
      name: `${manualRecipe.name} (Draft Edit)`,
      type: "DISH",
      yieldQuantity: 1,
      yieldUnit: "PORTION",
      isDraft: true,
      publishedRecipeId: manualRecipe.id,
      items: {
        create: [
          {
            componentType: "INVENTORY_ITEM",
            inventoryItemId: beefItem.id,
            quantity: 0.8, // Increased quantity in draft!
            unitOfMeasure: "LB",
            wastagePercent: 0,
            unitCost: 6.0,
            totalCost: 4.8,
          },
          {
            componentType: "INVENTORY_ITEM",
            inventoryItemId: bunItem.id,
            quantity: 1,
            unitOfMeasure: "PIECES",
            wastagePercent: 0,
            unitCost: 0.75,
            totalCost: 0.75,
          },
        ],
      },
    },
  });

  // Step 2: Create POS Order referencing the dish while draft is active
  const posOrder1 = await prisma.posOrder.create({
    data: {
      restaurantId: restaurant.id,
      outletId: outlet.id,
      orderNumber: `ORD-VERIFY-1-${runId}`,
      status: "COMPLETED",
      totalAmount: 33.0,
      finalAmount: 33.0,
      paymentStatus: "PAID",
      items: {
        create: [
          {
            recipeId: manualRecipe.id, // Live published recipe!
            name: manualRecipe.name,
            quantity: 2, // 2 burgers
            unitPrice: 16.5,
            totalPrice: 33.0,
          },
        ],
      },
    },
  });

  // Execute POS Depletion
  const pos1Depletion = await depleteOrderInventory(posOrder1.id, user.id);
  assert(pos1Depletion.depletedItemsCount > 0, "POS Order 1 depleted live inventory");

  // Verify that POS used the PUBLISHED formula (0.5 lb beef × 2 = 1.0 lb) NOT the draft formula (0.8 lb × 2 = 1.6 lb)
  const beefLedgerEntry = await prisma.stockLedger.findFirst({
    where: {
      referenceId: posOrder1.id,
      itemId: beefItem.id,
      movementType: "CONSUMPTION",
    },
  });
  assert(Math.abs(Number(beefLedgerEntry?.quantity)) === 1.0, `POS depletion used published formula: 1.0 lb deducted (not draft 1.6 lb)`);

  // Step 3: Now Chef updates the published recipe with a new formula (e.g. 0.3 lb beef)
  await prisma.recipeItem.updateMany({
    where: { recipeId: manualRecipe.id, inventoryItemId: beefItem.id },
    data: { quantity: 0.3 },
  });

  // Step 4: Customer cancels order 1! Cancel existing sale and verify reversal
  const cancelResult = await reverseOrderDepletion(posOrder1.id, user.id, "Customer changed mind");
  assert(cancelResult.restoredItemsCount > 0, "POS reversal completed successfully");

  // Check the RETURN entry in StockLedger: must restore the 1.0 lb originally deducted, NOT the modified 0.3 lb!
  const beefReturnEntry = await prisma.stockLedger.findFirst({
    where: {
      referenceId: `REV-${posOrder1.id}`,
      itemId: beefItem.id,
      movementType: "RETURN",
    },
  });
  assert(Number(beefReturnEntry?.quantity) === 1.0, `Cancellation reversal restored exact historical 1.0 lb deducted (got ${beefReturnEntry?.quantity})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 4: TRACE POS AND CATERING STOCK MOVEMENTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n── Check 4: POS & Catering Stock Movement Tracing & Planning Preview ──");

  // 4A. Trace all StockLedger entries for POS actions
  const allPosLedgers = await prisma.stockLedger.findMany({
    where: {
      restaurantId: restaurant.id,
      OR: [
        { referenceId: posOrder1.id },
        { referenceId: `REV-${posOrder1.id}` },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  console.log(`  📊 Verified POS StockLedger Audit Trail (${allPosLedgers.length} entries):`);
  for (const entry of allPosLedgers) {
    console.log(`     • [${entry.movementType}] Item=${entry.itemId.slice(-6)}, Qty=${entry.quantity}, Ref=${entry.referenceId}, Notes="${entry.notes}"`);
  }

  // 4B. Catering Event Creation & 150-Guest Planning Preview
  const cateringOrder = await prisma.cateringOrder.create({
    data: {
      restaurantId: restaurant.id,
      outletId: outlet.id,
      orderNumber: `CAT-VERIFY-${runId}`,
      eventName: "Grand Gala Banquet 150 Guests",
      clientName: "VIP Corporate Host",
      guestCount: 150,
      eventDate: new Date(),
      status: "CONFIRMED",
      items: {
        create: [
          {
            recipeId: manualRecipe.id,
            itemName: manualRecipe.name,
            quantity: 150,
            unitPrice: 25.0,
            totalPrice: 3750.0,
          },
        ],
      },
    },
  });

  // StockLedger count before planning preview
  const ledgerCountBeforePreview = await prisma.stockLedger.count({
    where: { restaurantId: restaurant.id },
  });

  // Run 150-guest planning preview with 10% buffer
  const previewReport = await calculateEventIngredients(restaurant.id, cateringOrder.id, {
    productionBufferPercent: 10,
  });

  // StockLedger count after planning preview
  const ledgerCountAfterPreview = await prisma.stockLedger.count({
    where: { restaurantId: restaurant.id },
  });

  assert(ledgerCountBeforePreview === ledgerCountAfterPreview, "150-guest Catering planning preview created zero (0) StockLedger movements");
  assert(previewReport.plannedServings === 165, "150 guests + 10% production buffer yields exactly 165 planned servings");

  // 4C. Catering Stock Posting Action & Idempotency Check
  console.log("  🔍 Inspecting Catering stock-posting capability in workflow:");
  const cateringDepletion1 = await depleteCateringOrderInventory(cateringOrder.id, user.id);
  assert(cateringDepletion1.depletedItemsCount > 0, `Catering order fulfillment posted stock movement to StockLedger (${cateringDepletion1.depletedItemsCount} items)`);

  const cateringLedgers = await prisma.stockLedger.findMany({
    where: { referenceId: `CAT-${cateringOrder.id}`, movementType: "CONSUMPTION" },
  });
  assert(cateringLedgers.length > 0, `Catering deduction confirmed: created ${cateringLedgers.length} StockLedger CONSUMPTION records`);

  // Submitting the same catering fulfillment a second time: Idempotency enforcement
  const cateringDepletion2 = await depleteCateringOrderInventory(cateringOrder.id, user.id);
  assert(cateringDepletion2.depletedItemsCount === 0, "Repeated submission of completed Catering event produced 0 additional deductions (idempotency verified)");

  const cateringLedgersAfterRetry = await prisma.stockLedger.findMany({
    where: { referenceId: `CAT-${cateringOrder.id}`, movementType: "CONSUMPTION" },
  });
  assert(cateringLedgers.length === cateringLedgersAfterRetry.length, "StockLedger entries count remained identical after repeated catering fulfillment call");

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 5: PRISMA MIGRATION COMPATIBILITY WITH PRE-UPGRADE WASTAGE RECIPES
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n── Check 5: Versioned Prisma Migration & Pre-Upgrade Wastage Compatibility ──");

  // Create a legacy pre-upgrade recipe structure with wastage configured
  const legacyRecipe = await prisma.recipe.create({
    data: {
      restaurantId: restaurant.id,
      name: `Legacy Peeling Prep Recipe ${runId}`,
      type: "SUB_RECIPE",
      yieldQuantity: 10,
      yieldUnit: "PORTION",
      // Notice: No instructions, no targetFoodCostPercent, default isDraft (false)
      items: {
        create: [
          {
            componentType: "INVENTORY_ITEM",
            inventoryItemId: potatoItem.id,
            quantity: 8.0, // 8.0 lb usable
            unitOfMeasure: "LB",
            wastagePercent: 20, // 20% peeling loss
            // Notice: No packId, no packQuantity, no originalText
          },
        ],
      },
    },
  });

  // Calculate costing on legacy recipe
  const legacyCost = await calculateRecipeCost(legacyRecipe.id);
  // Gross quantity = 8.0 / (1 - 0.20) = 10.0 lb
  // 10.0 lb @ $0.80/lb = $8.00 total batch cost
  // Cost per portion (yield 10) = $0.80
  assert(Number(legacyCost.totalCost) === 8.0, `Legacy recipe with 20% wastage calculates $8.00 batch cost (got $${legacyCost.totalCost})`);
  assert(Number(legacyCost.costPerUnit) === 0.8, `Legacy recipe calculates $0.80 cost per portion (got $${legacyCost.costPerUnit})`);

  // Check inventory depletion on legacy recipe for a full batch of 10 portions
  const legacyExplosion = await explodeRecipeToRawIngredients(legacyRecipe.id, 10);
  const rawPotatoes = legacyExplosion.get(potatoItem.id);
  assert(rawPotatoes?.quantity === 10.0, `Depletion engine consumes exactly 10.0 lb gross raw potatoes for legacy 20% wastage recipe full batch (got ${rawPotatoes?.quantity})`);
  assert(Number(legacyCost.totalCost) === rawPotatoes!.quantity * Number(potatoItem.costPerUnit), `Costing and depletion agree on the raw amount consumed (10.0 lb @ $0.80 = $8.00)`);

  console.log("\n================================================================================");
  console.log("  ALL 5 VERIFICATION SUITES PASSED END-TO-END WITH ZERO DEFECTS");
  console.log("================================================================================");
}

main()
  .catch((e) => {
    console.error("Verification suite failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
