"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface StockEntry {
  itemId: string;
  outletId: string;
  itemName: string;
  category?: string | null;
  unitOfMeasure: string;
  reorderPoint: number;
  parLevel: number;
  currentStock: number;
  isLowStock: boolean;
}

interface Outlet {
  id: string;
  name: string;
}

const UOM_LABELS: Record<string, string> = {
  KG: "kg",
  G: "g",
  L: "L",
  ML: "ml",
  PIECES: "pcs",
  DOZEN: "doz",
  BOX: "box",
  PACKET: "pkt",
};

const MOVEMENT_TYPES = ["PURCHASE", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT", "CONSUMPTION", "RETURN"];

export default function InventoryStockPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [stock, setStock] = useState<StockEntry[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [outletFilter, setOutletFilter] = useState("");
  const [error, setError] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);
  const [showWastage, setShowWastage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [adjForm, setAdjForm] = useState({ outletId: "", itemId: "", movementType: "PURCHASE", quantity: 0, notes: "" });
  const [wastageForm, setWastageForm] = useState({ outletId: "", itemId: "", quantity: 1, reason: "EXPIRED", notes: "" });
  const [selectedStockForWastage, setSelectedStockForWastage] = useState<StockEntry | null>(null);
  const [selectedStockForAdjust, setSelectedStockForAdjust] = useState<StockEntry | null>(null);

  const fetchData = async (outlet = outletFilter) => {
    try {
      const p = new URLSearchParams();
      if (outlet) p.set("outletId", outlet);
      const [resStock, resOutlets, resItems] = await Promise.all([
        fetch(`/api/restaurant/inventory/stock?${p}`),
        fetch("/api/restaurant/outlets"),
        fetch("/api/restaurant/inventory/items"),
      ]);
      if (resStock.ok) setStock((await resStock.json()).stock || []);
      if (resOutlets.ok) setOutlets((await resOutlets.json()).outlets || []);
      if (resItems.ok) setItems((await resItems.json()).items || []);
    } catch {
      setError("Failed to load stock data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openGeneralAdjust = () => {
    setSelectedStockForAdjust(null);
    setAdjForm({
      outletId: outletFilter || (outlets[0]?.id ?? ""),
      itemId: items[0]?.id ?? "",
      movementType: "ADJUSTMENT",
      quantity: 0,
      notes: "",
    });
    setError("");
    setShowAdjust(true);
  };

  const openItemAdjust = (s: StockEntry) => {
    setSelectedStockForAdjust(s);
    setAdjForm({
      outletId: s.outletId,
      itemId: s.itemId,
      movementType: "ADJUSTMENT",
      quantity: 0,
      notes: "",
    });
    setError("");
    setShowAdjust(true);
  };

  const openGeneralWastage = () => {
    setSelectedStockForWastage(null);
    setWastageForm({
      outletId: outletFilter || (outlets[0]?.id ?? ""),
      itemId: items[0]?.id ?? "",
      quantity: 1,
      reason: "EXPIRED",
      notes: "",
    });
    setError("");
    setShowWastage(true);
  };

  const openItemWastage = (s: StockEntry) => {
    setSelectedStockForWastage(s);
    setWastageForm({
      outletId: s.outletId,
      itemId: s.itemId,
      quantity: 1,
      reason: "EXPIRED",
      notes: "",
    });
    setError("");
    setShowWastage(true);
  };

  const handleAdjust = async () => {
    if (!adjForm.outletId || !adjForm.itemId) {
      setError("Outlet and item are required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...adjForm, quantity: Number(adjForm.quantity) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowAdjust(false);
      setSelectedStockForAdjust(null);
      setAdjForm({ outletId: "", itemId: "", movementType: "PURCHASE", quantity: 0, notes: "" });
      fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to record movement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWastage = async () => {
    if (!wastageForm.outletId || !wastageForm.itemId || !wastageForm.quantity) {
      setError("All fields are required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/wastage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...wastageForm, quantity: Number(wastageForm.quantity) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowWastage(false);
      setSelectedStockForWastage(null);
      setWastageForm({ outletId: "", itemId: "", quantity: 1, reason: "EXPIRED", notes: "" });
      fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to record wastage");
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
        <p className="text-xs font-medium">Loading Stock Ledger...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Stock Management" />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Executive Header */}
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
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Real-Time Stock Levels
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Stock Inventory Ledger
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Track real-time ingredient quantities, reorder points, and threshold deficits per branch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openGeneralAdjust}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              + Adjust Stock
            </button>
            <button
              onClick={openGeneralWastage}
              className={`px-4 py-2 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                isDark
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                  : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Log Wastage</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <select
            value={outletFilter}
            onChange={(e) => {
              setOutletFilter(e.target.value);
              fetchData(e.target.value);
            }}
            className={`px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
              isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <option value="">All Outlets (Consolidated)</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stock Items Grid */}
        {stock.length === 0 ? (
          <div
            className={`p-12 text-center rounded-3xl border text-xs space-y-2 ${
              isDark ? "bg-[#121622]/40 border-white/[0.06] text-[#8F95A3]" : "bg-white border-slate-200 text-slate-500 shadow-xs"
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto text-[#8F95A3]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="font-semibold text-sm">No stock records found</p>
            <p className="opacity-75">Record your first stock movement or receive a purchase order to populate the stock ledger.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stock.map((s, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-3xl border transition space-y-3 flex flex-col justify-between ${
                  s.isLowStock
                    ? isDark
                      ? "bg-amber-500/[0.04] border-amber-500/30"
                      : "bg-amber-50/40 border-amber-200 shadow-xs"
                    : isDark
                    ? "bg-[#121622]/60 border-white/[0.06]"
                    : "bg-white border-slate-200/80 shadow-xs"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {s.isLowStock && (
                          <span className="text-[9px] font-bold uppercase px-2 py-0.2 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            Low Stock
                          </span>
                        )}
                        <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                          {s.itemName}
                        </h3>
                      </div>
                      <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        {outlets.find((o) => o.id === s.outletId)?.name ?? "Global Branch"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className={`text-2xl font-black ${
                        s.isLowStock ? "text-amber-500" : isDark ? "text-emerald-400" : "text-emerald-600"
                      }`}>
                        {s.currentStock}
                      </p>
                      <p className={`text-[11px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        {UOM_LABELS[s.unitOfMeasure] ?? s.unitOfMeasure}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`pt-3 border-t text-[11px] flex justify-between items-center ${
                  isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-100 text-slate-500"
                }`}>
                  <div className="space-x-3">
                    <span>Reorder: <strong className={isDark ? "text-white" : "text-slate-900"}>{s.reorderPoint}</strong></span>
                    <span>Par: <strong className={isDark ? "text-white" : "text-slate-900"}>{s.parLevel}</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="Log Wastage for this item"
                      onClick={() => openItemWastage(s)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${
                        isDark
                          ? "bg-rose-500/10 border-rose-500/25 text-rose-400 hover:bg-rose-500/20 active:scale-95"
                          : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 active:scale-95"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Log Waste</span>
                    </button>

                    <button
                      type="button"
                      title="Adjust Stock"
                      onClick={() => openItemAdjust(s)}
                      className={`p-1.5 rounded-xl border transition cursor-pointer ${
                        isDark
                          ? "bg-white/[0.04] border-white/[0.08] text-[#8F95A3] hover:text-white hover:bg-white/[0.08] active:scale-95"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-95"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Adjust Stock Modal */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold">Record Stock Movement</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Audit, cycle count, or adjust physical on-hand quantity.
                </p>
              </div>
              <button onClick={() => setShowAdjust(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            {selectedStockForAdjust && (
              <div className={`p-3.5 rounded-2xl border ${
                isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0071E3] block">
                      Target Item
                    </span>
                    <p className="text-sm font-bold">{selectedStockForAdjust.itemName}</p>
                    <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      {outlets.find((o) => o.id === selectedStockForAdjust.outletId)?.name || "Branch Outlet"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8F95A3] block">
                      On Hand
                    </span>
                    <span className="text-sm font-mono font-bold">
                      {selectedStockForAdjust.currentStock} {UOM_LABELS[selectedStockForAdjust.unitOfMeasure] ?? selectedStockForAdjust.unitOfMeasure}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {!selectedStockForAdjust && (
                <>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Branch Outlet *
                    </label>
                    <select
                      value={adjForm.outletId}
                      onChange={(e) => setAdjForm({ ...adjForm, outletId: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="">Select Outlet...</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Inventory Item *
                    </label>
                    <select
                      value={adjForm.itemId}
                      onChange={(e) => setAdjForm({ ...adjForm, itemId: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="">Select Item...</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Movement Type
                  </label>
                  <select
                    value={adjForm.movementType}
                    onChange={(e) => setAdjForm({ ...adjForm, movementType: e.target.value })}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition cursor-pointer ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    {MOVEMENT_TYPES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Quantity Delta (+ / -) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={adjForm.quantity}
                    onChange={(e) => setAdjForm({ ...adjForm, quantity: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3.5 py-2 text-xs font-mono rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Notes / Audit Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly physical stock count variance"
                  value={adjForm.notes}
                  onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowAdjust(false)}
                className={`px-4 py-2 rounded-xl text-xs font-medium ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdjust}
                disabled={submitting}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Saving..." : "Record Adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Wastage Modal */}
      {showWastage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-rose-500">Log Wastage / Spoilage</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Record discarded food, prep loss, or expired items.
                </p>
              </div>
              <button onClick={() => setShowWastage(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            {/* Quick Context Card when triggered per-item */}
            {selectedStockForWastage && (
              <div className={`p-4 rounded-2xl border ${
                isDark ? "bg-rose-500/[0.06] border-rose-500/20" : "bg-rose-50/60 border-rose-200"
              }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">
                      Target Ingredient
                    </span>
                    <p className="text-sm font-bold">{selectedStockForWastage.itemName}</p>
                    <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      {outlets.find((o) => o.id === selectedStockForWastage.outletId)?.name || "Branch Outlet"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8F95A3] block">
                      In Stock
                    </span>
                    <span className="text-sm font-mono font-bold">
                      {selectedStockForWastage.currentStock} {UOM_LABELS[selectedStockForWastage.unitOfMeasure] ?? selectedStockForWastage.unitOfMeasure}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {!selectedStockForWastage && (
                <>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Branch Outlet *
                    </label>
                    <select
                      value={wastageForm.outletId}
                      onChange={(e) => setWastageForm({ ...wastageForm, outletId: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="">Select Outlet...</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Item *
                    </label>
                    <select
                      value={wastageForm.itemId}
                      onChange={(e) => setWastageForm({ ...wastageForm, itemId: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="">Select Item...</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Quantity Lost * {selectedStockForWastage ? `(${UOM_LABELS[selectedStockForWastage.unitOfMeasure] ?? selectedStockForWastage.unitOfMeasure})` : ""}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={wastageForm.quantity}
                    onChange={(e) => setWastageForm({ ...wastageForm, quantity: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Reason *
                  </label>
                  <select
                    value={wastageForm.reason}
                    onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition cursor-pointer ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="DAMAGED">DAMAGED</option>
                    <option value="SPILLAGE">SPILLAGE</option>
                    <option value="THEFT">THEFT</option>
                    <option value="OVERPRODUCTION">OVERPRODUCTION</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Notes / Explanation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Broken packaging or dropped container"
                  value={wastageForm.notes}
                  onChange={(e) => setWastageForm({ ...wastageForm, notes: e.target.value })}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowWastage(false)}
                className={`px-4 py-2 rounded-xl text-xs font-medium ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWastage}
                disabled={submitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50 cursor-pointer shadow-sm shadow-rose-600/20"
              >
                {submitting ? "Logging..." : "Log Wastage"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
