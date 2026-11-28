import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/core/database/client";
import { ToastAdapter } from "./adapters/toastAdapter";
import { SquareAdapter } from "./adapters/squareAdapter";
import { CloverAdapter } from "./adapters/cloverAdapter";
import {
  PosProviderAdapter,
  PosProviderType,
  ProviderCredentials,
  NormalizedOrder,
} from "./types";
import {
  encryptPosCredentials,
  encryptWebhookSecret,
  maskPosCredentials,
  resolveAndMigrateIntegrationCredentials,
  sanitizeProviderError,
} from "./crypto";
import {
  applyDeltaDepletionForOrder,
  resolveOrderItemMappings,
} from "./depletionSync";

const SYNC_LOCK_STALE_MS = 15 * 60 * 1000;

const FREQUENCY_MS: Record<string, number> = {
  "5_MIN": 5 * 60 * 1000,
  "15_MIN": 15 * 60 * 1000,
  "30_MIN": 30 * 60 * 1000,
  HOURLY: 60 * 60 * 1000,
};

function roundCents(val: number): number {
  return Math.round(val * 100) / 100;
}

export function getProviderAdapter(provider: string): PosProviderAdapter {
  switch (provider.toUpperCase()) {
    case "TOAST":
      return new ToastAdapter();
    case "SQUARE":
      return new SquareAdapter();
    case "CLOVER":
      return new CloverAdapter();
    default:
      throw new Error(`Unsupported POS provider: ${provider}`);
  }
}

export function computeOrderSyncHash(order: NormalizedOrder): string {
  const canonical = {
    orderType: order.orderType,
    status: order.status,
    paymentStatus: order.paymentStatus || "PAID",
    paymentMethod: order.paymentMethod || "",
    currency: order.currency || "USD",
    totalAmount: Math.round(order.totalAmount * 100),
    taxAmount: Math.round(order.taxAmount * 100),
    tipAmount: Math.round(order.tipAmount * 100),
    discountAmount: Math.round(order.discountAmount * 100),
    serviceChargeAmount: Math.round(order.serviceChargeAmount * 100),
    voidedAmount: Math.round(order.voidedAmount * 100),
    refundAmount: Math.round(order.refundAmount * 100),
    payments: (order.payments || []).map((p) => ({
      t: p.tenderType,
      a: Math.round(p.amount * 100),
      tip: Math.round(p.tipAmount * 100),
    })),
    refunds: (order.refunds || []).map((r) => ({
      id: r.externalRefundId,
      a: Math.round(r.amount * 100),
    })),
    items: (order.items || []).map((i, idx) => ({
      k: i.providerItemId || `item_${idx + 1}`,
      q: i.quantity,
      u: Math.round(i.unitPrice * 100),
      t: Math.round((i.totalPrice ?? i.quantity * i.unitPrice) * 100),
      tx: Math.round((i.taxAmount || 0) * 100),
      d: Math.round((i.discountAmount || 0) * 100),
      n: Math.round((i.netSales ?? i.quantity * i.unitPrice) * 100),
      rq: i.refundedQuantity || 0,
      v: Boolean(i.isVoided),
      m: i.modifiers || [],
    })),
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function computeIntegrationHealth(integration: {
  status: string;
  activeSyncLockId: string | null;
  lastSyncStatus: string | null;
  lastSuccessfulSyncAt: Date | null;
  syncFrequency: string;
}): "HEALTHY" | "STALE" | "ERROR" | "DISCONNECTED" | "SYNCING" {
  if (integration.status === "DISCONNECTED") return "DISCONNECTED";
  if (integration.activeSyncLockId) return "SYNCING";
  if (integration.status === "ERROR" || integration.lastSyncStatus === "FAILED") {
    return "ERROR";
  }
  const freqMs = FREQUENCY_MS[integration.syncFrequency];
  if (freqMs && integration.lastSuccessfulSyncAt) {
    if (Date.now() - integration.lastSuccessfulSyncAt.getTime() > freqMs * 2) {
      return "STALE";
    }
  }
  if (!integration.lastSuccessfulSyncAt && integration.status === "ACTIVE") {
    return "STALE";
  }
  return "HEALTHY";
}

export async function getIntegrationsList(
  restaurantId: string,
  accessibleOutletIds?: string[] | null
) {
  const where: Prisma.PosIntegrationWhereInput = { restaurantId };
  if (accessibleOutletIds !== undefined && accessibleOutletIds !== null) {
    where.outletId = { in: accessibleOutletIds };
  }

  const rows = await prisma.posIntegration.findMany({
    where,
    include: {
      outlet: { select: { id: true, name: true } },
      syncRuns: {
        orderBy: { startedAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const results = [];
  for (const row of rows) {
    let maskedCreds: Record<string, any> = {};
    try {
      const creds = await resolveAndMigrateIntegrationCredentials(row);
      maskedCreds = maskPosCredentials(creds);
    } catch {
      maskedCreds = { environment: row.environment };
    }

    results.push({
      id: row.id,
      restaurantId: row.restaurantId,
      outletId: row.outletId,
      outlet: row.outlet,
      provider: row.provider,
      providerLocationId: row.providerLocationId,
      providerLocationName: row.providerLocationName,
      providerMerchantId: row.providerMerchantId,
      status: row.status,
      environment: row.environment,
      isTestMode: row.isTestMode,
      syncFrequency: row.syncFrequency,
      lastSyncAt: row.lastSyncAt,
      lastSuccessfulSyncAt: row.lastSuccessfulSyncAt,
      lastSyncStatus: row.lastSyncStatus,
      backfillCompletedAt: row.backfillCompletedAt,
      errorMessage: row.errorMessage,
      importedOrdersCount: row.importedOrdersCount,
      stockPostingEnabled: row.stockPostingEnabled,
      stockPostingEffectiveFrom: row.stockPostingEffectiveFrom,
      health: computeIntegrationHealth(row),
      credentialsMasked: maskedCreds,
      syncRuns: row.syncRuns,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  return results;
}

export async function validateProviderCredentials(
  provider: PosProviderType,
  credentials: ProviderCredentials
) {
  const adapter = getProviderAdapter(provider);
  return adapter.validateCredentials(credentials);
}

export async function connectPosIntegration(params: {
  restaurantId: string;
  outletId: string;
  provider: PosProviderType;
  credentials: ProviderCredentials;
  providerLocationId?: string;
  providerLocationName?: string;
  syncFrequency?: string;
  isTestMode?: boolean;
}) {
  const adapter = getProviderAdapter(params.provider);
  const validation = await adapter.validateCredentials(params.credentials);

  if (!validation.valid) {
    throw new Error(validation.error || "Invalid POS credentials");
  }

  const locationId =
    params.providerLocationId || validation.locations?.[0]?.id || undefined;
  const locationName =
    params.providerLocationName || validation.locations?.[0]?.name || undefined;
  const environment =
    params.credentials.environment === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";

  const encrypted = encryptPosCredentials(params.credentials);
  const webhookEncrypted = params.credentials.webhookSecret
    ? encryptWebhookSecret(params.credentials.webhookSecret)
    : null;

  const existing = await prisma.posIntegration.findFirst({
    where: {
      restaurantId: params.restaurantId,
      outletId: params.outletId,
      provider: params.provider,
    },
  });

  if (existing) {
    const updated = await prisma.posIntegration.update({
      where: { id: existing.id },
      data: {
        providerLocationId: locationId,
        providerLocationName: locationName,
        providerMerchantId: params.credentials.merchantId || params.credentials.restaurantGuid || null,
        status: "ACTIVE",
        environment,
        isTestMode: params.isTestMode ?? environment === "SANDBOX",
        credentials: Prisma.JsonNull,
        credentialsEncrypted: encrypted,
        ...(webhookEncrypted ? { webhookSecretEncrypted: webhookEncrypted } : {}),
        syncFrequency: params.syncFrequency || existing.syncFrequency,
        errorMessage: null,
        syncError: null,
      },
    });
    return {
      ...updated,
      credentials: undefined,
      credentialsEncrypted: undefined,
      webhookSecretEncrypted: undefined,
      credentialsMasked: maskPosCredentials(params.credentials),
    };
  }

  const created = await prisma.posIntegration.create({
    data: {
      restaurantId: params.restaurantId,
      outletId: params.outletId,
      provider: params.provider,
      providerLocationId: locationId,
      providerLocationName: locationName,
      providerMerchantId: params.credentials.merchantId || params.credentials.restaurantGuid || null,
      status: "ACTIVE",
      environment,
      isTestMode: params.isTestMode ?? environment === "SANDBOX",
      credentials: Prisma.JsonNull,
      credentialsEncrypted: encrypted,
      webhookSecretEncrypted: webhookEncrypted,
      syncFrequency: params.syncFrequency || "15_MIN",
    },
  });

  return {
    ...created,
    credentials: undefined,
    credentialsEncrypted: undefined,
    webhookSecretEncrypted: undefined,
    credentialsMasked: maskPosCredentials(params.credentials),
  };
}

export async function testIntegrationConnection(
  restaurantId: string,
  integrationId: string
) {
  const integration = await prisma.posIntegration.findFirst({
    where: { id: integrationId, restaurantId },
  });
  if (!integration) {
    throw new Error("Integration not found");
  }

  const creds = await resolveAndMigrateIntegrationCredentials(integration);
  const adapter = getProviderAdapter(integration.provider);
  const validation = await adapter.validateCredentials(creds);

  await prisma.posIntegration.update({
    where: { id: integration.id },
    data: {
      status: validation.valid ? "ACTIVE" : "ERROR",
      errorMessage: validation.valid
        ? null
        : sanitizeProviderError(validation.error),
    },
  });

  return validation;
}

export async function disconnectIntegration(
  restaurantId: string,
  integrationId: string,
  _action: "DEACTIVATE" | "DELETE" = "DEACTIVATE"
) {
  const integration = await prisma.posIntegration.findFirst({
    where: { id: integrationId, restaurantId },
  });
  if (!integration) {
    throw new Error("Integration not found");
  }

  // Always preserve imported order history on disconnect
  const updated = await prisma.posIntegration.update({
    where: { id: integration.id },
    data: {
      status: "DISCONNECTED",
      activeSyncLockId: null,
      activeSyncStartedAt: null,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    ordersPreserved: true,
  };
}

async function fetchWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 150 * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastErr;
}

interface ResumableSyncCursor {
  since: string;
  until: string;
  cursor: string;
}

function encodeResumableCursor(data: ResumableSyncCursor): string {
  return JSON.stringify(data);
}

function decodeResumableCursor(raw?: string | null): ResumableSyncCursor | { cursor: string } | null {
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.cursor === "string") {
        return parsed as ResumableSyncCursor;
      }
    } catch {
      // fall through to legacy raw cursor
    }
  }
  return { cursor: raw };
}

export async function executeSync(
  restaurantIdOrIntegrationId: string,
  integrationIdArg?: string,
  options?: {
    runType?: "BACKFILL" | "INCREMENTAL" | "WEBHOOK" | "MANUAL";
    businessDate?: string;
    since?: Date;
    until?: Date;
    limit?: number;
    maxPages?: number;
    timeBudgetMs?: number;
    userId?: string;
    adapterOverride?: PosProviderAdapter;
  }
) {
  let restaurantId = restaurantIdOrIntegrationId;
  let integrationId = integrationIdArg;
  if (!integrationId) {
    const found = await prisma.posIntegration.findUnique({
      where: { id: restaurantIdOrIntegrationId },
      select: { id: true, restaurantId: true },
    });
    if (!found) {
      throw new Error("POS Integration not found");
    }
    restaurantId = found.restaurantId;
    integrationId = found.id;
  }

  const integration = await prisma.posIntegration.findFirst({
    where: { id: integrationId, restaurantId },
    include: { outlet: { select: { currency: true } } },
  });
  if (!integration) {
    throw new Error("POS Integration not found");
  }
  if (integration.status === "DISCONNECTED") {
    throw new Error("Cannot sync a disconnected POS integration");
  }

  const lockId = crypto.randomUUID();
  const staleThreshold = new Date(Date.now() - SYNC_LOCK_STALE_MS);

  const lockClaim = await prisma.posIntegration.updateMany({
    where: {
      id: integration.id,
      OR: [
        { activeSyncLockId: null },
        { activeSyncStartedAt: { lt: staleThreshold } },
      ],
    },
    data: {
      activeSyncLockId: lockId,
      activeSyncStartedAt: new Date(),
    },
  });

  if (lockClaim.count === 0) {
    throw new Error("A sync job is already running for this POS connection");
  }

  const runType = options?.runType || "INCREMENTAL";
  const rawStoredCursor =
    runType === "BACKFILL" ? integration.backfillCursor : integration.syncCursor;
  const decodedCursor = decodeResumableCursor(rawStoredCursor);

  const hasExplicitRange = Boolean(options?.since || options?.until);
  const resumableWindow =
    !hasExplicitRange && decodedCursor && "since" in decodedCursor && "until" in decodedCursor
      ? decodedCursor
      : null;

  const rangeEnd = options?.until || (resumableWindow ? new Date(resumableWindow.until) : new Date());
  const rangeStart =
    options?.since ||
    (resumableWindow
      ? new Date(resumableWindow.since)
      : runType === "BACKFILL"
        ? new Date(rangeEnd.getTime() - 30 * 24 * 60 * 60 * 1000)
        : integration.lastSuccessfulSyncAt ||
          new Date(rangeEnd.getTime() - 24 * 60 * 60 * 1000));

  let currentCursor =
    hasExplicitRange
      ? undefined
      : decodedCursor?.cursor;

  const syncRun = await prisma.posSyncRun.create({
    data: {
      restaurantId,
      outletId: integration.outletId,
      integrationId: integration.id,
      runType,
      status: "RUNNING",
      rangeStart,
      rangeEnd,
      cursorIn: currentCursor || null,
    },
  });

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let incompleteDueToBudget = false;
  const maxPages = options?.maxPages || 200;
  const startedAtMs = Date.now();
  const timeBudgetMs = options?.timeBudgetMs ?? 0;

  try {
    const creds = await resolveAndMigrateIntegrationCredentials(integration);
    const adapter =
      options?.adapterOverride || getProviderAdapter(integration.provider);

    for (let page = 0; page < maxPages; page++) {
      if (timeBudgetMs > 0 && page > 0 && Date.now() - startedAtMs >= timeBudgetMs) {
        incompleteDueToBudget = true;
        break;
      }

      const fetchRes = await fetchWithRetry(() =>
        adapter.fetchOrders(creds, {
          locationId: integration.providerLocationId || undefined,
          businessDate: options?.businessDate,
          since: rangeStart,
          until: rangeEnd,
          cursor: currentCursor,
          limit: options?.limit || 100,
          mode: runType,
        })
      );

      for (const order of fetchRes.orders) {
        try {
          const outcome = await upsertNormalizedPosOrder({
            restaurantId,
            outletId: integration.outletId,
            outletCurrency: integration.outlet?.currency || "USD",
            integration,
            order,
            runType,
            userId: options?.userId,
          });
          if (outcome === "IMPORTED") importedCount += 1;
          else if (outcome === "UPDATED") updatedCount += 1;
          else skippedCount += 1;
        } catch (orderErr) {
          failedCount += 1;
          console.error(
            `POS order upsert error (${order.providerOrderId}):`,
            sanitizeProviderError(orderErr)
          );
        }
      }

      // Advance cursor ONLY after this page's covered orders are saved
      const hasMore = Boolean(fetchRes.hasMore && fetchRes.nextCursor);
      currentCursor = hasMore ? fetchRes.nextCursor : undefined;
      const persistedCursor = currentCursor
        ? encodeResumableCursor({
            since: rangeStart.toISOString(),
            until: rangeEnd.toISOString(),
            cursor: currentCursor,
          })
        : null;

      await prisma.posIntegration.update({
        where: { id: integration.id },
        data:
          runType === "BACKFILL"
            ? {
                backfillCursor: persistedCursor,
                ...(hasMore ? {} : { backfillCompletedAt: new Date() }),
              }
            : { syncCursor: persistedCursor },
      });

      if (!hasMore) {
        break;
      }

      if (page === maxPages - 1) {
        incompleteDueToBudget = true;
      }
    }

    const totalOrdersCount = await prisma.posOrder.count({
      where: { restaurantId, outletId: integration.outletId, provider: integration.provider },
    });

    const finalRunStatus =
      incompleteDueToBudget || (failedCount > 0 && importedCount + updatedCount > 0)
        ? "PARTIAL"
        : failedCount > 0
          ? "FAILED"
          : "SUCCEEDED";

    await prisma.$transaction([
      prisma.posSyncRun.update({
        where: { id: syncRun.id },
        data: {
          status: finalRunStatus,
          cursorOut: currentCursor || null,
          importedCount,
          updatedCount,
          skippedCount,
          failedCount,
          ...(incompleteDueToBudget
            ? { errorSummary: "Paused at page/time budget; saved cursor for automatic resume" }
            : {}),
          finishedAt: new Date(),
        },
      }),
      prisma.posIntegration.update({
        where: { id: integration.id },
        data: {
          status: "ACTIVE",
          lastSyncAt: new Date(),
          ...(finalRunStatus === "SUCCEEDED" && runType !== "BACKFILL"
            ? { lastSuccessfulSyncAt: new Date() }
            : {}),
          lastSyncStatus: finalRunStatus,
          errorMessage:
            failedCount > 0
              ? `${failedCount} order(s) failed during sync`
              : incompleteDueToBudget
                ? "Sync paused at budget; remaining pages queued for resume"
                : null,
          importedOrdersCount: totalOrdersCount,
          activeSyncLockId: null,
          activeSyncStartedAt: null,
        },
      }),
    ]);

    return {
      success: true,
      syncRunId: syncRun.id,
      status: finalRunStatus,
      hasMore: incompleteDueToBudget,
      importedCount,
      updatedCount,
      skippedCount,
      failedCount,
      importedOrdersCount: importedCount,
      updatedOrdersCount: updatedCount,
      skippedOrdersCount: skippedCount,
      cursorOut: currentCursor || null,
    };
  } catch (err: any) {
    const safeError = sanitizeProviderError(err);

    await prisma.$transaction([
      prisma.posSyncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "FAILED",
          cursorOut: currentCursor || null,
          importedCount,
          updatedCount,
          skippedCount,
          failedCount: failedCount + 1,
          errorSummary: safeError,
          finishedAt: new Date(),
        },
      }),
      prisma.posIntegration.update({
        where: { id: integration.id },
        data: {
          status: "ERROR",
          lastSyncAt: new Date(),
          lastSyncStatus: "FAILED",
          errorMessage: safeError,
          activeSyncLockId: null,
          activeSyncStartedAt: null,
        },
      }),
    ]);

    throw new Error(safeError);
  }
}

function mapPaymentStatus(status?: NormalizedOrder["paymentStatus"]): "PENDING" | "PAID" | "REFUNDED" | "PARTIALLY_REFUNDED" {
  if (status === "PARTIAL") return "PARTIALLY_REFUNDED";
  if (status === "REFUNDED") return "REFUNDED";
  if (status === "PENDING" || status === "FAILED") return "PENDING";
  return "PAID";
}

export async function upsertNormalizedPosOrder(params: {
  restaurantId: string;
  outletId: string;
  outletCurrency?: string;
  integration: {
    id: string;
    environment: string;
    stockPostingEnabled: boolean;
    stockPostingEffectiveFrom: Date | null;
  };
  order: NormalizedOrder;
  runType: "BACKFILL" | "INCREMENTAL" | "WEBHOOK" | "MANUAL";
  userId?: string;
}): Promise<"IMPORTED" | "UPDATED" | "SKIPPED"> {
  const { restaurantId, outletId, outletCurrency, integration, order } = params;
  const resolvedCurrency = order.currency || outletCurrency || "USD";
  const normalizedWithCurrency: NormalizedOrder = {
    ...order,
    currency: resolvedCurrency,
  };
  const syncHash = computeOrderSyncHash(normalizedWithCurrency);

  const existing = await prisma.posOrder.findUnique({
    where: {
      restaurantId_provider_providerOrderId: {
        restaurantId,
        provider: order.provider,
        providerOrderId: order.providerOrderId,
      },
    },
    include: { items: true },
  });

  if (existing) {
    // External identity guard: do not cross-overwrite different integration account or environment
    if (
      (existing.integrationId && existing.integrationId !== integration.id) ||
      (existing.environment && existing.environment !== order.environment)
    ) {
      return "SKIPPED";
    }

    // Stale update guard
    if (
      existing.providerUpdatedAt &&
      order.providerUpdatedAt &&
      order.providerUpdatedAt.getTime() < existing.providerUpdatedAt.getTime()
    ) {
      return "SKIPPED";
    }

    const dbMatchesOrder =
      existing.syncHash === syncHash &&
      existing.orderType === order.orderType &&
      existing.status === order.status &&
      (existing.businessDate || null) === (order.businessDate || null) &&
      Math.round(Number(existing.totalAmount) * 100) === Math.round(order.totalAmount * 100) &&
      Math.round(Number(existing.tipAmount) * 100) === Math.round(order.tipAmount * 100) &&
      Math.round(Number(existing.refundAmount) * 100) === Math.round(order.refundAmount * 100);

    if (dbMatchesOrder) {
      await prisma.posOrder.update({
        where: { id: existing.id },
        data: { lastSyncedAt: new Date() },
      });
      return "SKIPPED";
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const ord = await tx.posOrder.update({
        where: { id: existing.id },
        data: {
          integrationId: integration.id,
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          status: order.status,
          currency: resolvedCurrency,
          environment: order.environment,
          totalAmount: roundCents(order.totalAmount),
          taxAmount: roundCents(order.taxAmount),
          discountAmount: roundCents(order.discountAmount),
          tipAmount: roundCents(order.tipAmount),
          serviceChargeAmount: roundCents(order.serviceChargeAmount),
          voidedAmount: roundCents(order.voidedAmount),
          refundAmount: roundCents(order.refundAmount),
          finalAmount: roundCents(order.totalAmount),
          paymentStatus: mapPaymentStatus(order.paymentStatus),
          paymentMethod: order.paymentMethod || existing.paymentMethod,
          paymentsJson: (order.payments || []) as unknown as Prisma.InputJsonValue,
          refundsJson: (order.refunds || []) as unknown as Prisma.InputJsonValue,
          providerUpdatedAt: order.providerUpdatedAt || null,
          providerVersion: order.providerVersion || null,
          businessDate: order.businessDate || existing.businessDate || null,
          syncHash,
          isPartialSnapshot: Boolean(order.isPartialSnapshot),
          lastSyncedAt: new Date(),
          customerName: order.customerName ?? existing.customerName,
          customerPhone: order.customerPhone ?? existing.customerPhone,
          notes: order.notes ?? existing.notes,
          rawPayload: (order.rawPayload || undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      const incomingIds = new Set<string>();

      for (let idx = 0; idx < order.items.length; idx++) {
        const i = order.items[idx];
        const providerItemId = i.providerItemId || `item_${idx + 1}`;
        incomingIds.add(providerItemId);
        const totalPrice = roundCents(i.totalPrice ?? i.quantity * i.unitPrice);
        const netSales = roundCents(
          i.netSales ?? (i.isVoided ? 0 : totalPrice - (i.discountAmount || 0))
        );

        await tx.posOrderItem.upsert({
          where: {
            orderId_providerItemId: {
              orderId: existing.id,
              providerItemId,
            },
          },
          update: {
            posMenuItemId: i.posMenuItemId || null,
            externalVariantId: i.externalVariantId || null,
            name: i.name,
            quantity: i.quantity,
            unitPrice: roundCents(i.unitPrice),
            totalPrice,
            taxAmount: roundCents(i.taxAmount || 0),
            discountAmount: roundCents(i.discountAmount || 0),
            netSales,
            refundedQuantity: i.refundedQuantity || 0,
            isVoided: Boolean(i.isVoided),
            modifiers: (i.modifiers || []) as unknown as Prisma.InputJsonValue,
          },
          create: {
            orderId: existing.id,
            posMenuItemId: i.posMenuItemId || null,
            providerItemId,
            externalVariantId: i.externalVariantId || null,
            name: i.name,
            quantity: i.quantity,
            unitPrice: roundCents(i.unitPrice),
            totalPrice,
            taxAmount: roundCents(i.taxAmount || 0),
            discountAmount: roundCents(i.discountAmount || 0),
            netSales,
            refundedQuantity: i.refundedQuantity || 0,
            isVoided: Boolean(i.isVoided),
            modifiers: (i.modifiers || []) as unknown as Prisma.InputJsonValue,
          },
        });
      }

      // Only delete missing items when adapter confirms a complete order snapshot
      if (!order.isPartialSnapshot) {
        const toDelete = existing.items.filter(
          (ex) => ex.providerItemId && !incomingIds.has(ex.providerItemId)
        );
        if (toDelete.length > 0) {
          await tx.posOrderItem.deleteMany({
            where: { id: { in: toDelete.map((d) => d.id) } },
          });
        }
      }

      return ord;
    });

    await resolveOrderItemMappings({
      restaurantId,
      outletId,
      provider: order.provider,
      orderId: updatedOrder.id,
    });

    await applyDeltaDepletionForOrder({
      restaurantId,
      outletId,
      orderId: updatedOrder.id,
      runType: params.runType,
      stockPostingEnabled: integration.stockPostingEnabled,
      stockPostingEffectiveFrom: integration.stockPostingEffectiveFrom,
      userId: params.userId,
    });

    return "UPDATED";
  }

  const createdOrder = await prisma.posOrder.create({
    data: {
      restaurantId,
      outletId,
      integrationId: integration.id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      status: order.status,
      currency: resolvedCurrency,
      environment: order.environment,
      totalAmount: roundCents(order.totalAmount),
      taxAmount: roundCents(order.taxAmount),
      discountAmount: roundCents(order.discountAmount),
      tipAmount: roundCents(order.tipAmount),
      serviceChargeAmount: roundCents(order.serviceChargeAmount),
      voidedAmount: roundCents(order.voidedAmount),
      refundAmount: roundCents(order.refundAmount),
      finalAmount: roundCents(order.totalAmount),
      paymentStatus: mapPaymentStatus(order.paymentStatus),
      paymentMethod: order.paymentMethod || null,
      paymentsJson: (order.payments || []) as unknown as Prisma.InputJsonValue,
      refundsJson: (order.refunds || []) as unknown as Prisma.InputJsonValue,
      provider: order.provider,
      providerOrderId: order.providerOrderId,
      providerLocationId: order.providerLocationId || null,
      providerUpdatedAt: order.providerUpdatedAt || null,
      providerVersion: order.providerVersion || null,
      businessDate: order.businessDate || null,
      syncHash,
      isPartialSnapshot: Boolean(order.isPartialSnapshot),
      lastSyncedAt: new Date(),
      customerName: order.customerName || null,
      customerPhone: order.customerPhone || null,
      notes: order.notes || null,
      rawPayload: (order.rawPayload || undefined) as Prisma.InputJsonValue | undefined,
      createdAt: order.createdAt,
      items: {
        create: order.items.map((i, idx) => {
          const totalPrice = roundCents(i.totalPrice ?? i.quantity * i.unitPrice);
          const netSales = roundCents(
            i.netSales ?? (i.isVoided ? 0 : totalPrice - (i.discountAmount || 0))
          );
          return {
            posMenuItemId: i.posMenuItemId || null,
            providerItemId: i.providerItemId || `item_${idx + 1}`,
            externalVariantId: i.externalVariantId || null,
            name: i.name,
            quantity: i.quantity,
            unitPrice: roundCents(i.unitPrice),
            totalPrice,
            taxAmount: roundCents(i.taxAmount || 0),
            discountAmount: roundCents(i.discountAmount || 0),
            netSales,
            refundedQuantity: i.refundedQuantity || 0,
            isVoided: Boolean(i.isVoided),
            modifiers: (i.modifiers || []) as unknown as Prisma.InputJsonValue,
          };
        }),
      },
    },
  });

  await resolveOrderItemMappings({
    restaurantId,
    outletId,
    provider: order.provider,
    orderId: createdOrder.id,
  });

  await applyDeltaDepletionForOrder({
    restaurantId,
    outletId,
    orderId: createdOrder.id,
    runType: params.runType,
    stockPostingEnabled: integration.stockPostingEnabled,
    stockPostingEffectiveFrom: integration.stockPostingEffectiveFrom,
    userId: params.userId,
  });

  return "IMPORTED";
}

export async function runScheduledPosSyncs() {
  const activeIntegrations = await prisma.posIntegration.findMany({
    where: { status: "ACTIVE" },
  });

  const now = Date.now();
  const results: Array<{ integrationId: string; status: string; error?: string }> = [];

  for (const integration of activeIntegrations) {
    // Automatically resume any unfinished historical backfill first
    if (integration.backfillCursor && !integration.backfillCompletedAt) {
      try {
        const res = await executeSync(integration.restaurantId, integration.id, {
          runType: "BACKFILL",
        });
        results.push({ integrationId: integration.id, status: `BACKFILL_${res.status}` });
      } catch (err: any) {
        results.push({
          integrationId: integration.id,
          status: "BACKFILL_FAILED",
          error: sanitizeProviderError(err),
        });
      }
    }

    const freqMs = FREQUENCY_MS[integration.syncFrequency];
    if (!freqMs) continue; // MANUAL or unknown frequency

    if (
      integration.lastSyncAt &&
      now - integration.lastSyncAt.getTime() < freqMs
    ) {
      continue;
    }

    try {
      const res = await executeSync(integration.restaurantId, integration.id, {
        runType: "INCREMENTAL",
      });
      results.push({ integrationId: integration.id, status: res.status });
    } catch (err: any) {
      results.push({
        integrationId: integration.id,
        status: "FAILED",
        error: sanitizeProviderError(err),
      });
    }
  }

  return results;
}

export async function getUnifiedOrdersDashboard(
  restaurantId: string,
  filters?: {
    outletId?: string;
    accessibleOutletIds?: string[] | null;
    provider?: string;
    status?: string;
    businessDate?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }
) {
  const where: Prisma.PosOrderWhereInput = { restaurantId };

  if (filters?.outletId && filters.outletId !== "ALL") {
    where.outletId = filters.outletId;
  } else if (
    filters?.accessibleOutletIds !== undefined &&
    filters.accessibleOutletIds !== null
  ) {
    where.outletId = { in: filters.accessibleOutletIds };
  }

  if (filters?.provider && filters.provider !== "ALL") {
    where.provider = filters.provider;
  }
  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status as any;
  }
  if (filters?.businessDate) {
    where.businessDate = filters.businessDate.replace(/-/g, "");
  }
  if (filters?.search) {
    where.OR = [
      { orderNumber: { contains: filters.search, mode: "insensitive" } },
      { customerName: { contains: filters.search, mode: "insensitive" } },
      { providerOrderId: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const page = Math.max(1, filters?.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters?.pageSize || 25));

  const [totalCount, orders, allMatchingForTotals] = await Promise.all([
    prisma.posOrder.count({ where }),
    prisma.posOrder.findMany({
      where,
      include: {
        items: {
          include: { recipe: { select: { id: true, name: true } } },
        },
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.posOrder.findMany({
      where,
      select: {
        currency: true,
        status: true,
        totalAmount: true,
        taxAmount: true,
        tipAmount: true,
        discountAmount: true,
        serviceChargeAmount: true,
        voidedAmount: true,
        refundAmount: true,
      },
    }),
  ]);

  // Never mix different currencies into a single combined total
  const totalsByCurrency: Record<
    string,
    {
      currency: string;
      orderCount: number;
      grossSales: number;
      discounts: number;
      refunds: number;
      netSales: number;
      tax: number;
      tips: number;
      serviceCharges: number;
      totalCollected: number;
    }
  > = {};

  for (const o of allMatchingForTotals) {
    const curr = o.currency || "USD";
    if (!totalsByCurrency[curr]) {
      totalsByCurrency[curr] = {
        currency: curr,
        orderCount: 0,
        grossSales: 0,
        discounts: 0,
        refunds: 0,
        netSales: 0,
        tax: 0,
        tips: 0,
        serviceCharges: 0,
        totalCollected: 0,
      };
    }
    const bucket = totalsByCurrency[curr];
    bucket.orderCount += 1;
    if (o.status === "CANCELLED") continue;

    const total = Number(o.totalAmount || 0);
    const tax = Number(o.taxAmount || 0);
    const tips = Number(o.tipAmount || 0);
    const discounts = Number(o.discountAmount || 0);
    const refunds = Number(o.refundAmount || 0);
    const svc = Number(o.serviceChargeAmount || 0);
    const net = Math.max(0, total - tax - tips - svc + refunds);
    const gross = net + discounts;

    bucket.grossSales = roundCents(bucket.grossSales + gross);
    bucket.discounts = roundCents(bucket.discounts + discounts);
    bucket.refunds = roundCents(bucket.refunds + refunds);
    bucket.netSales = roundCents(bucket.netSales + net);
    bucket.tax = roundCents(bucket.tax + tax);
    bucket.tips = roundCents(bucket.tips + tips);
    bucket.serviceCharges = roundCents(bucket.serviceCharges + svc);
    bucket.totalCollected = roundCents(bucket.totalCollected + total);
  }

  return {
    orders,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
    totalsByCurrency: Object.values(totalsByCurrency),
  };
}
