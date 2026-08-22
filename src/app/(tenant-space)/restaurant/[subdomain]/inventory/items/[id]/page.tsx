"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface ItemDetail {
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
  stockLedgers?: {
    id: string;
    changeType: string;
    quantityDelta: number;
    notes?: string;
    createdAt: string;
  }[];
}

interface Category {
  id: string;
  name: string;
}

import { getUnitPricingMatrix, formatUnit } from "@/core/inventory/units";

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

export default function InventoryItemDetailPage({
  params,
}: {
  params: Promise<{ subdomain: string; id: string }>;
}) {
  const router = useRouter();
  const { subdomain, id: itemId } = use(params);
  const { isDark } = useTheme();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);

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

  const fetchItemDetail = async () => {
    try {
      const [resItem, resCats] = await Promise.all([
        fetch(`/api/restaurant/inventory/items/${itemId}`),
        fetch("/api/restaurant/inventory/categories"),
      ]);
      const dataItem = await resItem.json();
      if (resItem.ok && dataItem.item) {
        setItem(dataItem.item);
        setForm({
          name: dataItem.item.name || "",
          sku: dataItem.item.sku || "",
          description: dataItem.item.description || "",
          categoryId: dataItem.item.category?.id || "",
          unitOfMeasure: dataItem.item.unitOfMeasure || "PIECES",
          reorderPoint: dataItem.item.reorderPoint?.toString() || "0",
          parLevel: dataItem.item.parLevel?.toString() || "0",
          costPerUnit: dataItem.item.costPerUnit?.toString() || "0",
        });
      } else {
        setError(dataItem.error || "Item not found");
      }

      if (resCats.ok) {
        setCategories((await resCats.json()).categories || []);
      }
    } catch {
      setError("Failed to load item detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (itemId) fetchItemDetail();
  }, [itemId]);

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      setError("Item name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/inventory/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          sku: form.sku || undefined,
          description: form.description || undefined,
          categoryId: form.categoryId || null,
          unitOfMeasure: form.unitOfMeasure,
          reorderPoint: Number(form.reorderPoint) || 0,
          parLevel: Number(form.parLevel) || 0,
          costPerUnit: Number(form.costPerUnit) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowEdit(false);
      fetchItemDetail();
    } catch (e: any) {
      setError(e.message || "Failed to update item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/restaurant/inventory/items/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        router.push(`/restaurant/${subdomain}/inventory/items`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to archive item");
        setArchiving(false);
      }
    } catch {
      setError("Failed to archive item");
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
        <p className="text-xs font-medium">Loading Item Details...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div
        className={`min-h-screen flex flex-col font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Item Details" />
        <main className="max-w-4xl mx-auto p-6 space-y-4">
          <button
            onClick={() => router.push(`/restaurant/${subdomain}/inventory/items`)}
            className="text-xs text-[#0071E3] hover:underline cursor-pointer"
          >
            ← Back to Item Master
          </button>
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error || "Item not found"}
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
      <RestaurantNavbar activeSection="Item Details" />

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
                onClick={() => router.push(`/restaurant/${subdomain}/inventory/items`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← Item Master
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                SKU: {item.sku || "UNASSIGNED"}
              </span>
              {item.isLowStock && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  Low Stock
                </span>
              )}
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {item.name}
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Category: <span className="font-semibold">{item.category?.name || "Uncategorized"}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              Edit Item
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

        {/* Stock & Parameters KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Current Stock
            </span>
            <p className={`text-2xl font-bold tracking-tight mt-1 ${
              item.isLowStock ? "text-amber-500" : isDark ? "text-emerald-400" : "text-emerald-600"
            }`}>
              {item.currentStock}
            </p>
            <p className={`text-[11px] font-mono mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              {formatUnit(item.unitOfMeasure as any)}
            </p>
          </div>

          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Reorder Point
            </span>
            <p className={`text-2xl font-bold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              {item.reorderPoint}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Minimum safe threshold
            </p>
          </div>

          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Par Level
            </span>
            <p className={`text-2xl font-bold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              {item.parLevel}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Target inventory stock
            </p>
          </div>

          <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Unit Cost
            </span>
            <p className={`text-2xl font-bold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              ${Number(item.costPerUnit).toFixed(2)}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Per {formatUnit(item.unitOfMeasure as any)}
            </p>
          </div>
        </div>

        {/* Dedicated Multi-Unit Pricing Equivalents Matrix */}
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
                Live cost converted across standard imperial, metric, and culinary kitchen measurement formats.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {getUnitPricingMatrix(Number(item.costPerUnit), item.unitOfMeasure as any).map((u) => (
              <div
                key={u.unit}
                className={`p-3.5 rounded-2xl border transition flex flex-col justify-between space-y-1 ${
                  u.isPrimary
                    ? isDark
                      ? "bg-[#0071E3]/15 border-[#0071E3]/40"
                      : "bg-blue-50/80 border-blue-300"
                    : isDark
                    ? "bg-[#0A0C12] border-white/[0.06]"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Price per {u.label}
                </span>
                <p className={`text-base font-extrabold font-mono ${
                  u.isPrimary ? "text-[#0071E3]" : isDark ? "text-white" : "text-slate-900"
                }`}>
                  {u.formattedPricing}
                </p>
                {u.description && (
                  <p className={`text-[9px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                    {u.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stock Movement Ledgers History */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
            Stock Movement History
          </h2>

          {!item.stockLedgers || item.stockLedgers.length === 0 ? (
            <div className={`p-8 text-center text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              No stock movements recorded for this item yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                    isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                  }`}>
                    <th className="pb-3 px-3">Date</th>
                    <th className="pb-3 px-3">Movement Type</th>
                    <th className="pb-3 px-3">Quantity Delta</th>
                    <th className="pb-3 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {item.stockLedgers.map((l) => (
                    <tr key={l.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                      <td className={`py-3 px-3 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-white/[0.04] border-white/[0.08]">
                          {l.changeType}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        <span className={l.quantityDelta >= 0 ? "text-emerald-500" : "text-rose-500"}>
                          {l.quantityDelta >= 0 ? `+${l.quantityDelta}` : l.quantityDelta}
                        </span>
                      </td>
                      <td className={`py-3 px-3 ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                        {l.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Edit Item Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Edit Item Specifications</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Update name, SKU, reorder thresholds, and unit costs.
                </p>
              </div>
              <button onClick={() => setShowEdit(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
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
                  onClick={() => setShowEdit(false)}
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
                  {submitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
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
                  Archive Inventory Item
                </h2>
                <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Are you sure you want to archive{" "}
                  <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    {item.name}
                  </span>
                  ? It will no longer appear in active procurement or recipe calculations.
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
                {archiving ? "Archiving..." : "Archive Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
