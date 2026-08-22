import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { calculateRecipeCost, syncRecipeCosting } from "@/core/inventory/recipeCosting";
import { z } from "zod";

import { UnitOfMeasure } from "@prisma/client";

const updateRecipeItemSchema = z.object({
  id: z.string().optional(),
  componentType: z.enum(["INVENTORY_ITEM", "SUB_RECIPE"]),
  inventoryItemId: z.string().optional().nullable(),
  subRecipeId: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unitOfMeasure: z.nativeEnum(UnitOfMeasure),
  wastagePercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

const updateRecipeSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(["DISH", "SUB_RECIPE"]).optional(),
  description: z.string().optional(),
  yieldQuantity: z.number().positive().optional(),
  yieldUnit: z.nativeEnum(UnitOfMeasure).optional(),
  servingSize: z.string().optional(),
  prepTimeMin: z.number().int().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  items: z.array(updateRecipeItemSchema).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const recipe = await prisma.recipe.findFirst({
      where: { id, restaurantId: session.activeRestaurantId, archivedAt: null },
      include: {
        items: {
          include: {
            inventoryItem: true,
            subRecipe: true,
          },
        },
        usedInRecipeItems: {
          include: {
            recipe: true,
          },
        },
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const breakdown = await calculateRecipeCost(id);

    return NextResponse.json({ success: true, recipe, breakdown });
  } catch (error: any) {
    console.error("Get Recipe Detail Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();
    const result = updateRecipeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid recipe payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    const existing = await prisma.recipe.findFirst({
      where: { id, restaurantId: session.activeRestaurantId, archivedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    // Check duplicate name if renamed
    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.recipe.findFirst({
        where: {
          restaurantId: session.activeRestaurantId,
          name: { equals: data.name, mode: "insensitive" },
          archivedAt: null,
          NOT: { id },
        },
      });
      if (duplicate) {
        return NextResponse.json({ error: `A recipe named "${data.name}" already exists.` }, { status: 400 });
      }
    }

    // Update recipe header & items in transaction
    await prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.type && { type: data.type }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.yieldQuantity !== undefined && { yieldQuantity: data.yieldQuantity }),
          ...(data.yieldUnit && { yieldUnit: data.yieldUnit }),
          ...(data.servingSize !== undefined && { servingSize: data.servingSize }),
          ...(data.prepTimeMin !== undefined && { prepTimeMin: data.prepTimeMin }),
          ...(data.sellingPrice !== undefined && { sellingPrice: data.sellingPrice }),
        },
      });

      if (data.items) {
        // Replace items
        await tx.recipeItem.deleteMany({ where: { recipeId: id } });
        await tx.recipeItem.createMany({
          data: data.items.map((i) => ({
            recipeId: id,
            componentType: i.componentType,
            inventoryItemId: i.componentType === "INVENTORY_ITEM" ? i.inventoryItemId : null,
            subRecipeId: i.componentType === "SUB_RECIPE" ? i.subRecipeId : null,
            quantity: i.quantity,
            unitOfMeasure: i.unitOfMeasure,
            wastagePercent: i.wastagePercent,
            notes: i.notes,
          })),
        });
      }
    });

    const breakdown = await syncRecipeCosting(id);

    return NextResponse.json({ success: true, message: "Recipe updated successfully", breakdown });
  } catch (error: any) {
    console.error("Update Recipe Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const existing = await prisma.recipe.findFirst({
      where: { id, restaurantId: session.activeRestaurantId, archivedAt: null },
      include: {
        usedInRecipeItems: {
          include: { recipe: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    if (existing.usedInRecipeItems && existing.usedInRecipeItems.length > 0) {
      const activeParents = existing.usedInRecipeItems
        .filter((u) => !u.recipe.archivedAt)
        .map((u) => u.recipe.name);

      if (activeParents.length > 0) {
        return NextResponse.json(
          {
            error: `Cannot archive sub-recipe "${existing.name}" because it is currently used in ${activeParents.length} recipe(s): ${activeParents.join(", ")}. Please remove it from parent recipes first.`,
          },
          { status: 400 }
        );
      }
    }

    await prisma.recipe.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Recipe archived successfully" });
  } catch (error: any) {
    console.error("Delete Recipe Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
