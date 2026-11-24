import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { prisma } from "@/core/database/client";
import { parseRecipeExcelFile, GroupedRecipeImport } from "@/core/inventory/recipeExcelImporter";
import { InventoryItemLookup, SubRecipeLookup } from "@/core/inventory/recipeMatcher";
import { syncRecipeCosting } from "@/core/inventory/recipeCosting";

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

    const contentType = req.headers.get("content-type") || "";

    // 1. COMMIT WORKFLOW (JSON payload with confirmed recipes to save as drafts)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const recipesToCommit: GroupedRecipeImport[] = body.recipes || [];
      const duplicateAction = body.duplicateAction || "CREATE_AS_DRAFT"; // "CREATE_AS_DRAFT" | "UPDATE" | "SKIP"

      if (recipesToCommit.length === 0) {
        return NextResponse.json({ error: "No recipes provided to commit" }, { status: 400 });
      }

      const createdRecipes: any[] = [];
      const skippedRecipes: string[] = [];
      const updatedRecipes: any[] = [];

      for (const grp of recipesToCommit) {
        let recipeName = grp.recipeName.trim();

        const existing = await prisma.recipe.findFirst({
          where: {
            restaurantId: session.activeRestaurantId,
            name: { equals: recipeName, mode: "insensitive" },
            archivedAt: null,
          },
        });

        if (existing) {
          if (duplicateAction === "SKIP") {
            skippedRecipes.push(recipeName);
            continue;
          } else if (duplicateAction === "CREATE_AS_DRAFT") {
            recipeName = `${recipeName} (Draft ${new Date().toISOString().slice(11, 19).replace(/:/g, "")})`;
          } else if (duplicateAction === "UPDATE") {
            // Update existing recipe items in transaction
            await prisma.$transaction(async (tx) => {
              await tx.recipe.update({
                where: { id: existing.id },
                data: {
                  type: grp.recipeType,
                  yieldQuantity: grp.batchYield,
                  yieldUnit: grp.yieldUnit,
                  isDraft: true,
                },
              });
              await tx.recipeItem.deleteMany({ where: { recipeId: existing.id } });
              await tx.recipeItem.createMany({
                data: grp.rows.map((r) => ({
                  recipeId: existing.id,
                  componentType: r.matchedComponent?.componentType || "INVENTORY_ITEM",
                  inventoryItemId:
                    r.matchedComponent?.componentType === "INVENTORY_ITEM"
                      ? r.matchedComponent.id
                      : null,
                  subRecipeId:
                    r.matchedComponent?.componentType === "SUB_RECIPE"
                      ? r.matchedComponent.id
                      : null,
                  packId: r.matchedComponent?.selectedPackId || null,
                  quantity: r.quantity,
                  packQuantity: r.matchedComponent?.packQuantity || null,
                  unitOfMeasure: r.unit,
                  wastagePercent: r.prepLossPercent,
                  notes: r.notes || null,
                  originalText: `${r.quantity} ${r.unit} ${r.ingredientNameOrSku}`,
                  isUnresolved: !r.matchedComponent || !r.matchedComponent.isUnitCompatible,
                  unresolvedReason: !r.matchedComponent
                    ? `Unmatched ingredient "${r.ingredientNameOrSku}"`
                    : !r.matchedComponent.isUnitCompatible
                    ? r.matchedComponent.unitCompatibilityError
                    : null,
                })),
              });
            });

            await syncRecipeCosting(existing.id);
            updatedRecipes.push({ id: existing.id, name: recipeName });
            continue;
          }
        }

        // Create as new draft recipe
        const newRecipe = await prisma.recipe.create({
          data: {
            restaurantId: session.activeRestaurantId,
            name: recipeName,
            type: grp.recipeType,
            yieldQuantity: grp.batchYield,
            yieldUnit: grp.yieldUnit,
            isDraft: true,
            sourceType: "EXCEL",
            items: {
              create: grp.rows.map((r) => ({
                componentType: r.matchedComponent?.componentType || "INVENTORY_ITEM",
                inventoryItemId:
                  r.matchedComponent?.componentType === "INVENTORY_ITEM"
                    ? r.matchedComponent.id
                    : null,
                subRecipeId:
                  r.matchedComponent?.componentType === "SUB_RECIPE"
                    ? r.matchedComponent.id
                    : null,
                packId: r.matchedComponent?.selectedPackId || null,
                quantity: r.quantity,
                packQuantity: r.matchedComponent?.packQuantity || null,
                unitOfMeasure: r.unit,
                wastagePercent: r.prepLossPercent,
                notes: r.notes || null,
                originalText: `${r.quantity} ${r.unit} ${r.ingredientNameOrSku}`,
                isUnresolved: !r.matchedComponent || !r.matchedComponent.isUnitCompatible,
                unresolvedReason: !r.matchedComponent
                  ? `Unmatched ingredient "${r.ingredientNameOrSku}"`
                  : !r.matchedComponent.isUnitCompatible
                  ? r.matchedComponent.unitCompatibilityError
                  : null,
              })),
            },
          },
        });

        await syncRecipeCosting(newRecipe.id);
        createdRecipes.push({ id: newRecipe.id, name: newRecipe.name });
      }

      return NextResponse.json({
        success: true,
        message: `Import complete: ${createdRecipes.length} created as drafts, ${updatedRecipes.length} updated, ${skippedRecipes.length} skipped`,
        createdRecipes,
        updatedRecipes,
        skippedRecipes,
      });
    }

    // 2. PARSE & PREVIEW WORKFLOW (Multipart Form with uploaded file)
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const requestedSheet = (formData.get("sheetName") as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Query tenant catalogue
    const [rawItems, rawSubRecipes, existingRecipes] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { restaurantId: session.activeRestaurantId, archivedAt: null },
        include: {
          purchasePacks: {
            where: { isActive: true },
          },
        },
      }),
      prisma.recipe.findMany({
        where: {
          restaurantId: session.activeRestaurantId,
          type: "SUB_RECIPE",
          archivedAt: null,
        },
        select: {
          id: true,
          name: true,
          yieldQuantity: true,
          yieldUnit: true,
          costPerUnit: true,
        },
      }),
      prisma.recipe.findMany({
        where: { restaurantId: session.activeRestaurantId, archivedAt: null },
        select: { name: true },
      }),
    ]);

    const inventoryItems: InventoryItemLookup[] = rawItems.map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      unitOfMeasure: i.unitOfMeasure,
      costPerUnit: Number(i.costPerUnit || 0),
      purchasePacks: i.purchasePacks.map((p) => ({
        id: p.id,
        name: p.name,
        packType: p.packType,
        packUnit: p.packUnit,
        conversionFactor: Number(p.conversionFactor || 1),
        netQuantityPerPack: Number(p.netQuantityPerPack || 1),
      })),
    }));

    const subRecipes: SubRecipeLookup[] = (rawSubRecipes as any[])
      .filter((s) => !s.isDraft)
      .map((s) => ({
      id: s.id,
      name: s.name,
      yieldQuantity: Number(s.yieldQuantity || 1),
      yieldUnit: s.yieldUnit,
      costPerUnit: Number(s.costPerUnit || 0),
    }));

    const existingRecipeNames = new Set(existingRecipes.map((r) => r.name.toLowerCase()));

    const parseResult = parseRecipeExcelFile(buffer, {
      sheetName: requestedSheet,
      inventoryItems,
      subRecipes,
      existingRecipeNames,
    });

    return NextResponse.json({
      success: true,
      parseResult,
    });
  } catch (error: any) {
    console.error("Excel Import Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process Excel import" }, { status: 500 });
  }
}
