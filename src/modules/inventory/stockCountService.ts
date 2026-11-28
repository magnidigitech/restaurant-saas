import { Prisma } from "@prisma/client";
import { prisma } from "@/core/database/client";
import { convertQuantity } from "@/core/inventory/units";

function roundQty4(val: number): number {
  return Math.round(val * 10000) / 10000;
}

export interface CountedPackSnapshot {
  packId: string;
  packName: string;
  packUnit: string;
  packCount: number;
  netQuantityPerPack: number;
  conversionFactorToBase: number;
  baseQty: number;
}

export interface SaveCountEntryInput {
  itemId: string;
  isCounted: boolean;
  baseQty?: number | null;
  packs?: Array<{ packId: string; packCount: number }>;
}

export class StockCountError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "STOCK_COUNT_ERROR") {
    super(message);
    this.name = "StockCountError";
    this.status = status;
    this.code = code;
  }
}

async function computeExpectedAndLaterByItem(
  tx: Prisma.TransactionClient | typeof prisma,
  restaurantId: string,
  outletId: string,
  cutoffAt: Date,
  itemIds: string[]
) {
  const [atCutoffAggs, laterAggs] = await Promise.all([
    tx.stockLedger.groupBy({
      by: ["itemId"],
      where: {
        restaurantId,
        outletId,
        itemId: { in: itemIds },
        occurredAt: { lte: cutoffAt },
      },
      _sum: { quantity: true },
    }),
    tx.stockLedger.groupBy({
      by: ["itemId"],
      where: {
        restaurantId,
        outletId,
        itemId: { in: itemIds },
        occurredAt: { gt: cutoffAt },
      },
      _sum: { quantity: true },
    }),
  ]);

  const expectedMap = new Map<string, number>();
  for (const a of atCutoffAggs) {
    expectedMap.set(a.itemId, roundQty4(Number(a._sum.quantity || 0)));
  }
  const laterMap = new Map<string, number>();
  for (const a of laterAggs) {
    laterMap.set(a.itemId, roundQty4(Number(a._sum.quantity || 0)));
  }

  return { expectedMap, laterMap };
}

export async function listStockCounts(
  restaurantId: string,
  filters?: {
    outletId?: string;
    accessibleOutletIds?: string[] | null;
    status?: string;
  }
) {
  const where: Prisma.StockCountWhereInput = { restaurantId };
  if (filters?.outletId && filters.outletId !== "ALL") {
    where.outletId = filters.outletId;
  } else if (
    filters?.accessibleOutletIds !== undefined &&
    filters?.accessibleOutletIds !== null
  ) {
    where.outletId = { in: filters.accessibleOutletIds };
  }
  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status as any;
  }

  const counts = await prisma.stockCount.findMany({
    where,
    include: {
      outlet: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          isCounted: true,
          varianceQty: true,
          recountRequested: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return counts.map((c) => {
    const totalItems = c.items.length;
    const countedItems = c.items.filter((i) => i.isCounted).length;
    const varianceItems = c.items.filter(
      (i) => i.isCounted && Math.abs(Number(i.varianceQty)) > 0.0001
    ).length;
    return {
      ...c,
      progress: {
        totalItems,
        countedItems,
        remainingItems: totalItems - countedItems,
        varianceItems,
      },
    };
  });
}

export async function startOrResumeStockCount(
  restaurantId: string,
  params: {
    outletId: string;
    userId: string;
    cutoffAt?: Date;
    notes?: string;
    itemIds?: string[];
  }
) {
  await prisma.restaurantOutlet.findFirstOrThrow({
    where: { id: params.outletId, restaurantId },
  });

  // Check for an existing open count in this outlet
  const existingOpen = await prisma.stockCount.findFirst({
    where: {
      restaurantId,
      outletId: params.outletId,
      status: { in: ["DRAFT", "NEEDS_RECOUNT", "SUBMITTED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingOpen) {
    if (existingOpen.status === "SUBMITTED") {
      throw new StockCountError(
        `An active count (${existingOpen.countNumber}) is awaiting manager approval for this outlet. Approve or cancel it before starting an overlapping count.`,
        409,
        "OVERLAPPING_STOCK_COUNT"
      );
    }
    return getStockCountDetail(restaurantId, existingOpen.id);
  }

  const items = await prisma.inventoryItem.findMany({
    where: {
      restaurantId,
      archivedAt: null,
      ...(params.itemIds && params.itemIds.length > 0
        ? { id: { in: params.itemIds } }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  if (items.length === 0) {
    throw new StockCountError("No active inventory items found to count", 400);
  }

  const cutoffAt = params.cutoffAt || new Date();
  const dateStr = cutoffAt.toISOString().slice(0, 10).replace(/-/g, "");
  const countToday = await prisma.stockCount.count({
    where: { restaurantId, countNumber: { startsWith: `CNT-${dateStr}` } },
  });
  const countNumber = `CNT-${dateStr}-${String(countToday + 1).padStart(4, "0")}`;

  const created = await prisma.stockCount.create({
    data: {
      restaurantId,
      outletId: params.outletId,
      countNumber,
      status: "DRAFT",
      countDate: cutoffAt,
      cutoffAt,
      startedByUserId: params.userId,
      notes: params.notes || null,
      items: {
        create: items.map((item) => ({
          itemId: item.id,
          unitOfMeasure: item.unitOfMeasure,
          isCounted: false,
        })),
      },
    },
  });

  return getStockCountDetail(restaurantId, created.id);
}

export async function getStockCountDetail(restaurantId: string, countId: string) {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, restaurantId },
    include: {
      outlet: { select: { id: true, name: true } },
      items: {
        include: {
          item: {
            select: {
              id: true,
              name: true,
              sku: true,
              unitOfMeasure: true,
              costPerUnit: true,
              category: { select: { name: true } },
              purchasePacks: { orderBy: { createdAt: "asc" } },
            },
          },
        },
        orderBy: { item: { name: "asc" } },
      },
    },
  });

  if (!count) {
    throw new StockCountError("Stock count not found", 404, "NOT_FOUND");
  }

  const itemIds = count.items.map((i) => i.itemId);
  const { expectedMap, laterMap } = await computeExpectedAndLaterByItem(
    prisma,
    restaurantId,
    count.outletId,
    count.cutoffAt,
    itemIds
  );

  let requiresRefresh = false;
  const skippedItems: Array<{ itemId: string; itemName: string }> = [];

  const enrichedItems = count.items.map((ci) => {
    const liveExpected = expectedMap.get(ci.itemId) ?? 0;
    const liveLater = laterMap.get(ci.itemId) ?? 0;
    const expected =
      count.status === "APPROVED" ? Number(ci.expectedAtCutoff) : liveExpected;
    const later =
      count.status === "APPROVED" ? Number(ci.laterMovementsQty) : liveLater;
    const counted = ci.isCounted ? Number(ci.countedBaseQty ?? 0) : null;
    const variance =
      counted !== null ? roundQty4(counted - expected) : 0;

    const itemStale =
      count.status === "SUBMITTED" &&
      ci.isCounted &&
      ci.reviewedExpectedAtCutoff !== null &&
      Math.abs(liveExpected - Number(ci.reviewedExpectedAtCutoff)) > 0.0001;

    if (itemStale) requiresRefresh = true;
    if (!ci.isCounted) {
      skippedItems.push({ itemId: ci.itemId, itemName: ci.item.name });
    }

    return {
      ...ci,
      countedBaseInput: ci.countedBaseInput !== null ? Number(ci.countedBaseInput) : null,
      countedBaseQty: counted,
      expectedAtCutoff: expected,
      laterMovementsQty: later,
      varianceQty: variance,
      reviewedExpectedAtCutoff:
        ci.reviewedExpectedAtCutoff !== null
          ? Number(ci.reviewedExpectedAtCutoff)
          : null,
      isStaleReview: itemStale,
    };
  });

  const totalItems = enrichedItems.length;
  const countedItems = enrichedItems.filter((i) => i.isCounted).length;

  return {
    ...count,
    items: enrichedItems,
    skippedItems,
    requiresRefresh,
    progress: {
      totalItems,
      countedItems,
      remainingItems: totalItems - countedItems,
      varianceItems: enrichedItems.filter(
        (i) => i.isCounted && Math.abs(i.varianceQty) > 0.0001
      ).length,
    },
  };
}

export async function saveCountEntries(
  restaurantId: string,
  countId: string,
  userId: string,
  entries: SaveCountEntryInput[]
) {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, restaurantId },
    include: {
      items: {
        include: {
          item: {
            include: { purchasePacks: true },
          },
        },
      },
    },
  });

  if (!count) {
    throw new StockCountError("Stock count not found", 404, "NOT_FOUND");
  }
  if (count.status !== "DRAFT" && count.status !== "NEEDS_RECOUNT") {
    throw new StockCountError(
      `Cannot edit entries while count status is ${count.status}`,
      400,
      "INVALID_STATUS"
    );
  }

  const itemRowMap = new Map(count.items.map((i) => [i.itemId, i]));

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const row = itemRowMap.get(entry.itemId);
      if (!row) continue;

      if (!entry.isCounted) {
        await tx.stockCountItem.update({
          where: { id: row.id },
          data: {
            isCounted: false,
            countedBaseInput: null,
            countedPacksJson: Prisma.JsonNull,
            countedBaseQty: null,
            countedByUserId: null,
            countedAt: null,
          },
        });
        continue;
      }

      const baseInput = Math.max(0, Number(entry.baseQty ?? 0));
      const packSnapshots: CountedPackSnapshot[] = [];
      let packsBaseTotal = 0;

      for (const pInput of entry.packs || []) {
        const packCount = Math.max(0, Number(pInput.packCount || 0));
        if (packCount <= 0) continue;
        const packDef = row.item.purchasePacks.find((p) => p.id === pInput.packId);
        if (!packDef) {
          throw new StockCountError(
            `Purchase pack ${pInput.packId} not found for item ${row.item.name}`,
            400
          );
        }
        const netPerPack = Number(packDef.netQuantityPerPack);
        const factorToBase =
          packDef.packUnit === row.unitOfMeasure
            ? netPerPack
            : convertQuantity(netPerPack, packDef.packUnit, row.unitOfMeasure);
        const baseQty = roundQty4(packCount * factorToBase);
        packsBaseTotal = roundQty4(packsBaseTotal + baseQty);

        packSnapshots.push({
          packId: packDef.id,
          packName: packDef.name,
          packUnit: packDef.packUnit,
          packCount,
          netQuantityPerPack: netPerPack,
          conversionFactorToBase: roundQty4(factorToBase),
          baseQty,
        });
      }

      const totalCountedBase = roundQty4(baseInput + packsBaseTotal);

      await tx.stockCountItem.update({
        where: { id: row.id },
        data: {
          isCounted: true,
          countedBaseInput: roundQty4(baseInput),
          countedPacksJson: packSnapshots as unknown as Prisma.InputJsonValue,
          countedBaseQty: totalCountedBase,
          recountRequested: false,
          recountReason: null,
          countedByUserId: userId,
          countedAt: new Date(),
        },
      });
    }
  });

  return getStockCountDetail(restaurantId, countId);
}

export async function submitStockCount(
  restaurantId: string,
  countId: string,
  userId: string
) {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, restaurantId },
    include: { items: true },
  });
  if (!count) {
    throw new StockCountError("Stock count not found", 404, "NOT_FOUND");
  }
  if (count.status !== "DRAFT" && count.status !== "NEEDS_RECOUNT") {
    throw new StockCountError(
      `Cannot submit count in ${count.status} state`,
      400,
      "INVALID_STATUS"
    );
  }

  const countedRows = count.items.filter((i) => i.isCounted);
  if (countedRows.length === 0) {
    throw new StockCountError(
      "Count at least one item (explicit 0 counts are valid) before submitting",
      400,
      "NO_COUNTED_ITEMS"
    );
  }

  const itemIds = count.items.map((i) => i.itemId);
  const { expectedMap, laterMap } = await computeExpectedAndLaterByItem(
    prisma,
    restaurantId,
    count.outletId,
    count.cutoffAt,
    itemIds
  );

  await prisma.$transaction(async (tx) => {
    for (const row of count.items) {
      const expected = expectedMap.get(row.itemId) ?? 0;
      const later = laterMap.get(row.itemId) ?? 0;
      const counted = row.isCounted ? Number(row.countedBaseQty ?? 0) : 0;
      const variance = row.isCounted ? roundQty4(counted - expected) : 0;

      await tx.stockCountItem.update({
        where: { id: row.id },
        data: {
          expectedAtCutoff: expected,
          laterMovementsQty: later,
          varianceQty: variance,
          reviewedExpectedAtCutoff: row.isCounted ? expected : null,
        },
      });
    }

    await tx.stockCount.update({
      where: { id: count.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedByUserId: userId,
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      },
    });
  });

  return getStockCountDetail(restaurantId, countId);
}

export async function refreshStockCountReview(
  restaurantId: string,
  countId: string,
  userId: string
) {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, restaurantId },
    include: { items: true },
  });
  if (!count) {
    throw new StockCountError("Stock count not found", 404, "NOT_FOUND");
  }
  if (count.status !== "SUBMITTED") {
    throw new StockCountError("Only SUBMITTED counts can be refreshed", 400);
  }

  const itemIds = count.items.map((i) => i.itemId);
  const { expectedMap, laterMap } = await computeExpectedAndLaterByItem(
    prisma,
    restaurantId,
    count.outletId,
    count.cutoffAt,
    itemIds
  );

  await prisma.$transaction(async (tx) => {
    for (const row of count.items) {
      const expected = expectedMap.get(row.itemId) ?? 0;
      const later = laterMap.get(row.itemId) ?? 0;
      const counted = row.isCounted ? Number(row.countedBaseQty ?? 0) : 0;
      const variance = row.isCounted ? roundQty4(counted - expected) : 0;

      await tx.stockCountItem.update({
        where: { id: row.id },
        data: {
          expectedAtCutoff: expected,
          laterMovementsQty: later,
          varianceQty: variance,
          reviewedExpectedAtCutoff: row.isCounted ? expected : null,
        },
      });
    }

    await tx.stockCount.update({
      where: { id: count.id },
      data: {
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      },
    });
  });

  return getStockCountDetail(restaurantId, countId);
}

export async function requestStockCountRecount(
  restaurantId: string,
  countId: string,
  userId: string,
  items: Array<{ itemId: string; reason?: string }>
) {
  const count = await prisma.stockCount.findFirst({
    where: { id: countId, restaurantId },
    include: { items: true },
  });
  if (!count) {
    throw new StockCountError("Stock count not found", 404, "NOT_FOUND");
  }
  if (count.status !== "SUBMITTED") {
    throw new StockCountError("Only SUBMITTED counts can be sent back for recount", 400);
  }

  const reasonMap = new Map(items.map((i) => [i.itemId, i.reason || "Recount requested"]));

  await prisma.$transaction(async (tx) => {
    for (const row of count.items) {
      if (reasonMap.has(row.itemId)) {
        await tx.stockCountItem.update({
          where: { id: row.id },
          data: {
            recountRequested: true,
            recountReason: reasonMap.get(row.itemId),
          },
        });
      }
    }

    await tx.stockCount.update({
      where: { id: count.id },
      data: {
        status: "NEEDS_RECOUNT",
        reviewedAt: new Date(),
        reviewedByUserId: userId,
      },
    });
  });

  return getStockCountDetail(restaurantId, countId);
}

export async function approveAndPostStockCount(
  restaurantId: string,
  countId: string,
  userId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    // Atomic status lock: prevents concurrent/repeated approval from posting duplicate adjustments
    const claim = await tx.stockCount.updateMany({
      where: { id: countId, restaurantId, status: "SUBMITTED" },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedByUserId: userId,
      },
    });

    if (claim.count === 0) {
      throw new StockCountError(
        "Stock count is already approved or not in SUBMITTED status",
        409,
        "ALREADY_APPROVED_OR_INVALID"
      );
    }

    const count = await tx.stockCount.findFirstOrThrow({
      where: { id: countId, restaurantId },
      include: { items: { include: { item: { select: { name: true } } } } },
    });

    const itemIds = count.items.map((i) => i.itemId);
    const { expectedMap, laterMap } = await computeExpectedAndLaterByItem(
      tx,
      restaurantId,
      count.outletId,
      count.cutoffAt,
      itemIds
    );

    let postedAdjustmentsCount = 0;

    for (const row of count.items) {
      if (!row.isCounted) continue;

      const liveExpected = expectedMap.get(row.itemId) ?? 0;
      const liveLater = laterMap.get(row.itemId) ?? 0;

      if (
        row.reviewedExpectedAtCutoff !== null &&
        Math.abs(liveExpected - Number(row.reviewedExpectedAtCutoff)) > 0.0001
      ) {
        throw new StockCountError(
          `Expected balance at cutoff changed for ${row.item.name} (${Number(row.reviewedExpectedAtCutoff)} -> ${liveExpected}) due to a backdated movement. Refresh review before approving.`,
          409,
          "STALE_REVIEW_REQUIRED"
        );
      }

      const counted = Number(row.countedBaseQty ?? 0);
      const variance = roundQty4(counted - liveExpected);

      let adjustmentLedgerId: string | null = null;
      if (Math.abs(variance) > 0.0001) {
        const ledger = await tx.stockLedger.create({
          data: {
            restaurantId,
            outletId: count.outletId,
            itemId: row.itemId,
            movementType: "ADJUSTMENT",
            quantity: variance,
            referenceId: `${count.countNumber}:${row.itemId}`,
            notes: `Stock Count ${count.countNumber} variance adjustment (Expected: ${liveExpected}, Counted: ${counted})`,
            recordedBy: userId,
            occurredAt: count.cutoffAt,
          },
        });
        adjustmentLedgerId = ledger.id;
        postedAdjustmentsCount += 1;
      }

      await tx.stockCountItem.update({
        where: { id: row.id },
        data: {
          expectedAtCutoff: liveExpected,
          laterMovementsQty: liveLater,
          varianceQty: variance,
          adjustmentLedgerId,
        },
      });
    }

    return { postedAdjustmentsCount };
  });

  const detail = await getStockCountDetail(restaurantId, countId);
  return { ...detail, postedAdjustmentsCount: result.postedAdjustmentsCount };
}
