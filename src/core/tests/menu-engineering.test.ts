import { prisma } from "@/core/database/client";
import { computeMenuEngineering } from "@/core/analytics/menuEngineering";
import { computeFoodCostVariance } from "@/core/analytics/foodCostVariance";

async function runTests() {
  console.log("=========================================================");
  console.log("  Menu Engineering & Food Cost Variance Test Suite");
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
  const testSubdomain = `test-analytics-${Date.now()}`;
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Analytics Test Bistro",
      subdomain: testSubdomain,
      status: "ACTIVE",
    },
  });

  const outlet = await prisma.restaurantOutlet.create({
    data: {
      restaurantId: restaurant.id,
      name: "Main Dining Room",
      currency: "USD",
      timezone: "UTC",
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `gm-${Date.now()}@example.com`,
      name: "General Manager Alice",
      passwordHash: "dummyhash",
    },
  });

  try {
    console.log("── Section 1: Setting up Dishes for Kasavana-Smith Matrix ──");

    // 1. STAR: High Margin ($18 margin), High Volume (50 orders)
    const starDish = await prisma.recipe.create({
      data: {
        restaurantId: restaurant.id,
        name: "Truffle Filet Mignon",
        type: "DISH",
        sellingPrice: 28.0,
        costPerUnit: 10.0, // Margin = $18.00
      },
    });

    // 2. PLOWHORSE: Low Margin ($3 margin), High Volume (60 orders)
    const plowhorseDish = await prisma.recipe.create({
      data: {
        restaurantId: restaurant.id,
        name: "Classic Cheeseburger",
        type: "DISH",
        sellingPrice: 12.0,
        costPerUnit: 9.0, // Margin = $3.00
      },
    });

    // 3. PUZZLE: High Margin ($20 margin), Low Volume (5 orders)
    const puzzleDish = await prisma.recipe.create({
      data: {
        restaurantId: restaurant.id,
        name: "Caviar Blini Special",
        type: "DISH",
        sellingPrice: 35.0,
        costPerUnit: 15.0, // Margin = $20.00
      },
    });

    // 4. DOG: Low Margin ($2 margin), Low Volume (3 orders)
    const dogDish = await prisma.recipe.create({
      data: {
        restaurantId: restaurant.id,
        name: "Cabbage Soup",
        type: "DISH",
        sellingPrice: 6.0,
        costPerUnit: 4.0, // Margin = $2.00
      },
    });

    assert(starDish.id !== "" && dogDish.id !== "", "Created 4 benchmark dishes with distinct margin profiles");

    // Place POS Orders
    const orderStar = await prisma.posOrder.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet.id,
        orderNumber: "ORD-STAR-01",
        totalAmount: 1400.0,
        finalAmount: 1400.0,
        items: {
          create: [{ recipeId: starDish.id, name: starDish.name, quantity: 50, unitPrice: 28.0, totalPrice: 1400.0 }],
        },
      },
    });

    const orderPlowhorse = await prisma.posOrder.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet.id,
        orderNumber: "ORD-PLOW-01",
        totalAmount: 720.0,
        finalAmount: 720.0,
        items: {
          create: [{ recipeId: plowhorseDish.id, name: plowhorseDish.name, quantity: 60, unitPrice: 12.0, totalPrice: 720.0 }],
        },
      },
    });

    const orderPuzzle = await prisma.posOrder.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet.id,
        orderNumber: "ORD-PUZZ-01",
        totalAmount: 175.0,
        finalAmount: 175.0,
        items: {
          create: [{ recipeId: puzzleDish.id, name: puzzleDish.name, quantity: 5, unitPrice: 35.0, totalPrice: 175.0 }],
        },
      },
    });

    const orderDog = await prisma.posOrder.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet.id,
        orderNumber: "ORD-DOG-01",
        totalAmount: 18.0,
        finalAmount: 18.0,
        items: {
          create: [{ recipeId: dogDish.id, name: dogDish.name, quantity: 3, unitPrice: 6.0, totalPrice: 18.0 }],
        },
      },
    });

    assert(orderStar.id !== "" && orderDog.id !== "", "Placed POS order tickets across all 4 dishes");

    console.log("\n── Section 2: Kasavana-Smith Matrix Classification Verification ──");

    const matrix = await computeMenuEngineering(restaurant.id);
    assert(matrix.totalDishesCount === 4, "Matrix analyzed all 4 menu dishes");
    assert(matrix.totalUnitsSold === 118, `Total units sold calculated accurately as 118 (50+60+5+3)`);

    // Verify Star classification
    const starResult = matrix.stars.find((d) => d.recipeId === starDish.id);
    assert(starResult !== undefined, "Truffle Filet Mignon classified as 🌟 STAR");
    assert(starResult?.classification === "STAR", "Star classification metadata confirmed");

    // Verify Plowhorse classification
    const plowResult = matrix.plowhorses.find((d) => d.recipeId === plowhorseDish.id);
    assert(plowResult !== undefined, "Classic Cheeseburger classified as 🐴 PLOWHORSE");

    // Verify Puzzle classification
    const puzzleResult = matrix.puzzles.find((d) => d.recipeId === puzzleDish.id);
    assert(puzzleResult !== undefined, "Caviar Blini Special classified as 🧩 PUZZLE");

    // Verify Dog classification
    const dogResult = matrix.dogs.find((d) => d.recipeId === dogDish.id);
    assert(dogResult !== undefined, "Cabbage Soup classified as 🐕 DOG");

    console.log("\n── Section 3: Theoretical vs. Actual (TvA) Variance Analytics ──");

    // Create raw inventory item linked to a recipe
    const beefItem = await prisma.inventoryItem.create({
      data: {
        restaurantId: restaurant.id,
        name: "Prime Beef Fillet",
        unitOfMeasure: "KG",
        costPerUnit: 40.0, // $40/kg
      },
    });

    const steakRecipe = await prisma.recipe.create({
      data: {
        restaurantId: restaurant.id,
        name: "Filet Steak Dinner",
        type: "DISH",
        sellingPrice: 45.0,
        costPerUnit: 12.0,
        items: {
          create: [
            {
              componentType: "INVENTORY_ITEM",
              inventoryItemId: beefItem.id,
              quantity: 0.3, // 300g per portion
              unitOfMeasure: "KG",
            },
          ],
        },
      },
    });

    // 10 orders placed -> Theoretical = 10 * 0.3kg = 3.0 kg beef
    await prisma.posOrder.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet.id,
        orderNumber: "ORD-STEAK-10",
        totalAmount: 450.0,
        finalAmount: 450.0,
        items: {
          create: [{ recipeId: steakRecipe.id, name: steakRecipe.name, quantity: 10, unitPrice: 45.0, totalPrice: 450.0 }],
        },
      },
    });

    // Record Actual Stock Ledger usage of 3.8 kg (0.8 kg shrinkage / waste)
    await prisma.stockLedger.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet.id,
        itemId: beefItem.id,
        movementType: "CONSUMPTION",
        quantity: -3.8, // 3.8 kg consumed in physical counts
        recordedBy: user.id,
      },
    });

    const varianceSummary = await computeFoodCostVariance(restaurant.id);
    const beefVariance = varianceSummary.items.find((i) => i.itemId === beefItem.id);

    assert(beefVariance !== undefined, "Food cost variance computed for Prime Beef Fillet");
    assert(beefVariance?.theoreticalUsage === 3.0, `Theoretical usage is 3.0 KG (got ${beefVariance?.theoreticalUsage})`);
    assert(beefVariance?.actualUsage === 3.8, `Actual usage is 3.8 KG (got ${beefVariance?.actualUsage})`);
    assert(Math.abs((beefVariance?.varianceQuantity || 0) - 0.8) < 0.01, "Variance quantity is +0.8 KG loss");
    assert(Math.abs((beefVariance?.varianceCost || 0) - 32.0) < 0.01, "Dollar loss is $32.00 (0.8kg * $40/kg)");
    assert(beefVariance?.riskLevel === "CRITICAL", "High variance flagged as CRITICAL risk");

    console.log("\n=========================================================");
    console.log(`  Test Results: ${passed} Passed, ${failed} Failed`);
    console.log("=========================================================\n");

    if (failed > 0) process.exit(1);
  } finally {
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
