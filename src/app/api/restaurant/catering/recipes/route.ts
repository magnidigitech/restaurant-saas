import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import {
  getStoredRecipes,
  saveStoredRecipe,
  deleteStoredRecipe,
} from "@/modules/catering/eventStore";
import { MenuItemOption } from "@/modules/catering/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subdomain = searchParams.get("subdomain") || "bahubali";
    const category = searchParams.get("category");

    // 1. Stored recipes (persistent across restarts / edits)
    const stored = getStoredRecipes();

    // 2. Database kitchen recipes if any
    let dbRecipes: MenuItemOption[] = [];
    try {
      const restaurant = await prisma.restaurant.findFirst({
        where: { subdomain },
        select: { id: true },
      });

      if (restaurant) {
        const recipes = await prisma.recipe.findMany({
          where: { restaurantId: restaurant.id, archivedAt: null },
          select: {
            id: true,
            name: true,
            description: true,
            costPerUnit: true,
            yieldUnit: true,
            yieldQuantity: true,
          },
        });

        dbRecipes = recipes.map((r) => ({
          id: `rec-${r.id}`,
          name: r.name,
          category: "Curry",
          dietary:
            r.name.toLowerCase().includes("chicken") ||
            r.name.toLowerCase().includes("mutton") ||
            r.name.toLowerCase().includes("fish") ||
            r.name.toLowerCase().includes("prawn")
              ? "NON_VEG"
              : "VEG",
          description: r.description || "Freshly formulated kitchen recipe",
          internalRecipeId: r.id,
          basePortionPerPax: Number(r.yieldQuantity || 0.15),
          portionUnit: String(r.yieldUnit || "kg").toLowerCase(),
          approxCostPerPax: Number(r.costPerUnit || 45),
          spiceLevel: "MEDIUM",
          tags: ["kitchen-recipe"],
        }));
      }
    } catch (e) {
      console.warn("Could not query db recipes for catering:", e);
    }

    // Merge without duplicates by name
    const nameSet = new Set<string>();
    const allRecipes: MenuItemOption[] = [];

    [...stored, ...dbRecipes].forEach((item) => {
      const key = item.name.toLowerCase().trim();
      if (!nameSet.has(key)) {
        nameSet.add(key);
        if (!category || item.category.toLowerCase().includes(category.toLowerCase())) {
          allRecipes.push(item);
        }
      }
    });

    return NextResponse.json({ recipes: allRecipes });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, recipe, recipes } = body;

    if (action === "CREATE_RECIPE" && recipe) {
      saveStoredRecipe(recipe);
      return NextResponse.json({ success: true, recipe });
    }

    if (action === "BULK_IMPORT" && Array.isArray(recipes)) {
      recipes.forEach((r) => saveStoredRecipe(r));
      return NextResponse.json({ success: true, count: recipes.length });
    }

    if (action === "DELETE_RECIPE" && body.id) {
      deleteStoredRecipe(body.id);
      return NextResponse.json({ success: true, id: body.id });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to process recipe request" },
      { status: 500 }
    );
  }
}
