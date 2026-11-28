import assert from "node:assert/strict";
import { prisma } from "@/core/database/client";
import { depleteOrderInventory, explodeRecipeToRawIngredients } from "@/core/inventory/depletionEngine";
import { connectPosIntegration, executeSync } from "@/modules/pos-integrations/service";
import { NormalizedOrder, PosProviderAdapter } from "@/modules/pos-integrations/types";

async function run() {
  console.log("Running Phase 3 Conditional Packaging & Pilot Tests...");

  const suffix = Date.now().toString();
  const restaurant = await prisma.restaurant.create({
    data: { name: `Pkg Pilot ${suffix}`, subdomain: `pkg-pilot-${suffix}`, status: "ACTIVE" },
  });
  const outlet = await prisma.restaurantOutlet.create({
    data: { restaurantId: restaurant.id, name: "Calgary Pilot", currency: "CAD", timezone: "America/Edmonton" },
  });
  const user = await prisma.user.create({
    data: { email: `pkg-pilot-${suffix}@example.com`, name: "Pilot Mgr", passwordHash: "test" },
  });

  const [paneer, tomato, container] = await Promise.all([
    prisma.inventoryItem.create({
      data: { restaurantId: restaurant.id, name: `Paneer ${suffix}`, unitOfMeasure: "KG", costPerUnit: 10 },
    }),
    prisma.inventoryItem.create({
      data: { restaurantId: restaurant.id, name: `Tomato ${suffix}`, unitOfMeasure: "LB", costPerUnit: 2 },
    }),
    prisma.inventoryItem.create({
      data: { restaurantId: restaurant.id, name: `Takeout Container 32oz ${suffix}`, unitOfMeasure: "PIECES", costPerUnit: 0.5 },
    }),
  ]);

  const gravySub = await prisma.recipe.create({
    data: {
      restaurantId: restaurant.id,
      name: `Makhani Gravy ${suffix}`,
      type: "SUB_RECIPE",
      yieldQuantity: 1,
      yieldUnit: "PORTION",
      isDraft: false,
      items: {
        create: [{ componentType: "INVENTORY_ITEM", inventoryItemId: tomato.id, quantity: 0.2, unitOfMeasure: "LB", wastagePercent: 20 }],
      },
    },
  });

  const dish = await prisma.recipe.create({
    data: {
      restaurantId: restaurant.id,
      name: `Paneer Butter Masala ${suffix}`,
      type: "DISH",
      isDraft: false,
      items: {
        create: [
          { componentType: "INVENTORY_ITEM", inventoryItemId: paneer.id, quantity: 0.19, unitOfMeasure: "KG", wastagePercent: 5 },
          { componentType: "SUB_RECIPE", subRecipeId: gravySub.id, quantity: 1, unitOfMeasure: "PORTION", wastagePercent: 0 },
          {
            componentType: "INVENTORY_ITEM",
            inventoryItemId: container.id,
            quantity: 1,
            unitOfMeasure: "PIECES",
            wastagePercent: 0,
            isPackaging: true,
            applicableOrderTypes: ["TAKEAWAY", "DELIVERY"],
          },
        ],
      },
    },
  });

  try {
    // 1. Dry-run explosion by orderType
    const dineInExp = await explodeRecipeToRawIngredients(dish.id, 1, new Set(), [], { orderType: "DINE_IN" });
    assert.equal(Number(dineInExp.get(paneer.id)!.quantity.toFixed(4)), 0.2);
    assert.equal(Number(dineInExp.get(tomato.id)!.quantity.toFixed(4)), 0.25);
    assert.equal(dineInExp.has(container.id), false, "DINE_IN must consume 0 containers");

    const takeawayExp = await explodeRecipeToRawIngredients(dish.id, 1, new Set(), [], { orderType: "TAKEAWAY" });
    assert.equal(takeawayExp.get(container.id)!.quantity, 1, "TAKEAWAY must consume 1 container");

    const deliveryExp = await explodeRecipeToRawIngredients(dish.id, 1, new Set(), [], { orderType: "DELIVERY" });
    assert.equal(deliveryExp.get(container.id)!.quantity, 1, "DELIVERY must consume 1 container");

    let unknownFlagged = false;
    const unknownExp = await explodeRecipeToRawIngredients(dish.id, 1, new Set(), [], {
      orderType: "UNKNOWN",
      onPackagingSkippedForUnknown: () => { unknownFlagged = true; },
    });
    assert.equal(unknownFlagged, true);
    assert.equal(unknownExp.has(container.id), false);
    assert.equal(Number(unknownExp.get(paneer.id)!.quantity.toFixed(4)), 0.2);

    // 2. Connect POS, map dish, enable forward-only posting
    const conn = await connectPosIntegration({
      restaurantId: restaurant.id,
      outletId: outlet.id,
      provider: "TOAST",
      credentials: { clientId: "sandbox_pilot", clientSecret: "sec", restaurantGuid: "guid_pilot", environment: "SANDBOX" },
    });
    await prisma.posMenuItemMapping.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet.id,
        provider: "TOAST",
        externalItemId: "toast_pbm_1",
        externalItemName: "Paneer Butter Masala",
        externalVariantId: "",
        recipeId: dish.id,
        effectiveFrom: new Date("2026-11-27T18:00:00.000Z"),
      },
    });
    await prisma.posIntegration.update({
      where: { id: conn.id },
      data: { stockPostingEnabled: true, stockPostingEffectiveFrom: new Date("2026-11-27T18:00:00.000Z") },
    });

    const getOrderNet = async (orderId: string, itemId: string) => {
      const agg = await prisma.stockLedger.aggregate({
        where: { outletId: outlet.id, referenceId: orderId, itemId },
        _sum: { quantity: true },
      });
      return Number(Number(agg._sum.quantity || 0).toFixed(4));
    };

    const mkOrder = (overrides: Partial<NormalizedOrder>): NormalizedOrder => ({
      provider: "TOAST",
      providerOrderId: "ord_take_1",
      orderNumber: "TST-901",
      orderType: "TAKEAWAY",
      status: "COMPLETED",
      currency: "CAD",
      environment: "SANDBOX",
      totalAmount: 20,
      taxAmount: 1,
      tipAmount: 2,
      discountAmount: 0,
      serviceChargeAmount: 0,
      voidedAmount: 0,
      refundAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "CARD",
      createdAt: new Date("2026-11-27T19:00:00.000Z"),
      providerUpdatedAt: new Date("2026-11-27T19:00:00.000Z"),
      isPartialSnapshot: false,
      items: [{ posMenuItemId: "toast_pbm_1", providerItemId: "li_1", name: "Paneer Butter Masala", quantity: 1, unitPrice: 18, totalPrice: 18, netSales: 18, isVoided: false }],
      ...overrides,
    });

    // 3. Sync TAKEAWAY order -> deducts food + 1 container
    const syncOrder = async (ord: NormalizedOrder, runType: "INCREMENTAL" | "BACKFILL" = "INCREMENTAL") => {
      const adp: PosProviderAdapter = {
        provider: "TOAST",
        validateCredentials: async () => ({ valid: true }),
        fetchOrders: async () => ({ orders: [ord], hasMore: false }),
      };
      return executeSync(restaurant.id, conn.id, { runType, adapterOverride: adp });
    };

    await syncOrder(mkOrder({}));
    const dbOrd = await prisma.posOrder.findFirstOrThrow({ where: { restaurantId: restaurant.id, providerOrderId: "ord_take_1" } });
    assert.equal(await getOrderNet(dbOrd.id, paneer.id), -0.2);
    assert.equal(await getOrderNet(dbOrd.id, container.id), -1);

    // 4. Sync retry -> 0 additional movements
    const countBeforeRetry = await prisma.stockLedger.count({ where: { outletId: outlet.id } });
    await syncOrder(mkOrder({}));
    assert.equal(await prisma.stockLedger.count({ where: { outletId: outlet.id } }), countBeforeRetry);

    // 5. Order type change: TAKEAWAY -> DINE_IN reverses ONLY container (+1), leaves food intact
    await syncOrder(mkOrder({ orderType: "DINE_IN", providerUpdatedAt: new Date("2026-11-27T19:02:00.000Z") }));
    assert.equal(await getOrderNet(dbOrd.id, paneer.id), -0.2);
    assert.equal(await getOrderNet(dbOrd.id, tomato.id), -0.25);
    assert.equal(await getOrderNet(dbOrd.id, container.id), 0);

    // 6. Quantity edit 1 -> 2 on DINE_IN -> doubles food, still 0 containers
    await syncOrder(mkOrder({
      orderType: "DINE_IN",
      providerUpdatedAt: new Date("2026-11-27T19:05:00.000Z"),
      items: [{ posMenuItemId: "toast_pbm_1", providerItemId: "li_1", name: "Paneer Butter Masala", quantity: 2, unitPrice: 18, totalPrice: 36, netSales: 36, isVoided: false }],
    }));
    assert.equal(await getOrderNet(dbOrd.id, paneer.id), -0.4);
    assert.equal(await getOrderNet(dbOrd.id, container.id), 0);

    // 7. Void reverses recorded food movements back to 0
    await syncOrder(mkOrder({
      orderType: "DINE_IN",
      status: "CANCELLED",
      providerUpdatedAt: new Date("2026-11-27T19:08:00.000Z"),
      items: [{ posMenuItemId: "toast_pbm_1", providerItemId: "li_1", name: "Paneer Butter Masala", quantity: 2, unitPrice: 18, totalPrice: 36, netSales: 0, isVoided: true }],
    }));
    assert.equal(await getOrderNet(dbOrd.id, paneer.id), 0);
    assert.equal(await getOrderNet(dbOrd.id, tomato.id), 0);

    // 8. UNKNOWN order type posts food and sets packagingReviewRequired = true
    await syncOrder(mkOrder({
      providerOrderId: "ord_unk_1",
      orderNumber: "TST-902",
      orderType: "UNKNOWN",
    }));
    const unkOrd = await prisma.posOrder.findFirstOrThrow({ where: { restaurantId: restaurant.id, providerOrderId: "ord_unk_1" } });
    assert.equal(unkOrd.packagingReviewRequired, true);
    assert.equal(await getOrderNet(unkOrd.id, paneer.id), -0.2);
    assert.equal(await getOrderNet(unkOrd.id, container.id), 0);

    // 9. Reporting-only backfill creates 0 stock movements
    const countBeforeBackfill = await prisma.stockLedger.count({ where: { outletId: outlet.id } });
    await syncOrder(mkOrder({
      providerOrderId: "ord_hist_1",
      orderNumber: "TST-700",
      orderType: "DELIVERY",
      createdAt: new Date("2026-11-20T12:00:00.000Z"),
    }), "BACKFILL");
    assert.equal(await prisma.stockLedger.count({ where: { outletId: outlet.id } }), countBeforeBackfill);

    // 10. Manual POS order respects orderType (DINE_IN -> 0 containers, TAKEAWAY -> 1 container)
    const manualDine = await prisma.posOrder.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet.id,
        orderNumber: "MAN-1",
        orderType: "DINE_IN",
        totalAmount: 18,
        finalAmount: 18,
        items: { create: [{ recipeId: dish.id, name: "Paneer Butter Masala", quantity: 1, unitPrice: 18, totalPrice: 18 }] },
      },
    });
    await depleteOrderInventory(manualDine.id, user.id);
    assert.equal(await getOrderNet(manualDine.id, paneer.id), -0.2);
    assert.equal(await getOrderNet(manualDine.id, container.id), 0);

    const manualTake = await prisma.posOrder.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet.id,
        orderNumber: "MAN-2",
        orderType: "TAKEAWAY",
        totalAmount: 18,
        finalAmount: 18,
        items: { create: [{ recipeId: dish.id, name: "Paneer Butter Masala", quantity: 1, unitPrice: 18, totalPrice: 18 }] },
      },
    });
    await depleteOrderInventory(manualTake.id, user.id);
    assert.equal(await getOrderNet(manualTake.id, container.id), -1);

    console.log("PHASE 3 CONDITIONAL PACKAGING & PILOT TESTS PASSED!");
  } finally {
    await prisma.restaurant.delete({ where: { id: restaurant.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
