import { prisma } from "@/core/database/client";
import { CateringOrderStatus, CateringEventType } from "@prisma/client";

export interface CreateCateringOrderItemInput {
  recipeId?: string;
  itemName: string;
  category?: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

export interface CreateCateringOrderInput {
  eventName: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  eventDate: string | Date;
  eventTime?: string;
  eventType?: CateringEventType;
  guestCount: number;
  venueAddress?: string;
  outletId?: string;
  taxRatePercent?: number;
  discountAmount?: number;
  advancePaid?: number;
  notes?: string;
  items?: CreateCateringOrderItemInput[];
}

export interface UpdateCateringOrderInput {
  eventName?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  eventDate?: string | Date;
  eventTime?: string;
  eventType?: CateringEventType;
  guestCount?: number;
  venueAddress?: string;
  outletId?: string;
  status?: CateringOrderStatus;
  taxRatePercent?: number;
  discountAmount?: number;
  advancePaid?: number;
  notes?: string;
  items?: CreateCateringOrderItemInput[];
}

export async function getCateringRecipes(restaurantId: string) {
  const recipes = await prisma.recipe.findMany({
    where: {
      restaurantId,
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      type: true,
      description: true,
      yieldQuantity: true,
      yieldUnit: true,
      sellingPrice: true,
      costPerUnit: true,
      totalCost: true,
    },
    orderBy: { name: "asc" },
  });
  return recipes;
}

export async function listCateringOrders(
  restaurantId: string,
  filters?: { status?: string; search?: string }
) {
  const where: any = { restaurantId };

  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status as CateringOrderStatus;
  }

  if (filters?.search) {
    const s = filters.search.trim();
    where.OR = [
      { orderNumber: { contains: s, mode: "insensitive" } },
      { eventName: { contains: s, mode: "insensitive" } },
      { clientName: { contains: s, mode: "insensitive" } },
      { clientEmail: { contains: s, mode: "insensitive" } },
      { clientPhone: { contains: s, mode: "insensitive" } },
      { venueAddress: { contains: s, mode: "insensitive" } },
    ];
  }

  const orders = await prisma.cateringOrder.findMany({
    where,
    include: {
      outlet: { select: { id: true, name: true } },
      items: {
        include: {
          recipe: {
            select: { id: true, name: true, yieldQuantity: true, yieldUnit: true, costPerUnit: true, sellingPrice: true },
          },
        },
      },
    },
    orderBy: { eventDate: "asc" },
  });

  // Overview metrics calculation
  const totalOrders = orders.length;
  const activeOrders = orders.filter(
    (o) => o.status === CateringOrderStatus.CONFIRMED || o.status === CateringOrderStatus.IN_PREPARATION
  ).length;
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const totalDeposits = orders.reduce((sum, o) => sum + Number(o.advancePaid || 0), 0);
  const totalBalance = orders.reduce((sum, o) => sum + Number(o.balanceDue || 0), 0);

  return {
    orders,
    metrics: {
      totalOrders,
      activeOrders,
      totalRevenue,
      totalDeposits,
      totalBalance,
    },
  };
}

export async function getCateringOrderById(restaurantId: string, orderId: string) {
  const order = await prisma.cateringOrder.findFirst({
    where: { id: orderId, restaurantId },
    include: {
      outlet: { select: { id: true, name: true } },
      items: {
        include: {
          recipe: {
            include: {
              items: {
                include: {
                  inventoryItem: true,
                  subRecipe: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return order;
}

export async function createCateringOrder(
  restaurantId: string,
  input: CreateCateringOrderInput
) {
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.cateringOrder.count({ where: { restaurantId } });
  const orderNumber = `CAT-${todayStr}-${String(count + 1).padStart(4, "0")}`;

  let subtotal = 0;
  const preparedItems = [];

  if (input.items && input.items.length > 0) {
    for (const item of input.items) {
      let itemName = item.itemName;
      let unitPrice = Number(item.unitPrice || 0);
      let category = item.category || "Main Course";

      // Autofill from recipe if linked
      if (item.recipeId) {
        const recipe = await prisma.recipe.findFirst({
          where: { id: item.recipeId, restaurantId },
        });
        if (recipe) {
          if (!itemName) itemName = recipe.name;
          if (unitPrice === 0) unitPrice = Number(recipe.sellingPrice || 0);
        }
      }

      const qty = Number(item.quantity || 1);
      const itemTotal = unitPrice * qty;
      subtotal += itemTotal;

      preparedItems.push({
        recipeId: item.recipeId || null,
        itemName,
        category,
        unitPrice,
        quantity: qty,
        totalPrice: itemTotal,
        notes: item.notes || null,
      });
    }
  }

  const taxRate = Number(input.taxRatePercent || 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const discountAmount = Number(input.discountAmount || 0);
  const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);
  const advancePaid = Number(input.advancePaid || 0);
  const balanceDue = Math.max(0, totalAmount - advancePaid);

  let initialStatus: CateringOrderStatus = CateringOrderStatus.DRAFT;
  if (advancePaid > 0) {
    initialStatus = CateringOrderStatus.CONFIRMED;
  }

  const newOrder = await prisma.cateringOrder.create({
    data: {
      restaurantId,
      outletId: input.outletId || null,
      orderNumber,
      eventName: input.eventName,
      clientName: input.clientName,
      clientEmail: input.clientEmail || null,
      clientPhone: input.clientPhone || null,
      eventDate: new Date(input.eventDate),
      eventTime: input.eventTime || null,
      eventType: input.eventType || CateringEventType.BUFFET,
      guestCount: Number(input.guestCount || 50),
      venueAddress: input.venueAddress || null,
      status: initialStatus,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      advancePaid,
      balanceDue,
      notes: input.notes || null,
      items: {
        create: preparedItems,
      },
    },
    include: {
      items: {
        include: {
          recipe: true,
        },
      },
    },
  });

  return newOrder;
}

export async function updateCateringOrder(
  restaurantId: string,
  orderId: string,
  input: UpdateCateringOrderInput
) {
  const existing = await prisma.cateringOrder.findFirst({
    where: { id: orderId, restaurantId },
    include: { items: true },
  });

  if (!existing) {
    throw new Error("Catering order not found.");
  }

  let subtotal = Number(existing.subtotal || 0);
  let preparedItems: any[] | undefined = undefined;

  if (input.items !== undefined) {
    subtotal = 0;
    preparedItems = [];
    for (const item of input.items) {
      let itemName = item.itemName;
      let unitPrice = Number(item.unitPrice || 0);
      let category = item.category || "Main Course";

      if (item.recipeId) {
        const recipe = await prisma.recipe.findFirst({
          where: { id: item.recipeId, restaurantId },
        });
        if (recipe) {
          if (!itemName) itemName = recipe.name;
          if (unitPrice === 0) unitPrice = Number(recipe.sellingPrice || 0);
        }
      }

      const qty = Number(item.quantity || 1);
      const itemTotal = unitPrice * qty;
      subtotal += itemTotal;

      preparedItems.push({
        recipeId: item.recipeId || null,
        itemName,
        category,
        unitPrice,
        quantity: qty,
        totalPrice: itemTotal,
        notes: item.notes || null,
      });
    }
  }

  const taxRate = input.taxRatePercent !== undefined ? Number(input.taxRatePercent) : (Number(existing.taxAmount || 0) * 100) / Math.max(1, Number(existing.subtotal || 1));
  const taxAmount = (subtotal * taxRate) / 100;
  const discountAmount = input.discountAmount !== undefined ? Number(input.discountAmount) : Number(existing.discountAmount || 0);
  const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);
  const advancePaid = input.advancePaid !== undefined ? Number(input.advancePaid) : Number(existing.advancePaid || 0);
  const balanceDue = Math.max(0, totalAmount - advancePaid);

  let newStatus = input.status || existing.status;

  // Delete old items if updating items array
  if (preparedItems) {
    await prisma.cateringOrderItem.deleteMany({
      where: { cateringOrderId: orderId },
    });
  }

  const updatedOrder = await prisma.cateringOrder.update({
    where: { id: orderId },
    data: {
      eventName: input.eventName !== undefined ? input.eventName : existing.eventName,
      clientName: input.clientName !== undefined ? input.clientName : existing.clientName,
      clientEmail: input.clientEmail !== undefined ? input.clientEmail : existing.clientEmail,
      clientPhone: input.clientPhone !== undefined ? input.clientPhone : existing.clientPhone,
      eventDate: input.eventDate ? new Date(input.eventDate) : existing.eventDate,
      eventTime: input.eventTime !== undefined ? input.eventTime : existing.eventTime,
      eventType: input.eventType || existing.eventType,
      guestCount: input.guestCount !== undefined ? Number(input.guestCount) : existing.guestCount,
      venueAddress: input.venueAddress !== undefined ? input.venueAddress : existing.venueAddress,
      status: newStatus,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      advancePaid,
      balanceDue,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      ...(preparedItems
        ? {
            items: {
              create: preparedItems,
            },
          }
        : {}),
    },
    include: {
      items: {
        include: {
          recipe: true,
        },
      },
    },
  });

  return updatedOrder;
}

export async function deleteCateringOrder(restaurantId: string, orderId: string) {
  const existing = await prisma.cateringOrder.findFirst({
    where: { id: orderId, restaurantId },
  });

  if (!existing) {
    throw new Error("Catering order not found.");
  }

  await prisma.cateringOrder.delete({
    where: { id: orderId },
  });

  return { success: true };
}

export async function calculateEventIngredients(restaurantId: string, orderId: string) {
  const order = await prisma.cateringOrder.findFirst({
    where: { id: orderId, restaurantId },
    include: {
      items: {
        include: {
          recipe: {
            include: {
              items: {
                include: {
                  inventoryItem: true,
                  subRecipe: {
                    include: {
                      items: {
                        include: {
                          inventoryItem: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error("Catering order not found.");
  }

  const rawMaterialRequirementsMap = new Map<
    string,
    {
      inventoryItemId: string;
      name: string;
      categoryName?: string;
      unitOfMeasure: string;
      requiredQuantity: number;
      estimatedUnitCost: number;
      totalEstimatedCost: number;
      usedInDishes: string[];
    }
  >();

  const guestCount = order.guestCount || 50;

  for (const item of order.items) {
    if (!item.recipe) continue;

    const recipe = item.recipe;
    const yieldQty = Number(recipe.yieldQuantity || 1);
    // Multiplier based on Pax vs Recipe yield quantity
    const itemQty = Number(item.quantity || guestCount);
    const multiplier = itemQty / yieldQty;

    const processRecipeItem = (recItem: any, dishName: string, scaleFactor: number) => {
      if (recItem.componentType === "INVENTORY_ITEM" && recItem.inventoryItem) {
        const inv = recItem.inventoryItem;
        const baseQty = Number(recItem.quantity || 0);
        const wastagePct = Number(recItem.wastagePercent || 0);
        const grossQty = baseQty * (1 + wastagePct / 100) * scaleFactor;
        const unitCost = Number(recItem.unitCost || inv.costPrice || 0);

        const existingReq = rawMaterialRequirementsMap.get(inv.id);
        if (existingReq) {
          existingReq.requiredQuantity += grossQty;
          existingReq.totalEstimatedCost += grossQty * unitCost;
          if (!existingReq.usedInDishes.includes(dishName)) {
            existingReq.usedInDishes.push(dishName);
          }
        } else {
          rawMaterialRequirementsMap.set(inv.id, {
            inventoryItemId: inv.id,
            name: inv.name,
            categoryName: inv.categoryId ? "Raw Ingredient" : "General",
            unitOfMeasure: recItem.unitOfMeasure || inv.unitOfMeasure,
            requiredQuantity: grossQty,
            estimatedUnitCost: unitCost,
            totalEstimatedCost: grossQty * unitCost,
            usedInDishes: [dishName],
          });
        }
      } else if (recItem.componentType === "SUB_RECIPE" && recItem.subRecipe) {
        const subRec = recItem.subRecipe;
        const subYield = Number(subRec.yieldQuantity || 1);
        const subScale = (Number(recItem.quantity || 1) / subYield) * scaleFactor;
        if (subRec.items) {
          for (const subRecItem of subRec.items) {
            processRecipeItem(subRecItem, `${dishName} (Sub-recipe: ${subRec.name})`, subScale);
          }
        }
      }
    };

    for (const recItem of recipe.items) {
      processRecipeItem(recItem, item.itemName || recipe.name, multiplier);
    }
  }

  const rawMaterials = Array.from(rawMaterialRequirementsMap.values()).map((rm) => ({
    ...rm,
    requiredQuantity: Number(rm.requiredQuantity.toFixed(3)),
    totalEstimatedCost: Number(rm.totalEstimatedCost.toFixed(2)),
  }));

  const totalRawCost = rawMaterials.reduce((sum, r) => sum + r.totalEstimatedCost, 0);

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    eventName: order.eventName,
    guestCount,
    rawMaterials,
    totalRawCost: Number(totalRawCost.toFixed(2)),
  };
}

export interface CreateCateringPackageInput {
  name: string;
  description?: string;
  category?: string;
  pricePerPax: number;
  suggestedPax?: number;
  items: Array<{
    recipeId?: string;
    itemName: string;
    category?: string;
    unitPrice: number;
    portionQtyPerPax?: number;
  }>;
}

export async function listCateringPackages(restaurantId: string) {
  return prisma.cateringPackage.findMany({
    where: { restaurantId },
    include: {
      items: {
        include: {
          recipe: {
            select: { id: true, name: true, costPerUnit: true, sellingPrice: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function createCateringPackage(
  restaurantId: string,
  input: CreateCateringPackageInput
) {
  const preparedItems = input.items.map((i) => ({
    recipeId: i.recipeId || null,
    itemName: i.itemName,
    category: i.category || "Main Course",
    unitPrice: Number(i.unitPrice || 0),
    portionQtyPerPax: Number(i.portionQtyPerPax || 1),
  }));

  return prisma.cateringPackage.create({
    data: {
      restaurantId,
      name: input.name,
      description: input.description || null,
      category: input.category || "Buffet",
      pricePerPax: Number(input.pricePerPax || 0),
      suggestedPax: Number(input.suggestedPax || 50),
      items: {
        create: preparedItems,
      },
    },
    include: {
      items: true,
    },
  });
}

export async function deleteCateringPackage(restaurantId: string, packageId: string) {
  const pkg = await prisma.cateringPackage.findFirst({
    where: { id: packageId, restaurantId },
  });
  if (!pkg) throw new Error("Catering package not found.");
  await prisma.cateringPackage.delete({ where: { id: packageId } });
  return { success: true };
}

