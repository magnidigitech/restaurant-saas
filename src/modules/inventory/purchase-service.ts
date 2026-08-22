import { prisma, createPrismaClient } from "@/core/database/client";

function getPrisma(): any {
  const p = (globalThis as any).prisma || prisma;
  if (p && p.purchaseOrder && typeof p.purchaseOrder.findMany === "function") {
    return p;
  }
  const fresh = createPrismaClient() as any;
  (globalThis as any).prisma = fresh;
  return fresh;
}

export const PurchaseService = {
  async getPurchaseOrders(
    restaurantId: string,
    options?: {
      outletId?: string;
      vendorId?: string;
      status?: string;
      search?: string;
    }
  ) {
    let db = getPrisma();
    const where: any = { restaurantId, archivedAt: null };
    if (options?.outletId) where.outletId = options.outletId;
    if (options?.vendorId) where.vendorId = options.vendorId;
    if (options?.status) where.status = options.status;
    if (options?.search) {
      where.OR = [
        { poNumber: { contains: options.search, mode: "insensitive" } },
        { vendor: { name: { contains: options.search, mode: "insensitive" } } },
      ];
    }

    try {
      return await db.purchaseOrder.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true, code: true, paymentTerms: true } },
          outlet: { select: { id: true, name: true } },
          items: {
            include: {
              item: { select: { id: true, name: true, unitOfMeasure: true, costPerUnit: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      return freshDb.purchaseOrder.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true, code: true, paymentTerms: true } },
          outlet: { select: { id: true, name: true } },
          items: {
            include: {
              item: { select: { id: true, name: true, unitOfMeasure: true, costPerUnit: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }
  },

  async getPOById(restaurantId: string, id: string) {
    let db = getPrisma();
    const fetchPO = async (client: any) => {
      const po = await client.purchaseOrder.findFirst({
        where: { id, restaurantId, archivedAt: null },
        include: {
          vendor: true,
          outlet: true,
          items: {
            include: {
              item: true,
            },
          },
        },
      });
      if (!po) throw new Error("Purchase Order not found");
      return po;
    };

    try {
      return await fetchPO(db);
    } catch (e: any) {
      if (e.message === "Purchase Order not found") throw e;
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      return await fetchPO(freshDb);
    }
  },

  async createPO(
    restaurantId: string,
    createdBy: string,
    data: {
      outletId: string;
      vendorId: string;
      expectedDeliveryDate?: string;
      notes?: string;
      items: {
        itemId: string;
        orderedQuantity: number;
        unitCost: number;
      }[];
    }
  ) {
    let db = getPrisma();
    const executeCreate = async (client: any) => {
      // Collision-safe sequential PO Number
      const lastPO = await client.purchaseOrder.findFirst({
        where: { restaurantId },
        orderBy: { createdAt: "desc" },
        select: { poNumber: true },
      });
      let nextNum = 1;
      if (lastPO?.poNumber && lastPO.poNumber.startsWith("PO-")) {
        const parsed = parseInt(lastPO.poNumber.replace("PO-", ""), 10);
        if (!isNaN(parsed)) {
          nextNum = parsed + 1;
        }
      } else {
        const count = await client.purchaseOrder.count({ where: { restaurantId } });
        nextNum = count + 1;
      }
      const poNumber = `PO-${nextNum.toString().padStart(5, "0")}`;

      let totalAmount = 0;
      const poItemsData = data.items.map((i) => {
        const lineTotal = i.orderedQuantity * i.unitCost;
        totalAmount += lineTotal;
        return {
          itemId: i.itemId,
          orderedQuantity: i.orderedQuantity,
          unitCost: i.unitCost,
          totalCost: lineTotal,
        };
      });

      const taxAmount = 0;
      const grandTotal = totalAmount + taxAmount;

      return client.purchaseOrder.create({
        data: {
          restaurantId,
          outletId: data.outletId,
          vendorId: data.vendorId,
          poNumber,
          status: "DRAFT",
          totalAmount,
          taxAmount,
          grandTotal,
          expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
          notes: data.notes || null,
          createdBy,
          items: {
            create: poItemsData,
          },
        },
        include: {
          vendor: true,
          outlet: true,
          items: { include: { item: true } },
        },
      });
    };

    try {
      return await executeCreate(db);
    } catch (e: any) {
      console.error("[PurchaseService.createPO] Primary attempt failed:", e.message);
      try {
        const freshDb = createPrismaClient() as any;
        (globalThis as any).prisma = freshDb;
        return await executeCreate(freshDb);
      } catch (freshErr: any) {
        console.error("[PurchaseService.createPO] Retry failed:", freshErr.message);
        throw freshErr;
      }
    }
  },

  async updatePOStatus(restaurantId: string, id: string, status: "DRAFT" | "SENT" | "CANCELLED") {
    let db = getPrisma();
    const executeUpdate = async (client: any) => {
      await client.purchaseOrder.findFirstOrThrow({ where: { id, restaurantId } });
      return client.purchaseOrder.update({
        where: { id },
        data: { status },
      });
    };

    try {
      return await executeUpdate(db);
    } catch {
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      return await executeUpdate(freshDb);
    }
  },

  async receivePOItems(
    restaurantId: string,
    userId: string,
    poId: string,
    receiveData?: {
      status?: "RECEIVED" | "PARTIALLY_RECEIVED";
      items?: {
        itemId: string;
        receivedQuantity: number;
        unitCost?: number;
      }[];
    }
  ) {
    let db = getPrisma();

    const executeReceive = async (client: any) => {
      const po = await client.purchaseOrder.findFirst({
        where: { id: poId, restaurantId },
        include: { items: true },
      });

      if (!po) throw new Error("Purchase Order not found");
      if (po.status === "RECEIVED") throw new Error("Purchase Order has already been received and completed");
      if (po.status === "CANCELLED") throw new Error("Cannot receive a cancelled Purchase Order");

      return client.$transaction(async (tx: any) => {
        const itemsToProcess = receiveData?.items && receiveData.items.length > 0
          ? receiveData.items
          : po.items.map((i: any) => ({
              itemId: i.itemId,
              receivedQuantity: Number(i.orderedQuantity) - Number(i.receivedQuantity || 0),
              unitCost: Number(i.unitCost),
            }));

        let allFullyReceived = true;

        for (const reqItem of itemsToProcess) {
          const existingItem = po.items.find((i: any) => i.itemId === reqItem.itemId);
          if (!existingItem) continue;

          const qtyToReceive = Math.max(0, Number(reqItem.receivedQuantity));
          const newUnitCost = reqItem.unitCost !== undefined ? Number(reqItem.unitCost) : Number(existingItem.unitCost);
          const cumulativeReceived = Number(existingItem.receivedQuantity || 0) + qtyToReceive;

          if (cumulativeReceived < Number(existingItem.orderedQuantity)) {
            allFullyReceived = false;
          }

          // Update purchase order item row
          await tx.purchaseOrderItem.update({
            where: { id: existingItem.id },
            data: {
              receivedQuantity: cumulativeReceived,
              unitCost: newUnitCost,
              totalCost: Number(existingItem.orderedQuantity) * newUnitCost,
            },
          });

          // Sync inventory item latest cost price
          if (newUnitCost > 0) {
            await tx.inventoryItem.update({
              where: { id: existingItem.itemId },
              data: { costPerUnit: newUnitCost },
            }).catch(() => {});
          }

          // Log Stock Ledger movement if quantity received > 0
          if (qtyToReceive > 0) {
            await tx.stockLedger.create({
              data: {
                restaurantId,
                outletId: po.outletId,
                itemId: existingItem.itemId,
                movementType: "PURCHASE",
                quantity: qtyToReceive,
                referenceId: po.poNumber,
                notes: `Received via Purchase Order ${po.poNumber} @ ₹${newUnitCost}/unit`,
                recordedBy: userId,
              },
            });
          }
        }

        // Re-fetch updated PO items to calculate totals
        const updatedPOItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: poId },
        });

        let updatedSubtotal = 0;
        let checkAllReceived = true;

        updatedPOItems.forEach((item: any) => {
          const total = Number(item.orderedQuantity) * Number(item.unitCost);
          updatedSubtotal += total;
          if (Number(item.receivedQuantity || 0) < Number(item.orderedQuantity)) {
            checkAllReceived = false;
          }
        });

        const taxRate = (po as any).taxRate ? Number((po as any).taxRate) : 0;
        const taxAmount = (updatedSubtotal * taxRate) / 100;
        const updatedGrandTotal = updatedSubtotal + taxAmount;

        const targetStatus = receiveData?.status
          ? receiveData.status
          : checkAllReceived
          ? "RECEIVED"
          : "PARTIALLY_RECEIVED";

        return tx.purchaseOrder.update({
          where: { id: poId },
          data: {
            status: targetStatus,
            receivedAt: new Date(),
            totalAmount: updatedGrandTotal,
            taxAmount,
            grandTotal: updatedGrandTotal,
          },
          include: {
            vendor: true,
            outlet: true,
            items: { include: { item: true } },
          },
        });
      });
    };

    try {
      return await executeReceive(db);
    } catch (e: any) {
      if (e.message?.includes("Purchase Order")) throw e;
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      return await executeReceive(freshDb);
    }
  },
};
