import assert from "node:assert/strict";
import { prisma } from "@/core/database/client";
import { InventoryService } from "@/modules/inventory/service";
import { assertInventoryOutletInScope } from "@/modules/inventory/authHelper";
import {
  approveAndPostStockCount,
  getStockCountDetail,
  refreshStockCountReview,
  saveCountEntries,
  startOrResumeStockCount,
  submitStockCount,
} from "@/modules/inventory/stockCountService";

async function run() {
  console.log("Running Phase 1 Inventory Control & Stock Reconciliation tests...");

  const suffix = Date.now().toString();
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Inv Recon Test ${suffix}`,
      subdomain: `inv-recon-${suffix}`,
      status: "ACTIVE",
    },
  });

  const [outletA, outletB] = await Promise.all([
    prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Calgary Main", currency: "CAD" },
    }),
    prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Downtown Branch", currency: "CAD" },
    }),
  ]);

  const user = await prisma.user.create({
    data: {
      email: `inv-mgr-${suffix}@example.com`,
      name: "Outlet Manager",
      passwordHash: "test",
    },
  });

  try {
    // 1. Create Tomato (LB) with Box (40 LB) purchase pack
    const tomato = await prisma.inventoryItem.create({
      data: {
        restaurantId: restaurant.id,
        name: `Roma Tomato ${suffix}`,
        unitOfMeasure: "LB",
        costPerUnit: 2.0,
        purchasePacks: {
          create: [
            {
              restaurantId: restaurant.id,
              name: "Box",
              packType: "BOX",
              packUnit: "LB",
              netQuantityPerPack: 40,
              conversionFactor: 40,
            },
          ],
        },
      },
    });

    const boxPack = await prisma.itemPurchasePack.findFirstOrThrow({
      where: { itemId: tomato.id },
    });

    // 2. Receive 3 boxes × 40 lb = 120 lb
    await InventoryService.addStockMovement(restaurant.id, {
      outletId: outletA.id,
      itemId: tomato.id,
      movementType: "PURCHASE",
      quantity: 0,
      packId: boxPack.id,
      packCount: 3,
      referenceId: "PO-1001",
      recordedBy: user.id,
    });

    // 3. Record 5 lb of waste
    await InventoryService.logWastage(restaurant.id, {
      outletId: outletA.id,
      itemId: tomato.id,
      quantity: 5,
      reason: "EXPIRED",
      notes: "Bruised crate",
      recordedBy: user.id,
    });

    // 4. Verify ledger explains 115 lb expected balance
    const summary1 = await InventoryService.getItemLedgerBreakdown(
      restaurant.id,
      tomato.id,
      outletA.id
    );
    assert.equal(summary1.attribution.purchase, 120);
    assert.equal(summary1.attribution.wastage, -5);
    assert.equal(summary1.expectedBalance, 115);
    assert.equal(summary1.movements.length, 2);
    // Newest first: wastage (runningBalance 115), then purchase (runningBalance 120)
    assert.equal(summary1.movements[0].movementType, "WASTAGE");
    assert.equal(summary1.movements[0].runningBalance, 115);
    assert.equal(summary1.movements[1].movementType, "PURCHASE");
    assert.equal(summary1.movements[1].runningBalance, 120);

    // 5. Verify atomic transfer, recipe consumption, and adjustment attribution
    await InventoryService.transferStockBetweenOutlets(restaurant.id, {
      fromOutletId: outletA.id,
      toOutletId: outletB.id,
      itemId: tomato.id,
      quantity: 10,
      notes: "Prep support",
      recordedBy: user.id,
    });
    await InventoryService.addStockMovement(restaurant.id, {
      outletId: outletA.id,
      itemId: tomato.id,
      movementType: "CONSUMPTION",
      quantity: 2,
      referenceId: "ORD-5001",
      recordedBy: user.id,
    });
    await InventoryService.addStockMovement(restaurant.id, {
      outletId: outletA.id,
      itemId: tomato.id,
      movementType: "ADJUSTMENT",
      quantity: 1,
      notes: "Scale recalibration",
      recordedBy: user.id,
    });

    const summaryA = await InventoryService.getItemLedgerBreakdown(
      restaurant.id,
      tomato.id,
      outletA.id
    );
    assert.equal(summaryA.attribution.purchase, 120);
    assert.equal(summaryA.attribution.wastage, -5);
    assert.equal(summaryA.attribution.transferOut, -10);
    assert.equal(summaryA.attribution.consumption, -2);
    assert.equal(summaryA.attribution.adjustment, 1);
    assert.equal(summaryA.expectedBalance, 104);

    const summaryB = await InventoryService.getItemLedgerBreakdown(
      restaurant.id,
      tomato.id,
      outletB.id
    );
    assert.equal(summaryB.attribution.transferIn, 10);
    assert.equal(summaryB.expectedBalance, 10);

    // 6. Phase 2 Physical Stock Counts & Variance Approval
    const [salt, oliveOil] = await Promise.all([
      prisma.inventoryItem.create({
        data: { restaurantId: restaurant.id, name: `Kosher Salt ${suffix}`, unitOfMeasure: "LB" },
      }),
      prisma.inventoryItem.create({
        data: { restaurantId: restaurant.id, name: `Olive Oil ${suffix}`, unitOfMeasure: "L" },
      }),
    ]);

    const outletC = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Westside Count Outlet", currency: "CAD" },
    });

    // Receive 3 boxes × 40 lb = 120 lb, log 5 lb waste -> 115 lb expected
    const t0 = new Date(Date.now() - 60_000);
    await prisma.stockLedger.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outletC.id,
        itemId: tomato.id,
        movementType: "PURCHASE",
        quantity: 120,
        referenceId: "PO-2001",
        recordedBy: user.id,
        occurredAt: new Date(t0.getTime() - 20_000),
      },
    });
    await prisma.stockLedger.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outletC.id,
        itemId: tomato.id,
        movementType: "WASTAGE",
        quantity: -5,
        referenceId: "WST-2001",
        recordedBy: user.id,
        occurredAt: new Date(t0.getTime() - 10_000),
      },
    });

    const draftCount = await startOrResumeStockCount(restaurant.id, {
      outletId: outletC.id,
      userId: user.id,
      cutoffAt: t0,
    });

    const ledgerCountBeforeSubmit = await prisma.stockLedger.count({
      where: { outletId: outletC.id },
    });

    // Enter 2 boxes + 32 lb (= 112 lb) for Tomato, explicit 0 for Salt, leave Olive Oil uncounted
    await saveCountEntries(restaurant.id, draftCount.id, user.id, [
      {
        itemId: tomato.id,
        isCounted: true,
        baseQty: 32,
        packs: [{ packId: boxPack.id, packCount: 2 }],
      },
      { itemId: salt.id, isCounted: true, baseQty: 0 },
      { itemId: oliveOil.id, isCounted: false },
    ]);

    // Edit pack after counting (40 -> 50 lb) -> recorded count must stay 112 lb
    await prisma.itemPurchasePack.update({
      where: { id: boxPack.id },
      data: { netQuantityPerPack: 50, conversionFactor: 50 },
    });

    const submitted = await submitStockCount(restaurant.id, draftCount.id, user.id);
    assert.equal(
      await prisma.stockLedger.count({ where: { outletId: outletC.id } }),
      ledgerCountBeforeSubmit
    );

    const tomatoRow = submitted.items.find((i) => i.itemId === tomato.id)!;
    assert.equal(tomatoRow.expectedAtCutoff, 115);
    assert.equal(tomatoRow.countedBaseQty, 112);
    assert.equal(tomatoRow.varianceQty, -3);
    assert.ok(submitted.skippedItems.some((s) => s.itemId === oliveOil.id));

    // Overlapping count blocked while SUBMITTED
    await assert.rejects(
      () => startOrResumeStockCount(restaurant.id, { outletId: outletC.id, userId: user.id }),
      /awaiting manager approval/
    );

    // +20 lb delivery AFTER cutoff and BEFORE approval
    await prisma.stockLedger.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outletC.id,
        itemId: tomato.id,
        movementType: "PURCHASE",
        quantity: 20,
        referenceId: "PO-2002",
        recordedBy: user.id,
        occurredAt: new Date(t0.getTime() + 30_000),
      },
    });

    // Concurrent approval -> only one succeeds and posts exactly one -3 lb adjustment
    const [app1, app2] = await Promise.allSettled([
      approveAndPostStockCount(restaurant.id, draftCount.id, user.id),
      approveAndPostStockCount(restaurant.id, draftCount.id, user.id),
    ]);
    const fulfilled = [app1, app2].filter((r) => r.status === "fulfilled");
    const rejected = [app1, app2].filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal((fulfilled[0] as PromiseFulfilledResult<any>).value.postedAdjustmentsCount, 1);

    const finalTomato = await InventoryService.getItemLedgerBreakdown(
      restaurant.id,
      tomato.id,
      outletC.id
    );
    // 115 - 3 + 20 = 132 lb
    assert.equal(finalTomato.expectedBalance, 132);

    // Backdated movement requires refresh before approval
    const t1 = new Date();
    const count2 = await startOrResumeStockCount(restaurant.id, {
      outletId: outletC.id,
      userId: user.id,
      cutoffAt: t1,
      itemIds: [tomato.id],
    });
    await saveCountEntries(restaurant.id, count2.id, user.id, [
      { itemId: tomato.id, isCounted: true, baseQty: 130 },
    ]);
    await submitStockCount(restaurant.id, count2.id, user.id);

    // Insert backdated movement before cutoffAt
    await prisma.stockLedger.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outletC.id,
        itemId: tomato.id,
        movementType: "WASTAGE",
        quantity: -2,
        recordedBy: user.id,
        occurredAt: new Date(t1.getTime() - 1000),
      },
    });

    const staleCheck = await getStockCountDetail(restaurant.id, count2.id);
    assert.equal(staleCheck.requiresRefresh, true);
    await assert.rejects(
      () => approveAndPostStockCount(restaurant.id, count2.id, user.id),
      /Refresh review before approving/
    );
    await refreshStockCountReview(restaurant.id, count2.id, user.id);
    const approved2 = await approveAndPostStockCount(restaurant.id, count2.id, user.id);
    assert.equal(approved2.status, "APPROVED");

    // Out-of-scope manager blocked
    assert.equal(
      assertInventoryOutletInScope(
        {
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          restaurantId: restaurant.id,
          membershipId: "m1",
          isAdmin: false,
          canViewInventory: true,
          canManageInventory: true,
          accessibleOutletIds: [outletA.id],
        },
        outletC.id
      ).ok,
      false
    );

    // 7. Verify Calgary Toast integration stockPostingEnabled remains false
    const calgary = await prisma.posIntegration.findUnique({
      where: { id: "d172f932-37fe-4744-8031-2f54eb4f26fd" },
      select: { stockPostingEnabled: true },
    });
    if (calgary) {
      assert.equal(calgary.stockPostingEnabled, false);
    }

    console.log("PHASE 1 INVENTORY CONTROL & STOCK RECONCILIATION TESTS PASSED!");
  } finally {
    await prisma.restaurant.delete({ where: { id: restaurant.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
