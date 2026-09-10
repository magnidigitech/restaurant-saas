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

    let created: any;
    try {
      created = await db.vendor.create({ data: vendorPayload });
    } catch (err: any) {
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      try {
        created = await freshDb.vendor.create({ data: vendorPayload });
      } catch (retryErr: any) {
        delete vendorPayload.outletIds;
        created = await freshDb.vendor.create({ data: vendorPayload });
      }
    }

    // Always guarantee outlet_ids is persisted in PostgreSQL
    if (data.outletIds && data.outletIds.length > 0 && created?.id) {
      const freshDb = createPrismaClient() as any;
      const arraySql = `ARRAY[${data.outletIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")}]::text[]`;
      try {
        await freshDb.$executeRawUnsafe(
          `UPDATE "inventory_vendors" SET "outlet_ids" = ${arraySql} WHERE "id" = '${created.id}'`
        );
      } catch {
        // ignore
      }
    }

    return created;
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

    let updated: any;
    try {
      updated = await db.vendor.update({
        where: { id },
        data: updatePayload,
      });
    } catch (err: any) {
      const freshDb = createPrismaClient() as any;
      (globalThis as any).prisma = freshDb;
      try {
        updated = await freshDb.vendor.update({
          where: { id },
          data: updatePayload,
        });
      } catch (retryErr: any) {
        delete updatePayload.outletIds;
        updated = await freshDb.vendor.update({
          where: { id },
          data: updatePayload,
        });
      }
    }

    // Always guarantee outlet_ids is updated in PostgreSQL
    if (data.outletIds !== undefined) {
      const freshDb = createPrismaClient() as any;
      const arraySql =
        data.outletIds.length > 0
          ? `ARRAY[${data.outletIds.map((item) => `'${item.replace(/'/g, "''")}'`).join(",")}]::text[]`
          : `ARRAY[]::text[]`;
      try {
        await freshDb.$executeRawUnsafe(
          `UPDATE "inventory_vendors" SET "outlet_ids" = ${arraySql} WHERE "id" = '${id}'`
        );
      } catch {
        // ignore
      }
    }

    return updated;
  },

  async archiveVendor(restaurantId: string, id: string) {
    const db = getPrisma();
    await db.vendor.findFirstOrThrow({ where: { id, restaurantId } });
    return db.vendor.update({
      where: { id },
      data: { archivedAt: new Date(), status: "INACTIVE" },
    });
  },

  async bulkImportVendors(
    restaurantId: string,
    rows: Array<{
      rowNumber?: number;
      name?: string;
      code?: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
      taxId?: string;
      paymentTerms?: string;
      status?: string;
      notes?: string;
      action?: "CREATE" | "UPDATE" | "SKIP";
      existingVendorId?: string;
    }>,
    options?: { updateExisting?: boolean }
  ) {
    const db = getPrisma();
    const existingVendors = await db.vendor.findMany({
      where: { restaurantId, archivedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        contactPerson: true,
        email: true,
        phone: true,
        address: true,
        taxId: true,
        paymentTerms: true,
        status: true,
        notes: true,
      },
    });

    const existingIdMap = new Map<string, any>();
    const existingNameMap = new Map<string, any>();
    const existingCodeMap = new Map<string, any>();

    existingVendors.forEach((v: any) => {
      existingIdMap.set(v.id, v);
      if (v.name) existingNameMap.set(v.name.trim().toLowerCase(), v);
      if (v.code) existingCodeMap.set(v.code.trim().toLowerCase(), v);
    });

    const normalizePaymentTerms = (raw: string) => {
      const upper = (raw || "NET30").trim().toUpperCase().replace(/\s+/g, "");
      if (upper === "PREPAID") return "IMMEDIATE";
      const valid = new Set(["COD", "IMMEDIATE", "NET7", "NET15", "NET30", "NET60"]);
      return valid.has(upper) ? upper : "NET30";
    };

    const normalizeStatus = (raw: string) => {
      const upper = (raw || "ACTIVE").trim().toUpperCase();
      const valid = new Set(["ACTIVE", "INACTIVE", "BLOCKED"]);
      return valid.has(upper) ? upper : "ACTIVE";
    };

    const added: Array<{ row: number; name: string; code?: string }> = [];
    const updated: Array<{
      row: number;
      name: string;
      code?: string;
      overrides: Array<{ field: string; label: string; oldValue: string; newValue: string }>;
    }> = [];
    const skipped: Array<{ row: number; name: string; code?: string; reason: string }> = [];
    const failed: Array<{ row: number; name: string; reason: string }> = [];

    const shouldUpdateExisting = options?.updateExisting !== false;

    for (let index = 0; index < rows.length; index++) {
      const r = rows[index];
      const rowNum = r.rowNumber || index + 1;
      const name = (r.name || "").trim();
      const code = (r.code || "").trim();
      const contactPerson = (r.contactPerson || "").trim();
      const email = (r.email || "").trim();
      const phone = (r.phone || "").trim();
      const address = (r.address || "").trim();
      const taxId = (r.taxId || "").trim();
      const paymentTerms = normalizePaymentTerms(r.paymentTerms || "");
      const status = normalizeStatus(r.status || "");
      const notes = (r.notes || "").trim();

      if (r.action === "SKIP") {
        skipped.push({
          row: rowNum,
          name: name || "Unnamed Supplier",
          code: code || undefined,
          reason: "Skipped by user selection",
        });
        continue;
      }

      if (!name && !r.existingVendorId && !code) {
        failed.push({
          row: rowNum,
          name: "Unnamed Supplier",
          reason: "Vendor name or code is required",
        });
        continue;
      }

      const nameLower = name ? name.toLowerCase() : "";
      const codeLower = code ? code.toLowerCase() : "";

      // Match existing vendor: by ID first, then by code, then by name
      let matchedVendor: any = null;
      if (r.existingVendorId && existingIdMap.has(r.existingVendorId)) {
        matchedVendor = existingIdMap.get(r.existingVendorId);
      } else if (codeLower && existingCodeMap.has(codeLower)) {
        matchedVendor = existingCodeMap.get(codeLower);
      } else if (nameLower && existingNameMap.has(nameLower)) {
        matchedVendor = existingNameMap.get(nameLower);
      }

      if (matchedVendor) {
        const canUpdate = r.action === "UPDATE" || (shouldUpdateExisting && r.action !== "CREATE");

        if (!canUpdate) {
          skipped.push({
            row: rowNum,
            name: matchedVendor.name,
            code: matchedVendor.code || undefined,
            reason: `Supplier already exists in directory (Override not selected)`,
          });
          continue;
        }

        // Compute diff across ALL fields
        const fieldChecks: Array<{
          key: "name" | "code" | "contactPerson" | "email" | "phone" | "address" | "taxId" | "paymentTerms" | "status" | "notes";
          label: string;
          currentVal: string;
          newVal: string;
        }> = [
          { key: "name", label: "Supplier Name", currentVal: matchedVendor.name || "", newVal: name || matchedVendor.name },
          { key: "code", label: "Vendor Code", currentVal: matchedVendor.code || "", newVal: code },
          { key: "contactPerson", label: "Representative", currentVal: matchedVendor.contactPerson || "", newVal: contactPerson },
          { key: "email", label: "Email Address", currentVal: matchedVendor.email || "", newVal: email },
          { key: "phone", label: "Phone Number", currentVal: matchedVendor.phone || "", newVal: phone },
          { key: "address", label: "Address", currentVal: matchedVendor.address || "", newVal: address },
          { key: "taxId", label: "Tax ID / GST", currentVal: matchedVendor.taxId || "", newVal: taxId },
          { key: "paymentTerms", label: "Payment Terms", currentVal: matchedVendor.paymentTerms || "NET30", newVal: paymentTerms },
          { key: "status", label: "Status", currentVal: matchedVendor.status || "ACTIVE", newVal: status },
          { key: "notes", label: "Notes", currentVal: matchedVendor.notes || "", newVal: notes },
        ];

        const overrides: Array<{ field: string; label: string; oldValue: string; newValue: string }> = [];
        const updatePayload: any = {};

        for (const item of fieldChecks) {
          const currentTrimmed = item.currentVal.trim();
          const newTrimmed = item.newVal.trim();

          // If the spreadsheet provided a value and it differs from what is in the DB
          if (newTrimmed && newTrimmed !== currentTrimmed) {
            overrides.push({
              field: item.key,
              label: item.label,
              oldValue: item.currentVal || "—",
              newValue: item.newVal,
            });
            updatePayload[item.key] = item.newVal;
          }
        }

        if (overrides.length > 0) {
          try {
            const updatedVendor = await this.updateVendor(restaurantId, matchedVendor.id, updatePayload);

            // Update in-memory lookup maps
            if (matchedVendor.name) existingNameMap.delete(matchedVendor.name.toLowerCase());
            if (updatedVendor.name) existingNameMap.set(updatedVendor.name.toLowerCase(), updatedVendor);

            if (matchedVendor.code) existingCodeMap.delete(matchedVendor.code.toLowerCase());
            if (updatedVendor.code) existingCodeMap.set(updatedVendor.code.toLowerCase(), updatedVendor);

            existingIdMap.set(matchedVendor.id, updatedVendor);

            updated.push({
              row: rowNum,
              name: updatedVendor.name,
              code: updatedVendor.code || undefined,
              overrides,
            });
          } catch (err: any) {
            failed.push({
              row: rowNum,
              name: name || matchedVendor.name,
              reason: err.message || "Failed to update supplier record",
            });
          }
        } else {
          skipped.push({
            row: rowNum,
            name: matchedVendor.name,
            code: matchedVendor.code || undefined,
            reason: "Identical record (all fields match existing directory)",
          });
        }
      } else {
        // Not existing: create new vendor
        if (!name) {
          failed.push({
            row: rowNum,
            name: "Unnamed Supplier",
            reason: "Supplier name is required for new suppliers",
          });
          continue;
        }

        try {
          const created = await this.createVendor(restaurantId, {
            name,
            code: code || undefined,
            contactPerson: contactPerson || undefined,
            email: email || undefined,
            phone: phone || undefined,
            address: address || undefined,
            taxId: taxId || undefined,
            paymentTerms,
            status,
            notes: notes || undefined,
          });

          if (nameLower) existingNameMap.set(nameLower, created);
          if (codeLower) existingCodeMap.set(codeLower, created);
          existingIdMap.set(created.id, created);

          added.push({
            row: rowNum,
            name,
            code: code || undefined,
          });
        } catch (err: any) {
          failed.push({
            row: rowNum,
            name,
            reason: err.message || "Failed to create vendor record",
          });
        }
      }
    }

    return { added, updated, skipped, failed };
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
