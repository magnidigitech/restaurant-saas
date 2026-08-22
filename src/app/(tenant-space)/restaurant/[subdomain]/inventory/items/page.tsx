"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface Item {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  unitOfMeasure: string;
  reorderPoint: number;
  parLevel: number;
  costPerUnit: number;
  currentStock: number;
  isLowStock: boolean;
  category?: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

import { formatUnit } from "@/core/inventory/units";

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

export default function InventoryItemsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    categoryId: "",
    unitOfMeasure: "PIECES",
    reorderPoint: "",
    parLevel: "",
    costPerUnit: "",
  });

  const fetchData = async (s = search, cat = categoryFilter) => {
    try {
      const p = new URLSearchParams();
      if (s) p.set("search", s);
      if (cat) p.set("categoryId", cat);
      const [resItems, resCats] = await Promise.all([
        fetch(`/api/restaurant/inventory/items?${p}`),
        fetch("/api/restaurant/inventory/categories"),
      ]);
      if (resItems.ok) setItems((await resItems.json()).items || []);
      if (resCats.ok) setCategories((await resCats.json()).categories || []);
    } catch {
      setError("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    fetchData(val, categoryFilter);
  };

  const handleCategoryFilter = (val: string) => {
    setCategoryFilter(val);
    fetchData(search, val);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError("Item name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          categoryId: form.categoryId || undefined,
          reorderPoint: Number(form.reorderPoint) || 0,
          parLevel: Number(form.parLevel) || 0,
          costPerUnit: Number(form.costPerUnit) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreate(false);
      setForm({
        name: "",
        sku: "",
        description: "",
        categoryId: "",
        unitOfMeasure: "PIECES",
        reorderPoint: "",
        parLevel: "",
        costPerUnit: "",
      });
      fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to create item");
    } finally {
      setSubmitting(false);
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
        <p className="text-xs font-medium">Loading Item Master...</p>
      </div>
    );
  }

  const lowCount = items.filter((i) => i.isLowStock).length;

  return (
    <ModuleAccessGuard moduleKey="inventory" moduleName="Inventory & Stock Control" activeSection="Item Master">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Item Master" />

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
                Catalog & SKUs
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Inventory Item Master
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              {items.length} items total • {lowCount > 0 ? <span className="text-amber-500 font-semibold">{lowCount} low stock alerts</span> : "all inventory healthy"}
            </p>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
          >
            + New Item
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex gap-3 flex-wrap">
          <input
            placeholder="Search items by name or SKU code..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className={`flex-1 min-w-56 px-4 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
              isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          />
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryFilter(e.target.value)}
            className={`px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
              isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Items Table */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          {items.length === 0 ? (
            <div className={`p-12 text-center text-xs space-y-1 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              <p className="font-semibold text-sm">No items found</p>
              <p className="opacity-75">Click &quot;+ New Item&quot; to add ingredients or supplies to your catalog.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                    isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                  }`}>
                    <th className="pb-3 px-3">Item Details</th>
                    <th className="pb-3 px-3">Category</th>
                    <th className="pb-3 px-3">Unit</th>
                    <th className="pb-3 px-3">Current Stock</th>
                    <th className="pb-3 px-3">Reorder Point</th>
                    <th className="pb-3 px-3">Cost / Unit</th>
                    <th className="pb-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {items.map((i) => (
                    <tr
                      key={i.id}
                      onClick={() => router.push(`/restaurant/${subdomain}/inventory/items/${i.id}`)}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition cursor-pointer group"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold block ${isDark ? "text-white" : "text-slate-900"}`}>
                            {i.name}
                          </span>
                          {i.isLowStock && (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.2 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                              Low
                            </span>
                          )}
                        </div>
                        {i.sku && (
                          <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                            SKU: {i.sku}
                          </span>
                        )}
                      </td>
                      <td className={`py-3 px-3 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        {i.category?.name ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${
                            isDark ? "bg-white/[0.04] text-[#BAC0CD] border-white/[0.08]" : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {i.category.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={`py-3 px-3 font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        {formatUnit(i.unitOfMeasure as any)}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`font-bold ${
                          i.isLowStock ? "text-amber-500" : isDark ? "text-emerald-400" : "text-emerald-600"
                        }`}>
                          {i.currentStock}
                        </span>
                      </td>
                      <td className={`py-3 px-3 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        {i.reorderPoint}
                      </td>
                      <td className={`py-3 px-3 font-mono ${isDark ? "text-white" : "text-slate-900"}`}>
                        ${Number(i.costPerUnit).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-[#0071E3] font-medium group-hover:underline text-xs">
                          View →
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* New Item Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Add New Inventory Item</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Define catalog item specifications, reorder limits, and cost structure.
                </p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Saffron / Rice"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    SKU Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ING-001"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Category
                  </label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition cursor-pointer ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Unit of Measure *
                  </label>
                  <select
                    value={form.unitOfMeasure}
                    onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition cursor-pointer ${
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
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Reorder Point
                  </label>
                  <input
                    type="number"
                    value={form.reorderPoint}
                    onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Par Level
                  </label>
                  <input
                    type="number"
                    value={form.parLevel}
                    onChange={(e) => setForm({ ...form, parLevel: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Cost / Unit ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.costPerUnit}
                    onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Item"}
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
