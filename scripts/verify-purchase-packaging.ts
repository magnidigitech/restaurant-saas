import { prisma } from "../src/core/database/client";
import { InventoryService as inventoryService } from "../src/modules/inventory/service";
import { VendorService as vendorService } from "../src/modules/inventory/vendor-service";
import { PurchaseService as purchaseService } from "../src/modules/inventory/purchase-service";
import {
  validateCompatibleUnits,
  calculatePackDetailsAndFactor,
  COMMON_PACKAGING_TYPES,
  formatUnit,
} from "../src/core/inventory/units";

async function runVerification() {
  console.log("================================================================================");
  console.log("  PURCHASE PACKAGING AUTOMATED VERIFICATION SUITE");
  console.log("================================================================================\n");

  let passes = 0;
  let fails = 0;

  const assert = (condition: boolean, testName: string, detail?: string) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      if (detail) console.log(`     └─ ${detail}`);
      passes++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     └─ ${detail}`);
      fails++;
    }
  };

  // 1. Setup / identify tenant and outlets
  const restaurant = await prisma.restaurant.findFirst({
    where: { subdomain: "bahubali" },
  });
  if (!restaurant) {
    throw new Error("Restaurant 'bahubali' not found");
  }
  const restaurantId = restaurant.id;

  const outlet = await prisma.restaurantOutlet.findFirst({
    where: { restaurantId },
  });
  if (!outlet) {
    throw new Error("Outlet for 'bahubali' not found");
  }
  const outletId = outlet.id;

  const getItemStock = async (itemId: string) => {
    const agg = await prisma.stockLedger.aggregate({
      where: { itemId, outletId },
      _sum: { quantity: true },
    });
    return Number(agg._sum.quantity || 0);
  };

  const user = await prisma.user.findFirst({
    where: { memberships: { some: { restaurantId } } },
  });
  const userId = user?.id || "system-test-user";

  // Create a second tenant to test cross-tenant isolation
  let tenantB = await prisma.restaurant.findFirst({
    where: { subdomain: "tenant-b-test" },
  });
  if (!tenantB) {
    tenantB = await prisma.restaurant.create({
      data: {
        name: "Tenant B Test",
        subdomain: "tenant-b-test",
        status: "ACTIVE",
      },
    });
  }

  // Create a vendor for bahubali
  let vendor = await prisma.vendor.findFirst({
    where: { restaurantId, name: "Sysco Test Foods" },
  });
  if (!vendor) {
    vendor = await prisma.vendor.create({
      data: {
        restaurantId,
        name: "Sysco Test Foods",
        code: "SYS-TEST",
        paymentTerms: "NET30",
        status: "ACTIVE",
      },
    });
  }

  console.log(`Environment initialized: Restaurant=${restaurant.name} (${restaurantId}), Outlet=${outlet.name}\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Receiving 2 boxes of tomatoes (40 lb) adds 80 lb; 2 boxes of potatoes (20 lb) adds 40 lb
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- TEST 1: Fixed Pack Receiving (Tomatoes & Potatoes) ---");
  const tomatoItem = await inventoryService.createItem(restaurantId, {
    name: "Roma Tomatoes (Test " + Date.now() + ")",
    unitOfMeasure: "LB",
    costPerUnit: 1.25,
    purchasePacks: [
      {
        name: "40 lb Box",
        packType: "Box",
        packageQty: 1,
        netWeightOrVol: 40,
        weightOrVolUnit: "LB",
        conversionFactor: 40,
        defaultPricePerPack: 50.0,
        isVariableWeight: false,
      } as any,
    ],
  });
  const tomatoPack = tomatoItem.purchasePacks[0];

  const potatoItem = await inventoryService.createItem(restaurantId, {
    name: "Russet Potatoes (Test " + Date.now() + ")",
    unitOfMeasure: "LB",
    costPerUnit: 0.8,
    purchasePacks: [
      {
        name: "20 lb Box",
        packType: "Box",
        packageQty: 1,
        netWeightOrVol: 20,
        weightOrVolUnit: "LB",
        conversionFactor: 20,
        defaultPricePerPack: 16.0,
        isVariableWeight: false,
      } as any,
    ],
  });
  const potatoPack = potatoItem.purchasePacks[0];

  const po1 = await purchaseService.createPO(restaurantId, userId, {
    vendorId: vendor.id,
    outletId,
    items: [
      {
        itemId: tomatoItem.id,
        packId: tomatoPack.id,
        orderedPackCount: 2,
        packPrice: 50.0,
        pricingBasis: "PER_PACK",
      },
      {
        itemId: potatoItem.id,
        packId: potatoPack.id,
        orderedPackCount: 2,
        packPrice: 16.0,
        pricingBasis: "PER_PACK",
      },
    ],
  });

  await purchaseService.receivePOItems(restaurantId, userId, po1.id, {
    status: "RECEIVED",
    items: [
      { poItemId: po1.items[0].id, receivingPackCount: 2 },
      { poItemId: po1.items[1].id, receivingPackCount: 2 },
    ],
  });

  const tomatoStockQty = await getItemStock(tomatoItem.id);
  const potatoStockQty = await getItemStock(potatoItem.id);

  assert(
    tomatoStockQty === 80,
    "Receiving two boxes of tomatoes (40 lb each) adds exactly 80 lb to inventory",
    `Expected: 80 lb, Actual: ${tomatoStockQty} lb`
  );
  assert(
    potatoStockQty === 40,
    "Receiving two boxes of potatoes (20 lb each) adds exactly 40 lb to inventory",
    `Expected: 40 lb, Actual: ${potatoStockQty} lb`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: Receiving 1 case of cups (nested packaging 20 sleeves × 50 each = 1,000 each)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 2: Nested Packaging (Cups 20 sleeves × 50 each = 1,000) ---");
  const cupsItem = await inventoryService.createItem(restaurantId, {
    name: "Paper Cups 12oz (Test " + Date.now() + ")",
    unitOfMeasure: "EACH",
    costPerUnit: 0.05,
    purchasePacks: [
      {
        name: "Case of 1,000",
        packType: "Case",
        packageQty: 1,
        innerPackType: "Sleeve",
        innerPackQty: 20,
        itemsPerInnerPack: 50,
        conversionFactor: 1000,
        defaultPricePerPack: 45.0,
        isVariableWeight: false,
      } as any,
    ],
  });
  const cupsPack = cupsItem.purchasePacks[0];

  const po2 = await purchaseService.createPO(restaurantId, userId, {
    vendorId: vendor.id,
    outletId,
    items: [
      {
        itemId: cupsItem.id,
        packId: cupsPack.id,
        orderedPackCount: 1,
        packPrice: 45.0,
        pricingBasis: "PER_PACK",
      },
    ],
  });

  await purchaseService.receivePOItems(restaurantId, userId, po2.id, {
    status: "RECEIVED",
    items: [{ poItemId: po2.items[0].id, receivingPackCount: 1 }],
  });

  const cupsStockQty = await getItemStock(cupsItem.id);

  assert(
    cupsStockQty === 1000,
    "Receiving one case of cups adds exactly 1,000 units to inventory",
    `Expected: 1000 units, Actual: ${cupsStockQty} units`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: Partial receiving (2 boxes arrived against 3 ordered leaves 1 outstanding)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 3: Partial Receiving & Outstanding Pack Tracking ---");
  const po3 = await purchaseService.createPO(restaurantId, userId, {
    vendorId: vendor.id,
    outletId,
    items: [
      {
        itemId: tomatoItem.id,
        packId: tomatoPack.id,
        orderedPackCount: 3,
        packPrice: 50.0,
        pricingBasis: "PER_PACK",
      },
    ],
  });

  const updatedPO3 = await purchaseService.receivePOItems(restaurantId, userId, po3.id, {
    items: [{ poItemId: po3.items[0].id, receivingPackCount: 2 }],
  });

  const lineItem = updatedPO3.items[0];
  const orderedPacks = Number(lineItem.orderedPackCount || 0);
  const receivedPacks = Number(lineItem.receivedPackCount || 0);
  const remainingPacks = orderedPacks - receivedPacks;

  assert(
    receivedPacks === 2 && remainingPacks === 1,
    "When two boxes arrive against a three-box order, one box remains outstanding",
    `Ordered: ${orderedPacks}, Received: ${receivedPacks}, Remaining: ${remainingPacks}, Status: ${updatedPO3.status}`
  );
  assert(
    updatedPO3.status === "PARTIALLY_RECEIVED",
    "PO status is correctly transitioned to PARTIALLY_RECEIVED",
    `Status: ${updatedPO3.status}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: Variable-weight receipt (boxes 38.5 lb and 41 lb adds 79.5 lb)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 4: Variable-Weight / Catch-Weight Receipt ---");
  const meatItem = await inventoryService.createItem(restaurantId, {
    name: "Beef Brisket (Test " + Date.now() + ")",
    unitOfMeasure: "LB",
    costPerUnit: 4.5,
    purchasePacks: [
      {
        name: "Approx 40 lb Box (Catch Weight)",
        packType: "Box",
        packageQty: 1,
        netWeightOrVol: 40,
        weightOrVolUnit: "LB",
        conversionFactor: 40,
        defaultPricePerPack: 180.0,
        isVariableWeight: true,
        weightUnit: "LB",
      } as any,
    ],
  });
  const meatPack = meatItem.purchasePacks[0];

  const po4 = await purchaseService.createPO(restaurantId, userId, {
    vendorId: vendor.id,
    outletId,
    items: [
      {
        itemId: meatItem.id,
        packId: meatPack.id,
        orderedPackCount: 2,
        packPrice: 4.5,
        pricingBasis: "PER_WEIGHT_UNIT",
      },
    ],
  });

  // Receive 2 boxes weighing 38.5 lb and 41 lb = 79.5 lb total
  await purchaseService.receivePOItems(restaurantId, userId, po4.id, {
    status: "RECEIVED",
    items: [
      {
        poItemId: po4.items[0].id,
        receivingPackCount: 2,
        actualWeightReceived: 79.5,
      },
    ],
  });

  const meatStockQty = await getItemStock(meatItem.id);

  assert(
    meatStockQty === 79.5,
    "Variable-weight receipt for boxes weighing 38.5 lb and 41 lb adds exactly 79.5 lb",
    `Expected: 79.5 lb, Actual: ${meatStockQty} lb`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Editing catalogue pack leaves existing PO snapshots intact
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 5: Snapshot Immutability On Catalogue Edits ---");
  // Edit the tomatoPack definition
  await inventoryService.updateItemPurchasePack(restaurantId, tomatoPack.id, {
    name: "Altered 50 lb Box",
    conversionFactor: 50,
  });

  // Fetch PO1 line items to verify snapshots were preserved
  const reloadedPO1 = await prisma.purchaseOrder.findUnique({
    where: { id: po1.id },
    include: { items: true },
  });
  const reloadedPO1Item = reloadedPO1?.items.find((i) => i.itemId === tomatoItem.id);

  assert(
    reloadedPO1Item?.packLabel === "40 lb Box" &&
      Number(reloadedPO1Item?.packConversionFactor) === 40 &&
      Number(reloadedPO1Item?.packPrice) === 50.0 &&
      Number(reloadedPO1Item?.orderedQuantity) === 80,
    "Editing a catalogue pack leaves the quantities, conversions, and prices on existing POs intact",
    `Snapshot Pack: "${reloadedPO1Item?.packLabel}", Factor: ${reloadedPO1Item?.packConversionFactor}, Price: $${reloadedPO1Item?.packPrice}, Qty: ${reloadedPO1Item?.orderedQuantity}`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: Un-packaged PO receiving backward compatibility
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 6: Backward Compatibility (Un-packaged PO Receiving) ---");
  const bulkFlourItem = await inventoryService.createItem(restaurantId, {
    name: "Bulk Flour (Test " + Date.now() + ")",
    unitOfMeasure: "KG",
    costPerUnit: 1.1,
  });

  const po6 = await purchaseService.createPO(restaurantId, userId, {
    vendorId: vendor.id,
    outletId,
    items: [
      {
        itemId: bulkFlourItem.id,
        orderedQuantity: 25,
        unitCost: 1.1,
      },
    ],
  });

  await purchaseService.receivePOItems(restaurantId, userId, po6.id, {
    status: "RECEIVED",
    items: [{ poItemId: po6.items[0].id, receivedQuantity: 25 }],
  });

  const flourStockQty = await getItemStock(bulkFlourItem.id);

  assert(
    flourStockQty === 25,
    "An existing PO without packaging can still be received via standard unit flow",
    `Expected: 25 KG, Actual: ${flourStockQty} KG`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 7: Idempotency protection & cross-tenant pack isolation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 7: Idempotency Protection & Cross-Tenant Pack Isolation ---");
  const testIdempotencyKey = `test_key_${Date.now()}`;

  const po7 = await purchaseService.createPO(restaurantId, userId, {
    vendorId: vendor.id,
    outletId,
    items: [
      {
        itemId: bulkFlourItem.id,
        orderedQuantity: 10,
        unitCost: 1.1,
      },
    ],
  });

  // First receipt submission
  await purchaseService.receivePOItems(restaurantId, userId, po7.id, {
    idempotencyKey: testIdempotencyKey,
    items: [{ poItemId: po7.items[0].id, receivedQuantity: 10 }],
  });

  const stockBeforeRetry = await getItemStock(bulkFlourItem.id);

  // Second receipt submission with the same idempotency key
  await purchaseService.receivePOItems(restaurantId, userId, po7.id, {
    idempotencyKey: testIdempotencyKey,
    items: [{ poItemId: po7.items[0].id, receivedQuantity: 10 }],
  });

  const stockAfterRetry = await getItemStock(bulkFlourItem.id);

  const receiptCount = await prisma.purchaseOrderReceipt.count({
    where: { idempotencyKey: testIdempotencyKey },
  });

  assert(
    stockBeforeRetry === stockAfterRetry && receiptCount === 1,
    "Retrying a receipt with the same idempotency key does not add stock twice",
    `Initial Stock: ${stockBeforeRetry}, Stock After Retry: ${stockAfterRetry}, Receipts Written: ${receiptCount}`
  );

  // Multi-item receiving with single idempotency key (validating no unique constraint failure)
  const multiItemPO = await purchaseService.createPO(restaurantId, userId, {
    vendorId: vendor.id,
    outletId,
    items: [
      { itemId: tomatoItem.id, packId: tomatoPack.id, orderedPackCount: 2 },
      { itemId: potatoItem.id, packId: potatoPack.id, orderedPackCount: 3 },
    ],
  });

  const multiKey = `multi_key_${Date.now()}`;
  let multiReceiptError = null;
  try {
    await purchaseService.receivePOItems(restaurantId, userId, multiItemPO.id, {
      idempotencyKey: multiKey,
      items: [
        { poItemId: multiItemPO.items[0].id, itemId: tomatoItem.id, receivingPackCount: 2 },
        { poItemId: multiItemPO.items[1].id, itemId: potatoItem.id, receivingPackCount: 3 },
      ],
    });
  } catch (err: any) {
    multiReceiptError = err.message;
  }

  assert(
    multiReceiptError === null,
    "Multi-item PO receipt with idempotency key creates audit records without unique constraint failure",
    multiReceiptError ? `Failed with error: ${multiReceiptError}` : "Successfully received multiple items in single atomic transaction"
  );

  // Cross-tenant isolation test: Create an item and pack in Tenant B
  const tenantBItem = await inventoryService.createItem(tenantB.id, {
    name: "Tenant B Secret Item " + Date.now(),
    unitOfMeasure: "PIECES",
    purchasePacks: [
      {
        name: "Tenant B Exclusive Crate",
        packType: "Crate",
        conversionFactor: 100,
        packageQty: 1,
      } as any,
    ],
  });
  const tenantBPack = tenantBItem.purchasePacks[0];

  // Try creating a PO in Bahubali restaurant referencing Tenant B's pack
  let crossTenantRejected = false;
  try {
    await purchaseService.createPO(restaurantId, userId, {
      vendorId: vendor.id,
      outletId,
      items: [
        {
          itemId: tomatoItem.id,
          packId: tenantBPack.id, // Pack belongs to Tenant B!
          orderedPackCount: 1,
        },
      ],
    });
  } catch (err: any) {
    crossTenantRejected = true;
  }

  assert(
    crossTenantRejected,
    "Cross-tenant isolation enforced: Packs from another tenant cannot be selected or ordered",
    "Attempt to select Tenant B pack was successfully rejected by server validation"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 8: Unit Compatibility, Gallon Labeling & Packaging Types
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST 8: Unit Compatibility, Gallon Labeling & Packaging Types ---");
  const compWeightToVol = validateCompatibleUnits("LB", "L");
  assert(
    !compWeightToVol.compatible,
    "Incompatible conversions (e.g. LB weight to L volume) are strictly rejected",
    compWeightToVol.error
  );

  const compSame = validateCompatibleUnits("LB", "OZ");
  assert(
    compSame.compatible,
    "Compatible units (e.g. OZ to LB weight) are accepted",
    "OZ to LB compatibility check passed"
  );

  assert(
    formatUnit("GAL") === "US gal" && formatUnit("IMP_GAL") === "Imp gal",
    "US Gallons and Imperial Gallons are explicitly and distinctly labeled",
    `GAL: "${formatUnit("GAL")}", IMP_GAL: "${formatUnit("IMP_GAL")}"`
  );

  assert(
    COMMON_PACKAGING_TYPES.length === 34 && COMMON_PACKAGING_TYPES.includes("Box") && COMMON_PACKAGING_TYPES.includes("Custom"),
    "All 34 common US and Canadian packaging options are available",
    `Total types: ${COMMON_PACKAGING_TYPES.length}`
  );

  const friesCalc = calculatePackDetailsAndFactor({
    packType: "Case",
    isNested: true,
    innerPackType: "Bag",
    innerPackCount: 4,
    unitsPerInner: 5,
    packUnit: "LB",
    stockUnit: "LB",
  });
  assert(
    friesCalc.isValid && friesCalc.conversionFactor === 20,
    "Fries nested packaging preview: 1 case × 4 bags × 5 lb = 20 lb",
    friesCalc.previewString
  );

  const cansCalc = calculatePackDetailsAndFactor({
    packType: "Case",
    isNested: true,
    innerPackType: "Can",
    innerCustomTypeLabel: "#10 can",
    innerPackCount: 6,
    unitsPerInner: 102,
    packUnit: "OZ",
    stockUnit: "LB",
  });
  assert(
    cansCalc.isValid && cansCalc.conversionFactor === 38.25,
    "Canned tomatoes nested packaging with #10 can explicit net quantity: 6 cans × 102 oz = 38.25 lb",
    cansCalc.previewString
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(`  VERIFICATION RESULTS: ${passes} PASSED, ${fails} FAILED`);
  console.log("================================================================================");

  if (fails > 0) {
    process.exit(1);
  }
}

runVerification()
  .catch((err) => {
    console.error("FATAL ERROR during verification:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
