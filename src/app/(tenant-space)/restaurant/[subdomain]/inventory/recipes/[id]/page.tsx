"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import {
  UnitEquivalentPricing,
  formatUnit,
  getUnitPricingMatrix,
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
  FileSpreadsheet,
  Sparkles,
  ArrowLeft,
  Tag,
  ShoppingBag,
  FlaskConical,
  Flame,
  ArrowUpRight,
  PieChart,
  Plus,
} from "lucide-react";

interface ComponentCost {
  componentType: "INVENTORY_ITEM" | "SUB_RECIPE";
  id: string;
  name: string;
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
  sellingPrice: number;
  costPerUnit: number;
  totalCost: number;
  grossMarginPercent: number;
  foodCostPercent: number;
  targetFoodCostPercent?: number;
  isDraft: boolean;
  sourceType?: string;
  createdAt: string;
  usedInRecipeItems?: { id: string; recipe: { id: string; name: string } }[];
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
  const [breakdownItems, setBreakdownItems] = useState<ComponentCost[]>([]);
  const [unitMatrix, setUnitMatrix] = useState<UnitEquivalentPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fetchRecipeDetail = async () => {
    try {
      const res = await fetch(`/api/restaurant/inventory/recipes/${recipeId}`);
      const data = await res.json();
      if (res.ok && data.recipe) {
        setRecipe({
          ...data.recipe,
          foodCostPercent: data.breakdown?.foodCostPercent || 0,
        });
        setBreakdownItems(data.breakdown?.items || []);
        setUnitMatrix(data.breakdown?.unitPricingMatrix || []);
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

  // Robust financial and culinary calculations with fallbacks
  const isDish = recipe?.type === "DISH";
  const isSubRecipe = recipe?.type === "SUB_RECIPE";

  const effectiveCostPerUnit = useMemo(() => {
    if (!recipe) return 0;
    if (recipe.costPerUnit && Number(recipe.costPerUnit) > 0) {
      return Number(recipe.costPerUnit);
    }
    if (recipe.totalCost && Number(recipe.totalCost) > 0 && recipe.yieldQuantity) {
      return Number(recipe.totalCost) / Math.max(1, Number(recipe.yieldQuantity));
    }
    return 0;
  }, [recipe]);

  const effectiveTotalCost = useMemo(() => {
    if (!recipe) return 0;
    if (recipe.totalCost && Number(recipe.totalCost) > 0) {
      return Number(recipe.totalCost);
    }
    return effectiveCostPerUnit * Math.max(1, Number(recipe.yieldQuantity || 1));
  }, [recipe, effectiveCostPerUnit]);

  const effectiveSellingPrice = Number(recipe?.sellingPrice || 0);

  const effectiveFoodCostPercent = useMemo(() => {
    if (effectiveSellingPrice <= 0 || effectiveCostPerUnit <= 0) return 0;
    return (effectiveCostPerUnit / effectiveSellingPrice) * 100;
  }, [effectiveSellingPrice, effectiveCostPerUnit]);

  const effectiveGrossMarginPercent = useMemo(() => {
    if (effectiveSellingPrice <= 0) return 0;
    return Math.max(
      0,
      ((effectiveSellingPrice - effectiveCostPerUnit) / effectiveSellingPrice) * 100
    );
  }, [effectiveSellingPrice, effectiveCostPerUnit]);

  const effectiveProfitPerServing = useMemo(() => {
    return Math.max(0, effectiveSellingPrice - effectiveCostPerUnit);
  }, [effectiveSellingPrice, effectiveCostPerUnit]);

  const targetFoodCost = Number(recipe?.targetFoodCostPercent || 28);
  const suggestedSellingPrice = useMemo(() => {
    if (targetFoodCost <= 0 || effectiveCostPerUnit <= 0) return 0;
    return effectiveCostPerUnit / (targetFoodCost / 100);
  }, [targetFoodCost, effectiveCostPerUnit]);

  // Unit matrix normalization (prevents $0.00 cards when unit cost is known)
  const computedUnitMatrix = useMemo(() => {
    if (!recipe) return [];
    if (unitMatrix && unitMatrix.length > 0 && unitMatrix.some((u) => u.unitCost > 0)) {
      return unitMatrix;
    }
    if (effectiveCostPerUnit > 0) {
      return getUnitPricingMatrix(effectiveCostPerUnit, (recipe.yieldUnit as any) || "PORTION");
    }
    return unitMatrix;
  }, [unitMatrix, effectiveCostPerUnit, recipe]);

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-9 h-9 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Loading Recipe Formulation Dossier...
        </p>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div
        className={`min-h-screen flex flex-col font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Recipe Details" />
        <main className="max-w-4xl mx-auto p-6 space-y-4">
          <button
            onClick={() => router.push(`/restaurant/${subdomain}/inventory/recipes`)}
            className="text-xs text-[#0071E3] hover:underline cursor-pointer flex items-center gap-1 font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Recipe Builder
          </button>
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error || "Recipe not found"}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Recipe Details" />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Breadcrumb Navigation Trail */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <nav className="flex items-center gap-2 text-xs">
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/inventory/recipes`)}
              className="text-[#0071E3] hover:underline font-semibold cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Recipe Studio</span>
            </button>
            <span className="text-slate-400 dark:text-slate-600">/</span>
            <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs">
              {recipe.name}
            </span>
          </nav>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Created {new Date(recipe.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Executive Header Banner */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition shadow-sm ${
            isDark
              ? "bg-[#121622]/80 border-white/[0.08]"
              : "bg-white border-slate-200/90 shadow-slate-900/5"
          }`}
        >
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-2.5 min-w-0">
              {/* Type and Status Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {isSubRecipe ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                    <ChefHat className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>Kitchen Prep Sub-Recipe</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    <Utensils className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Menu Dish Formulation</span>
                  </span>
                )}

                {recipe.isDraft ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>Draft (Not Live in POS)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-[#0071E3] dark:text-[#70B4FF] border border-blue-500/20">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Published & Live BOM</span>
                  </span>
                )}

                {recipe.sourceType === "PASTED" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>Pasted Extraction</span>
                  </span>
                )}
                {recipe.sourceType === "EXCEL" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                    <FileSpreadsheet className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span>Excel Import</span>
                  </span>
                )}
              </div>

              {/* Recipe Title & Subtitle */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {recipe.name}
                </h1>
                {recipe.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    {recipe.description}
                  </p>
                )}
              </div>

              {/* Quick Info Chips */}
              <div className="flex items-center gap-2 flex-wrap pt-1 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] font-medium">
                  <Layers className="w-3.5 h-3.5 text-[#0071E3]" />
                  <span>
                    Batch Yield:{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {recipe.yieldQuantity} {formatUnit(recipe.yieldUnit as any)}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] font-medium">
                  <FlaskConical className="w-3.5 h-3.5 text-purple-500" />
                  <span>
                    Formula:{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {breakdownItems.length} components
                    </strong>
                  </span>
                </div>

                {recipe.servingSize && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] font-medium">
                    <Scale className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      Serving Size:{" "}
                      <strong className="text-slate-900 dark:text-white">
                        {recipe.servingSize}
                      </strong>
                    </span>
                  </div>
                )}

                {recipe.prepTimeMin && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.05] font-medium">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>
                      Active Prep:{" "}
                      <strong className="text-slate-900 dark:text-white">
                        {recipe.prepTimeMin} mins
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 w-full lg:w-auto shrink-0 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() =>
                  router.push(`/restaurant/${subdomain}/inventory/recipes?edit=${recipe.id}`)
                }
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-sm transition active:scale-[0.98] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Formula</span>
              </button>

              {recipe.isDraft ? (
                <button
                  type="button"
                  disabled={publishing}
                  onClick={handlePublish}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{publishing ? "Publishing..." : "Publish to POS"}</span>
                </button>
              ) : isDish ? (
                <button
                  type="button"
                  onClick={() => router.push(`/restaurant/${subdomain}/pos`)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition active:scale-[0.98] cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />
                  <span>Order in POS</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setShowArchiveModal(true)}
                className="px-3.5 py-2.5 rounded-xl text-xs font-medium border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer flex items-center justify-center gap-1.5"
                title="Archive Recipe"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="sm:hidden">Archive</span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Financial & Operational KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {isDish ? (
            <>
              {/* Dish KPI 1: Batch Formulation Cost */}
              <div
                className={`p-5 rounded-3xl border transition ${
                  isDark
                    ? "bg-[#121622]/80 border-white/[0.08]"
                    : "bg-white border-slate-200/90 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Batch Formulation Cost
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-[#0071E3] flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white mt-2">
                  ${effectiveTotalCost.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Full batch cost for {recipe.yieldQuantity} {formatUnit(recipe.yieldUnit as any)}
                </p>
              </div>

              {/* Dish KPI 2: Portion Food Cost */}
              <div
                className={`p-5 rounded-3xl border transition ${
                  isDark
                    ? "bg-[#121622]/80 border-white/[0.08]"
                    : "bg-white border-slate-200/90 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Portion Food Cost
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Utensils className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#0071E3] mt-2">
                  ${effectiveCostPerUnit.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Raw ingredient cost per {formatUnit(recipe.yieldUnit as any)} serving
                </p>
              </div>

              {/* Dish KPI 3: Menu Retail Price */}
              <div
                className={`p-5 rounded-3xl border transition ${
                  isDark
                    ? "bg-[#121622]/80 border-white/[0.08]"
                    : "bg-white border-slate-200/90 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Menu Retail Price
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <Tag className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white mt-2">
                  ${effectiveSellingPrice.toFixed(2)}
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Food Cost:
                  </span>
                  <span
                    className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-full ${
                      effectiveFoodCostPercent <= 28
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : effectiveFoodCostPercent <= 35
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {effectiveFoodCostPercent.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Dish KPI 4: Gross Margin & Contribution Profit */}
              <div
                className={`p-5 rounded-3xl border transition ${
                  isDark
                    ? "bg-[#121622]/80 border-white/[0.08]"
                    : "bg-white border-slate-200/90 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Gross Profit Margin
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <p
                  className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight mt-2 ${
                    effectiveGrossMarginPercent >= 70
                      ? "text-emerald-600 dark:text-emerald-400"
                      : effectiveGrossMarginPercent >= 60
                      ? "text-[#0071E3]"
                      : "text-amber-500"
                  }`}
                >
                  {effectiveGrossMarginPercent.toFixed(1)}%
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  Profit:{" "}
                  <strong className="text-slate-900 dark:text-white font-mono">
                    +${effectiveProfitPerServing.toFixed(2)}
                  </strong>{" "}
                  / plate
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Sub-Recipe KPI 1: Batch Prep Cost */}
              <div
                className={`p-5 rounded-3xl border transition ${
                  isDark
                    ? "bg-[#121622]/80 border-white/[0.08]"
                    : "bg-white border-slate-200/90 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Batch Prep Cost
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <ChefHat className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white mt-2">
                  ${effectiveTotalCost.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Total raw ingredients for full prep batch
                </p>
              </div>

              {/* Sub-Recipe KPI 2: Internal Unit Yield Cost */}
              <div
                className={`p-5 rounded-3xl border transition ${
                  isDark
                    ? "bg-[#121622]/80 border-white/[0.08]"
                    : "bg-white border-slate-200/90 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Cost / Prep Yield Unit
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-[#0071E3] flex items-center justify-center">
                    <Scale className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[#0071E3] mt-2">
                  ${effectiveCostPerUnit.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Internal cost per {formatUnit(recipe.yieldUnit as any)} of prepared base
                </p>
              </div>

              {/* Sub-Recipe KPI 3: Standard Batch Yield */}
              <div
                className={`p-5 rounded-3xl border transition ${
                  isDark
                    ? "bg-[#121622]/80 border-white/[0.08]"
                    : "bg-white border-slate-200/90 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Batch Yield Output
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white mt-2">
                  {recipe.yieldQuantity} {formatUnit(recipe.yieldUnit as any)}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {recipe.servingSize ? `Portion: ${recipe.servingSize}` : "Kitchen batch formulation standard"}
                </p>
              </div>

              {/* Sub-Recipe KPI 4: Active Dish Connections */}
              <div
                className={`p-5 rounded-3xl border transition ${
                  isDark
                    ? "bg-[#121622]/80 border-white/[0.08]"
                    : "bg-white border-slate-200/90 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Active Menu Connections
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Share2 className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white mt-2">
                  {recipe.usedInRecipeItems?.length || 0} Dishes
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {recipe.usedInRecipeItems && recipe.usedInRecipeItems.length > 0
                    ? "Linked to active menu formulas"
                    : "Standalone prep component"}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Target Food Cost & Pricing Advisor Banner (For Dishes) */}
        {isDish && effectiveSellingPrice > 0 && (
          <div
            className={`p-5 rounded-3xl border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
              isDark
                ? "bg-[#0A0C12] border-white/[0.08]"
                : "bg-blue-50/60 border-blue-200/80"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#0071E3]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Target Food Cost & Menu Pricing Intelligence
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                At your target of <strong>{targetFoodCost}% Food Cost</strong>, suggested menu retail
                price is{" "}
                <strong className="text-slate-900 dark:text-white font-mono">
                  ${suggestedSellingPrice.toFixed(2)}
                </strong>
                . Current menu price is{" "}
                <strong className="font-mono text-slate-900 dark:text-white">
                  ${effectiveSellingPrice.toFixed(2)}
                </strong>{" "}
                yielding{" "}
                <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                  +${effectiveProfitPerServing.toFixed(2)}
                </strong>{" "}
                net gross margin per portion.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <div className="text-right">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Target Price
                </span>
                <span className="text-base font-extrabold font-mono text-[#0071E3]">
                  ${suggestedSellingPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Parent Dish Usages (For Sub-Recipes) */}
        {isSubRecipe && (
          <div
            className={`p-6 rounded-3xl border transition space-y-3 ${
              isDark
                ? "bg-[#121622]/80 border-white/[0.08]"
                : "bg-white border-slate-200/90 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-purple-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Parent Menu Dish Usages
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {recipe.usedInRecipeItems?.length || 0} connections
              </span>
            </div>

            {recipe.usedInRecipeItems && recipe.usedInRecipeItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                {recipe.usedInRecipeItems.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/restaurant/${subdomain}/inventory/recipes/${u.recipe.id}`
                      )
                    }
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                      isDark
                        ? "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
                        : "bg-slate-50 border-slate-200 hover:bg-blue-50/50 hover:border-blue-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {u.recipe.name}
                      </div>
                      <div className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">
                        Active Menu Dish
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                This sub-recipe is currently standalone and not yet linked to any finished menu dishes.
                You can add it as a component inside any dish formula in the Recipe Studio.
              </p>
            )}
          </div>
        )}

        {/* Preparation Instructions */}
        {recipe.instructions && (
          <div
            className={`p-6 rounded-3xl border transition space-y-3 ${
              isDark
                ? "bg-[#121622]/80 border-white/[0.08]"
                : "bg-white border-slate-200/90 shadow-2xs"
            }`}
          >
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Chef Preparation Method & Kitchen Steps
              </h2>
            </div>
            <div className="space-y-2 pt-1">
              {recipe.instructions
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((step, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed ${
                      isDark
                        ? "bg-white/[0.02] border-white/[0.05] text-slate-200"
                        : "bg-slate-50/80 border-slate-200/70 text-slate-800"
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-[#0071E3]/10 text-[#0071E3] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1">{step}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Kitchen Scoop & Culinary Yield Conversion Matrix */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark
              ? "bg-[#121622]/80 border-white/[0.08]"
              : "bg-white border-slate-200/90 shadow-2xs"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-[#0071E3]" />
                <span>
                  {isSubRecipe
                    ? "Kitchen Scoop & Prep Yield Conversions"
                    : "Portion & Catering Pricing Equivalents"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Normalized food costing across kitchen scoops, ladles, weight, and volume measures.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {computedUnitMatrix.map((item) => (
              <div
                key={item.unit}
                className={`p-3.5 rounded-2xl border transition flex flex-col justify-between space-y-1.5 ${
                  item.isPrimary
                    ? isDark
                      ? "bg-[#0071E3]/15 border-[#0071E3]/50 shadow-xs"
                      : "bg-blue-50/90 border-[#0071E3] shadow-xs"
                    : isDark
                    ? "bg-[#0A0C12] border-white/[0.06] hover:bg-white/[0.03]"
                    : "bg-slate-50/80 border-slate-200 hover:bg-slate-100/80"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider truncate ${
                      item.isPrimary
                        ? "text-[#0071E3] dark:text-[#70B4FF]"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    Per {item.label}
                  </span>
                  {item.isPrimary && (
                    <span className="w-2 h-2 rounded-full bg-[#0071E3] shrink-0" />
                  )}
                </div>

                <p
                  className={`text-base sm:text-lg font-extrabold font-mono tracking-tight ${
                    item.isPrimary
                      ? "text-[#0071E3] dark:text-[#70B4FF]"
                      : isDark
                      ? "text-white"
                      : "text-slate-900"
                  }`}
                >
                  {item.formattedPricing}
                </p>

                {item.description && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ingredients & Formula Bill of Materials (BOM) Breakdown */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark
              ? "bg-[#121622]/80 border-white/[0.08]"
              : "bg-white border-slate-200/90 shadow-2xs"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-purple-500" />
                <span>Formula Ingredients & Bill of Materials (BOM)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Components, prep trim shrinkage, and stock depletion quantities.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(`/restaurant/${subdomain}/inventory/recipes?edit=${recipe.id}`)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>Add / Edit Components</span>
            </button>
          </div>

          {breakdownItems.length === 0 ? (
            /* Empty State */
            <div
              className={`p-8 sm:p-12 rounded-3xl border border-dashed text-center flex flex-col items-center justify-center space-y-3 ${
                isDark
                  ? "bg-white/[0.01] border-white/[0.1]"
                  : "bg-slate-50/50 border-slate-300"
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                <FlaskConical className="w-6 h-6" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  No Formula Components Configured Yet
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  This formulation has zero raw items or sub-recipes linked. Open the Recipe Studio
                  to connect inventory items, packaging definitions, and prep loss percentages.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  router.push(`/restaurant/${subdomain}/inventory/recipes?edit=${recipe.id}`)
                }
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white transition active:scale-[0.98] cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Formulate Ingredients Now</span>
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr
                      className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                        isDark
                          ? "border-white/[0.08] text-slate-400"
                          : "border-slate-200 text-slate-500"
                      }`}
                    >
                      <th className="pb-3 px-3">Component Item</th>
                      <th className="pb-3 px-3">Classification</th>
                      <th className="pb-3 px-3">Usable Quantity</th>
                      <th className="pb-3 px-3">Trim Loss %</th>
                      <th className="pb-3 px-3">Gross Depletion</th>
                      <th className="pb-3 px-3">Effective Cost / Unit</th>
                      <th className="pb-3 px-3 text-right">Extended Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {breakdownItems.map((item, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition"
                      >
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.name}
                          </div>
                          {item.packName && (
                            <div className="text-[10px] text-purple-600 dark:text-purple-400 font-mono mt-0.5">
                              Pack: {item.packQuantity}× {item.packName}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              item.componentType === "SUB_RECIPE"
                                ? isDark
                                  ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                  : "bg-purple-100 text-purple-700 border-purple-200"
                                : isDark
                                ? "bg-white/[0.04] text-slate-300 border-white/[0.08]"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {item.componentType === "SUB_RECIPE"
                              ? "Sub-Recipe"
                              : "Raw Item"}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                          {item.quantity} {formatUnit(item.unitOfMeasure as any)}
                        </td>
                        <td className="py-3.5 px-3 font-mono">
                          {item.wastagePercent > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full">
                              +{item.wastagePercent}% loss
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                          {item.grossQuantity !== undefined
                            ? `${item.grossQuantity.toFixed(2)} ${formatUnit(
                                item.unitOfMeasure as any
                              )}`
                            : `${item.quantity} ${formatUnit(
                                item.unitOfMeasure as any
                              )}`}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                          ${item.effectiveUnitCost.toFixed(
                            item.effectiveUnitCost < 0.1 ? 4 : 2
                          )}{" "}
                          / {formatUnit(item.unitOfMeasure as any)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                          ${item.totalCost.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-2.5">
                {breakdownItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border space-y-2.5 ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.06]"
                        : "bg-slate-50/80 border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {item.name}
                        </div>
                        {item.packName && (
                          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-mono mt-0.5">
                            Pack: {item.packQuantity}× {item.packName}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 border ${
                          item.componentType === "SUB_RECIPE"
                            ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                            : "bg-slate-200/80 text-slate-700 border-slate-300"
                        }`}
                      >
                        {item.componentType === "SUB_RECIPE" ? "Sub-Recipe" : "Raw"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Quantity
                        </span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-white">
                          {item.quantity} {formatUnit(item.unitOfMeasure as any)}
                        </span>
                        {item.wastagePercent > 0 && (
                          <span className="text-[10px] text-amber-500 block">
                            +{item.wastagePercent}% trim loss
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">
                          Line Total
                        </span>
                        <span className="font-mono font-extrabold text-sm text-[#0071E3]">
                          ${item.totalCost.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ${item.effectiveUnitCost.toFixed(2)} /{" "}
                          {formatUnit(item.unitOfMeasure as any)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 overscroll-contain">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${
              isDark
                ? "bg-[#121622] border-white/[0.08] text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  Archive Recipe Formulation
                </h2>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Are you sure you want to archive{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {recipe.name}
                  </strong>
                  ? It will no longer be available for POS register depletion or sub-recipe
                  composition in dishes.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                disabled={archiving}
                onClick={() => setShowArchiveModal(false)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isDark
                    ? "bg-white/[0.04] text-slate-300 hover:text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={archiving}
                onClick={handleArchive}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {archiving ? "Archiving..." : "Archive Recipe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
