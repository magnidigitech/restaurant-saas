import { prisma } from "@/core/database/client";
import { ToastAdapter } from "./adapters/toastAdapter";
import { SquareAdapter } from "./adapters/squareAdapter";
import { CloverAdapter } from "./adapters/cloverAdapter";
import {
  PosProviderType,
  PosProviderAdapter,
  ProviderCredentials,
  PosEnvironmentType,
  NormalizedOrder,
} from "./types";

export function getProviderAdapter(provider: PosProviderType): PosProviderAdapter {
  switch (provider) {
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

export interface ConnectPayload {
  provider: PosProviderType;
  outletId: string;
  environment: PosEnvironmentType;
  credentials: ProviderCredentials;
  providerLocationId?: string;
  providerLocationName?: string;
  importPeriodDays?: number; // e.g., 7, 30, 90
}

export async function getIntegrationsList(restaurantId: string) {
  const integrations = await prisma.posIntegration.findMany({
    where: { restaurantId },
    include: {
      outlet: {
        select: {
          id: true,
          name: true,
          currency: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate order counts per integration / provider
  const summaries = await Promise.all(
    integrations.map(async (integ) => {
      const ordersCount = await prisma.posOrder.count({
        where: {
          restaurantId,
          outletId: integ.outletId,
          provider: integ.provider,
        },
      });

      // Mask sensitive credential values for security
      const creds = (integ.credentials as any) || {};
      const maskedCredentials: Record<string, string> = {};
      if (creds.accessToken) maskedCredentials.accessToken = `••••••••${creds.accessToken.slice(-4)}`;
      if (creds.clientSecret) maskedCredentials.clientSecret = `••••••••${creds.clientSecret.slice(-4)}`;
      if (creds.apiToken) maskedCredentials.apiToken = `••••••••${creds.apiToken.slice(-4)}`;
      if (creds.merchantId) maskedCredentials.merchantId = creds.merchantId;
      if (creds.restaurantGuid) maskedCredentials.restaurantGuid = creds.restaurantGuid;

      return {
        id: integ.id,
        restaurantId: integ.restaurantId,
        outletId: integ.outletId,
        outletName: integ.outlet.name,
        provider: integ.provider as PosProviderType,
        status: integ.status,
        environment: integ.environment as PosEnvironmentType,
        providerLocationId: integ.providerLocationId,
        providerLocationName: integ.providerLocationName,
        lastSyncAt: integ.lastSyncAt,
        lastSyncStatus: integ.lastSyncStatus,
        errorMessage: integ.errorMessage,
        ordersImportedCount: ordersCount,
        maskedCredentials,
        createdAt: integ.createdAt,
      };
    })
  );

  return summaries;
}

export async function validateProviderCredentials(
  provider: PosProviderType,
  credentials: ProviderCredentials
) {
  const adapter = getProviderAdapter(provider);
  return await adapter.validateCredentials(credentials);
}

export async function connectPosIntegration(restaurantId: string, payload: ConnectPayload) {
  const adapter = getProviderAdapter(payload.provider);

  // 1. Validate credentials with adapter
  const validation = await adapter.validateCredentials(payload.credentials);
  if (!validation.valid) {
    throw new Error(validation.error || "Failed to validate POS credentials");
  }

  // 2. Verify outlet belongs to restaurant
  const outlet = await prisma.restaurantOutlet.findFirst({
    where: { id: payload.outletId, restaurantId },
  });
  if (!outlet) {
    throw new Error("Specified outlet does not belong to this restaurant");
  }

  // 3. Upsert PosIntegration
  const existing = await prisma.posIntegration.findFirst({
    where: {
      restaurantId,
      outletId: payload.outletId,
      provider: payload.provider,
    },
  });

  let integration;
  if (existing) {
    integration = await prisma.posIntegration.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        environment: payload.environment,
        credentials: payload.credentials as any,
        providerLocationId: payload.providerLocationId || null,
        providerLocationName: payload.providerLocationName || null,
        errorMessage: null,
      },
    });
  } else {
    integration = await prisma.posIntegration.create({
      data: {
        restaurantId,
        outletId: payload.outletId,
        provider: payload.provider,
        status: "ACTIVE",
        environment: payload.environment,
        credentials: payload.credentials as any,
        providerLocationId: payload.providerLocationId || null,
        providerLocationName: payload.providerLocationName || null,
      },
    });
  }

  // 4. Trigger initial import
  const importDays = payload.importPeriodDays || 30;
  const since = new Date(Date.now() - importDays * 24 * 60 * 60 * 1000);

  let initialImportCount = 0;
  try {
    const syncResult = await executeSync(integration.id, since);
    initialImportCount = syncResult.newOrdersCount;
  } catch (syncErr: any) {
    console.error("Initial import partial failure:", syncErr);
    // Even if initial sync has warnings, integration remains configured
  }

  return {
    integrationId: integration.id,
    provider: integration.provider,
    status: integration.status,
    environment: integration.environment,
    initialImportCount,
  };
}

export async function executeSync(integrationId: string, since?: Date) {
  const integration = await prisma.posIntegration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw new Error("Integration not found");
  }

  const adapter = getProviderAdapter(integration.provider as PosProviderType);
  const credentials = integration.credentials as unknown as ProviderCredentials;

  try {
    const fetchResult = await adapter.fetchOrders(credentials, {
      locationId: integration.providerLocationId || undefined,
      since: since || integration.lastSyncAt || undefined,
      limit: 50,
    });

    let newOrdersCount = 0;
    let updatedOrdersCount = 0;

    for (const order of fetchResult.orders) {
      // Check if order already exists (Idempotent import to prevent duplicate orders)
      const existingOrder = await prisma.posOrder.findFirst({
        where: {
          restaurantId: integration.restaurantId,
          provider: order.provider,
          providerOrderId: order.providerOrderId,
        },
      });

      if (existingOrder) {
        // Reflect updates, cancellations, and refunds
        await prisma.posOrder.update({
          where: { id: existingOrder.id },
          data: {
            status: order.status,
            totalAmount: order.totalAmount,
            taxAmount: order.taxAmount,
            tipAmount: order.tipAmount,
            refundAmount: order.refundAmount,
            discountAmount: order.discountAmount,
            paymentMethod: order.paymentMethod,
            customerName: order.customerName || existingOrder.customerName,
            customerPhone: order.customerPhone || existingOrder.customerPhone,
            rawPayload: order.rawPayload,
            updatedAt: new Date(),
          },
        });
        updatedOrdersCount++;
      } else {
        // Create new synced order
        const createdOrder = await prisma.posOrder.create({
          data: {
            restaurantId: integration.restaurantId,
            outletId: integration.outletId,
            provider: order.provider,
            providerOrderId: order.providerOrderId,
            providerLocationId: order.providerLocationId,
            orderNumber: order.orderNumber,
            orderType: order.orderType,
            status: order.status,
            totalAmount: order.totalAmount,
            taxAmount: order.taxAmount,
            tipAmount: order.tipAmount,
            discountAmount: order.discountAmount,
            refundAmount: order.refundAmount,
            paymentMethod: order.paymentMethod,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            rawPayload: order.rawPayload,
            notes: order.notes,
            createdAt: order.createdAt,
          },
        });

        // Add line items
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            await prisma.posOrderItem.create({
              data: {
                orderId: createdOrder.id,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                notes: item.notes,
                modifiers: item.modifiers ? (item.modifiers as any) : undefined,
              },
            });
          }
        }

        newOrdersCount++;
      }
    }

    // Update integration sync timestamp and status
    await prisma.posIntegration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "SUCCESS",
        errorMessage: null,
      },
    });

    return {
      success: true,
      newOrdersCount,
      updatedOrdersCount,
      totalProcessed: fetchResult.orders.length,
      recordsRequiringAttention: fetchResult.recordsRequiringAttention || 0,
    };
  } catch (err: any) {
    await prisma.posIntegration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "ERROR",
        errorMessage: err.message || "Synchronization failed",
      },
    });
    throw err;
  }
}

export async function disconnectIntegration(
  restaurantId: string,
  integrationId: string,
  action: "DEACTIVATE" | "DELETE" = "DEACTIVATE"
) {
  const integration = await prisma.posIntegration.findFirst({
    where: { id: integrationId, restaurantId },
  });

  if (!integration) {
    throw new Error("Integration not found");
  }

  if (action === "DEACTIVATE") {
    // Preserve previously imported orders for reporting & historical audit
    await prisma.posIntegration.update({
      where: { id: integrationId },
      data: {
        status: "DISCONNECTED",
        errorMessage: "Integration disconnected by user. Synced order history preserved as read-only.",
      },
    });
    return {
      message: "Integration disconnected. Historical orders remain intact as read-only.",
    };
  } else {
    // Permanent deletion of connection configuration
    await prisma.posIntegration.delete({
      where: { id: integrationId },
    });
    return {
      message: "Integration credentials removed. Historical orders retained.",
    };
  }
}

export interface DashboardFilters {
  outletId?: string;
  provider?: string;
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function getUnifiedOrdersDashboard(restaurantId: string, filters: DashboardFilters) {
  const where: any = { restaurantId };

  if (filters.outletId && filters.outletId !== "ALL") {
    where.outletId = filters.outletId;
  }

  if (filters.provider && filters.provider !== "ALL") {
    where.provider = filters.provider;
  }

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { providerOrderId: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q, mode: "insensitive" } },
    ];
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const limit = Math.min(filters.limit || 25, 100);
  const offset = filters.offset || 0;

  const [orders, totalCount, aggregateData] = await Promise.all([
    prisma.posOrder.findMany({
      where,
      include: {
        outlet: { select: { id: true, name: true, currency: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.posOrder.count({ where }),
    prisma.posOrder.aggregate({
      where,
      _sum: {
        totalAmount: true,
        taxAmount: true,
        tipAmount: true,
        refundAmount: true,
        discountAmount: true,
      },
      _count: { id: true },
    }),
  ]);

  const grossVolume = aggregateData._sum.totalAmount || 0;
  const totalTax = aggregateData._sum.taxAmount || 0;
  const totalTips = aggregateData._sum.tipAmount || 0;
  const totalRefunds = aggregateData._sum.refundAmount || 0;
  const netSales = Math.max(0, grossVolume - totalTax - totalRefunds);
  const orderCount = aggregateData._count.id || 0;
  const aov = orderCount > 0 ? grossVolume / orderCount : 0;

  return {
    orders,
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + orders.length < totalCount,
    },
    metrics: {
      grossVolume: Number(grossVolume.toFixed(2)),
      netSales: Number(netSales.toFixed(2)),
      orderCount,
      aov: Number(aov.toFixed(2)),
      totalTips: Number(totalTips.toFixed(2)),
      totalRefunds: Number(totalRefunds.toFixed(2)),
    },
  };
}
