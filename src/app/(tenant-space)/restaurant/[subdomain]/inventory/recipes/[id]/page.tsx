"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import {
  UnitEquivalentPricing,
  UnitOfMeasure,
  formatUnit,
  getUnitPricingMatrix,
  UNIT_DEFINITIONS,
} from "@/core/inventory/units";
import {
  ChefHat,
  Utensils,
  DollarSign,
  TrendingUp,
  Layers,
  Scale,
  Clock,
  Edit3,
  Share2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  ShoppingBag,
  FlaskConical,
  Flame,
  Plus,
  ArrowRight,
  Info,
} from "lucide-react";

interface ComponentCost {
  componentType: "INVENTORY_ITEM" | "SUB_RECIPE";
  id: string;
  name: string;
  sku?: string | null;
  quantity: number;
  unitOfMeasure: string;
  wastagePercent: number;
  grossQuantity?: number;
  baseUnit: string;
  baseUnitCost: number;
  effectiveUnitCost: number;
  netCost: number;
  wastageCost: number;
  totalCost: number;
  packName?: string | null;
  packQuantity?: number | null;
  originalText?: string | null;
  statedQuantityRaw?: string | null;
  isUnresolved?: boolean;
  unresolvedReason?: string | null;
  hasMissingCost?: boolean;
  unitPricingMatrix?: UnitEquivalentPricing[];
  subComponents?: ComponentCost[];
}

interface RecipeDetail {
  id: string;
  name: string;
  type: "DISH" | "SUB_RECIPE";
  description?: string;
  instructions?: string;
  yieldQuantity: number;
  yieldUnit: string;
  servingSize?: string;
  prepTimeMin?: number;
  sellingPrice: number | null;
  costPerUnit: number | null;
  totalCost: number | null;
  grossMarginPercent: number | null;
  foodCostPercent: number | null;
  targetFoodCostPercent?: number | null;
  isDraft: boolean;
  sourceType?: string;
  createdAt: string;
  usedInRecipeItems?: { id: string; recipe: { id: string; name: string; type: string } }[];
}

interface RecipeCostBreakdownData {
  recipeId: string;
  name: string;
  type: "DISH" | "SUB_RECIPE";
  isDraft: boolean;
  yieldQuantity: number;
  yieldUnit: UnitOfMeasure;
  sellingPrice: number;
  totalCost: number;
  costPerUnit: number;
  grossMarginPercent: number;
  foodCostPercent: number;
  hasMissingCosts: boolean;
  unitPricingMatrix: UnitEquivalentPricing[];
  items: ComponentCost[];
  costSource: "FORMULA_CALCULATED" | "STORED_SNAPSHOT" | "UNAVAILABLE";
  storedTotalCost?: number;
  storedCostPerUnit?: number;
}

/**
 * Natural language unit formatting helper.
 * Strictly uses stored recipe units — never invents or silently relabels units.
 */
function getUnitDisplayInfo(unitRaw: string, type: "DISH" | "SUB_RECIPE", qty = 1) {
  const u = (unitRaw || "").toUpperCase();
  const isDish = type === "DISH";

  let singular = "unit";
  let plural = "units";
  let short = formatUnit(u as any) || u.toLowerCase();
  let costNoun = "unit";
  let profitNoun = "unit";

  if (u === "PORTION") {
    singular = "serving";
    plural = "servings";
    short = "serving";
    costNoun = "serving";
    profitNoun = "serving";
  } else if (u === "PIECES" || u === "EACH") {
    singular = "piece";
    plural = "pieces";
    short = "pcs";
    costNoun = "piece";
    profitNoun = "piece";
  } else if (u === "DOZEN") {
    singular = "dozen";
    plural = "dozens";
    short = "doz";
    costNoun = "dozen";
    profitNoun = "dozen";
  } else if (u === "L") {
    singular = "litre";
    plural = "litres";
    short = "L";
    costNoun = "litre";
    profitNoun = "litre";
  } else if (u === "ML") {
    singular = "millilitre";
    plural = "millilitres";
    short = "mL";
    costNoun = "millilitre";
    profitNoun = "millilitre";
  } else if (u === "KG") {
    singular = "kilogram";
    plural = "kilograms";
    short = "kg";
    costNoun = "kilogram";
    profitNoun = "kilogram";
  } else if (u === "G") {
    singular = "gram";
    plural = "grams";
    short = "g";
    costNoun = "gram";
    profitNoun = "gram";
  } else if (u === "LB") {
    singular = "pound";
    plural = "pounds";
    short = "lb";
    costNoun = "pound";
    profitNoun = "pound";
  } else if (u === "OZ") {
    singular = "ounce";
    plural = "ounces";
    short = "oz";
    costNoun = "ounce";
    profitNoun = "ounce";
  } else if (u === "GAL" || u === "IMP_GAL") {
    singular = "gallon";
    plural = "gallons";
    short = u === "IMP_GAL" ? "Imp gal" : "US gal";
    costNoun = "gallon";
    profitNoun = "gallon";
  } else if (u === "CUP") {
    singular = "cup";
    plural = "cups";
    short = "cup";
    costNoun = "cup";
    profitNoun = "cup";
  } else if (u === "LADLE") {
    singular = "ladle";
    plural = "ladles";
    short = "ladle";
    costNoun = "ladle";
    profitNoun = "ladle";
  }

  const nounForCount = qty === 1 ? singular : plural;
  const batchLabel = `${qty} ${nounForCount} per batch`;
  const costLabel = isDish ? `Food cost per ${costNoun}` : `Cost per ${costNoun}`;
  const profitLabel = `Gross profit per ${profitNoun}`;

  return {
    singular,
    plural,
    short,
    nounForCount,
    batchLabel,
    costLabel,
    profitLabel,
  };
}

export default function RecipeDetailPage({
  params,
}: {
  params: Promise<{ subdomain: string; id: string }>;
}) {
  const router = useRouter();
  const { subdomain, id: recipeId } = use(params);
  const { isDark } = useTheme();

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [breakdown, setBreakdown] = useState<RecipeCostBreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const fetchRecipeDetail = async () => {
    try {
      const res = await fetch(`/api/restaurant/inventory/recipes/${recipeId}`);
      const data = await res.json();
      if (res.ok && data.recipe) {
        setRecipe(data.recipe);
        setBreakdown(data.breakdown || null);
      } else {
        setError(data.error || "Recipe not found");
      }
    } catch {
      setError("Failed to load recipe detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (recipeId) fetchRecipeDetail();
  }, [recipeId]);

  const toggleRowExpanded = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleArchive = async () => {
    setArchiving(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/inventory/recipes/${recipeId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/restaurant/${subdomain}/inventory/recipes`);
      } else {
        setError(data.error || "Failed to archive recipe");
        setShowArchiveModal(false);
        setArchiving(false);
      }
    } catch {
      setError("Failed to archive recipe");
      setArchiving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setShowOverflowMenu(false);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/inventory/recipes/${recipeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDraft: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to publish");
      await fetchRecipeDetail();
    } catch (e: any) {
      setError(e.message || "Publishing failed");
    } finally {
      setPublishing(false);
    }
  };

  // -------------------------------------------------------------------------
  // Unified Costing Derivations (Source of Truth)
  // -------------------------------------------------------------------------
  const isDish = recipe?.type === "DISH";
  const isSubRecipe = recipe?.type === "SUB_RECIPE";
  const yieldQty = Number(recipe?.yieldQuantity || 1);
  const yieldUnitRaw = recipe?.yieldUnit || "PORTION";

  const unitInfo = useMemo(() => {
    return getUnitDisplayInfo(yieldUnitRaw, recipe?.type || "DISH", yieldQty);
  }, [yieldUnitRaw, recipe?.type, yieldQty]);

  const ingredientsList = useMemo(() => {
    return breakdown?.items || [];
  }, [breakdown]);

  // Determine Verified Cost & Source
  const costState = useMemo(() => {
    if (!recipe) {
      return {
        unitCost: null as number | null,
        batchCost: null as number | null,
        source: "UNAVAILABLE" as const,
        isVerifiedZero: false,
      };
    }

    // 1. Live Formula Calculation
    if (breakdown && breakdown.items && breakdown.items.length > 0) {
      return {
        unitCost: Number(breakdown.costPerUnit || 0),
        batchCost: Number(breakdown.totalCost || 0),
        source: "FORMULA_CALCULATED" as const,
        isVerifiedZero: breakdown.costPerUnit === 0 && !breakdown.hasMissingCosts,
      };
    }

    // 2. Stored Baseline Snapshot (e.g. from template/Excel import without items yet)
    const storedUnit = recipe.costPerUnit !== null ? Number(recipe.costPerUnit) : null;
    const storedTotal = recipe.totalCost !== null ? Number(recipe.totalCost) : null;

    if ((storedUnit !== null && storedUnit > 0) || (storedTotal !== null && storedTotal > 0)) {
      const resolvedUnit = storedUnit !== null && storedUnit > 0
        ? storedUnit
        : (storedTotal !== null && yieldQty > 0 ? storedTotal / yieldQty : 0);
      const resolvedBatch = storedTotal !== null && storedTotal > 0
        ? storedTotal
        : (storedUnit !== null ? storedUnit * yieldQty : 0);

      return {
        unitCost: resolvedUnit,
        batchCost: resolvedBatch,
        source: "STORED_SNAPSHOT" as const,
        isVerifiedZero: false,
      };
    }

    // 3. Unavailable / Not Configured
    return {
      unitCost: null,
      batchCost: null,
      source: "UNAVAILABLE" as const,
      isVerifiedZero: false,
    };
  }, [recipe, breakdown, yieldQty]);

  // Derived Financials for Dishes (Same Basis: Selling Unit)
  const financialMetrics = useMemo(() => {
    const rawSellingPrice = recipe?.sellingPrice;
    const sellingPrice = rawSellingPrice !== null && rawSellingPrice !== undefined && Number(rawSellingPrice) > 0
      ? Number(rawSellingPrice)
      : null;

    const unitCost = costState.unitCost;

    if (sellingPrice === null || unitCost === null || unitCost <= 0) {
      return {
        sellingPrice,
        foodCostPercent: null as number | null,
        grossMarginPercent: null as number | null,
        grossProfit: null as number | null,
        isProfitable: false,
      };
    }

    const foodCostPercent = (unitCost / sellingPrice) * 100;
    const grossMarginPercent = ((sellingPrice - unitCost) / sellingPrice) * 100;
    const grossProfit = sellingPrice - unitCost;

    return {
      sellingPrice,
      foodCostPercent,
      grossMarginPercent,
      grossProfit,
      isProfitable: grossProfit > 0,
    };
  }, [recipe?.sellingPrice, costState.unitCost]);

  // Filtered Cost by Unit (Only Dimensional Equivalents)
  const costByUnitList = useMemo(() => {
    if (!recipe || costState.unitCost === null || costState.unitCost <= 0) {
      return [];
    }

    const baseUnit = (recipe.yieldUnit as UnitOfMeasure) || "PORTION";
    const baseCategory = UNIT_DEFINITIONS[baseUnit]?.category;
    const fullMatrix = getUnitPricingMatrix(costState.unitCost, baseUnit);

    return fullMatrix.filter((item) => {
      const itemCategory = UNIT_DEFINITIONS[item.unit]?.category;
      if (itemCategory !== baseCategory) return false;

      // Only show serving/portion if base unit is count or portion
      if (item.unit === "PORTION" && baseCategory !== "COUNT") {
        return false;
      }
      return true;
    });
  }, [recipe, costState.unitCost]);

  // Stated plain language formula count
  const ingredientsSummaryText = useMemo(() => {
    const count = ingredientsList.length;
    const ingWord = count === 1 ? "ingredient" : "ingredients";
    return `${unitInfo.batchLabel} · ${count} ${ingWord}`;
  }, [unitInfo.batchLabel, ingredientsList.length]);

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
          }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Loading recipe details...</p>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div
        className={`min-h-screen flex flex-col font-sans antialiased ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
          }`}
      >
        <RestaurantNavbar activeSection="Recipes" />
        <main className="max-w-4xl mx-auto p-6 space-y-4">
          <Link
            href={`/restaurant/${subdomain}/inventory/recipes`}
            className="text-xs text-[#0071E3] hover:underline font-semibold"
          >
            ← Back to recipes
          </Link>
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-2xl">
            {error || "Recipe not found"}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
    >
      <RestaurantNavbar activeSection="Recipes" />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5">
        {/* Compact Breadcrumb & Header Bar */}
        <header
          className={`p-5 sm:p-6 rounded-2xl border transition ${isDark
            ? "bg-[#121622] border-white/[0.08]"
            : "bg-white border-slate-200 shadow-2xs"
            }`}
        >
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              {/* Breadcrumb + Classification Pills */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <Link
                  href={`/restaurant/${subdomain}/inventory/recipes`}
                  className="text-slate-500 dark:text-slate-400 hover:text-[#0071E3] font-medium transition"
                >
                  Recipes
                </Link>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="text-slate-600 dark:text-slate-300 truncate max-w-[180px] sm:max-w-xs">
                  {recipe.name}
                </span>

                <span
                  className={`ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${isDish
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                    }`}
                >
                  {isDish ? "Menu dish" : "Prep recipe"}
                </span>

                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${recipe.isDraft
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                    : "bg-blue-500/10 text-[#0071E3] dark:text-[#70B4FF] border-blue-500/20"
                    }`}
                >
                  {recipe.isDraft ? "Draft" : "Published"}
                </span>
              </div>

              {/* Recipe Title */}
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white break-words">
                {recipe.name}
              </h1>

              {/* Plain Language Stated Yield & Ingredient Count */}
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {ingredientsSummaryText}
                </span>

                {recipe.servingSize && (
                  <>
                    <span>·</span>
                    <span>Serving: {recipe.servingSize}</span>
                  </>
                )}

                {recipe.prepTimeMin && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {recipe.prepTimeMin} min prep
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 w-full lg:w-auto shrink-0 flex-wrap sm:flex-nowrap">
              {/* Primary Action: Edit Recipe */}
              <button
                type="button"
                onClick={() =>
                  router.push(`/restaurant/${subdomain}/inventory/recipes?edit=${recipe.id}`)
                }
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-2xs transition active:scale-[0.98] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit recipe</span>
              </button>

              {/* Secondary Action: Order in POS (Published Dishes Only) */}
              {isDish && !recipe.isDraft && (
                <button
                  type="button"
                  onClick={() => router.push(`/restaurant/${subdomain}/pos`)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-white/[0.12] bg-white dark:bg-[#121622] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition active:scale-[0.98] cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-[#0071E3]" />
                  <span>Order in POS</span>
                </button>
              )}

              {/* Overflow Menu Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-500 transition cursor-pointer"
                  title="More actions"
                  aria-label="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showOverflowMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowOverflowMenu(false)}
                    />
                    <div
                      className={`absolute right-0 top-full mt-1.5 w-48 rounded-2xl border shadow-xl p-1 z-30 ${isDark ? "bg-[#181D2D] border-white/[0.1]" : "bg-white border-slate-200"
                        }`}
                    >
                      {recipe.isDraft && (
                        <button
                          type="button"
                          disabled={publishing}
                          onClick={handlePublish}
                          className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2 cursor-pointer transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{publishing ? "Publishing..." : "Publish recipe"}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setShowOverflowMenu(false);
                          setShowArchiveModal(true);
                        }}
                        className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium flex items-center gap-2 cursor-pointer transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Archive recipe</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 2-Column Responsive Layout: Wider Left (Formula) + Narrower Right (Costing) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: Ingredients, Preparation, Used In */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-5">
            {/* Ingredients Section */}
            <section
              className={`p-5 sm:p-6 rounded-2xl border transition ${isDark
                ? "bg-[#121622] border-white/[0.08]"
                : "bg-white border-slate-200 shadow-2xs"
                }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06] mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Ingredients
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Formula items, trim shrinkage, and raw stock quantities.
                  </p>
                </div>

                {ingredientsList.length > 0 && (
                  <span className="text-xs text-slate-400 tabular-nums">
                    {ingredientsList.length} total
                  </span>
                )}
              </div>

              {ingredientsList.length === 0 ? (
                /* Empty Ingredients State */
                <div className="py-8 sm:py-10 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/[0.05] text-slate-400 flex items-center justify-center mx-auto">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      No ingredients added yet
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      This recipe does not have any inventory items or prep recipes linked.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/restaurant/${subdomain}/inventory/recipes?edit=${recipe.id}`)
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-2xs transition active:scale-[0.98] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add ingredients</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <th className="pb-2.5 px-2">Ingredient</th>
                          <th className="pb-2.5 px-2">Recipe quantity</th>
                          <th className="pb-2.5 px-2">Prep loss</th>
                          <th className="pb-2.5 px-2">Stock quantity</th>
                          <th className="pb-2.5 px-2 text-right">Line cost</th>
                          <th className="pb-2.5 px-2 w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                        {ingredientsList.map((item, idx) => {
                          const isExpanded = !!expandedRows[item.id || String(idx)];
                          const rowKey = item.id || String(idx);
                          return (
                            <React.Fragment key={rowKey}>
                              <tr
                                onClick={() => toggleRowExpanded(rowKey)}
                                className="hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer transition"
                              >
                                <td className="py-3 px-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                      {item.name}
                                    </span>
                                    <span
                                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${item.componentType === "SUB_RECIPE"
                                        ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                                        : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.08]"
                                        }`}
                                    >
                                      {item.componentType === "SUB_RECIPE" ? "Prep recipe" : "Item"}
                                    </span>
                                  </div>
                                  {item.packName && (
                                    <div className="text-[11px] text-purple-600 dark:text-purple-400 font-mono mt-0.5">
                                      Pack: {item.packQuantity}× {item.packName}
                                    </div>
                                  )}
                                  {item.isUnresolved && (
                                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      <span>{item.unresolvedReason || "Unresolved item"}</span>
                                    </div>
                                  )}
                                </td>

                                <td className="py-3 px-2 font-mono tabular-nums text-slate-800 dark:text-slate-200">
                                  {item.quantity} {formatUnit(item.unitOfMeasure as any)}
                                </td>

                                <td className="py-3 px-2 font-mono tabular-nums">
                                  {item.wastagePercent > 0 ? (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                      +{item.wastagePercent}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>

                                <td className="py-3 px-2 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                                  {item.grossQuantity !== undefined
                                    ? `${item.grossQuantity.toFixed(2)} ${formatUnit(item.unitOfMeasure as any)}`
                                    : `${item.quantity} ${formatUnit(item.unitOfMeasure as any)}`}
                                </td>

                                <td className="py-3 px-2 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                                  ${item.totalCost.toFixed(2)}
                                </td>

                                <td className="py-3 px-2 text-right text-slate-400">
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                                  )}
                                </td>
                              </tr>

                              {/* Expandable Details Row */}
                              {isExpanded && (
                                <tr className="bg-slate-50/70 dark:bg-white/[0.02]">
                                  <td colSpan={6} className="p-3 text-[11px] space-y-1.5 border-b border-black/[0.06] dark:border-white/[0.06]">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600 dark:text-slate-400">
                                      <div>
                                        <span className="block text-[10px] uppercase font-bold text-slate-400">
                                          Base unit cost
                                        </span>
                                        <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                                          ${item.baseUnitCost.toFixed(2)} / {formatUnit(item.baseUnit as any)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="block text-[10px] uppercase font-bold text-slate-400">
                                          Effective cost / unit
                                        </span>
                                        <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                                          ${item.effectiveUnitCost.toFixed(item.effectiveUnitCost < 0.1 ? 4 : 2)} / {formatUnit(item.unitOfMeasure as any)}
                                        </span>
                                      </div>
                                      {item.sku && (
                                        <div>
                                          <span className="block text-[10px] uppercase font-bold text-slate-400">
                                            Inventory SKU
                                          </span>
                                          <span className="font-mono text-slate-800 dark:text-slate-200">
                                            {item.sku}
                                          </span>
                                        </div>
                                      )}
                                      {item.wastageCost > 0 && (
                                        <div>
                                          <span className="block text-[10px] uppercase font-bold text-slate-400">
                                            Shrinkage cost
                                          </span>
                                          <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
                                            +${item.wastageCost.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {(item.originalText || item.statedQuantityRaw) && (
                                      <div className="pt-1.5 text-slate-500">
                                        <span className="text-[10px] font-semibold text-slate-400 mr-1.5">
                                          Source line:
                                        </span>
                                        <span className="italic">
                                          {item.originalText || item.statedQuantityRaw}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Compact Ingredient Rows (Zero Horizontal Scrolling) */}
                  <div className="sm:hidden space-y-2">
                    {ingredientsList.map((item, idx) => {
                      const isExpanded = !!expandedRows[item.id || String(idx)];
                      const rowKey = item.id || String(idx);
                      return (
                        <div
                          key={rowKey}
                          className={`p-3 rounded-xl border transition ${isDark
                            ? "bg-white/[0.02] border-white/[0.06]"
                            : "bg-slate-50/70 border-slate-200"
                            }`}
                        >
                          <div
                            onClick={() => toggleRowExpanded(rowKey)}
                            className="flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                                  {item.name}
                                </span>
                                <span
                                  className={`text-[9px] font-semibold px-1 py-0.2 rounded border shrink-0 ${item.componentType === "SUB_RECIPE"
                                    ? "bg-purple-500/10 text-purple-700 border-purple-500/20"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                    }`}
                                >
                                  {item.componentType === "SUB_RECIPE" ? "Prep" : "Item"}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                                {item.quantity} {formatUnit(item.unitOfMeasure as any)}
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-2">
                              <span className="font-bold text-xs font-mono tabular-nums text-slate-900 dark:text-white">
                                ${item.totalCost.toFixed(2)}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </div>
                          </div>

                          {/* Expanded Mobile Details */}
                          {isExpanded && (
                            <div className="pt-2.5 mt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[11px] space-y-1.5">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Stock quantity:</span>
                                <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                                  {item.grossQuantity !== undefined
                                    ? `${item.grossQuantity.toFixed(2)} ${formatUnit(item.unitOfMeasure as any)}`
                                    : `${item.quantity} ${formatUnit(item.unitOfMeasure as any)}`}
                                </span>
                              </div>

                              {item.wastagePercent > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Prep loss:</span>
                                  <span className="font-mono tabular-nums text-amber-600">
                                    +{item.wastagePercent}% loss (+${item.wastageCost.toFixed(2)})
                                  </span>
                                </div>
                              )}

                              <div className="flex justify-between">
                                <span className="text-slate-400">Effective unit cost:</span>
                                <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                                  ${item.effectiveUnitCost.toFixed(2)} / {formatUnit(item.unitOfMeasure as any)}
                                </span>
                              </div>

                              {item.packName && (
                                <div className="text-purple-600 font-mono text-[10px]">
                                  Pack: {item.packQuantity}× {item.packName}
                                </div>
                              )}

                              {item.originalText && (
                                <div className="text-slate-400 text-[10px] italic pt-1">
                                  "{item.originalText}"
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            {/* Preparation Instructions Section */}
            {recipe.instructions && (
              <section
                className={`p-5 sm:p-6 rounded-2xl border transition ${isDark
                  ? "bg-[#121622] border-white/[0.08]"
                  : "bg-white border-slate-200 shadow-2xs"
                  }`}
              >
                <div className="flex items-center gap-2 pb-3 border-b border-black/[0.06] dark:border-white/[0.06] mb-3">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Preparation
                  </h2>
                </div>
                <div className="space-y-2">
                  {recipe.instructions
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean)
                    .map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs leading-relaxed ${isDark
                          ? "bg-white/[0.02] border-white/[0.05] text-slate-200"
                          : "bg-slate-50/70 border-slate-200 text-slate-800"
                          }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-[#0071E3]/10 text-[#0071E3] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="min-w-0 flex-1">{step}</span>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Used In Section (Placed below relevant content for Prep Recipes) */}
            {isSubRecipe && (
              <section
                className={`p-5 sm:p-6 rounded-2xl border transition ${isDark
                  ? "bg-[#121622] border-white/[0.08]"
                  : "bg-white border-slate-200 shadow-2xs"
                  }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06] mb-3">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-purple-500" />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Used in
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400">
                    {recipe.usedInRecipeItems?.length || 0} parent recipes
                  </span>
                </div>

                {recipe.usedInRecipeItems && recipe.usedInRecipeItems.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {recipe.usedInRecipeItems.map((u) => (
                      <Link
                        key={u.id}
                        href={`/restaurant/${subdomain}/inventory/recipes/${u.recipe.id}`}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition hover:border-[#0071E3] ${isDark
                          ? "bg-white/[0.02] border-white/[0.06]"
                          : "bg-slate-50 border-slate-200"
                          }`}
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate block">
                            {u.recipe.name}
                          </span>
                          <span className="text-[10px] text-purple-600 dark:text-purple-400">
                            {u.recipe.type === "DISH" ? "Menu dish" : "Sub-recipe"}
                          </span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This prep recipe is not currently used in any parent recipes. Link it inside a dish formula in the recipe workspace.
                  </p>
                )}
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: Costing, Pricing Summary & Cost by Unit */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            {/* Cost and Pricing Summary Card */}
            <section
              className={`p-5 sm:p-6 rounded-2xl border transition ${isDark
                ? "bg-[#121622] border-white/[0.08]"
                : "bg-white border-slate-200 shadow-2xs"
                }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06] mb-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cost and pricing summary
                </h2>
                {costState.source === "STORED_SNAPSHOT" && (
                  <span
                    className="text-[10px] font-medium text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full"
                    title="Cost figures reflect stored baseline data. Add ingredients to calculate live formula cost."
                  >
                    Stored baseline
                  </span>
                )}
                {costState.source === "FORMULA_CALCULATED" && (
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Formula-verified
                  </span>
                )}
              </div>

              {/* Informational callout if stored baseline */}
              {costState.source === "STORED_SNAPSHOT" && (
                <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Costs reflect stored baseline values. Add ingredients to calculate live formula costs.
                  </span>
                </div>
              )}

              {/* DYNAMIC METRICS FOR MENU DISH */}
              {isDish ? (
                <div className="space-y-4">
                  {/* Batch Food Cost */}
                  <div className="flex items-baseline justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Batch food cost
                    </span>
                    <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {costState.batchCost !== null ? `$${costState.batchCost.toFixed(2)}` : "—"}
                    </span>
                  </div>

                  {/* Food Cost per Selling Unit */}
                  <div className="flex items-baseline justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {unitInfo.costLabel}
                    </span>
                    <span className="text-lg font-extrabold font-mono tabular-nums text-[#0071E3]">
                      {costState.unitCost !== null ? `$${costState.unitCost.toFixed(2)}` : "Unavailable"}
                    </span>
                  </div>

                  {/* Selling Price */}
                  <div className="flex items-baseline justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Selling price
                    </span>
                    <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {financialMetrics.sellingPrice !== null
                        ? `$${financialMetrics.sellingPrice.toFixed(2)}`
                        : "Not set"}
                    </span>
                  </div>

                  {/* Food Cost % */}
                  <div className="flex items-baseline justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Food cost %
                    </span>
                    <span
                      className={`text-sm font-bold font-mono tabular-nums ${financialMetrics.foodCostPercent === null
                        ? "text-slate-400"
                        : financialMetrics.foodCostPercent <= 28.6
                          ? "text-emerald-600 dark:text-emerald-400"
                          : financialMetrics.foodCostPercent <= 35
                            ? "text-amber-600"
                            : "text-rose-600"
                        }`}
                    >
                      {financialMetrics.foodCostPercent !== null
                        ? `${financialMetrics.foodCostPercent.toFixed(1)}%`
                        : "—"}
                    </span>
                  </div>

                  {/* Gross Margin % */}
                  <div className="flex items-baseline justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Gross margin %
                    </span>
                    <span
                      className={`text-sm font-bold font-mono tabular-nums ${financialMetrics.grossMarginPercent === null
                        ? "text-slate-400"
                        : financialMetrics.grossMarginPercent >= 70
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-900 dark:text-white"
                        }`}
                    >
                      {financialMetrics.grossMarginPercent !== null
                        ? `${financialMetrics.grossMarginPercent.toFixed(1)}%`
                        : "—"}
                    </span>
                  </div>

                  {/* Gross Profit per Selling Unit */}
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {unitInfo.profitLabel}
                    </span>
                    <span
                      className={`text-base font-bold font-mono tabular-nums ${financialMetrics.grossProfit === null
                        ? "text-slate-400"
                        : financialMetrics.isProfitable
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600"
                        }`}
                    >
                      {financialMetrics.grossProfit !== null
                        ? `$${financialMetrics.grossProfit.toFixed(2)}`
                        : "—"}
                    </span>
                  </div>
                </div>
              ) : (
                /* DYNAMIC METRICS FOR PREP SUB-RECIPE (Omit retail pricing, margin, POS) */
                <div className="space-y-4">
                  {/* Batch Cost */}
                  <div className="flex items-baseline justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Batch cost
                    </span>
                    <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {costState.batchCost !== null ? `$${costState.batchCost.toFixed(2)}` : "—"}
                    </span>
                  </div>

                  {/* Batch Yield */}
                  <div className="flex items-baseline justify-between pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Yield
                    </span>
                    <span className="text-sm font-semibold font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {recipe.yieldQuantity} {unitInfo.short}
                    </span>
                  </div>

                  {/* Cost per Yield Unit */}
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {unitInfo.costLabel}
                    </span>
                    <span className="text-lg font-extrabold font-mono tabular-nums text-[#0071E3]">
                      {costState.unitCost !== null ? `$${costState.unitCost.toFixed(2)}` : "Unavailable"}
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* Cost by Unit Section */}
            <section
              className={`p-5 sm:p-6 rounded-2xl border transition ${isDark
                ? "bg-[#121622] border-white/[0.08]"
                : "bg-white border-slate-200 shadow-2xs"
                }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06] mb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cost by unit
                </h2>
                <span className="text-xs text-slate-400">
                  {unitInfo.short} basis
                </span>
              </div>

              {costByUnitList.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  Cost by unit unavailable — add ingredients or cost data.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {costByUnitList.map((item) => (
                    <div
                      key={item.unit}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between ${item.isPrimary
                        ? isDark
                          ? "bg-[#0071E3]/15 border-[#0071E3]/40"
                          : "bg-blue-50/80 border-blue-200"
                        : isDark
                          ? "bg-white/[0.02] border-white/[0.06]"
                          : "bg-slate-50 border-slate-200"
                        }`}
                    >
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                        Per {item.label}
                      </span>
                      <span
                        className={`text-sm font-bold font-mono tabular-nums mt-1 ${item.isPrimary ? "text-[#0071E3]" : "text-slate-900 dark:text-white"
                          }`}
                      >
                        {item.formattedPricing}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 overscroll-contain">
          <div
            className={`w-full max-w-md p-6 rounded-2xl border shadow-xl space-y-4 animate-in zoom-in-95 duration-150 ${isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Archive recipe
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to archive <strong>{recipe.name}</strong>? It will no longer be available for POS register sales or sub-recipe formula composition.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                disabled={archiving}
                onClick={() => setShowArchiveModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={archiving}
                onClick={handleArchive}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {archiving ? "Archiving..." : "Archive recipe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
