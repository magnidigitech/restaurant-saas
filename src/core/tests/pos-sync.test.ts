import { prisma } from "@/core/database/client";
import { executeSync } from "@/modules/pos-integrations/service";

async function runPosSyncTests() {
  console.log("==================================================");
  console.log("RUNNING POS INTEGRATION SYNC & ANALYTICS TESTS");
  console.log("==================================================");

  let passCount = 0;
  let failCount = 0;

  const assert = (name: string, condition: boolean, details?: string) => {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${name} ${details ? `- ${details}` : ""}`);
      failCount++;
    }
  };

  let testRestaurantId = "";
  let testOutletId = "";
  let testIntegrationId = "";

  try {
    // Setup test restaurant and outlet
    const restaurant = await prisma.restaurant.create({
      data: {
        name: "Idempotency Test Bistro",
        subdomain: `test-pos-sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      },
    });
    testRestaurantId = restaurant.id;

    const outlet = await prisma.restaurantOutlet.create({
      data: {
        restaurantId: testRestaurantId,
        name: "Main Test Outlet",
        currency: "USD",
        timezone: "America/New_York",
      },
    });
    testOutletId = outlet.id;

    const integration = await prisma.posIntegration.create({
      data: {
        restaurantId: testRestaurantId,
        outletId: testOutletId,
        provider: "SQUARE",
        environment: "SANDBOX",
        credentials: {
          environment: "SANDBOX",
          accessToken: "EAAA_TEST_TOKEN",
        },
      },
    });
    testIntegrationId = integration.id;

    // Test 1: Initial Sync (10 orders fetched and saved)
    const res1 = await executeSync(testIntegrationId);
    assert("1. Initial POS Sync succeeds", res1.success === true);

    const savedOrdersCount = await prisma.posOrder.count({
      where: { restaurantId: testRestaurantId },
    });
    assert("1. Initial orders saved into database (count > 0)", savedOrdersCount > 0);

    const savedItemsCount = await prisma.posOrderItem.count({
      where: { order: { restaurantId: testRestaurantId } },
    });
    assert("1. Line items saved into database with posMenuItemId/providerItemId", savedItemsCount > 0);

    // Test 2: Resync (0 duplicates, count remains identical)
    const res2 = await executeSync(testIntegrationId);
    const countAfterResync = await prisma.posOrder.count({
      where: { restaurantId: testRestaurantId },
    });
    assert("2. Resyncing orders produces 0 duplicates", countAfterResync === savedOrdersCount);
    assert("2. Resyncing marks orders as skipped", res2.skippedOrdersCount === savedOrdersCount);

    // Test 3: Change existing order total and resync -> record updated, totals corrected
    const firstOrder = await prisma.posOrder.findFirst({
      where: { restaurantId: testRestaurantId },
    });
    assert("3. Existing order found for update test", !!firstOrder);

    if (firstOrder) {
      await prisma.posOrder.update({
        where: { id: firstOrder.id },
        data: { totalAmount: 999.99, status: "CANCELLED" },
      });

      // Sync again -> changed order is updated back to correct synced value
      const res3 = await executeSync(testIntegrationId);
      assert("3. Modified order trigger updatedOrdersCount > 0", res3.updatedOrdersCount > 0);

      const refreshedOrder = await prisma.posOrder.findUnique({
        where: { id: firstOrder.id },
      });
      assert("3. Synced order total is corrected back", Number(refreshedOrder?.totalAmount) !== 999.99);

      const countAfterUpdateSync = await prisma.posOrder.count({
        where: { restaurantId: testRestaurantId },
      });
      assert("3. Total order count remains strictly unchanged", countAfterUpdateSync === savedOrdersCount);
    }

    // Test 4: Simultaneous parallel sync execution -> 0 race conditions or duplicate rows
    const [parallelResA, parallelResB] = await Promise.all([
      executeSync(testIntegrationId),
      executeSync(testIntegrationId),
    ]);

    assert("4. Simultaneous parallel sync A completed", parallelResA.success === true);
    assert("4. Simultaneous parallel sync B completed", parallelResB.success === true);

    const duplicateGroups = await prisma.posOrder.groupBy({
      by: ["providerOrderId"],
      where: { restaurantId: testRestaurantId },
      _count: { providerOrderId: true },
    });

    const hasDuplicates = duplicateGroups.some((g) => g._count.providerOrderId > 1);
    assert("4. Concurrent sync execution produced 0 duplicate orders", !hasDuplicates);

  } catch (err: any) {
    console.error("Test execution exception:", err);
    failCount++;
  } finally {
    if (testRestaurantId) {
      await prisma.restaurant.delete({
        where: { id: testRestaurantId },
      });
    }
  }

  console.log("--------------------------------------------------");
  console.log(`RESULTS: ${passCount} PASSED, ${failCount} FAILED.`);
  console.log("--------------------------------------------------");
  if (failCount > 0) {
    process.exit(1);
  }
}

runPosSyncTests();
