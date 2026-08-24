import { prisma, createPrismaClient } from "@/core/database/client";

function getPrisma(): any {
  const p = (globalThis as any).prisma || prisma;
  if (p && p.vendorItem && typeof p.vendorItem.findMany === "function") {
    return p;
  }
  const fresh = createPrismaClient() as any;
  (globalThis as any).prisma = fresh;
  return fresh;
}

export const VendorService = {
  async getVendors(restaurantId: string, search?: string, status?: string, outletId?: string) {
    let db = getPrisma();
    const where: any = { restaurantId, archivedAt: null };
    if (status) {
      where.status = status;
    }
    if (outletId) {
      where.OR = [
        ...(where.OR || []),
        { outletIds: { has: outletId } },
        { outletIds: { isEmpty: true } },
      ];
    }
    if (search) {
      const searchConditions = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions }
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    try {
      return await db.vendor.findMany({
        where,
        include: {
          vendorItems: {
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
      try {
        return await freshDb.vendor.findMany({
          where,
          include: {
            vendorItems: {
              include: {
                item: { select: { id: true, name: true, unitOfMeasure: true, costPerUnit: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      } catch {
        delete where.OR;
        delete where.AND;
        return await freshDb.vendor.findMany({
          where: { restaurantId, archivedAt: null },
          include: {
            vendorItems: {
              include: {
                item: { select: { id: true, name: true, unitOfMeasure: true, costPerUnit: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      }
    }
  },

  async getVendorById(restaurantId: string, id: string) {
    let db = getPrisma();
    try {
      const vendor = await db.vendor.findFirst({
        where: { id, restaurantId, archivedAt: null },
        include: {
          vendorItems: {
            include: {
              item: true,
            },
          },
        },
      });
      if (!vendor) throw new Error("Vendor not found");
      return vendor;
    } catch (e: any) {
      if (e.message?.includes("Vendor not found")) throw e;
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      const vendor = await freshDb.vendor.findFirst({
        where: { id, restaurantId, archivedAt: null },
        include: {
          vendorItems: {
            include: {
              item: true,
            },
          },
        },
      });
      if (!vendor) throw new Error("Vendor not found");
      return vendor;
    }
  },

  async createVendor(
    restaurantId: string,
    data: {
      name: string;
      code?: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
      taxId?: string;
      paymentTerms?: string;
      status?: string;
      outletIds?: string[];
      notes?: string;
    }
  ) {
    let db = getPrisma();
    const vendorPayload: any = {
      restaurantId,
      name: data.name,
      code: data.code || null,
      contactPerson: data.contactPerson || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      taxId: data.taxId || null,
      paymentTerms: (data.paymentTerms as any) || "NET30",
      status: (data.status as any) || "ACTIVE",
      outletIds: data.outletIds || [],
      notes: data.notes || null,
    };

    try {
      return await db.vendor.create({ data: vendorPayload });
    } catch (err: any) {
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      try {
        return await freshDb.vendor.create({ data: vendorPayload });
      } catch (retryErr: any) {
        if (retryErr.message?.includes("outletIds")) {
          delete vendorPayload.outletIds;
          const created = await freshDb.vendor.create({ data: vendorPayload });
          if (data.outletIds && data.outletIds.length > 0) {
            try {
              await freshDb.$executeRawUnsafe(
                `UPDATE "inventory_vendors" SET "outlet_ids" = $1 WHERE "id" = $2`,
                data.outletIds,
                created.id
              );
            } catch {
              // ignore
            }
          }
          return created;
        }
        throw retryErr;
      }
    }
  },

  async updateVendor(
    restaurantId: string,
    id: string,
    data: {
      name?: string;
      code?: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
      taxId?: string;
      paymentTerms?: string;
      status?: string;
      outletIds?: string[];
      notes?: string;
    }
  ) {
    let db = getPrisma();
    await db.vendor.findFirstOrThrow({ where: { id, restaurantId } });
    const updatePayload: any = {
      ...data,
      paymentTerms: data.paymentTerms ? (data.paymentTerms as any) : undefined,
      status: data.status ? (data.status as any) : undefined,
      outletIds: data.outletIds !== undefined ? data.outletIds : undefined,
    };

    try {
      return await db.vendor.update({
        where: { id },
        data: updatePayload,
      });
    } catch (err: any) {
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      try {
        return await freshDb.vendor.update({
          where: { id },
          data: updatePayload,
        });
      } catch (retryErr: any) {
        if (retryErr.message?.includes("outletIds")) {
          delete updatePayload.outletIds;
          const updated = await freshDb.vendor.update({
            where: { id },
            data: updatePayload,
          });
          if (data.outletIds !== undefined) {
            try {
              await freshDb.$executeRawUnsafe(
                `UPDATE "inventory_vendors" SET "outlet_ids" = $1 WHERE "id" = $2`,
                data.outletIds,
                id
              );
            } catch {
              // ignore
            }
          }
          return updated;
        }
        throw retryErr;
      }
    }
  },

  async archiveVendor(restaurantId: string, id: string) {
    const db = getPrisma();
    await db.vendor.findFirstOrThrow({ where: { id, restaurantId } });
    return db.vendor.update({
      where: { id },
      data: { archivedAt: new Date(), status: "INACTIVE" },
    });
  },

  // Vendor-Item Mappings
  async getVendorItems(restaurantId: string, vendorId?: string, itemId?: string) {
    let db = getPrisma();
    const where: any = { restaurantId };
    if (vendorId) where.vendorId = vendorId;
    if (itemId) where.itemId = itemId;

    try {
      return await db.vendorItem.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true, code: true } },
          item: { select: { id: true, name: true, unitOfMeasure: true, costPerUnit: true, reorderPoint: true, parLevel: true } },
        },
      });
    } catch {
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      return freshDb.vendorItem.findMany({
        where,
        include: {
          vendor: { select: { id: true, name: true, code: true } },
          item: { select: { id: true, name: true, unitOfMeasure: true, costPerUnit: true, reorderPoint: true, parLevel: true } },
        },
      });
    }
  },

  async linkVendorItem(
    restaurantId: string,
    data: {
      vendorId: string;
      itemId: string;
      vendorSku?: string;
      unitCost?: number;
      leadTimeDays?: number;
      isPreferred?: boolean;
    }
  ) {
    let db = getPrisma();
    const executeSingle = async (client: any) => {
      if (data.isPreferred) {
        await client.vendorItem.updateMany({
          where: { restaurantId, itemId: data.itemId, vendorId: { not: data.vendorId } },
          data: { isPreferred: false },
        });
      }
      return client.vendorItem.upsert({
        where: {
          vendorId_itemId: {
            vendorId: data.vendorId,
            itemId: data.itemId,
          },
        },
        update: {
          vendorSku: data.vendorSku || null,
          unitCost: data.unitCost !== undefined ? data.unitCost : null,
          leadTimeDays: data.leadTimeDays !== undefined ? data.leadTimeDays : null,
          isPreferred: data.isPreferred || false,
        },
        create: {
          restaurantId,
          vendorId: data.vendorId,
          itemId: data.itemId,
          vendorSku: data.vendorSku || null,
          unitCost: data.unitCost !== undefined ? data.unitCost : null,
          leadTimeDays: data.leadTimeDays !== undefined ? data.leadTimeDays : null,
          isPreferred: data.isPreferred || false,
        },
        include: {
          vendor: true,
          item: true,
        },
      });
    };

    try {
      return await executeSingle(db);
    } catch {
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      return await executeSingle(freshDb);
    }
  },

  async linkVendorItemsBulk(
    restaurantId: string,
    vendorId: string,
    items: {
      itemId: string;
      vendorSku?: string;
      unitCost?: number;
      leadTimeDays?: number;
      isPreferred?: boolean;
    }[]
  ) {
    let db = getPrisma();
    const executeUpserts = async (client: any) => {
      for (const item of items) {
        if (item.isPreferred) {
          await client.vendorItem.updateMany({
            where: { restaurantId, itemId: item.itemId, vendorId: { not: vendorId } },
            data: { isPreferred: false },
          });
        }
      }

      return await client.$transaction(
        items.map((item) =>
          client.vendorItem.upsert({
            where: {
              vendorId_itemId: {
                vendorId,
                itemId: item.itemId,
              },
            },
            update: {
              vendorSku: item.vendorSku || null,
              unitCost: item.unitCost !== undefined ? item.unitCost : null,
              leadTimeDays: item.leadTimeDays !== undefined ? item.leadTimeDays : null,
              isPreferred: item.isPreferred || false,
            },
            create: {
              restaurantId,
              vendorId,
              itemId: item.itemId,
              vendorSku: item.vendorSku || null,
              unitCost: item.unitCost !== undefined ? item.unitCost : null,
              leadTimeDays: item.leadTimeDays !== undefined ? item.leadTimeDays : null,
              isPreferred: item.isPreferred || false,
            },
          })
        )
      );
    };

    try {
      return await executeUpserts(db);
    } catch {
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      return await executeUpserts(freshDb);
    }
  },

  async unlinkVendorItem(restaurantId: string, vendorId: string, itemId: string) {
    let db = getPrisma();
    return db.vendorItem.deleteMany({
      where: {
        restaurantId,
        vendorId,
        itemId,
      },
    });
  },
};
