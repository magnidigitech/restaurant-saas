import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "@/core/database/client";
import {
  encryptPosCredentials,
  decryptPosCredentials,
  maskPosCredentials,
  resolveAndMigrateIntegrationCredentials,
  sanitizeProviderError,
} from "@/modules/pos-integrations/crypto";
import {
  connectPosIntegration,
  disconnectIntegration,
  executeSync,
  getProviderAdapter,
  getUnifiedOrdersDashboard,
} from "@/modules/pos-integrations/service";
import { assertPosOutletInScope } from "@/modules/pos-integrations/authHelper";
import { TipPoolService } from "@/modules/payroll/tipPoolService";
import { NormalizedOrder, PosProviderAdapter } from "@/modules/pos-integrations/types";

async function run() {
  console.log("Running POS Integrations & Orders Hub acceptance tests...");

  const suffix = Date.now().toString();
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `POS Hub Test ${suffix}`,
      subdomain: `pos-hub-test-${suffix}`,
      status: "ACTIVE",
    },
  });

  const [outletA, outletB] = await Promise.all([
    prisma.restaurantOutlet.create({
      data: {
        restaurantId: restaurant.id,
        name: "Downtown Flagship",
        currency: "USD",
      },
    }),
    prisma.restaurantOutlet.create({
      data: {
        restaurantId: restaurant.id,
        name: "Airport Kiosk",
        currency: "CAD",
      },
    }),
  ]);

  const ingredient = await prisma.inventoryItem.create({
    data: {
      restaurantId: restaurant.id,
      name: `Ribeye Cut ${suffix}`,
      unitOfMeasure: "KG",
      costPerUnit: 12,
    },
  });

  const recipe = await prisma.recipe.create({
    data: {
      restaurantId: restaurant.id,
      name: `Signature Ribeye ${suffix}`,
      type: "DISH",
      isDraft: false,
      sellingPrice: 40,
      items: {
        create: [
          {
            inventoryItemId: ingredient.id,
            quantity: 0.5,
            unitOfMeasure: "KG",
          },
        ],
      },
    },
  });

  try {
    // 1. Encryption, legacy plaintext migration, masking, error sanitization
    const rawCreds = {
      accessToken: "EAAA_sandbox_secret_token_999",
      environment: "SANDBOX" as const,
      webhookSecret: "whsec_super_secret",
    };
    const enc = encryptPosCredentials(rawCreds);
    assert.ok(!enc.includes("EAAA_sandbox_secret_token_999"));
    assert.deepEqual(decryptPosCredentials(enc), rawCreds);
    const masked = maskPosCredentials(rawCreds);
    assert.equal(masked.hasApiToken, true);
    assert.equal((masked as any).accessToken, undefined);

    const sanitized = sanitizeProviderError(
      new Error("Auth failed with Bearer EAAA_secret_123 and clientSecret=my_secret_val")
    );
    assert.ok(!sanitized.includes("EAAA_secret_123"));
    assert.ok(!sanitized.includes("my_secret_val"));

    // Legacy plaintext migration
    const legacyInt = await prisma.posIntegration.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outletB.id,
        provider: "SQUARE",
        status: "ACTIVE",
        environment: "SANDBOX",
        credentials: { accessToken: "EAAA_legacy_token", environment: "SANDBOX" },
      },
    });
    const migrated = await resolveAndMigrateIntegrationCredentials(legacyInt);
    assert.equal(migrated.accessToken, "EAAA_legacy_token");
    const afterMig = await prisma.posIntegration.findUnique({ where: { id: legacyInt.id } });
    assert.equal(afterMig?.credentials, null);
    assert.ok(afterMig?.credentialsEncrypted);

    // 2. Webhook signature verification for Toast, Square, Clover
    const webhookBody = JSON.stringify({ event: "order.updated", id: "123" });
    const toastSig = crypto.createHmac("sha256", "sec1").update(`${webhookBody}170000`, "utf8").digest("base64");
    assert.equal(
      getProviderAdapter("TOAST").verifyWebhookSignature!({
        rawBody: webhookBody,
        headers: { "toast-signature": toastSig, "toast-timestamp": "170000" },
        secret: "sec1",
      }),
      true
    );
    const sqUrl = "https://example.com/api/webhooks/pos/square";
    const sqSig = crypto.createHmac("sha256", "sec2").update(`${sqUrl}${webhookBody}`, "utf8").digest("base64");
    assert.equal(
      getProviderAdapter("SQUARE").verifyWebhookSignature!({
        rawBody: webhookBody,
        headers: { "x-square-hmacsha256-signature": sqSig },
        secret: "sec2",
        notificationUrl: sqUrl,
      }),
      true
    );
    const clvSig = crypto.createHmac("sha256", "sec3").update(webhookBody, "utf8").digest("hex");
    assert.equal(
      getProviderAdapter("CLOVER").verifyWebhookSignature!({
        rawBody: webhookBody,
        headers: { "x-clover-hmac-sha256": clvSig },
        secret: "sec3",
      }),
      true
    );

    // 3. Connect Square on Outlet A, run resumable 2-page backfill (reporting-only)
    const connA = await connectPosIntegration({
      restaurantId: restaurant.id,
      outletId: outletA.id,
      provider: "SQUARE",
      credentials: rawCreds,
      syncFrequency: "15_MIN",
    });

    const baseTime = new Date("2026-11-20T12:00:00.000Z");
    const mockOrder1: NormalizedOrder = {
      provider: "SQUARE",
      providerOrderId: "sq_test_1",
      orderNumber: "SQ-1001",
      orderType: "DINE_IN",
      status: "COMPLETED",
      currency: "USD",
      environment: "SANDBOX",
      totalAmount: 55,
      taxAmount: 5,
      tipAmount: 10,
      discountAmount: 0,
      serviceChargeAmount: 0,
      voidedAmount: 0,
      refundAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "SPLIT",
      payments: [
        { tenderType: "CARD", label: "VISA", amount: 35, tipAmount: 7 },
        { tenderType: "CASH", label: "Cash", amount: 20, tipAmount: 3 },
      ],
      createdAt: baseTime,
      providerUpdatedAt: baseTime,
      isPartialSnapshot: false,
      items: [
        {
          posMenuItemId: "ext_ribeye_1",
          providerItemId: "li_1",
          name: "Signature Ribeye",
          quantity: 1,
          unitPrice: 40,
          totalPrice: 40,
          netSales: 40,
          isVoided: false,
        },
      ],
    };

    const paginatedAdapter: PosProviderAdapter = {
      provider: "SQUARE",
      validateCredentials: async () => ({ valid: true }),
      fetchOrders: async (_creds, opts) => {
        if (!opts.cursor) {
          return { orders: [mockOrder1], nextCursor: "page2", hasMore: true };
        }
        return {
          orders: [
            {
              ...mockOrder1,
              providerOrderId: "sq_test_2",
              orderNumber: "SQ-1002",
              tipAmount: 5,
              payments: [{ tenderType: "CASH", label: "Cash", amount: 45, tipAmount: 5 }],
            },
          ],
          hasMore: false,
        };
      },
    };

    const backfillRes = await executeSync(restaurant.id, connA.id, {
      runType: "BACKFILL",
      adapterOverride: paginatedAdapter,
    });
    assert.equal(backfillRes.importedCount, 2);
    assert.equal(backfillRes.status, "SUCCEEDED");

    // Verify historical backfill moved zero stock
    const ledgerAfterBackfill = await prisma.stockLedger.count({
      where: { restaurantId: restaurant.id },
    });
    assert.equal(ledgerAfterBackfill, 0);

    // 4. Overlapping sync lock check
    await prisma.posIntegration.update({
      where: { id: connA.id },
      data: { activeSyncLockId: "lock-1", activeSyncStartedAt: new Date() },
    });
    await assert.rejects(
      () => executeSync(restaurant.id, connA.id, { adapterOverride: paginatedAdapter }),
      /already running/
    );
    await prisma.posIntegration.update({
      where: { id: connA.id },
      data: { activeSyncLockId: null, activeSyncStartedAt: null },
    });

    // 5. Stage 2: Tip-only update, stale guard, partial refund, and TipPool split-tender attribution
    const updatedTime = new Date("2026-11-20T12:10:00.000Z");
    const staleTime = new Date("2026-11-20T11:50:00.000Z");
    const updateAdapter: PosProviderAdapter = {
      provider: "SQUARE",
      validateCredentials: async () => ({ valid: true }),
      fetchOrders: async () => ({
        orders: [
          {
            ...mockOrder1,
            tipAmount: 14, // tip-only change (+4)
            payments: [
              { tenderType: "CARD", label: "VISA", amount: 35, tipAmount: 11 },
              { tenderType: "CASH", label: "Cash", amount: 20, tipAmount: 3 },
            ],
            providerUpdatedAt: updatedTime,
          },
          {
            ...mockOrder1,
            providerOrderId: "sq_test_2",
            orderNumber: "SQ-1002",
            tipAmount: 99, // should be skipped because providerUpdatedAt is older
            providerUpdatedAt: staleTime,
          },
        ],
        hasMore: false,
      }),
    };

    const updateRes = await executeSync(restaurant.id, connA.id, {
      runType: "INCREMENTAL",
      adapterOverride: updateAdapter,
    });
    assert.equal(updateRes.updatedCount, 1);

    // TipPoolService check: Cash tips = 3 + 5 = 8, Card tips = 11
    const tipPreview = await TipPoolService.previewTipPool(restaurant.id, {
      outletId: outletA.id,
      startDate: "2026-11-20T00:00:00.000Z",
      endDate: "2026-11-20T23:59:59.000Z",
    });
    assert.equal(tipPreview.cashTipsAmount, 8);
    assert.equal(tipPreview.cardTipsAmount, 11);

    // 6. Currency isolation & outlet scope check
    await prisma.posOrder.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outletB.id,
        orderNumber: "CAD-1",
        currency: "CAD",
        totalAmount: 30,
        finalAmount: 30,
        provider: "SQUARE",
        providerOrderId: "cad_1",
      },
    });
    const dash = await getUnifiedOrdersDashboard(restaurant.id, {});
    assert.equal(dash.totalsByCurrency.length, 2);
    assert.equal(
      assertPosOutletInScope(
        {
          userId: "u1",
          userEmail: "a@b.com",
          userName: "Staff",
          restaurantId: restaurant.id,
          membershipId: "m1",
          isAdmin: false,
          canViewPos: true,
          canTakeOrders: true,
          canManagePos: true,
          accessibleOutletIds: [outletA.id],
        },
        outletB.id
      ).ok,
      false
    );

    // 7. Stage 3: Enable stock posting with effective start time, map item, verify delta depletion
    const effectiveFrom = new Date("2026-11-21T00:00:00.000Z");
    await prisma.posIntegration.update({
      where: { id: connA.id },
      data: {
        stockPostingEnabled: true,
        stockPostingEffectiveFrom: effectiveFrom,
      },
    });

    await prisma.posMenuItemMapping.updateMany({
      where: {
        restaurantId: restaurant.id,
        outletId: outletA.id,
        externalItemId: "ext_ribeye_1",
      },
      data: { recipeId: recipe.id },
    });

    const postEffectiveOrder: NormalizedOrder = {
      ...mockOrder1,
      providerOrderId: "sq_test_live_1",
      orderNumber: "SQ-2001",
      createdAt: new Date("2026-11-21T14:00:00.000Z"),
      providerUpdatedAt: new Date("2026-11-21T14:00:00.000Z"),
      items: [
        {
          posMenuItemId: "ext_ribeye_1",
          providerItemId: "li_live_1",
          name: "Signature Ribeye",
          quantity: 2,
          unitPrice: 40,
          totalPrice: 80,
          netSales: 80,
          isVoided: false,
        },
      ],
    };

    const liveAdapter: PosProviderAdapter = {
      provider: "SQUARE",
      validateCredentials: async () => ({ valid: true }),
      fetchOrders: async () => ({ orders: [postEffectiveOrder], hasMore: false }),
    };

    await executeSync(restaurant.id, connA.id, {
      runType: "INCREMENTAL",
      adapterOverride: liveAdapter,
    });
    const getLedgerSum = async () => {
      const agg = await prisma.stockLedger.aggregate({
        where: { restaurantId: restaurant.id, outletId: outletA.id, itemId: ingredient.id },
        _sum: { quantity: true },
      });
      return Number(agg._sum.quantity || 0);
    };
    // 2 * 0.5 KG = 1.0 KG deducted -> -1
    assert.equal(await getLedgerSum(), -1);

    // Retry same order -> zero additional deduction
    await executeSync(restaurant.id, connA.id, {
      runType: "INCREMENTAL",
      adapterOverride: liveAdapter,
    });
    assert.equal(await getLedgerSum(), -1);

    // Financial refund alone does NOT restore stock
    const refundAdapter: PosProviderAdapter = {
      provider: "SQUARE",
      validateCredentials: async () => ({ valid: true }),
      fetchOrders: async () => ({
        orders: [
          {
            ...postEffectiveOrder,
            refundAmount: 40,
            paymentStatus: "PARTIAL",
            providerUpdatedAt: new Date("2026-11-21T14:05:00.000Z"),
          },
        ],
        hasMore: false,
      }),
    };
    await executeSync(restaurant.id, connA.id, {
      runType: "INCREMENTAL",
      adapterOverride: refundAdapter,
    });
    assert.equal(await getLedgerSum(), -1);

    // Voiding item reverses 1.0 KG back to net 0
    const voidAdapter: PosProviderAdapter = {
      provider: "SQUARE",
      validateCredentials: async () => ({ valid: true }),
      fetchOrders: async () => ({
        orders: [
          {
            ...postEffectiveOrder,
            status: "CANCELLED",
            providerUpdatedAt: new Date("2026-11-21T14:10:00.000Z"),
            items: [{ ...postEffectiveOrder.items[0], isVoided: true, netSales: 0 }],
          },
        ],
        hasMore: false,
      }),
    };
    await executeSync(restaurant.id, connA.id, {
      runType: "INCREMENTAL",
      adapterOverride: voidAdapter,
    });
    assert.equal(await getLedgerSum(), 0);

    // 8. 245 distinct orders across 3 pages: interrupt after page 1, resume, verify Hub & 0 stock moves
    const outlet245 = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Multi-Page Bistro", currency: "CAD" },
    });
    const conn245 = await connectPosIntegration({
      restaurantId: restaurant.id,
      outletId: outlet245.id,
      provider: "SQUARE",
      credentials: rawCreds,
      syncFrequency: "15_MIN",
    });

    const ledgerBefore245 = await prisma.stockLedger.count({ where: { outletId: outlet245.id } });
    const orders245: NormalizedOrder[] = Array.from({ length: 245 }, (_, i) => ({
      provider: "SQUARE",
      providerOrderId: `sq_245_${i + 1}`,
      orderNumber: `SQ-${3001 + i}`,
      orderType: "DINE_IN",
      status: "COMPLETED",
      currency: "",
      environment: "SANDBOX",
      totalAmount: 10,
      taxAmount: 1,
      tipAmount: 2,
      discountAmount: 0,
      serviceChargeAmount: 0,
      voidedAmount: 0,
      refundAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "CARD",
      createdAt: new Date(Date.UTC(2026, 10, 22, 12, i % 60, 0)),
      providerUpdatedAt: new Date(Date.UTC(2026, 10, 22, 12, i % 60, 0)),
      isPartialSnapshot: false,
      items: [
        {
          posMenuItemId: "ext_item_245",
          providerItemId: `li_245_${i + 1}`,
          name: "Bistro Plate",
          quantity: 1,
          unitPrice: 7,
          totalPrice: 7,
          netSales: 7,
          isVoided: false,
        },
      ],
    }));

    const adapter245: PosProviderAdapter = {
      provider: "SQUARE",
      validateCredentials: async () => ({ valid: true }),
      fetchOrders: async (_creds, opts) => {
        const startIdx = opts.cursor === "p2" ? 100 : opts.cursor === "p3" ? 200 : 0;
        const slice = orders245.slice(startIdx, startIdx + 100);
        const nextCursor = startIdx === 0 ? "p2" : startIdx === 100 ? "p3" : undefined;
        return { orders: slice, nextCursor, hasMore: Boolean(nextCursor) };
      },
    };

    // Interrupt after page 1
    const part1 = await executeSync(restaurant.id, conn245.id, {
      runType: "BACKFILL",
      since: new Date("2026-11-22T00:00:00.000Z"),
      until: new Date("2026-11-23T00:00:00.000Z"),
      maxPages: 1,
      adapterOverride: adapter245,
    });
    assert.equal(part1.status, "PARTIAL");
    assert.equal(part1.hasMore, true);
    assert.equal(part1.importedCount, 100);

    // Resume without re-specifying since/until
    const part2 = await executeSync(restaurant.id, conn245.id, {
      runType: "BACKFILL",
      adapterOverride: adapter245,
    });
    assert.equal(part2.status, "SUCCEEDED");
    assert.equal(part2.hasMore, false);
    assert.equal(part2.importedCount, 145);

    const dbCount245 = await prisma.posOrder.count({ where: { outletId: outlet245.id } });
    assert.equal(dbCount245, 245);

    const [hubP1, hubP2, hubP3] = await Promise.all([
      getUnifiedOrdersDashboard(restaurant.id, { outletId: outlet245.id, page: 1, pageSize: 100 }),
      getUnifiedOrdersDashboard(restaurant.id, { outletId: outlet245.id, page: 2, pageSize: 100 }),
      getUnifiedOrdersDashboard(restaurant.id, { outletId: outlet245.id, page: 3, pageSize: 100 }),
    ]);
    assert.equal(hubP1.pagination.totalCount, 245);
    assert.equal(hubP1.orders.length, 100);
    assert.equal(hubP2.pagination.totalCount, 245);
    assert.equal(hubP2.orders.length, 100);
    assert.equal(hubP3.pagination.totalCount, 245);
    assert.equal(hubP3.orders.length, 45);
    assert.deepEqual(hubP1.totalsByCurrency, hubP2.totalsByCurrency);
    assert.deepEqual(hubP2.totalsByCurrency, hubP3.totalsByCurrency);
    assert.equal(hubP1.totalsByCurrency[0].currency, "CAD");
    assert.equal(hubP1.totalsByCurrency[0].totalCollected, 2450);

    const ledgerAfter245 = await prisma.stockLedger.count({ where: { outletId: outlet245.id } });
    assert.equal(ledgerAfter245 - ledgerBefore245, 0);

    // 9. Disconnect preserves imported order history
    await disconnectIntegration(restaurant.id, connA.id);
    const preservedOrders = await prisma.posOrder.count({
      where: { restaurantId: restaurant.id, outletId: outletA.id },
    });
    assert.ok(preservedOrders >= 3);

    console.log("ALL POS INTEGRATIONS & ORDERS HUB TESTS PASSED!");
  } finally {
    await prisma.restaurant.delete({ where: { id: restaurant.id } }).catch(() => {});
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
