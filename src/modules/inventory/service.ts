import { prisma } from "@/core/database/client";

export const InventoryService = {
  // ── Categories ──────────────────────────────────────────────────────────
  async getCategories(restaurantId: string) {
    return prisma.inventoryCategory.findMany({
      where: { restaurantId, parentId: null },
      include: {
        children: {
          include: {
            _count: { select: { items: true } },
          },
        },
        _count: { select: { items: true } },
      },
      orderBy: { name: "asc" },
    });
  },

  async createCategory(
    restaurantId: string,
    data: { name: string; description?: string; parentId?: string }
  ) {
    return prisma.inventoryCategory.create({
      data: {
        restaurantId,
        name: data.name,
        description: data.description,
        parentId: data.parentId || null,
      },
    });
  },

  async updateCategory(
    restaurantId: string,
    id: string,
    data: { name?: string; description?: string; parentId?: string | null }
  ) {
    await prisma.inventoryCategory.findFirstOrThrow({ where: { id, restaurantId } });
    return prisma.inventoryCategory.update({
      where: { id },
      data,
    });
  },

  async deleteCategory(restaurantId: string, id: string) {
    await prisma.inventoryCategory.findFirstOrThrow({ where: { id, restaurantId } });
    return prisma.inventoryCategory.delete({ where: { id } });
  },

  // ── Items ────────────────────────────────────────────────────────────────
  async getItems(
    restaurantId: string,
    options?: { categoryId?: string; search?: string }
  ) {
    const where: any = { restaurantId, archivedAt: null };
    if (options?.categoryId) where.categoryId = options.categoryId;
    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { sku: { contains: options.search, mode: "insensitive" } },
      ];
    }

    return prisma.inventoryItem.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
  },

  async getItemById(restaurantId: string, id: string) {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, restaurantId, archivedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        stockLedger: {
          orderBy: { occurredAt: "desc" },
          take: 20,
          include: { outlet: { select: { name: true } } },
        },
      },
    });
    if (!item) throw new Error("Inventory item not found");
    return item;
  },

  async createItem(
    restaurantId: string,
    data: {
      name: string;
      sku?: string;
      description?: string;
      categoryId?: string;
      unitOfMeasure: string;
      reorderPoint?: number;
      parLevel?: number;
      costPerUnit?: number;
    }
  ) {
    return prisma.inventoryItem.create({
      data: {
        restaurantId,
        name: data.name,
        sku: data.sku || null,
        description: data.description || null,
        categoryId: data.categoryId || null,
        unitOfMeasure: data.unitOfMeasure as any,
        reorderPoint: data.reorderPoint ?? 0,
        parLevel: data.parLevel ?? 0,
        costPerUnit: data.costPerUnit ?? 0,
      },
    });
  },

  async updateItem(
    restaurantId: string,
    id: string,
    data: {
      name?: string;
      sku?: string;
      description?: string;
      categoryId?: string | null;
      unitOfMeasure?: string;
      reorderPoint?: number;
      parLevel?: number;
      costPerUnit?: number;
    }
  ) {
    await prisma.inventoryItem.findFirstOrThrow({ where: { id, restaurantId } });
    return prisma.inventoryItem.update({ where: { id }, data: data as any });
  },

  async archiveItem(restaurantId: string, id: string) {
    await prisma.inventoryItem.findFirstOrThrow({ where: { id, restaurantId } });
    return prisma.inventoryItem.update({ where: { id }, data: { archivedAt: new Date() } });
  },

  // ── Stock Ledger ────────────────────────────────────────────────────────
  async addStockMovement(
    restaurantId: string,
    data: {
      outletId: string;
      itemId: string;
      movementType: string;
      quantity: number;
      referenceId?: string;
      notes?: string;
      recordedBy: string;
    }
  ) {
    await prisma.inventoryItem.findFirstOrThrow({ where: { id: data.itemId, restaurantId } });
    await prisma.restaurantOutlet.findFirstOrThrow({ where: { id: data.outletId, restaurantId } });

    return prisma.stockLedger.create({
      data: {
        restaurantId,
        outletId: data.outletId,
        itemId: data.itemId,
        movementType: data.movementType as any,
        quantity: data.quantity,
        referenceId: data.referenceId,
        notes: data.notes,
        recordedBy: data.recordedBy,
      },
    });
  },

  async getStockByOutlet(restaurantId: string, outletId?: string) {
    const where: any = { restaurantId };
    if (outletId) where.outletId = outletId;

    const aggs = await prisma.stockLedger.groupBy({
      by: ["itemId", "outletId"],
      where,
      _sum: { quantity: true },
    });

    const itemIds = [...new Set(aggs.map((a) => a.itemId))];
    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: itemIds } },
      include: { category: { select: { name: true } } },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    return aggs.map((agg) => {
      const item = itemMap.get(agg.itemId);
      const currentStock = Number(agg._sum.quantity ?? 0);
      return {
        itemId: agg.itemId,
        outletId: agg.outletId,
        itemName: item?.name ?? "Unknown",
        category: item?.category?.name ?? null,
        unitOfMeasure: item?.unitOfMeasure,
        reorderPoint: Number(item?.reorderPoint ?? 0),
        parLevel: Number(item?.parLevel ?? 0),
        currentStock,
        isLowStock: currentStock <= Number(item?.reorderPoint ?? 0),
      };
    });
  },

  async getLedgerHistory(restaurantId: string, itemId: string, outletId?: string) {
    return prisma.stockLedger.findMany({
      where: {
        restaurantId,
        itemId,
        ...(outletId && { outletId }),
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });
  },

  // ── Wastage ─────────────────────────────────────────────────────────────
  async logWastage(
    restaurantId: string,
    data: {
      outletId: string;
      itemId: string;
      quantity: number;
      reason: string;
      notes?: string;
      recordedBy: string;
    }
  ) {
    await prisma.inventoryItem.findFirstOrThrow({ where: { id: data.itemId, restaurantId } });
    await prisma.restaurantOutlet.findFirstOrThrow({ where: { id: data.outletId, restaurantId } });

    return prisma.$transaction(async (tx) => {
      const wastage = await tx.wastageLog.create({
        data: {
          restaurantId,
          outletId: data.outletId,
          itemId: data.itemId,
          quantity: data.quantity,
          reason: data.reason as any,
          notes: data.notes,
          recordedBy: data.recordedBy,
        },
      });

      await tx.stockLedger.create({
        data: {
          restaurantId,
          outletId: data.outletId,
          itemId: data.itemId,
          movementType: "WASTAGE",
          quantity: -Math.abs(data.quantity),
          referenceId: wastage.id,
          notes: `Wastage: ${data.reason}${data.notes ? " - " + data.notes : ""}`,
          recordedBy: data.recordedBy,
        },
      });

      return wastage;
    });
  },

  async getWastageLogs(restaurantId: string, outletId?: string, itemId?: string) {
    return prisma.wastageLog.findMany({
      where: {
        restaurantId,
        ...(outletId && { outletId }),
        ...(itemId && { itemId }),
      },
      include: {
        item: { select: { name: true, unitOfMeasure: true } },
        outlet: { select: { name: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });
  },

  // ── Low-Stock Alerts ────────────────────────────────────────────────────
  async getLowStockAlerts(restaurantId: string, outletId?: string) {
    // 1. Fetch all items for this restaurant
    const items = await prisma.inventoryItem.findMany({
      where: { restaurantId, archivedAt: null },
      include: { category: { select: { name: true } } },
    });

    // 2. Fetch stock aggregations from ledger
    const ledgerWhere: any = { restaurantId };
    if (outletId) ledgerWhere.outletId = outletId;

    const aggs = await prisma.stockLedger.groupBy({
      by: ["itemId"],
      where: ledgerWhere,
      _sum: { quantity: true },
    });

    const stockMap = new Map<string, number>();
    aggs.forEach((a) => {
      stockMap.set(a.itemId, Number(a._sum.quantity ?? 0));
    });

    // 3. Evaluate ALL items (defaulting un-moved items to stock 0)
    const alerts: any[] = [];
    items.forEach((item) => {
      const currentStock = stockMap.get(item.id) ?? 0;
      const reorderPoint = Number(item.reorderPoint ?? 0);
      const parLevel = Number(item.parLevel ?? 0);

      // Trigger alert if item has a reorder threshold and current stock is <= threshold
      if (reorderPoint > 0 && currentStock <= reorderPoint) {
        alerts.push({
          itemId: item.id,
          outletId: outletId || "",
          itemName: item.name,
          category: item.category?.name ?? null,
          unitOfMeasure: item.unitOfMeasure,
          reorderPoint,
          parLevel,
          currentStock,
          isLowStock: true,
          suggestedOrder: Math.max(0, parLevel - currentStock),
        });
      }
    });

    return alerts;
  },
};
