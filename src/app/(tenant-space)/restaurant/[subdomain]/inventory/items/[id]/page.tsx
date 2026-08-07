"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

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

const UOM_LABELS: Record<string, string> = {
  KG: "kg", G: "g", L: "L", ML: "ml",
  PIECES: "pcs", DOZEN: "doz", BOX: "box", PACKET: "pkt",
};

export default function InventoryItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params?.id as string;

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
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

  const handleUpdateItem = async () => {
    if (!form.name) { setError("Item name is required"); return; }
    setSubmitting(true); setError("");
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
    if (!confirm(`Archive item "${item?.name}"?`)) return;
    try {
      const res = await fetch(`/api/restaurant/inventory/items/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        router.back();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to archive item");
      }
    } catch {
      setError("Failed to archive item");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">
        Loading item details...
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-red-600 font-semibold">
        {error || "Item not found"}
      </main>
    );
  }

  const unitLabel = UOM_LABELS[item.unitOfMeasure] || item.unitOfMeasure;
  const assetValue = Number(item.currentStock) * Number(item.costPerUnit);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Top Navbar */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 font-semibold transition-colors cursor-pointer text-sm">
            ← Back to Item Master
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {item.name}
              {item.sku && <span className="text-xs text-gray-500 font-mono font-normal">({item.sku})</span>}
            </h1>
            <p className="text-xs text-gray-500">{item.category?.name || "Uncategorized"} • Unit: {item.unitOfMeasure}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEdit(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            Edit Item
          </button>
          <button
            onClick={handleArchive}
            className="px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Archive Item
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl font-semibold">{error}</div>}

        {/* Item Header Banner */}
        <div className="bg-white border-t-4 border-t-indigo-600 border-x border-b border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${item.isLowStock ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                {item.isLowStock ? "[LOW STOCK ALERT]" : "[STOCK HEALTHY]"}
              </span>
              {item.category && <span className="text-xs font-semibold text-gray-600">{item.category.name}</span>}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">{item.name}</h2>
            {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-right space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Total Asset Value</span>
            <span className="text-xl font-extrabold text-gray-900 font-mono">₹{assetValue.toFixed(2)}</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Current Stock</span>
            <p className={`text-2xl font-extrabold font-mono ${item.isLowStock ? "text-amber-600" : "text-emerald-600"}`}>
              {item.currentStock} <span className="text-xs font-normal text-gray-500">{unitLabel}</span>
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Reorder Threshold</span>
            <p className="text-2xl font-extrabold text-gray-900 font-mono">
              {Number(item.reorderPoint)} <span className="text-xs font-normal text-gray-500">{unitLabel}</span>
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Par Level Stock</span>
            <p className="text-2xl font-extrabold text-gray-900 font-mono">
              {Number(item.parLevel)} <span className="text-xs font-normal text-gray-500">{unitLabel}</span>
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Cost Per Unit</span>
            <p className="text-2xl font-extrabold text-gray-900 font-mono">
              ₹{Number(item.costPerUnit).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Stock Ledger History */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Stock Movements & Audit History</h3>
            <span className="text-xs text-gray-400 font-medium">{item.stockLedgers?.length || 0} entries</span>
          </div>

          {(!item.stockLedgers || item.stockLedgers.length === 0) ? (
            <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl text-gray-400 text-xs font-medium">
              No stock movements recorded yet for this item.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3">Movement Type</th>
                    <th className="py-3 px-3 text-right">Quantity Change</th>
                    <th className="py-3 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {item.stockLedgers.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="py-3 px-3 font-mono text-gray-600">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-gray-900 uppercase">{l.changeType}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={l.quantityDelta > 0 ? "text-emerald-600" : "text-red-600"}>
                          {l.quantityDelta > 0 ? `+${l.quantityDelta}` : l.quantityDelta} {unitLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-500">{l.notes || "—"}</td>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-2xl">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Edit Inventory Item</h2>
              <p className="text-xs text-gray-500 mt-0.5">Update item details, parameters, and unit costs</p>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3.5 py-2.5 rounded-xl font-semibold">{error}</div>}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">SKU / Code</label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

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

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Low Stock Threshold</label>
                <input
                  type="number"
                  min={0}
                  value={form.reorderPoint}
                  onChange={(e) => setForm((f) => ({ ...f, reorderPoint: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Target Par Level Stock</label>
                <input
                  type="number"
                  min={0}
                  value={form.parLevel}
                  onChange={(e) => setForm((f) => ({ ...f, parLevel: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Cost Per Unit (₹)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.costPerUnit}
                  onChange={(e) => setForm((f) => ({ ...f, costPerUnit: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">Description (Optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowEdit(false); setError(""); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateItem}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
