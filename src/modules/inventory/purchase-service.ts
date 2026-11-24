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
              pack: true,
            },
          },
          receipts: {
            orderBy: { createdAt: "desc" },
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
              pack: true,
            },
          },
          receipts: {
            orderBy: { createdAt: "desc" },
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
              pack: true,
            },
          },
          receipts: {
            orderBy: { createdAt: "desc" },
            include: { item: { select: { name: true, unitOfMeasure: true } } },
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
        packId?: string | null;
        orderedPackCount?: number | null;
        packPrice?: number | null;
        pricingBasis?: "PER_PACK" | "PER_WEIGHT_UNIT" | "PER_UNIT" | null;
        isVariableWeight?: boolean;
        orderedQuantity?: number;
        unitCost?: number;
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
      const poItemsData: any[] = [];

      for (const i of data.items) {
        if (i.packId) {
          const pack = await client.itemPurchasePack.findFirstOrThrow({
            where: { id: i.packId, restaurantId, itemId: i.itemId },
          });

          const packCount = Number(i.orderedPackCount) || 1;
          const conversionFactor = Number(pack.conversionFactor) || 1;
          const isVariableWeight = i.isVariableWeight !== undefined ? !!i.isVariableWeight : !!pack.isVariableWeight;
          const pricingBasis = i.pricingBasis || (isVariableWeight ? "PER_WEIGHT_UNIT" : "PER_PACK");
          const packPrice = i.packPrice !== undefined && i.packPrice !== null ? Number(i.packPrice) : (Number(i.unitCost) || 0);

          let orderedQuantity = 0;
          let lineTotal = 0;
          let unitCostPerStockUnit = 0;

          if (isVariableWeight) {
            orderedQuantity = i.orderedQuantity !== undefined && i.orderedQuantity !== null
              ? Number(i.orderedQuantity)
              : packCount * conversionFactor;
            
            if (pricingBasis === "PER_WEIGHT_UNIT") {
              lineTotal = orderedQuantity * packPrice;
              unitCostPerStockUnit = packPrice;
            } else if (pricingBasis === "PER_PACK") {
              lineTotal = packCount * packPrice;
              unitCostPerStockUnit = conversionFactor > 0 ? packPrice / conversionFactor : packPrice;
            } else {
              lineTotal = orderedQuantity * (Number(i.unitCost) || packPrice);
              unitCostPerStockUnit = Number(i.unitCost) || packPrice;
            }
          } else {
            orderedQuantity = packCount * conversionFactor;
            if (pricingBasis === "PER_PACK") {
              lineTotal = packCount * packPrice;
              unitCostPerStockUnit = conversionFactor > 0 ? packPrice / conversionFactor : packPrice;
            } else if (pricingBasis === "PER_WEIGHT_UNIT") {
              lineTotal = orderedQuantity * packPrice;
              unitCostPerStockUnit = packPrice;
            } else {
              lineTotal = orderedQuantity * (Number(i.unitCost) || packPrice);
              unitCostPerStockUnit = Number(i.unitCost) || packPrice;
            }
          }

          totalAmount += lineTotal;
          poItemsData.push({
            itemId: i.itemId,
            packId: pack.id,
            packLabel: pack.name,
            packDetails: pack.customTypeLabel || pack.packType,
            packConversionFactor: conversionFactor,
            orderedPackCount: packCount,
            receivedPackCount: 0,
            packPrice,
            pricingBasis,
            isVariableWeight,
            actualWeightReceived: 0,
            orderedQuantity,
            unitCost: unitCostPerStockUnit,
            totalCost: lineTotal,
          });
        } else {
          // Standard unit flow (no packaging)
          const orderedQuantity = Number(i.orderedQuantity) || 0;
          const unitCost = Number(i.unitCost) || 0;
          const lineTotal = orderedQuantity * unitCost;
          totalAmount += lineTotal;

          poItemsData.push({
            itemId: i.itemId,
            packId: null,
            orderedQuantity,
            unitCost,
            totalCost: lineTotal,
          });
        }
      }

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
          items: { include: { item: true, pack: true } },
          receipts: true,
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
      idempotencyKey?: string;
      items?: {
        poItemId?: string;
        itemId?: string;
        receivingPackCount?: number;
        actualWeightReceived?: number;
        receivedQuantity?: number;
        unitCost?: number;
      }[];
    }
  ) {
    let db = getPrisma();

    const executeReceive = async (client: any) => {
      // Idempotency check: if this submission was already processed, return existing PO
      if (receiveData?.idempotencyKey) {
        const existingReceipt = await client.purchaseOrderReceipt.findFirst({
          where: {
            restaurantId,
            OR: [
              { idempotencyKey: receiveData.idempotencyKey },
              { idempotencyKey: { startsWith: `${receiveData.idempotencyKey}:` } },
            ],
          },
        });
        if (existingReceipt) {
          return client.purchaseOrder.findFirst({
            where: { id: poId, restaurantId },
            include: {
              vendor: true,
              outlet: true,
              items: { include: { item: true, pack: true } },
              receipts: { orderBy: { createdAt: "desc" } },
            },
          });
        }
      }

      const po = await client.purchaseOrder.findFirst({
        where: { id: poId, restaurantId },
        include: { items: { include: { item: true, pack: true } } },
      });

      if (!po) throw new Error("Purchase Order not found");
      if (po.status === "RECEIVED") throw new Error("Purchase Order has already been received and completed");
      if (po.status === "CANCELLED") throw new Error("Cannot receive a cancelled Purchase Order");

      return client.$transaction(async (tx: any) => {
        // Double-check idempotency inside transaction
        if (receiveData?.idempotencyKey) {
          const existingReceipt = await tx.purchaseOrderReceipt.findFirst({
            where: {
              restaurantId,
              OR: [
                { idempotencyKey: receiveData.idempotencyKey },
                { idempotencyKey: { startsWith: `${receiveData.idempotencyKey}:` } },
              ],
            },
          });
          if (existingReceipt) {
            return tx.purchaseOrder.findFirst({
              where: { id: poId },
              include: {
                vendor: true,
                outlet: true,
                items: { include: { item: true, pack: true } },
                receipts: { orderBy: { createdAt: "desc" } },
              },
            });
          }
        }

        const itemsToProcess = receiveData?.items && receiveData.items.length > 0
          ? receiveData.items
          : po.items.map((i: any) => {
              if (i.packId || i.orderedPackCount) {
                const remainingPacks = Math.max(0, Number(i.orderedPackCount || 0) - Number(i.receivedPackCount || 0));
                return {
                  poItemId: i.id,
                  itemId: i.itemId,
                  receivingPackCount: remainingPacks,
                  actualWeightReceived: i.isVariableWeight ? remainingPacks * (Number(i.packConversionFactor) || 1) : undefined,
                  receivedQuantity: remainingPacks * (Number(i.packConversionFactor) || 1),
                  unitCost: Number(i.unitCost),
                };
              }
              return {
                poItemId: i.id,
                itemId: i.itemId,
                receivedQuantity: Math.max(0, Number(i.orderedQuantity) - Number(i.receivedQuantity || 0)),
                unitCost: Number(i.unitCost),
              };
            });

        let receiptItemIndex = 0;
        for (const reqItem of itemsToProcess) {
          const existingItem = po.items.find(
            (i: any) => (reqItem.poItemId && i.id === reqItem.poItemId) || i.itemId === reqItem.itemId
          );
          if (!existingItem) continue;

          const isPackItem = Boolean(existingItem.packId || existingItem.orderedPackCount);
          const packConversionFactor = Number(existingItem.packConversionFactor) || 1;
          const isVariableWeight = Boolean(existingItem.isVariableWeight);
          const pricingBasis = existingItem.pricingBasis || (isVariableWeight ? "PER_WEIGHT_UNIT" : (isPackItem ? "PER_PACK" : "PER_UNIT"));

          let packsReceived = 0;
          let qtyToReceiveInStockUnits = 0;
          let actualWeightReceivedThisReceipt = 0;
          let lineReceiptCost = 0;
          let effectiveUnitCost = Number(existingItem.unitCost);

          if (isPackItem) {
            packsReceived = Math.max(0, Number(reqItem.receivingPackCount ?? 0));

            if (isVariableWeight) {
              actualWeightReceivedThisReceipt = Math.max(0, Number(reqItem.actualWeightReceived ?? reqItem.receivedQuantity ?? 0));
              qtyToReceiveInStockUnits = actualWeightReceivedThisReceipt;

              if (pricingBasis === "PER_WEIGHT_UNIT") {
                const pricePerWeight = Number(reqItem.unitCost ?? existingItem.packPrice ?? existingItem.unitCost);
                lineReceiptCost = qtyToReceiveInStockUnits * pricePerWeight;
                effectiveUnitCost = pricePerWeight;
              } else if (pricingBasis === "PER_PACK") {
                const pricePerPack = Number(existingItem.packPrice ?? existingItem.unitCost * packConversionFactor);
                lineReceiptCost = packsReceived * pricePerPack;
                effectiveUnitCost = qtyToReceiveInStockUnits > 0 ? lineReceiptCost / qtyToReceiveInStockUnits : Number(existingItem.unitCost);
              } else {
                effectiveUnitCost = Number(reqItem.unitCost ?? existingItem.unitCost);
                lineReceiptCost = qtyToReceiveInStockUnits * effectiveUnitCost;
              }
            } else {
              // Fixed pack
              if (reqItem.receivingPackCount !== undefined && reqItem.receivingPackCount !== null) {
                packsReceived = Math.max(0, Number(reqItem.receivingPackCount));
                qtyToReceiveInStockUnits = packsReceived * packConversionFactor;
              } else {
                qtyToReceiveInStockUnits = Math.max(0, Number(reqItem.receivedQuantity ?? 0));
                packsReceived = packConversionFactor > 0 ? qtyToReceiveInStockUnits / packConversionFactor : 0;
              }

              if (pricingBasis === "PER_PACK") {
                const pricePerPack = Number(existingItem.packPrice ?? existingItem.unitCost * packConversionFactor);
                lineReceiptCost = packsReceived * pricePerPack;
                effectiveUnitCost = packConversionFactor > 0 ? pricePerPack / packConversionFactor : Number(existingItem.unitCost);
              } else {
                effectiveUnitCost = Number(reqItem.unitCost ?? existingItem.unitCost);
                lineReceiptCost = qtyToReceiveInStockUnits * effectiveUnitCost;
              }
            }
          } else {
            // Standard unit flow (no pack)
            qtyToReceiveInStockUnits = Math.max(0, Number(reqItem.receivedQuantity ?? 0));
            effectiveUnitCost = reqItem.unitCost !== undefined ? Number(reqItem.unitCost) : Number(existingItem.unitCost);
            lineReceiptCost = qtyToReceiveInStockUnits * effectiveUnitCost;
          }

          const cumulativeReceivedStockQty = Number(existingItem.receivedQuantity || 0) + qtyToReceiveInStockUnits;
          const cumulativeReceivedPacks = Number(existingItem.receivedPackCount || 0) + packsReceived;
          const cumulativeActualWeight = Number(existingItem.actualWeightReceived || 0) + actualWeightReceivedThisReceipt;

          // Update purchase order item row
          await tx.purchaseOrderItem.update({
            where: { id: existingItem.id },
            data: {
              receivedQuantity: cumulativeReceivedStockQty,
              receivedPackCount: isPackItem ? cumulativeReceivedPacks : undefined,
              actualWeightReceived: isVariableWeight ? cumulativeActualWeight : undefined,
              unitCost: effectiveUnitCost,
            },
          });

          // Sync inventory item latest cost price
          if (effectiveUnitCost > 0) {
            await tx.inventoryItem.update({
              where: { id: existingItem.itemId },
              data: { costPerUnit: effectiveUnitCost },
            }).catch(() => {});
          }

          // Log Stock Ledger movement and Purchase Order Receipt record atomically if stock quantity > 0
          if (qtyToReceiveInStockUnits > 0) {
            let movementNote = "";
            const itemUom = existingItem.item?.unitOfMeasure || "";

            if (isPackItem) {
              if (isVariableWeight) {
                movementNote = `Received ${packsReceived} ${existingItem.packLabel || "pack(s)"} (Actual weight: ${qtyToReceiveInStockUnits} ${itemUom}) via Purchase Order ${po.poNumber}`;
              } else {
                movementNote = `Received ${packsReceived} ${existingItem.packLabel || "pack(s)"} (${qtyToReceiveInStockUnits} ${itemUom}) via Purchase Order ${po.poNumber}`;
              }
            } else {
              movementNote = `Received via Purchase Order ${po.poNumber} (${qtyToReceiveInStockUnits} ${itemUom}) @ ₹${effectiveUnitCost}/${itemUom}`;
            }

            // Create stock ledger entry
            await tx.stockLedger.create({
              data: {
                restaurantId,
                outletId: po.outletId,
                itemId: existingItem.itemId,
                movementType: "PURCHASE",
                quantity: qtyToReceiveInStockUnits,
                referenceId: po.poNumber,
                notes: movementNote,
                recordedBy: userId,
              },
            });

            // Create persistent receipt audit record with unique idempotency key
            const itemReceiptKey = receiveData?.idempotencyKey
              ? receiptItemIndex === 0
                ? receiveData.idempotencyKey
                : `${receiveData.idempotencyKey}:${existingItem.id}`
              : null;
            receiptItemIndex++;

            await tx.purchaseOrderReceipt.create({
              data: {
                restaurantId,
                purchaseOrderId: po.id,
                poItemId: existingItem.id,
                itemId: existingItem.itemId,
                packsReceived: isPackItem ? packsReceived : null,
                quantityReceived: qtyToReceiveInStockUnits,
                actualWeightReceived: isVariableWeight ? actualWeightReceivedThisReceipt : null,
                unitCost: effectiveUnitCost,
                totalCost: lineReceiptCost,
                idempotencyKey: itemReceiptKey,
                notes: movementNote,
                receivedBy: userId,
              },
            });
          }
        }

        // Re-fetch updated PO items to calculate totals & check full completion
        const updatedPOItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: poId },
        });

        let updatedSubtotal = 0;
        let checkAllReceived = true;

        updatedPOItems.forEach((item: any) => {
          const total = Number(item.orderedQuantity) * Number(item.unitCost);
          updatedSubtotal += total;

          if (item.packId || item.orderedPackCount) {
            const ordPacks = Number(item.orderedPackCount || 0);
            const recPacks = Number(item.receivedPackCount || 0);
            if (recPacks < ordPacks) {
              checkAllReceived = false;
            }
          } else {
            if (Number(item.receivedQuantity || 0) < Number(item.orderedQuantity || 0)) {
              checkAllReceived = false;
            }
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
            items: { include: { item: true, pack: true } },
            receipts: {
              orderBy: { createdAt: "desc" },
              include: { item: { select: { name: true, unitOfMeasure: true } } },
            },
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
