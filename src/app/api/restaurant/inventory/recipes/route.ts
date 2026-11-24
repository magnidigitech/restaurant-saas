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
  packId: z.string().optional().nullable(),
  quantity: z.number().min(0),
  packQuantity: z.number().min(0).optional().nullable(),
  unitOfMeasure: z.nativeEnum(UnitOfMeasure),
  wastagePercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional().nullable(),
  originalText: z.string().optional().nullable(),
  statedQuantityRaw: z.string().optional().nullable(),
  isUnresolved: z.boolean().default(false),
  unresolvedReason: z.string().optional().nullable(),
});

const createRecipeSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["DISH", "SUB_RECIPE"]).default("DISH"),
  description: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  yieldQuantity: z.number().positive().default(1),
  yieldUnit: z.nativeEnum(UnitOfMeasure).default(UnitOfMeasure.PORTION),
  servingSize: z.string().optional().nullable(),
  prepTimeMin: z.number().int().min(0).optional().nullable(),
  sellingPrice: z.number().min(0).default(0),
  targetFoodCostPercent: z.number().min(1).max(100).optional().nullable(),
  isDraft: z.boolean().default(false),
  publishedRecipeId: z.string().optional().nullable(),
  sourceType: z.enum(["MANUAL", "PASTED", "EXCEL"]).default("MANUAL"),
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
    const status = searchParams.get("status"); // "PUBLISHED" | "DRAFT" | "ALL"

    const whereClause: any = {
      restaurantId: session.activeRestaurantId,
      archivedAt: null,
    };

    if (type === "DISH" || type === "SUB_RECIPE") {
      whereClause.type = type;
    }

    if (status === "DRAFT") {
      whereClause.isDraft = true;
    } else if (status === "PUBLISHED") {
      whereClause.isDraft = false;
    }

    if (search) {
      whereClause.name = { contains: search, mode: "insensitive" };
    }

    let recipes;
    try {
      recipes = await prisma.recipe.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { items: true, usedInRecipeItems: true },
          },
        },
        orderBy: [{ isDraft: "desc" }, { type: "asc" }, { name: "asc" }],
      });
    } catch (err: any) {
      if (err.message && err.message.includes("isDraft")) {
        delete whereClause.isDraft;
        recipes = await prisma.recipe.findMany({
          where: whereClause,
          include: {
            _count: {
              select: { items: true, usedInRecipeItems: true },
            },
          },
          orderBy: [{ type: "asc" }, { name: "asc" }],
        });
        if (status === "DRAFT") {
          recipes = recipes.filter((r: any) => r.isDraft === true);
        } else if (status === "PUBLISHED") {
          recipes = recipes.filter((r: any) => !r.isDraft);
        }
      } else {
        throw err;
      }
    }

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

    // Check duplicate name in tenant
    let effectiveName = data.name;
    const existing = await prisma.recipe.findFirst({
      where: {
        restaurantId: session.activeRestaurantId,
        name: { equals: effectiveName, mode: "insensitive" },
        archivedAt: null,
      },
    });

    if (existing) {
      if (data.isDraft && data.publishedRecipeId) {
        // Auto-suffix draft title for draft of published recipe
        effectiveName = `${data.name} (Draft)`;
      } else {
        return NextResponse.json({ error: `A recipe with the name "${data.name}" already exists.` }, { status: 400 });
      }
    }

    // Validation for PUBLISHED recipes: Block publishing if unresolved lines exist
    if (!data.isDraft) {
      const unresolvedLines = data.items.filter((i) => i.isUnresolved || (!i.inventoryItemId && !i.subRecipeId));
      if (unresolvedLines.length > 0) {
        return NextResponse.json(
          {
            error: "Cannot publish recipe with unresolved ingredient lines or unmapped stock items. Please resolve all issues or save as Draft.",
            unresolvedCount: unresolvedLines.length,
            unresolvedLines: unresolvedLines.map((u) => u.originalText || u.unresolvedReason || "Unknown line"),
          },
          { status: 400 }
        );
      }
    }

    // Verify all referenced inventory items and sub-recipes belong to this restaurant (tenant isolation)
    for (const item of data.items) {
      if (item.componentType === "INVENTORY_ITEM" && item.inventoryItemId) {
        const inv = await prisma.inventoryItem.findFirst({
          where: { id: item.inventoryItemId, restaurantId: session.activeRestaurantId, archivedAt: null },
        });
        if (!inv) {
          return NextResponse.json({ error: `Inventory item ${item.inventoryItemId} not found or unauthorized` }, { status: 404 });
        }

        // If packId provided, verify it belongs to this inventory item
        if (item.packId) {
          const pack = await prisma.itemPurchasePack.findFirst({
            where: { id: item.packId, itemId: item.inventoryItemId, restaurantId: session.activeRestaurantId },
          });
          if (!pack) {
            return NextResponse.json({ error: `Purchase packaging ${item.packId} is invalid for item ${inv.name}` }, { status: 400 });
          }
        }
      } else if (item.componentType === "SUB_RECIPE" && item.subRecipeId) {
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
        name: effectiveName,
        type: data.type,
        description: data.description || null,
        instructions: data.instructions || null,
        yieldQuantity: data.yieldQuantity,
        yieldUnit: data.yieldUnit,
        servingSize: data.servingSize || null,
        prepTimeMin: data.prepTimeMin || null,
        sellingPrice: data.sellingPrice,
        targetFoodCostPercent: data.targetFoodCostPercent || 28,
        isDraft: data.isDraft,
        publishedRecipeId: data.publishedRecipeId || null,
        sourceType: data.sourceType,
        items: {
          create: data.items.map((i) => ({
            componentType: i.componentType,
            inventoryItemId: i.componentType === "INVENTORY_ITEM" ? i.inventoryItemId : null,
            subRecipeId: i.componentType === "SUB_RECIPE" ? i.subRecipeId : null,
            packId: i.packId || null,
            quantity: i.quantity,
            packQuantity: i.packQuantity || null,
            unitOfMeasure: i.unitOfMeasure,
            wastagePercent: i.wastagePercent,
            notes: i.notes || null,
            originalText: i.originalText || null,
            statedQuantityRaw: i.statedQuantityRaw || null,
            isUnresolved: i.isUnresolved,
            unresolvedReason: i.unresolvedReason || null,
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
        action: data.isDraft ? "RECIPE_DRAFT_CREATED" : "RECIPE_PUBLISHED",
        entityType: "Recipe",
        entityId: newRecipe.id,
        newValues: JSON.stringify({ name: newRecipe.name, type: newRecipe.type, isDraft: data.isDraft, totalCost: breakdown.totalCost }),
      },
    });

    return NextResponse.json({ success: true, recipe: newRecipe, breakdown }, { status: 201 });
  } catch (error: any) {
    console.error("Create Recipe Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
