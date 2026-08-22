"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { convertUnitCost, getUnitPricingMatrix, formatUnit } from "@/core/inventory/units";

interface Recipe {
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
  createdAt: string;
  _count?: { items: number; usedInRecipeItems: number };
}

interface InventoryItem {
  id: string;
  name: string;
  unitOfMeasure: string;
  costPerUnit: number;
}

interface FormRecipeItem {
  componentType: "INVENTORY_ITEM" | "SUB_RECIPE";
  inventoryItemId?: string;
  subRecipeId?: string;
  quantity: string;
  unitOfMeasure: string;
  wastagePercent: string;
}

const CULINARY_UOM_GROUPS = [
  {
    group: "Weight Formats",
    options: [
      { value: "LB", label: "Pounds (lb)" },
      { value: "OZ", label: "Ounces (oz)" },
      { value: "KG", label: "Kilograms (kg)" },
      { value: "G", label: "Grams (g)" },
    ],
  },
  {
    group: "Volume & Kitchen Scoops",
    options: [
      { value: "LADLE", label: "Ladle (4 oz / ~118 ml scoop)" },
      { value: "CUP", label: "Cup (8 fl oz / ~237 ml)" },
      { value: "FL_OZ", label: "Fluid Ounces (fl oz)" },
      { value: "TBSP", label: "Tablespoon (tbsp - 15 ml)" },
      { value: "TSP", label: "Teaspoon (tsp - 5 ml)" },
      { value: "GAL", label: "Gallon (gal)" },
      { value: "QT", label: "Quart (qt)" },
      { value: "PT", label: "Pint (pt)" },
      { value: "L", label: "Liter (L)" },
      { value: "ML", label: "Milliliter (ml)" },
    ],
  },
  {
    group: "Count & Meal Portions",
    options: [
      { value: "PIECES", label: "Pieces (pcs)" },
      { value: "DOZEN", label: "Dozen (doz)" },
      { value: "PORTION", label: "Portion / Serving" },
      { value: "BOX", label: "Box" },
      { value: "PACKET", label: "Packet" },
    ],
  },
];

export default function RecipesDirectoryPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "DISH" | "SUB_RECIPE">("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Target Food Cost % Simulator State
  const [targetFoodCostPercent, setTargetFoodCostPercent] = useState("28");

  // Form State
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"DISH" | "SUB_RECIPE">("DISH");
  const [formDescription, setFormDescription] = useState("");
  const [formYieldQty, setFormYieldQty] = useState("1");
  const [formYieldUnit, setFormYieldUnit] = useState("PORTION");
  const [formSellingPrice, setFormSellingPrice] = useState("0");
  const [formItems, setFormItems] = useState<FormRecipeItem[]>([
    {
      componentType: "INVENTORY_ITEM",
      inventoryItemId: "",
      subRecipeId: "",
      quantity: "1",
      unitOfMeasure: "LB",
      wastagePercent: "0",
    },
  ]);

  const fetchData = async () => {
    try {
      const [resRecipes, resItems] = await Promise.all([
        fetch("/api/restaurant/inventory/recipes"),
        fetch("/api/restaurant/inventory/items"),
      ]);
      if (resRecipes.ok) setRecipes((await resRecipes.json()).recipes || []);
      if (resItems.ok) setInventoryItems((await resItems.json()).items || []);
    } catch {
      setError("Failed to load recipes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const subRecipesList = recipes.filter((r) => r.type === "SUB_RECIPE");

  const handleAddItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      {
        componentType: "INVENTORY_ITEM",
        inventoryItemId: "",
        subRecipeId: "",
        quantity: "1",
        unitOfMeasure: "OZ",
        wastagePercent: "0",
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemRowChange = (index: number, field: keyof FormRecipeItem, val: any) => {
    setFormItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };

      if (field === "inventoryItemId" && val) {
        const selected = inventoryItems.find((i) => i.id === val);
        if (selected) {
          copy[index].unitOfMeasure = selected.unitOfMeasure;
        }
      } else if (field === "subRecipeId" && val) {
        const selected = subRecipesList.find((r) => r.id === val);
        if (selected) {
          copy[index].unitOfMeasure = selected.yieldUnit;
        }
      }

      return copy;
    });
  };

  // Live Component Calculation for Form
  const computeFormRowCost = (row: FormRecipeItem) => {
    const qty = parseFloat(row.quantity) || 0;
    const waste = parseFloat(row.wastagePercent) || 0;

    let baseCost = 0;
    let baseUnit = "PIECES";

    if (row.componentType === "INVENTORY_ITEM" && row.inventoryItemId) {
      const item = inventoryItems.find((i) => i.id === row.inventoryItemId);
      if (item) {
        baseCost = Number(item.costPerUnit);
        baseUnit = item.unitOfMeasure;
      }
    } else if (row.componentType === "SUB_RECIPE" && row.subRecipeId) {
      const sub = subRecipesList.find((r) => r.id === row.subRecipeId);
      if (sub) {
        baseCost = Number(sub.costPerUnit);
        baseUnit = sub.yieldUnit;
      }
    }

    const effectiveUnitCost = convertUnitCost(baseCost, baseUnit as any, row.unitOfMeasure as any);
    const lineTotal = qty * (1 + waste / 100) * effectiveUnitCost;

    return {
      baseCost,
      baseUnit,
      effectiveUnitCost,
      lineTotal,
    };
  };

  const calculatedTotalBatchCost = formItems.reduce((acc, row) => {
    return acc + computeFormRowCost(row).lineTotal;
  }, 0);

  const yieldQtyNum = parseFloat(formYieldQty) || 1;
  const calculatedCostPerPortion = yieldQtyNum > 0 ? calculatedTotalBatchCost / yieldQtyNum : calculatedTotalBatchCost;
  const targetFoodCostNum = parseFloat(targetFoodCostPercent) || 28;
  const suggestedSellingPrice = targetFoodCostNum > 0 ? (calculatedCostPerPortion / (targetFoodCostNum / 100)) : 0;
  const currentSellingPriceNum = parseFloat(formSellingPrice) || 0;
  const currentGrossMargin = currentSellingPriceNum > 0 ? (((currentSellingPriceNum - calculatedCostPerPortion) / currentSellingPriceNum) * 100) : 0;

  const handleApplySuggestedPrice = () => {
    setFormSellingPrice(suggestedSellingPrice.toFixed(2));
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError("Recipe name is required");
      return;
    }

    const validItems = formItems.filter((i) =>
      i.componentType === "INVENTORY_ITEM" ? i.inventoryItemId : i.subRecipeId
    );

    if (validItems.length === 0) {
      setError("Please add at least one valid ingredient or sub-recipe");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        name: formName,
        type: formType,
        description: formDescription || undefined,
        yieldQuantity: parseFloat(formYieldQty) || 1,
        yieldUnit: formYieldUnit,
        sellingPrice: formType === "DISH" ? parseFloat(formSellingPrice) || 0 : 0,
        items: validItems.map((i) => ({
          componentType: i.componentType,
          inventoryItemId: i.componentType === "INVENTORY_ITEM" ? i.inventoryItemId : undefined,
          subRecipeId: i.componentType === "SUB_RECIPE" ? i.subRecipeId : undefined,
          quantity: parseFloat(i.quantity) || 1,
          unitOfMeasure: i.unitOfMeasure,
          wastagePercent: parseFloat(i.wastagePercent) || 0,
        })),
      };

      const res = await fetch("/api/restaurant/inventory/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create recipe");

      setShowCreate(false);
      setFormName("");
      setFormDescription("");
      setFormYieldQty("1");
      setFormSellingPrice("0");
      setFormItems([
        {
          componentType: "INVENTORY_ITEM",
          inventoryItemId: "",
          subRecipeId: "",
          quantity: "1",
          unitOfMeasure: "LB",
          wastagePercent: "0",
        },
      ]);
      fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to create recipe");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecipes = recipes.filter((r) => {
    if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const dishesCount = recipes.filter((r) => r.type === "DISH").length;
  const subRecipesCount = recipes.filter((r) => r.type === "SUB_RECIPE").length;

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Professional Recipe Studio...</p>
      </div>
    );
  }

  return (
    <ModuleAccessGuard moduleKey="inventory" moduleName="Recipes & Costing Studio" activeSection="Recipes">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Recipes" />

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
                onClick={() => router.push(`/restaurant/${subdomain}/inventory`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← Inventory Hub
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Professional Culinary Engine
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Recipe Studio & Unit Pricing Matrix
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              {dishesCount} Menu Dishes • {subRecipesCount} Sub-Recipes • Multi-format unit conversions (LB, OZ, Gram, KG, Ladle, Cup, Portion).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/pos`)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                isDark
                  ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                  : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-xs"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>Launch POS Terminal</span>
            </button>

            <button
              onClick={() => {
                setError("");
                setShowCreate(true);
              }}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              + Create Recipe / Sub-Recipe
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Filter Pills & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            {(["ALL", "DISH", "SUB_RECIPE"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTypeFilter(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  typeFilter === tab
                    ? "bg-[#0071E3] text-white shadow-xs font-semibold"
                    : isDark
                    ? "bg-[#121622]/60 text-[#8F95A3] hover:text-white border border-white/[0.06]"
                    : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                }`}
              >
                {tab === "ALL" ? `All Recipes (${recipes.length})` : tab === "DISH" ? `Menu Dishes (${dishesCount})` : `Sub-Recipes (${subRecipesCount})`}
              </button>
            ))}
          </div>

          <input
            placeholder="Search recipes, formulas, ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full sm:w-72 px-3.5 py-2 text-xs rounded-xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          />
        </div>

        {/* Recipe Cards Grid */}
        {filteredRecipes.length === 0 ? (
          <div
            className={`p-12 text-center rounded-3xl border text-xs space-y-2 ${
              isDark ? "bg-[#121622]/40 border-white/[0.06] text-[#8F95A3]" : "bg-white border-slate-200 text-slate-500 shadow-xs"
            }`}
          >
            <p className="font-semibold text-sm">No recipes found</p>
            <p className="opacity-75">Click &quot;+ Create Recipe / Sub-Recipe&quot; to build your culinary formulas.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRecipes.map((recipe) => {
              const unitMatrix = getUnitPricingMatrix(Number(recipe.costPerUnit), recipe.yieldUnit as any);

              return (
                <div
                  key={recipe.id}
                  onClick={() => router.push(`/restaurant/${subdomain}/inventory/recipes/${recipe.id}`)}
                  className={`p-6 rounded-3xl border transition flex flex-col justify-between space-y-4 cursor-pointer group ${
                    isDark
                      ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12] hover:bg-[#121622]"
                      : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs hover:shadow-md"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          recipe.type === "SUB_RECIPE"
                            ? isDark ? "bg-purple-500/15 text-purple-300 border-purple-500/25" : "bg-purple-100 text-purple-800 border-purple-200"
                            : isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}>
                          {recipe.type === "SUB_RECIPE" ? "Sub-Recipe Prep" : "Menu Dish"}
                        </span>
                        <h3 className={`text-base font-bold tracking-tight mt-1.5 group-hover:text-[#0071E3] transition ${isDark ? "text-white" : "text-slate-900"}`}>
                          {recipe.name}
                        </h3>
                        {recipe.description && (
                          <p className={`text-[11px] line-clamp-1 mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            {recipe.description}
                          </p>
                        )}
                      </div>

                      <div className="text-right font-mono">
                        {recipe.type === "DISH" ? (
                          <>
                            <span className={`text-base font-extrabold ${isDark ? "text-white" : "text-slate-900"}`}>
                              ${Number(recipe.sellingPrice).toFixed(2)}
                            </span>
                            <span className={`block text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>Price</span>
                          </>
                        ) : (
                          <>
                            <span className={`text-base font-extrabold text-[#0071E3]`}>
                              ${Number(recipe.costPerUnit).toFixed(2)}
                            </span>
                            <span className={`block text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>per {formatUnit(recipe.yieldUnit as any)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Food Cost & Gross Margin Specs */}
                    <div className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                      isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200/80"
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Recipe Food Cost:</span>
                        <span className={`font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                          ${Number(recipe.costPerUnit).toFixed(2)} / {formatUnit(recipe.yieldUnit as any)}
                        </span>
                      </div>

                      {recipe.type === "DISH" && Number(recipe.sellingPrice) > 0 && (
                        <div className="flex justify-between items-center">
                          <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Gross Margin:</span>
                          <span className={`font-mono font-bold ${
                            Number(recipe.grossMarginPercent) >= 65
                              ? "text-emerald-500"
                              : Number(recipe.grossMarginPercent) >= 50
                              ? "text-amber-500"
                              : "text-rose-500"
                          }`}>
                            {Number(recipe.grossMarginPercent).toFixed(1)}%
                          </span>
                        </div>
                      )}

                      {/* Multi-Unit Pricing Equivalents Chips */}
                      <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04] space-y-1">
                        <span className={`block text-[9px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          Unit Pricing Equivalents
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {unitMatrix.slice(0, 3).map((u) => (
                            <span
                              key={u.unit}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                isDark
                                  ? "bg-white/[0.03] text-[#BAC0CD] border-white/[0.06]"
                                  : "bg-white text-slate-700 border-slate-200"
                              }`}
                            >
                              {u.formattedPricing}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1 text-[11px]">
                    <span className={`font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      Yield: {recipe.yieldQuantity} {formatUnit(recipe.yieldUnit as any)}
                    </span>
                    <span className="text-[#0071E3] font-semibold group-hover:underline flex items-center gap-1">
                      Inspect Matrix →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Professional Recipe Builder Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Professional Recipe & Sub-Recipe Studio</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Build culinary formulas with instant live unit conversion and food cost simulation.
                </p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRecipe} className="space-y-5">
              {/* Step 1: Recipe Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Recipe Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Signature Truffle Burger or Tomato Basil Base Sauce"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white focus:border-[#0071E3]" : "bg-[#F5F5F7] border-slate-200 text-slate-900 focus:border-[#0071E3]"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Classification *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition cursor-pointer font-semibold ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="DISH">Finished Menu Dish (POS Sellable)</option>
                    <option value="SUB_RECIPE">Sub-Recipe (Prep Ingredient)</option>
                  </select>
                </div>
              </div>

              {/* Yield & Portions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Batch Yield Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formYieldQty}
                    onChange={(e) => setFormYieldQty(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs font-mono rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Yield Unit *
                  </label>
                  <select
                    value={formYieldUnit}
                    onChange={(e) => setFormYieldUnit(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition cursor-pointer ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    {CULINARY_UOM_GROUPS.map((grp) => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.options.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {formType === "DISH" ? (
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Selling Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formSellingPrice}
                      onChange={(e) => setFormSellingPrice(e.target.value)}
                      className={`w-full px-3.5 py-2 text-xs font-mono rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                ) : (
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    isDark ? "bg-[#0A0C12] border-white/[0.06] text-[#8F95A3]" : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}>
                    <span>Sub-Recipe Cost:</span>
                    <span className="font-mono font-bold text-[#0071E3]">${calculatedCostPerPortion.toFixed(2)} / {formatUnit(formYieldUnit as any)}</span>
                  </div>
                )}
              </div>

              {/* Dynamic Recipe Components Table */}
              <div className="space-y-2.5 pt-1">
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Formula Components & Ingredient Conversion
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer"
                  >
                    + Add Ingredient / Sub-Recipe
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formItems.map((row, idx) => {
                    const rowCost = computeFormRowCost(row);

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center gap-3 ${
                          isDark ? "bg-[#0A0C12]/80 border-white/[0.06]" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        {/* Type Toggle */}
                        <select
                          value={row.componentType}
                          onChange={(e) =>
                            handleItemRowChange(idx, "componentType", e.target.value as any)
                          }
                          className={`w-32 px-2.5 py-1.5 text-xs rounded-xl border font-semibold cursor-pointer ${
                            isDark ? "bg-[#121622] border-white/[0.08] text-[#8F95A3]" : "bg-white border-slate-200 text-slate-700"
                          }`}
                        >
                          <option value="INVENTORY_ITEM">Raw Ingredient</option>
                          <option value="SUB_RECIPE">Sub-Recipe</option>
                        </select>

                        {/* Component Selector */}
                        <div className="flex-1 w-full">
                          {row.componentType === "INVENTORY_ITEM" ? (
                            <select
                              value={row.inventoryItemId}
                              onChange={(e) => handleItemRowChange(idx, "inventoryItemId", e.target.value)}
                              className={`w-full px-3 py-1.5 text-xs rounded-xl border cursor-pointer ${
                                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                              }`}
                            >
                              <option value="">Select Raw Inventory Item...</option>
                              {inventoryItems.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} (${Number(i.costPerUnit).toFixed(2)} / {formatUnit(i.unitOfMeasure as any)})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={row.subRecipeId}
                              onChange={(e) => handleItemRowChange(idx, "subRecipeId", e.target.value)}
                              className={`w-full px-3 py-1.5 text-xs rounded-xl border cursor-pointer ${
                                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                              }`}
                            >
                              <option value="">Select Prepared Sub-Recipe...</option>
                              {subRecipesList.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name} (${Number(r.costPerUnit).toFixed(2)} / {formatUnit(r.yieldUnit as any)})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Quantity & Culinary Unit */}
                        <div className="flex items-center gap-2 w-full md:w-auto">
                          <input
                            type="number"
                            step="0.01"
                            min="0.001"
                            placeholder="Qty"
                            value={row.quantity}
                            onChange={(e) => handleItemRowChange(idx, "quantity", e.target.value)}
                            className={`w-20 px-2.5 py-1.5 text-xs font-mono rounded-xl border ${
                              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                            }`}
                          />
                          <select
                            value={row.unitOfMeasure}
                            onChange={(e) => handleItemRowChange(idx, "unitOfMeasure", e.target.value)}
                            className={`w-32 px-2.5 py-1.5 text-xs rounded-xl border cursor-pointer ${
                              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                            }`}
                          >
                            {CULINARY_UOM_GROUPS.map((grp) => (
                              <optgroup key={grp.group} label={grp.group}>
                                {grp.options.map((u) => (
                                  <option key={u.value} value={u.value}>
                                    {u.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>

                          {/* Trim Loss % */}
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="99"
                              placeholder="0% trim"
                              value={row.wastagePercent}
                              onChange={(e) => handleItemRowChange(idx, "wastagePercent", e.target.value)}
                              className={`w-14 px-2 py-1.5 text-xs font-mono rounded-xl border text-center ${
                                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                              }`}
                            />
                            <span className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>% trim</span>
                          </div>

                          {/* Computed Cost */}
                          <span className={`w-20 text-right font-mono font-bold text-xs ${isDark ? "text-white" : "text-slate-900"}`}>
                            ${rowCost.lineTotal.toFixed(2)}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            disabled={formItems.length === 1}
                            className="text-xs text-rose-500 hover:text-rose-600 disabled:opacity-30 cursor-pointer p-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Food Costing & Unit Pricing Matrix Simulator Sheet */}
              <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${
                isDark ? "bg-[#0071E3]/10 border-[#0071E3]/25" : "bg-blue-50/70 border-blue-200"
              }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-[#64B5FF]" : "text-blue-900"}`}>
                      Live Costing & Profit Simulator
                    </span>
                    <p className={`text-[11px] ${isDark ? "text-[#BAC0CD]" : "text-slate-600"}`}>
                      Total Batch Cost: <strong className="font-mono">${calculatedTotalBatchCost.toFixed(2)}</strong> • Food Cost / Portion: <strong className="font-mono">${calculatedCostPerPortion.toFixed(2)}</strong>
                    </p>
                  </div>

                  {formType === "DISH" && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>Target Cost %:</span>
                        <input
                          type="number"
                          min="10"
                          max="90"
                          value={targetFoodCostPercent}
                          onChange={(e) => setTargetFoodCostPercent(e.target.value)}
                          className={`w-14 px-2 py-1 text-xs font-mono text-center rounded-lg border ${
                            isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                          }`}
                        />
                        <span>%</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleApplySuggestedPrice}
                        className="px-3 py-1 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs"
                      >
                        Apply Suggested ${suggestedSellingPrice.toFixed(2)}
                      </button>
                    </div>
                  )}
                </div>

                {/* Live Unit Pricing Matrix Row */}
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Live Unit Pricing Equivalents (Per Yield Portion)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {getUnitPricingMatrix(calculatedCostPerPortion, formYieldUnit as any).map((u) => (
                      <div
                        key={u.unit}
                        className={`px-2.5 py-1 rounded-xl border text-xs flex items-center gap-1.5 ${
                          isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"
                        }`}
                      >
                        <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>{u.label}:</span>
                        <span className={`font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                          {u.formattedPricing}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting ? "Saving & Syncing Matrix..." : "Save Recipe Formula"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ModuleAccessGuard>
  );
}
