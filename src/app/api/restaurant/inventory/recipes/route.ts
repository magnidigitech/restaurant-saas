import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { syncRecipeCosting } from "@/core/inventory/recipeCosting";
import { z } from "zod";

import { UnitOfMeasure } from "@prisma/client";

const createRecipeItemSchema = z.object({
  componentType: z.enum(["INVENTORY_ITEM", "SUB_RECIPE"]),
  inventoryItemId: z.string().optional().nullable(),
  subRecipeId: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unitOfMeasure: z.nativeEnum(UnitOfMeasure),
  wastagePercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

const createRecipeSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["DISH", "SUB_RECIPE"]).default("DISH"),
  description: z.string().optional(),
  yieldQuantity: z.number().positive().default(1),
  yieldUnit: z.nativeEnum(UnitOfMeasure).default(UnitOfMeasure.PORTION),
  servingSize: z.string().optional(),
  prepTimeMin: z.number().int().min(0).optional(),
  sellingPrice: z.number().min(0).default(0),
  items: z.array(createRecipeItemSchema).min(1),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "DISH" | "SUB_RECIPE"
    const search = searchParams.get("search");

    const whereClause: any = {
      restaurantId: session.activeRestaurantId,
      archivedAt: null,
    };

    if (type === "DISH" || type === "SUB_RECIPE") {
      whereClause.type = type;
    }

    if (search) {
      whereClause.name = { contains: search, mode: "insensitive" };
    }

    const recipes = await prisma.recipe.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { items: true, usedInRecipeItems: true },
        },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, recipes });
  } catch (error: any) {
    console.error("List Recipes Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = createRecipeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid recipe payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    // Check duplicate name
    const existing = await prisma.recipe.findFirst({
      where: {
        restaurantId: session.activeRestaurantId,
        name: { equals: data.name, mode: "insensitive" },
        archivedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json({ error: `A recipe with the name "${data.name}" already exists.` }, { status: 400 });
    }

    // Verify all referenced inventory items and sub-recipes belong to this restaurant
    for (const item of data.items) {
      if (item.componentType === "INVENTORY_ITEM") {
        if (!item.inventoryItemId) {
          return NextResponse.json({ error: "Inventory item ID is required for inventory components" }, { status: 400 });
        }
        const inv = await prisma.inventoryItem.findFirst({
          where: { id: item.inventoryItemId, restaurantId: session.activeRestaurantId, archivedAt: null },
        });
        if (!inv) {
          return NextResponse.json({ error: `Inventory item ${item.inventoryItemId} not found or unauthorized` }, { status: 404 });
        }
      } else if (item.componentType === "SUB_RECIPE") {
        if (!item.subRecipeId) {
          return NextResponse.json({ error: "Sub-recipe ID is required for sub-recipe components" }, { status: 400 });
        }
        const sub = await prisma.recipe.findFirst({
          where: { id: item.subRecipeId, restaurantId: session.activeRestaurantId, archivedAt: null },
        });
        if (!sub) {
          return NextResponse.json({ error: `Sub-recipe ${item.subRecipeId} not found or unauthorized` }, { status: 404 });
        }
      }
    }

    // Create Recipe and items
    const newRecipe = await prisma.recipe.create({
      data: {
        restaurantId: session.activeRestaurantId,
        name: data.name,
        type: data.type,
        description: data.description,
        yieldQuantity: data.yieldQuantity,
        yieldUnit: data.yieldUnit,
        servingSize: data.servingSize,
        prepTimeMin: data.prepTimeMin,
        sellingPrice: data.sellingPrice,
        items: {
          create: data.items.map((i) => ({
            componentType: i.componentType,
            inventoryItemId: i.componentType === "INVENTORY_ITEM" ? i.inventoryItemId : null,
            subRecipeId: i.componentType === "SUB_RECIPE" ? i.subRecipeId : null,
            quantity: i.quantity,
            unitOfMeasure: i.unitOfMeasure,
            wastagePercent: i.wastagePercent,
            notes: i.notes,
          })),
        },
      },
    });

    // Compute and sync costing
    const breakdown = await syncRecipeCosting(newRecipe.id);

    await prisma.auditLog.create({
      data: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
        userEmail: session.email,
        action: "RECIPE_CREATED",
        entityType: "Recipe",
        entityId: newRecipe.id,
        newValues: JSON.stringify({ name: newRecipe.name, type: newRecipe.type, totalCost: breakdown.totalCost }),
      },
    });

    return NextResponse.json({ success: true, recipe: newRecipe, breakdown }, { status: 201 });
  } catch (error: any) {
    console.error("Create Recipe Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
