"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

const UOM_LABELS: Record<string, string> = {
  KG: "kg", G: "g", L: "L", ML: "ml",
  PIECES: "pcs", DOZEN: "doz", BOX: "box", PACKET: "pkt",
};

export default function InventoryItemsPage() {
  const router = useRouter();

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
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      if (cat) params.set("categoryId", cat);
      const [resItems, resCats] = await Promise.all([
        fetch(`/api/restaurant/inventory/items?${params}`),
        fetch("/api/restaurant/inventory/categories"),
      ]);
      if (resItems.ok) setItems((await resItems.json()).items || []);
      if (resCats.ok) setCategories((await resCats.json()).categories || []);
    } catch { setError("Failed to load items"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSearch = (val: string) => { setSearch(val); fetchData(val, categoryFilter); };
  const handleCategoryFilter = (val: string) => { setCategoryFilter(val); fetchData(search, val); };

  const handleCreate = async () => {
    if (!form.name) { setError("Item name is required"); return; }
    setSubmitting(true); setError("");
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
      setForm({ name: "", sku: "", description: "", categoryId: "", unitOfMeasure: "PIECES", reorderPoint: "", parLevel: "", costPerUnit: "" });
      fetchData();
    } catch (e: any) { setError(e.message || "Failed to create item"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">Loading item master...</main>;

  const lowCount = items.filter((i) => i.isLowStock).length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Top Navbar Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 font-semibold transition-colors cursor-pointer text-sm">
            ← Back
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Inventory Item Master</h1>
            <p className="text-xs text-gray-500">
              {items.length} items total • {lowCount > 0 ? <span className="text-amber-600 font-bold">{lowCount} low stock alerts</span> : "all stock healthy"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
        >
          + New Item
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl font-semibold">{error}</div>}

        {/* Search & Category Filter Controls */}
        <div className="flex gap-3 flex-wrap">
          <input
            placeholder="Search items by name or SKU code..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 min-w-56 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-600 shadow-sm"
          />
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-600 cursor-pointer shadow-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Inventory Items List Table */}
        {items.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-300 rounded-2xl bg-white space-y-2">
            <p className="text-gray-900 font-bold text-lg">No Inventory Items Found</p>
            <p className="text-gray-500 text-xs">Create your first inventory item using the button above.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-3.5 px-4">Item & Code</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4 text-right">Current Stock</th>
                    <th className="py-3.5 px-4 text-right">Reorder Threshold</th>
                    <th className="py-3.5 px-4 text-right">Par Level</th>
                    <th className="py-3.5 px-4 text-right">Cost Per Unit</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/inventory/items/${item.id}`)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-all"
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                        {item.sku && <p className="text-[11px] text-gray-500 font-mono">{item.sku}</p>}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 font-medium">{item.category?.name ?? "—"}</td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span className={`font-bold text-sm ${item.isLowStock ? "text-amber-600" : "text-emerald-600"}`}>
                          {item.currentStock} {UOM_LABELS[item.unitOfMeasure] || item.unitOfMeasure}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-gray-600">{Number(item.reorderPoint)} {UOM_LABELS[item.unitOfMeasure]}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-gray-600">{Number(item.parLevel)} {UOM_LABELS[item.unitOfMeasure]}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-gray-900">₹{Number(item.costPerUnit).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${item.isLowStock ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                          {item.isLowStock ? "[LOW STOCK]" : "[IN STOCK]"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* New Item Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-2xl">
            <div>
              <h2 className="text-xl font-bold text-gray-900">New Inventory Item</h2>
              <p className="text-xs text-gray-500 mt-0.5">Enter item details, stock thresholds, and unit costs</p>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-xl font-semibold">{error}</div>}

            <div className="grid grid-cols-2 gap-4">
              {/* Item Name */}
              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Item Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Tomatoes, Basmati Rice, Milk"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* SKU / Code */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">SKU / Item Code</label>
                <input
                  type="text"
                  placeholder="e.g. ING-001"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Unit of Measure */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Unit of Measure</label>
                <select
                  value={form.unitOfMeasure}
                  onChange={(e) => setForm((f) => ({ ...f, unitOfMeasure: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  {["KG", "G", "L", "ML", "PIECES", "DOZEN", "BOX", "PACKET"].map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">No Category Selected</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Reorder Point */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Low Stock Threshold</label>
                <input
                  type="number"
                  placeholder="e.g. 10"
                  min={0}
                  value={form.reorderPoint}
                  onChange={(e) => setForm((f) => ({ ...f, reorderPoint: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Par Level */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Target Par Stock Level</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  min={0}
                  value={form.parLevel}
                  onChange={(e) => setForm((f) => ({ ...f, parLevel: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Cost Per Unit */}
              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Cost Per Unit (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 45.50"
                  min={0}
                  step="0.01"
                  value={form.costPerUnit}
                  onChange={(e) => setForm((f) => ({ ...f, costPerUnit: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Description */}
              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Additional notes about supplier or storage location..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowCreate(false); setError(""); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {submitting ? "Creating..." : "Create Inventory Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
