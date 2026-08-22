import { prisma } from "@/core/database/client";
import {
  convertQuantity,
  convertUnitCost,
  canConvertUnits,
  getUnitPricingMatrix,
} from "@/core/inventory/units";
import { calculateRecipeCost, syncRecipeCosting } from "@/core/inventory/recipeCosting";
import { explodeRecipeToRawIngredients, depleteOrderInventory } from "@/core/inventory/depletionEngine";

async function runTests() {
  console.log("=========================================================");
  console.log("  Recipe Studio & Culinary Unit Pricing Matrix Test Suite");
  console.log("=========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Setup Test Restaurant and Outlet
  const testSubdomain = `test-culinary-${Date.now()}`;
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Culinary Test Kitchen",
      subdomain: testSubdomain,
      status: "ACTIVE",
    },
  });

  const outlet = await prisma.restaurantOutlet.create({
    data: {
      restaurantId: restaurant.id,
      name: "Main Branch",
      currency: "USD",
      timezone: "UTC",
    },
  });

  // Setup Test User
  const user = await prisma.user.create({
    data: {
      email: `chef-culinary-${Date.now()}@example.com`,
      name: "Executive Chef Gordon",
      passwordHash: "dummyhash",
    },
  });

  try {
    console.log("── Section 1: Culinary Multi-Unit Conversion & Pricing Matrix ──");

    // 1.1 Weight Conversion: Ordered in LB -> Converted to OZ, G, KG
    // Example: $16.00 / LB
    const pricePerLb = 16.0;
    const pricePerOz = convertUnitCost(pricePerLb, "LB", "OZ");
    assert(Math.abs(pricePerOz - 1.0) < 0.001, "$16.00 / LB converts to exactly $1.00 / OZ (16 oz per lb)");

    const pricePerGram = convertUnitCost(pricePerLb, "LB", "G");
    assert(Math.abs(pricePerGram - 0.03527) < 0.001, "$16.00 / LB converts to $0.0353 / Gram (453.59g per lb)");

    const pricePerKg = convertUnitCost(pricePerLb, "LB", "KG");
    assert(Math.abs(pricePerKg - 35.274) < 0.01, "$16.00 / LB converts to $35.27 / KG");

    // 1.2 Unit Pricing Matrix helper verification for LB
    const lbMatrix = getUnitPricingMatrix(16.0, "LB");
    const ozItem = lbMatrix.find((u) => u.unit === "OZ");
    const gItem = lbMatrix.find((u) => u.unit === "G");
    const kgItem = lbMatrix.find((u) => u.unit === "KG");
    assert(ozItem !== undefined && ozItem.formattedPricing.includes("$1.00 / oz"), "Matrix contains clean formatted pricing for OZ: $1.00 / oz");
    assert(gItem !== undefined && gItem.formattedPricing.includes("/ g"), "Matrix contains clean formatted pricing for Gram");
    assert(kgItem !== undefined && kgItem.formattedPricing.includes("$35.27 / kg"), "Matrix contains clean formatted pricing for KG: $35.27 / kg");

    // 1.3 Volume Conversion: Sauce Ordered in Gallons -> Converted to Ladle (4 oz), Cup, Liter, ML
    // Example: $32.00 / Gallon
    const pricePerGallon = 32.0;
    const pricePerLadle = convertUnitCost(pricePerGallon, "GAL", "LADLE"); // 32 ladles per gallon (128 oz / 4 oz = 32)
    assert(Math.abs(pricePerLadle - 1.0) < 0.001, "$32.00 / Gallon converts to exactly $1.00 / Ladle (32 4-oz ladles per gallon)");

    const pricePerCup = convertUnitCost(pricePerGallon, "GAL", "CUP"); // 16 cups per gallon
    assert(Math.abs(pricePerCup - 2.0) < 0.001, "$32.00 / Gallon converts to exactly $2.00 / Cup");

    const pricePerFlOz = convertUnitCost(pricePerGallon, "GAL", "FL_OZ"); // 128 fl oz per gallon
    assert(Math.abs(pricePerFlOz - 0.25) < 0.001, "$32.00 / Gallon converts to $0.25 / Fluid Ounce");

    const pricePerLiter = convertUnitCost(pricePerGallon, "GAL", "L");
    assert(Math.abs(pricePerLiter - 8.453) < 0.01, "$32.00 / Gallon converts to $8.45 / Liter");

    console.log("\n── Section 2: Creating Raw Ingredients with Culinary Units ──");

    // Prime Ribeye ordered in Pounds (LB) at $12.00 / LB
    const ribeye = await prisma.inventoryItem.create({
      data: {
        restaurantId: restaurant.id,
        name: "USDA Prime Ribeye Beef",
        unitOfMeasure: "LB",
        costPerUnit: 12.0, // $12.00 / LB ($0.75 / OZ)
        reorderPoint: 10,
        parLevel: 50,
      },
    });

    // Truffle Marinade ordered in Gallons (GAL) at $32.00 / GAL
    const marinade = await prisma.inventoryItem.create({
      data: {
        restaurantId: restaurant.id,
        name: "House Truffle Butter Marinade",
        unitOfMeasure: "GAL",
        costPerUnit: 32.0, // $32.00 / GAL ($1.00 / Ladle)
        reorderPoint: 2,
        parLevel: 10,
      },
    });

    // Brioche Buns ordered in DOZEN at $6.00 / DOZ ($0.50 / Piece)
    const buns = await prisma.inventoryItem.create({
      data: {
        restaurantId: restaurant.id,
        name: "Artisan Brioche Buns",
        unitOfMeasure: "DOZEN",
        costPerUnit: 6.0, // $6.00 / DOZ ($0.50 / Piece)
        reorderPoint: 5,
        parLevel: 20,
      },
    });

    assert(ribeye.id !== "" && marinade.id !== "", "Inventory items created with LB, GAL, and DOZEN standard units");

    // Stock up outlet
    await prisma.stockLedger.createMany({
      data: [
        {
          restaurantId: restaurant.id,
          outletId: outlet.id,
          itemId: ribeye.id,
          movementType: "PURCHASE",
          quantity: 100, // 100 Lbs
          recordedBy: user.id,
        },
        {
          restaurantId: restaurant.id,
          outletId: outlet.id,
          itemId: marinade.id,
          movementType: "PURCHASE",
          quantity: 10, // 10 Gallons
          recordedBy: user.id,
        },
        {
          restaurantId: restaurant.id,
          outletId: outlet.id,
          itemId: buns.id,
          movementType: "PURCHASE",
          quantity: 20, // 20 Dozen (240 buns)
          recordedBy: user.id,
        },
      ],
    });

    console.log("\n── Section 3: Sub-Recipe with Ladle & Ounce Units ──");

    // Sub-Recipe: "Marinated Steak Patty Batch"
    // Yield: 4 Portions (PIECES)
    // Ingredients:
    // - 32 OZ Ribeye Beef (2 LBs at $12/LB = $24.00 total, $6.00/portion)
    // - 2 Ladles Truffle Marinade (8 fl oz = 1/16 Gal at $32/Gal = $2.00 total, $0.50/portion)
    // Total Sub-Recipe Cost: $26.00 for 4 patties = $6.50 per patty portion
    const pattySubRecipe = await prisma.recipe.create({
      data: {
        restaurantId: restaurant.id,
        name: "House Prime Marinated Patties",
        type: "SUB_RECIPE",
        yieldQuantity: 4,
        yieldUnit: "PIECES",
        items: {
          create: [
            {
              componentType: "INVENTORY_ITEM",
              inventoryItemId: ribeye.id,
              quantity: 32, // 32 OZ (which is 2 LB)
              unitOfMeasure: "OZ",
            },
            {
              componentType: "INVENTORY_ITEM",
              inventoryItemId: marinade.id,
              quantity: 2, // 2 Ladles
              unitOfMeasure: "LADLE",
            },
          ],
        },
      },
    });

    const pattyCosting = await syncRecipeCosting(pattySubRecipe.id);
    assert(Math.abs(pattyCosting.totalCost - 26.0) < 0.05, `Sub-Recipe batch cost is $26.00 (got $${pattyCosting.totalCost.toFixed(2)})`);
    assert(Math.abs(pattyCosting.costPerUnit - 6.5) < 0.05, `Sub-Recipe cost per patty is $6.50 (got $${pattyCosting.costPerUnit.toFixed(2)})`);

    console.log("\n── Section 4: Finished Gourmet Burger Dish ──");

    // Finished Dish: "Signature Truffle Burger"
    // Yield: 1 PORTION
    // Selling Price: $24.00
    // Ingredients:
    // - 1 Marinated Steak Patty (Sub-Recipe at $6.50)
    // - 1 Brioche Bun (from DOZEN at $0.50)
    // - 1 Ladle Extra Truffle Sauce (at $1.00)
    // Total Food Cost = $6.50 + $0.50 + $1.00 = $8.00
    // Gross Margin % = (($24.00 - $8.00) / $24.00) * 100 = 66.67%
    const burgerDish = await prisma.recipe.create({
      data: {
        restaurantId: restaurant.id,
        name: "Signature Truffle Burger",
        type: "DISH",
        yieldQuantity: 1,
        yieldUnit: "PORTION",
        sellingPrice: 24.0,
        items: {
          create: [
            {
              componentType: "SUB_RECIPE",
              subRecipeId: pattySubRecipe.id,
              quantity: 1,
              unitOfMeasure: "PIECES",
            },
            {
              componentType: "INVENTORY_ITEM",
              inventoryItemId: buns.id,
              quantity: 1,
              unitOfMeasure: "PIECES",
            },
            {
              componentType: "INVENTORY_ITEM",
              inventoryItemId: marinade.id,
              quantity: 1,
              unitOfMeasure: "LADLE",
            },
          ],
        },
      },
    });

    const burgerCosting = await syncRecipeCosting(burgerDish.id);
    assert(Math.abs(burgerCosting.costPerUnit - 8.0) < 0.05, `Burger Food Cost per unit is $8.00 (got $${burgerCosting.costPerUnit.toFixed(2)})`);
    assert(Math.abs(burgerCosting.grossMarginPercent - 66.67) < 0.1, `Gross Margin is 66.7% (got ${burgerCosting.grossMarginPercent.toFixed(1)}%)`);

    console.log("\n── Section 5: POS Depletion Across Culinary Units ──");

    // Ordering 4 Truffle Burgers:
    // Requires:
    // - 4 Patties = (4 / 4) = 1 full batch of Sub-Recipe:
    //   -> 32 OZ Beef = 2.0 LB Beef
    //   -> 2 Ladles Marinade = 2/32 Gal = 0.0625 Gal
    // - 4 Brioche Buns = 4/12 = 0.3333 Dozen Buns
    // - 4 Ladles Extra Sauce = 4/32 Gal = 0.125 Gal
    // Total Marinade = 0.0625 + 0.125 = 0.1875 Gallons
    const exploded = await explodeRecipeToRawIngredients(burgerDish.id, 4);

    const beefExp = exploded.get(ribeye.id);
    assert(beefExp !== undefined && Math.abs(beefExp.quantity - 2.0) < 0.01, "4 Burgers deducts exactly 2.0 LB Beef from stock");

    const sauceExp = exploded.get(marinade.id);
    assert(sauceExp !== undefined && Math.abs(sauceExp.quantity - 0.1875) < 0.001, "4 Burgers deducts exactly 0.1875 Gallons (6 Ladles) Sauce from stock");

    const bunExp = exploded.get(buns.id);
    assert(bunExp !== undefined && Math.abs(bunExp.quantity - 4 / 12) < 0.001, "4 Burgers deducts exactly 0.3333 Dozen (4 buns) from stock");

    // Place POS Order
    const posOrder = await prisma.posOrder.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet.id,
        orderNumber: "ORD-CULINARY-001",
        totalAmount: 96.0,
        taxAmount: 4.8,
        finalAmount: 100.8,
        status: "COMPLETED",
        paymentStatus: "PAID",
        paymentMethod: "CARD",
        items: {
          create: [
            {
              recipeId: burgerDish.id,
              name: "Signature Truffle Burger",
              quantity: 4,
              unitPrice: 24.0,
              totalPrice: 96.0,
            },
          ],
        },
      },
    });

    const depletion = await depleteOrderInventory(posOrder.id, user.id);
    assert(depletion.depletedItemsCount === 3, "Successfully depleted all 3 raw ingredients");

    // Verify Remaining Stock in outlet
    const beefStock = await prisma.stockLedger.aggregate({
      where: { itemId: ribeye.id, outletId: outlet.id },
      _sum: { quantity: true },
    });
    assert(Number(beefStock._sum.quantity) === 98.0, "Beef stock is exactly 98.0 LB remaining (started 100, deducted 2.0)");

    console.log("\n=========================================================");
    console.log(`  Test Results: ${passed} Passed, ${failed} Failed`);
    console.log("=========================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Cleanup
    try {
      await prisma.restaurant.deleteMany({ where: { id: restaurant.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    } catch {
      // ignore
    }
  }
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
