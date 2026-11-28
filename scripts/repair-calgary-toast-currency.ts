import "dotenv/config";
import { prisma } from "../src/core/database/client";
import { resolveAndMigrateIntegrationCredentials } from "../src/modules/pos-integrations/crypto";

const CALGARY_OUTLET_ID = "4cb82e99-c85d-4230-9735-3fd9d9f9425b";
const TOAST_BASE_URL = "https://ws-api.toasttab.com";

async function fetchToastWithRetry(url: string, init: RequestInit, maxRetries = 4): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429 || attempt === maxRetries) {
      return res;
    }
    const retryAfter = Number(res.headers.get("retry-after") || "2");
    const waitMs = Math.max(1000, (Number.isFinite(retryAfter) ? retryAfter : 2) * 1000);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw new Error("Exhausted Toast retries");
}

async function main() {
  const integration = await prisma.posIntegration.findFirstOrThrow({
    where: {
      outletId: CALGARY_OUTLET_ID,
      provider: "TOAST",
      environment: "PRODUCTION",
    },
    select: {
      id: true,
      restaurantId: true,
      outletId: true,
      providerLocationId: true,
      credentials: true,
      credentialsEncrypted: true,
      outlet: { select: { name: true, currency: true, timezone: true } },
    },
  });

  // 1. Before snapshot
  const beforeCounts = await prisma.posOrder.groupBy({
    by: ["currency"],
    where: { restaurantId: integration.restaurantId, outletId: integration.outletId },
    _count: { id: true },
    _sum: {
      totalAmount: true,
      discountAmount: true,
      taxAmount: true,
      serviceChargeAmount: true,
      tipAmount: true,
      finalAmount: true,
    },
  });
  const beforeTotal = await prisma.posOrder.count({
    where: { restaurantId: integration.restaurantId, outletId: integration.outletId },
  });
  const beforeLedger = await prisma.stockLedger.count({
    where: { restaurantId: integration.restaurantId, outletId: integration.outletId },
  });

  // 2. Verify authoritative Toast restaurant currency
  const creds = await resolveAndMigrateIntegrationCredentials(integration);
  const tokenRes = await fetchToastWithRetry(`${TOAST_BASE_URL}/authentication/v1/authentication/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      userAccessType: "TOAST_MACHINE_CLIENT",
    }),
  });
  const tokenJson = (await tokenRes.json()) as any;
  const accessToken = tokenJson?.token?.accessToken;
  if (!accessToken) {
    throw new Error(`Toast authentication failed (status ${tokenRes.status})`);
  }

  const restGuid = integration.providerLocationId!;
  const restRes = await fetchToastWithRetry(`${TOAST_BASE_URL}/restaurants/v1/restaurants/${restGuid}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Toast-Restaurant-External-ID": restGuid,
    },
  });
  const restJson = (await restRes.json()) as any;
  const toastCurrencyCode: string | undefined = restJson?.general?.currencyCode;

  if (toastCurrencyCode !== "CAD") {
    throw new Error(`Expected Toast restaurant currencyCode CAD, got ${toastCurrencyCode}`);
  }

  // 3. Classify any USD-labeled orders for Calgary
  const usdOrders = await prisma.posOrder.findMany({
    where: {
      restaurantId: integration.restaurantId,
      outletId: integration.outletId,
      currency: "USD",
    },
    select: {
      id: true,
      provider: true,
      providerLocationId: true,
      rawPayload: true,
    },
  });

  const confirmedCadIds: string[] = [];
  const genuineUsdIds: string[] = [];
  const unverifiedIds: string[] = [];

  for (const row of usdOrders) {
    const raw = row.rawPayload as any;
    const rawCurrency = typeof raw?.currency === "string" ? raw.currency.toUpperCase() : "";
    if (rawCurrency === "USD") {
      genuineUsdIds.push(row.id);
    } else if (
      row.provider === "TOAST" &&
      row.providerLocationId === restGuid &&
      (rawCurrency === "" || rawCurrency === "CAD")
    ) {
      confirmedCadIds.push(row.id);
    } else {
      unverifiedIds.push(row.id);
    }
  }

  // 4. Update only confirmed CAD orders (no amount conversion)
  let updatedCount = 0;
  if (confirmedCadIds.length > 0) {
    const res = await prisma.posOrder.updateMany({
      where: {
        id: { in: confirmedCadIds },
        currency: "USD",
      },
      data: {
        currency: "CAD",
      },
    });
    updatedCount = res.count;
  }

  // 5. After snapshot
  const afterCounts = await prisma.posOrder.groupBy({
    by: ["currency"],
    where: { restaurantId: integration.restaurantId, outletId: integration.outletId },
    _count: { id: true },
    _sum: {
      totalAmount: true,
      discountAmount: true,
      taxAmount: true,
      serviceChargeAmount: true,
      tipAmount: true,
      finalAmount: true,
    },
  });
  const afterTotal = await prisma.posOrder.count({
    where: { restaurantId: integration.restaurantId, outletId: integration.outletId },
  });
  const afterLedger = await prisma.stockLedger.count({
    where: { restaurantId: integration.restaurantId, outletId: integration.outletId },
  });

  console.log(
    JSON.stringify(
      {
        toastCurrencyCode,
        classification: {
          usdFound: usdOrders.length,
          confirmedCad: confirmedCadIds.length,
          genuineUsd: genuineUsdIds.length,
          unverified: unverifiedIds.length,
        },
        updatedCount,
        beforeTotal,
        afterTotal,
        beforeLedger,
        afterLedger,
        beforeCounts,
        afterCounts,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
