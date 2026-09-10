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
    if (data.parentId && data.parentId === id) {
      throw new Error("Category cannot be its own parent");
    }
    return prisma.inventoryCategory.update({
      where: { id },
      data: {
        ...data,
        parentId: data.parentId === "" ? null : data.parentId,
      },
    });
  },

  async deleteCategory(restaurantId: string, id: string) {
    await prisma.inventoryCategory.findFirstOrThrow({ where: { id, restaurantId } });
    return prisma.inventoryCategory.delete({ where: { id } });
  },

  async moveItemsCategory(
    restaurantId: string,
    itemIds: string[],
    targetCategoryId: string | null
  ) {
    if (targetCategoryId) {
      await prisma.inventoryCategory.findFirstOrThrow({
        where: { id: targetCategoryId, restaurantId },
      });
    }
    return prisma.inventoryItem.updateMany({
      where: {
        id: { in: itemIds },
        restaurantId,
      },
      data: {
        categoryId: targetCategoryId,
      },
    });
  },

  async bulkImportCategories(
    restaurantId: string,
    rows: Array<{
      rowNumber?: number;
      name?: string;
      parentCategory?: string;
      description?: string;
    }>
  ) {
    const existingCats = await prisma.inventoryCategory.findMany({
      where: { restaurantId },
      select: { id: true, name: true, parentId: true },
    });

    const catNameToIdMap = new Map<string, string>();
    existingCats.forEach((c) => catNameToIdMap.set(c.name.trim().toLowerCase(), c.id));

    const added: Array<{ row: number; name: string; parentCategory?: string }> = [];
    const skipped: Array<{ row: number; name: string; reason: string }> = [];
    const failed: Array<{ row: number; name: string; reason: string }> = [];

    for (let index = 0; index < rows.length; index++) {
      const r = rows[index];
      const rowNum = r.rowNumber || index + 1;
      const name = (r.name || "").trim();
      const parentName = (r.parentCategory || "").trim();
      const description = (r.description || "").trim();

      if (!name) {
        failed.push({
          row: rowNum,
          name: "Unnamed Category",
          reason: "Category name is required",
        });
        continue;
      }

      const nameLower = name.toLowerCase();
      if (catNameToIdMap.has(nameLower)) {
        skipped.push({
          row: rowNum,
          name,
          reason: `Category "${name}" already exists in taxonomy`,
        });
        continue;
      }

      let parentId: string | null = null;
      if (parentName) {
        const parentLower = parentName.toLowerCase();
        if (catNameToIdMap.has(parentLower)) {
          parentId = catNameToIdMap.get(parentLower)!;
        } else {
          // Auto-create parent category if it doesn't exist yet
          const newParent = await prisma.inventoryCategory.create({
            data: {
              restaurantId,
              name: parentName,
            },
          });
          parentId = newParent.id;
          catNameToIdMap.set(parentLower, newParent.id);
          added.push({
            row: rowNum,
            name: parentName,
            parentCategory: "Root (Auto-created)",
          });
        }
      }

      const created = await prisma.inventoryCategory.create({
        data: {
          restaurantId,
          name,
          description: description || null,
          parentId,
        },
      });

      catNameToIdMap.set(nameLower, created.id);
      added.push({
        row: rowNum,
        name,
        parentCategory: parentName || undefined,
      });
    }

    return { added, skipped, failed };
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

    const items = await prisma.inventoryItem.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    const itemIds = items.map((i) => i.id);
    const stockAggs = await prisma.stockLedger.groupBy({
      by: ["itemId"],
      where: {
        restaurantId,
        itemId: { in: itemIds },
      },
      _sum: { quantity: true },
    });

    const stockMap = new Map<string, number>();
    stockAggs.forEach((agg) => {
      stockMap.set(agg.itemId, Number(agg._sum.quantity ?? 0));
    });

    return items.map((item) => {
      const currentStock = stockMap.get(item.id) ?? 0;
      const reorderPoint = Number(item.reorderPoint ?? 0);
      const isLowStock = currentStock > 0 && currentStock <= reorderPoint;
      const isOutOfStock = currentStock <= 0;
      return {
        ...item,
        costPerUnit: Number(item.costPerUnit ?? 0),
        reorderPoint,
        parLevel: Number(item.parLevel ?? 0),
        currentStock,
        isLowStock,
        isOutOfStock,
      };
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

  async bulkImportItems(
    restaurantId: string,
    rows: Array<{
      rowNumber?: number;
      name?: string;
      sku?: string;
      category?: string;
      unitOfMeasure?: string;
      costPerUnit?: number | string;
      reorderPoint?: number | string;
      parLevel?: number | string;
      description?: string;
      action?: "CREATE" | "UPDATE" | "SKIP";
      existingItemId?: string;
    }>,
    options?: { updateExisting?: boolean }
  ) {
    const existingItems = await prisma.inventoryItem.findMany({
      where: { restaurantId, archivedAt: null },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    const existingIdMap = new Map<string, any>();
    const existingNameMap = new Map<string, any>();
    const existingSkuMap = new Map<string, any>();

    existingItems.forEach((i: any) => {
      existingIdMap.set(i.id, i);
      if (i.name) existingNameMap.set(i.name.trim().toLowerCase(), i);
      if (i.sku) existingSkuMap.set(i.sku.trim().toLowerCase(), i);
    });

    const categories = await prisma.inventoryCategory.findMany({
      where: { restaurantId },
      select: { id: true, name: true },
    });

    const categoryMap = new Map<string, string>();
    categories.forEach((c) => categoryMap.set(c.name.trim().toLowerCase(), c.id));

    const validUoms = new Set([
      "KG", "G", "LB", "OZ", "L", "ML", "GAL", "QT", "PT", "CUP",
      "FL_OZ", "TBSP", "TSP", "LADLE", "PIECES", "DOZEN", "PORTION", "BOX", "PACKET"
    ]);

    const added: Array<{ row: number; name: string; sku?: string }> = [];
    const updated: Array<{
      row: number;
      name: string;
      sku?: string;
      overrides: Array<{ field: string; label: string; oldValue: string; newValue: string }>;
    }> = [];
    const skipped: Array<{ row: number; name: string; sku?: string; reason: string }> = [];
    const failed: Array<{ row: number; name: string; reason: string }> = [];

    const shouldUpdateExisting = options?.updateExisting !== false;

    for (let index = 0; index < rows.length; index++) {
      const r = rows[index];
      const rowNum = r.rowNumber || index + 1;
      const name = (r.name || "").trim();
      const sku = (r.sku || "").trim();
      const catName = (r.category || "").trim();
      const uomRaw = (r.unitOfMeasure || "PIECES").trim().toUpperCase();
      const description = (r.description || "").trim();

      if (r.action === "SKIP") {
        skipped.push({
          row: rowNum,
          name: name || "Unnamed Item",
          sku: sku || undefined,
          reason: "Skipped by user selection",
        });
        continue;
      }

      if (!name && !r.existingItemId && !sku) {
        failed.push({
          row: rowNum,
          name: "Unnamed Item",
          reason: "Item name is required",
        });
        continue;
      }

      const nameLower = name ? name.toLowerCase() : "";
      const skuLower = sku ? sku.toLowerCase() : "";

      // Parse numeric fields safely
      const costRaw = r.costPerUnit;
      const costPerUnit = costRaw !== undefined && costRaw !== "" && costRaw !== null ? Number(costRaw) : 0;
      if (isNaN(costPerUnit) || costPerUnit < 0) {
        failed.push({
          row: rowNum,
          name: name || "Unnamed Item",
          reason: "Cost per unit must be a valid non-negative number",
        });
        continue;
      }

      const reorderPoint = Number(r.reorderPoint) || 0;
      const parLevel = Number(r.parLevel) || 0;

      // Match UOM
      let unitOfMeasure = "PIECES";
      if (validUoms.has(uomRaw)) {
        unitOfMeasure = uomRaw;
      } else if (uomRaw === "POUND" || uomRaw === "POUNDS" || uomRaw === "LBS" || uomRaw === "LB") unitOfMeasure = "LB";
      else if (uomRaw === "OUNCE" || uomRaw === "OUNCES" || uomRaw === "OZ") unitOfMeasure = "OZ";
      else if (uomRaw === "KILOGRAM" || uomRaw === "KILOGRAMS" || uomRaw === "KG" || uomRaw === "KGS") unitOfMeasure = "KG";
      else if (uomRaw === "GRAM" || uomRaw === "GRAMS" || uomRaw === "G") unitOfMeasure = "G";
      else if (uomRaw === "LITER" || uomRaw === "LITERS" || uomRaw === "L" || uomRaw === "LTR") unitOfMeasure = "L";
      else if (uomRaw === "MILLILITER" || uomRaw === "MILLILITERS" || uomRaw === "ML") unitOfMeasure = "ML";
      else if (uomRaw === "GALLON" || uomRaw === "GALLONS" || uomRaw === "GAL") unitOfMeasure = "GAL";
      else if (uomRaw === "QUART" || uomRaw === "QUARTS" || uomRaw === "QT") unitOfMeasure = "QT";
      else if (uomRaw === "PINT" || uomRaw === "PINTS" || uomRaw === "PT") unitOfMeasure = "PT";
      else if (uomRaw === "CUP" || uomRaw === "CUPS") unitOfMeasure = "CUP";
      else if (uomRaw === "TABLESPOON" || uomRaw === "TBSP") unitOfMeasure = "TBSP";
      else if (uomRaw === "TEASPOON" || uomRaw === "TSP") unitOfMeasure = "TSP";
      else if (uomRaw === "LADLE" || uomRaw === "SCOOP") unitOfMeasure = "LADLE";
      else if (uomRaw === "DOZEN" || uomRaw === "DOZ") unitOfMeasure = "DOZEN";
      else if (uomRaw === "PORTION" || uomRaw === "SERVING") unitOfMeasure = "PORTION";
      else if (uomRaw === "BOX" || uomRaw === "BOXES") unitOfMeasure = "BOX";
      else if (uomRaw === "PACKET" || uomRaw === "PACKETS" || uomRaw === "PKT") unitOfMeasure = "PACKET";
      else if (uomRaw === "PIECES" || uomRaw === "PCS" || uomRaw === "PC" || uomRaw === "PIECE") unitOfMeasure = "PIECES";

      // Resolve Category ID
      let categoryId: string | undefined = undefined;
      if (catName) {
        const catKey = catName.toLowerCase();
        if (categoryMap.has(catKey)) {
          categoryId = categoryMap.get(catKey);
        } else {
          try {
            const newCat = await prisma.inventoryCategory.create({
              data: {
                restaurantId,
                name: catName,
              },
            });
            categoryId = newCat.id;
            categoryMap.set(catKey, newCat.id);
          } catch {
            // ignore
          }
        }
      }

      // Match existing item: by ID first, then by SKU, then by name
      let matchedItem: any = null;
      if (r.existingItemId && existingIdMap.has(r.existingItemId)) {
        matchedItem = existingIdMap.get(r.existingItemId);
      } else if (skuLower && existingSkuMap.has(skuLower)) {
        matchedItem = existingSkuMap.get(skuLower);
      } else if (nameLower && existingNameMap.has(nameLower)) {
        matchedItem = existingNameMap.get(nameLower);
      }

      if (matchedItem) {
        const canUpdate = r.action === "UPDATE" || (shouldUpdateExisting && r.action !== "CREATE");

        if (!canUpdate) {
          skipped.push({
            row: rowNum,
            name: matchedItem.name,
            sku: matchedItem.sku || undefined,
            reason: `Item already exists in catalog (Override not selected)`,
          });
          continue;
        }

        // Compute diff across ALL 8 item fields
        const overrides: Array<{ field: string; label: string; oldValue: string; newValue: string }> = [];
        const updateData: any = {};

        // 1. Name
        if (name && name !== matchedItem.name) {
          overrides.push({
            field: "name",
            label: "Item Name",
            oldValue: matchedItem.name,
            newValue: name,
          });
          updateData.name = name;
        }

        // 2. SKU
        if (sku && sku !== (matchedItem.sku || "")) {
          overrides.push({
            field: "sku",
            label: "SKU Code",
            oldValue: matchedItem.sku || "—",
            newValue: sku,
          });
          updateData.sku = sku;
        }

        // 3. Category
        const currentCatName = matchedItem.category?.name || "";
        if (catName && catName.toLowerCase() !== currentCatName.toLowerCase()) {
          overrides.push({
            field: "category",
            label: "Category",
            oldValue: currentCatName || "—",
            newValue: catName,
          });
          updateData.categoryId = categoryId || null;
        }

        // 4. Unit of Measure
        if (unitOfMeasure && unitOfMeasure !== matchedItem.unitOfMeasure) {
          overrides.push({
            field: "unitOfMeasure",
            label: "Unit of Measure",
            oldValue: matchedItem.unitOfMeasure || "PIECES",
            newValue: unitOfMeasure,
          });
          updateData.unitOfMeasure = unitOfMeasure as any;
        }

        // 5. Cost Per Unit
        const currentCost = Number(matchedItem.costPerUnit || 0);
        if (costRaw !== undefined && costRaw !== "" && Math.abs(costPerUnit - currentCost) > 0.0001) {
          overrides.push({
            field: "costPerUnit",
            label: "Cost Per Unit",
            oldValue: `$${currentCost.toFixed(2)}`,
            newValue: `$${costPerUnit.toFixed(2)}`,
          });
          updateData.costPerUnit = costPerUnit;
        }

        // 6. Reorder Point
        const currentReorder = Number(matchedItem.reorderPoint || 0);
        if (r.reorderPoint !== undefined && r.reorderPoint !== "" && Math.abs(reorderPoint - currentReorder) > 0.0001) {
          overrides.push({
            field: "reorderPoint",
            label: "Reorder Point",
            oldValue: currentReorder.toString(),
            newValue: reorderPoint.toString(),
          });
          updateData.reorderPoint = reorderPoint;
        }

        // 7. Par Level
        const currentPar = Number(matchedItem.parLevel || 0);
        if (r.parLevel !== undefined && r.parLevel !== "" && Math.abs(parLevel - currentPar) > 0.0001) {
          overrides.push({
            field: "parLevel",
            label: "Par Level",
            oldValue: currentPar.toString(),
            newValue: parLevel.toString(),
          });
          updateData.parLevel = parLevel;
        }

        // 8. Description
        const currentDesc = matchedItem.description || "";
        if (description && description !== currentDesc) {
          overrides.push({
            field: "description",
            label: "Description",
            oldValue: currentDesc || "—",
            newValue: description,
          });
          updateData.description = description;
        }

        if (overrides.length > 0) {
          try {
            const updatedItem = await prisma.inventoryItem.update({
              where: { id: matchedItem.id },
              data: updateData,
              include: {
                category: { select: { id: true, name: true } },
              },
            });

            // Update in-memory cache
            if (matchedItem.name) existingNameMap.delete(matchedItem.name.toLowerCase());
            if (updatedItem.name) existingNameMap.set(updatedItem.name.toLowerCase(), updatedItem);

            if (matchedItem.sku) existingSkuMap.delete(matchedItem.sku.toLowerCase());
            if (updatedItem.sku) existingSkuMap.set(updatedItem.sku.toLowerCase(), updatedItem);

            existingIdMap.set(matchedItem.id, updatedItem);

            updated.push({
              row: rowNum,
              name: updatedItem.name,
              sku: updatedItem.sku || undefined,
              overrides,
            });
          } catch (err: any) {
            failed.push({
              row: rowNum,
              name: name || matchedItem.name,
              reason: err.message || "Failed to update item record",
            });
          }
        } else {
          skipped.push({
            row: rowNum,
            name: matchedItem.name,
            sku: matchedItem.sku || undefined,
            reason: "Identical record (all fields match existing catalog)",
          });
        }
      } else {
        // Not existing: create new item
        if (!name) {
          failed.push({
            row: rowNum,
            name: "Unnamed Item",
            reason: "Item name is required for new items",
          });
          continue;
        }

        try {
          const newItem = await prisma.inventoryItem.create({
            data: {
              restaurantId,
              name,
              sku: sku || null,
              description: description || null,
              categoryId: categoryId || null,
              unitOfMeasure: unitOfMeasure as any,
              costPerUnit,
              reorderPoint,
              parLevel,
            },
            include: {
              category: { select: { id: true, name: true } },
            },
          });

          if (nameLower) existingNameMap.set(nameLower, newItem as any);
          if (skuLower) existingSkuMap.set(skuLower, newItem as any);
          existingIdMap.set(newItem.id, newItem as any);

          added.push({
            row: rowNum,
            name,
            sku: sku || undefined,
          });
        } catch (err: any) {
          failed.push({
            row: rowNum,
            name,
            reason: err.message || "Database creation error",
          });
        }
      }
    }

    return { added, updated, skipped, failed };
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
