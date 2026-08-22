"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import { UnitEquivalentPricing, formatUnit } from "@/core/inventory/units";

interface ComponentCost {
  componentType: "INVENTORY_ITEM" | "SUB_RECIPE";
  id: string;
  name: string;
  quantity: number;
  unitOfMeasure: string;
  wastagePercent: number;
  baseUnit: string;
  baseUnitCost: number;
  effectiveUnitCost: number;
  netCost: number;
  wastageCost: number;
  totalCost: number;
  unitPricingMatrix?: UnitEquivalentPricing[];
  subComponents?: ComponentCost[];
}

interface RecipeDetail {
  id: string;
  name: string;
  type: "DISH" | "SUB_RECIPE";
  description?: string;
  yieldQuantity: number;
  yieldUnit: string;
  sellingPrice: number;
  costPerUnit: number;
  totalCost: number;
  grossMarginPercent: number;
  foodCostPercent: number;
  unitPricingMatrix?: UnitEquivalentPricing[];
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

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Recipe Dossier & Unit Pricing...</p>
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
            className="text-xs text-[#0071E3] hover:underline cursor-pointer"
          >
            ← Back to Recipes
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
        {/* Executive Header Banner */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/inventory/recipes`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← All Recipes
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                recipe.type === "SUB_RECIPE"
                  ? isDark ? "bg-purple-500/15 text-purple-300 border-purple-500/25" : "bg-purple-100 text-purple-800 border-purple-200"
                  : isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
              }`}>
                {recipe.type === "SUB_RECIPE" ? "Sub-Recipe Prep" : "Menu Dish"}
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {recipe.name}
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Batch Yield: {recipe.yieldQuantity} {formatUnit(recipe.yieldUnit as any)} • {breakdownItems.length} formula components
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/pos`)}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              Order in POS
            </button>
            <button
              onClick={() => setShowArchiveModal(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                isDark
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                  : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
              }`}
            >
              <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Archive</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Costing & Profit Margin KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Batch Food Cost
            </span>
            <p className={`text-2xl font-bold font-mono tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              ${Number(recipe.totalCost).toFixed(2)}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Total formula raw ingredients
            </p>
          </div>

          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Unit Portion Cost
            </span>
            <p className={`text-2xl font-bold font-mono tracking-tight mt-1 text-[#0071E3]`}>
              ${Number(recipe.costPerUnit).toFixed(2)}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Per {formatUnit(recipe.yieldUnit as any)}
            </p>
          </div>

          {recipe.type === "DISH" ? (
            <>
              <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Menu Selling Price
                </span>
                <p className={`text-2xl font-bold font-mono tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                  ${Number(recipe.sellingPrice).toFixed(2)}
                </p>
                <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  Food Cost %: {recipe.foodCostPercent.toFixed(1)}%
                </p>
              </div>

              <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Gross Margin
                </span>
                <p className={`text-2xl font-bold font-mono tracking-tight mt-1 ${
                  Number(recipe.grossMarginPercent) >= 65 ? "text-emerald-500" : "text-amber-500"
                }`}>
                  {Number(recipe.grossMarginPercent).toFixed(1)}%
                </p>
                <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  Profit: ${(Number(recipe.sellingPrice) - Number(recipe.costPerUnit)).toFixed(2)} / serving
                </p>
              </div>
            </>
          ) : (
            <div className={`p-5 rounded-3xl border col-span-2 ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Parent Recipe Usages
              </span>
              <p className={`text-base font-semibold mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                {recipe.usedInRecipeItems && recipe.usedInRecipeItems.length > 0
                  ? recipe.usedInRecipeItems.map((u) => u.recipe.name).join(", ")
                  : "Standalone prep sub-recipe"}
              </p>
            </div>
          )}
        </div>

        {/* Dedicated Multi-Format Unit Pricing Matrix Section */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <div className="flex justify-between items-center">
            <div>
              <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                Unit Pricing Matrix & Kitchen Equivalents
              </h2>
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Equivalent food costing normalized across all standard imperial, metric, and culinary kitchen measures.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {unitMatrix.map((item) => (
              <div
                key={item.unit}
                className={`p-3.5 rounded-2xl border transition flex flex-col justify-between space-y-1 ${
                  item.isPrimary
                    ? isDark
                      ? "bg-[#0071E3]/15 border-[#0071E3]/40"
                      : "bg-blue-50/80 border-blue-300"
                    : isDark
                    ? "bg-[#0A0C12] border-white/[0.06]"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Price per {item.label}
                </span>
                <p className={`text-base font-extrabold font-mono ${
                  item.isPrimary ? "text-[#0071E3]" : isDark ? "text-white" : "text-slate-900"
                }`}>
                  {item.formattedPricing}
                </p>
                {item.description && (
                  <p className={`text-[9px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ingredients & Costing Explosion Breakdown Table */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
            Ingredient & Sub-Recipe Formula Breakdown
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                  isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                }`}>
                  <th className="pb-3 px-3">Component Item</th>
                  <th className="pb-3 px-3">Type</th>
                  <th className="pb-3 px-3">Recipe Quantity</th>
                  <th className="pb-3 px-3">Base Unit Cost</th>
                  <th className="pb-3 px-3">Effective Cost / Unit</th>
                  <th className="pb-3 px-3">Trim Loss %</th>
                  <th className="pb-3 px-3 text-right">Total Line Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {breakdownItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                    <td className={`py-3.5 px-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {item.name}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        item.componentType === "SUB_RECIPE"
                          ? isDark ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-purple-50 text-purple-700 border-purple-200"
                          : isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {item.componentType === "SUB_RECIPE" ? "Sub-Recipe" : "Raw Item"}
                      </span>
                    </td>
                    <td className={`py-3.5 px-3 font-mono ${isDark ? "text-white" : "text-slate-900"}`}>
                      {item.quantity} {formatUnit(item.unitOfMeasure as any)}
                    </td>
                    <td className={`py-3.5 px-3 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      ${item.baseUnitCost.toFixed(2)} / {formatUnit(item.baseUnit as any)}
                    </td>
                    <td className={`py-3.5 px-3 font-mono font-medium ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                      ${item.effectiveUnitCost.toFixed(item.effectiveUnitCost < 0.1 ? 4 : 2)} / {formatUnit(item.unitOfMeasure as any)}
                    </td>
                    <td className="py-3.5 px-3 font-mono">
                      {item.wastagePercent > 0 ? (
                        <span className="text-amber-500 font-semibold">+{item.wastagePercent}% loss</span>
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </td>
                    <td className={`py-3.5 px-3 text-right font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      ${item.totalCost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <h2 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  Archive Recipe
                </h2>
                <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Are you sure you want to archive{" "}
                  <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    {recipe.name}
                  </span>
                  ? It will no longer be available for POS ordering or sub-recipe formula composition.
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
                    ? "bg-white/[0.04] text-[#8F95A3] hover:text-white hover:bg-white/[0.08]"
                    : "bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={archiving}
                onClick={handleArchive}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm shadow-rose-600/20 cursor-pointer disabled:opacity-50"
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
