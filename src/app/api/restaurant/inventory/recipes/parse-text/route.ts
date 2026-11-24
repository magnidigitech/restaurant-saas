import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { prisma } from "@/core/database/client";
import { parsePastedRecipeText } from "@/core/inventory/recipeParser";
import {
  matchIngredientToCatalogue,
  InventoryItemLookup,
  SubRecipeLookup,
} from "@/core/inventory/recipeMatcher";

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
    const rawText = String(body.rawText || "").trim();

    if (!rawText) {
      return NextResponse.json({ error: "No recipe text provided" }, { status: 400 });
    }

    // 1. Run deterministic kitchen parser
    const parsedDoc = parsePastedRecipeText(rawText);

    // 2. Fetch tenant inventory items and sub-recipes for catalogue matching
    const [rawItems, rawSubRecipes] = await Promise.all([
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
    ]);

    const filteredSubRecipes = (rawSubRecipes as any[]).filter((s) => !s.isDraft);

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

    const subRecipes: SubRecipeLookup[] = filteredSubRecipes.map((s) => ({
      id: s.id,
      name: s.name,
      yieldQuantity: Number(s.yieldQuantity || 1),
      yieldUnit: s.yieldUnit,
      costPerUnit: Number(s.costPerUnit || 0),
    }));

    // 3. Match each ingredient line against catalogue and packs
    const enrichedIngredients = parsedDoc.ingredients.map((ing) => {
      const match = matchIngredientToCatalogue(ing, inventoryItems, subRecipes);
      return {
        ...ing,
        matchedComponent: match,
      };
    });

    const unresolvedCount = enrichedIngredients.filter(
      (i) => i.isUnresolved || !i.matchedComponent || !i.matchedComponent.isUnitCompatible
    ).length;

    return NextResponse.json({
      success: true,
      document: {
        ...parsedDoc,
        ingredients: enrichedIngredients,
        unresolvedCount,
      },
    });
  } catch (error: any) {
    console.error("Parse Recipe Text Error:", error);
    return NextResponse.json({ error: error.message || "Failed to parse recipe text" }, { status: 500 });
  }
}
