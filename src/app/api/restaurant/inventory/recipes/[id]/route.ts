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

const updateRecipeSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(["DISH", "SUB_RECIPE"]).optional(),
  description: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  yieldQuantity: z.number().positive().optional(),
  yieldUnit: z.nativeEnum(UnitOfMeasure).optional(),
  servingSize: z.string().optional().nullable(),
  prepTimeMin: z.number().int().min(0).optional().nullable(),
  sellingPrice: z.number().min(0).optional(),
  targetFoodCostPercent: z.number().min(1).max(100).optional().nullable(),
  isDraft: z.boolean().optional(),
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
            inventoryItem: {
              include: {
                purchasePacks: {
                  where: { isActive: true },
                },
              },
            },
            pack: true,
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
      include: { items: true },
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

    // If attempting to publish (or recipe is not draft and stays published), block if any unresolved line exists
    const willBePublished = data.isDraft !== undefined ? !data.isDraft : !existing.isDraft;
    if (willBePublished && data.items) {
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

    // Update recipe header & items in transaction
    const targetPublishedId = existing.isDraft && existing.publishedRecipeId && data.isDraft === false
      ? existing.publishedRecipeId
      : null;

    await prisma.$transaction(async (tx) => {
      // If promoting draft of an existing published recipe, update master published recipe
      const recipeToUpdateId = targetPublishedId || id;

      await tx.recipe.update({
        where: { id: recipeToUpdateId },
        data: {
          ...(data.name && !targetPublishedId && { name: data.name }),
          ...(data.type && { type: data.type }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.instructions !== undefined && { instructions: data.instructions }),
          ...(data.yieldQuantity !== undefined && { yieldQuantity: data.yieldQuantity }),
          ...(data.yieldUnit && { yieldUnit: data.yieldUnit }),
          ...(data.servingSize !== undefined && { servingSize: data.servingSize }),
          ...(data.prepTimeMin !== undefined && { prepTimeMin: data.prepTimeMin }),
          ...(data.sellingPrice !== undefined && { sellingPrice: data.sellingPrice }),
          ...(data.targetFoodCostPercent !== undefined && { targetFoodCostPercent: data.targetFoodCostPercent }),
          ...(data.isDraft !== undefined && !targetPublishedId && { isDraft: data.isDraft }),
        },
      });

      if (data.items) {
        // Replace items on active recipe
        await tx.recipeItem.deleteMany({ where: { recipeId: recipeToUpdateId } });
        await tx.recipeItem.createMany({
          data: data.items.map((i) => ({
            recipeId: recipeToUpdateId,
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
        });
      }

      // If promoted, archive the draft copy
      if (targetPublishedId) {
        await tx.recipe.update({
          where: { id },
          data: {
            archivedAt: new Date(),
          },
        });
      }
    });

    const activeId = targetPublishedId || id;
    const breakdown = await syncRecipeCosting(activeId);

    return NextResponse.json({
      success: true,
      message: targetPublishedId ? "Draft recipe promoted and published to live menu" : "Recipe updated successfully",
      promotedToPublishedId: targetPublishedId,
      breakdown,
    });
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
          include: {
            recipe: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    if (existing.usedInRecipeItems && existing.usedInRecipeItems.length > 0) {
      const activeParents = existing.usedInRecipeItems
        .filter((u) => u.recipe.archivedAt === null)
        .map((u) => u.recipe.name);

      if (activeParents.length > 0) {
        return NextResponse.json(
          {
            error: `Cannot archive recipe because it is currently used as a sub-recipe in: ${activeParents.join(", ")}. Please remove it from parent formulas first.`,
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
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
