"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

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
  KG: "kg", G: "g", L: "L", ML: "ml",
  PIECES: "pcs", DOZEN: "doz", BOX: "box", PACKET: "pkt",
};

const MOVEMENT_TYPES = ["PURCHASE", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT", "CONSUMPTION", "RETURN"];

export default function InventoryStockPage() {
  const router = useRouter();

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
  const [wastageForm, setWastageForm] = useState({ outletId: "", itemId: "", quantity: 0, reason: "EXPIRED", notes: "" });

  const fetchData = async (outlet = outletFilter) => {
    try {
      const params = new URLSearchParams();
      if (outlet) params.set("outletId", outlet);
      const [resStock, resOutlets, resItems] = await Promise.all([
        fetch(`/api/restaurant/inventory/stock?${params}`),
        fetch("/api/restaurant/outlets"),
        fetch("/api/restaurant/inventory/items"),
      ]);
      if (resStock.ok) setStock((await resStock.json()).stock || []);
      if (resOutlets.ok) setOutlets((await resOutlets.json()).outlets || []);
      if (resItems.ok) setItems((await resItems.json()).items || []);
    } catch { setError("Failed to load stock data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdjust = async () => {
    if (!adjForm.outletId || !adjForm.itemId) { setError("Outlet and item are required"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...adjForm, quantity: Number(adjForm.quantity) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowAdjust(false);
      setAdjForm({ outletId: "", itemId: "", movementType: "PURCHASE", quantity: 0, notes: "" });
      fetchData();
    } catch (e: any) { setError(e.message || "Failed to record movement"); }
    finally { setSubmitting(false); }
  };

  const handleWastage = async () => {
    if (!wastageForm.outletId || !wastageForm.itemId || !wastageForm.quantity) { setError("All fields are required"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/restaurant/inventory/wastage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...wastageForm, quantity: Number(wastageForm.quantity) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowWastage(false);
      setWastageForm({ outletId: "", itemId: "", quantity: 0, reason: "EXPIRED", notes: "" });
      fetchData();
    } catch (e: any) { setError(e.message || "Failed to record wastage"); }
    finally { setSubmitting(false); }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading stock...</main>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white cursor-pointer">← Back</button>
          <div>
            <h1 className="text-xl font-bold text-white">Stock Management</h1>
            <p className="text-xs text-slate-500">Real-time stock levels per outlet</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdjust(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg cursor-pointer transition-all">+ Adjust Stock</button>
          <button onClick={() => setShowWastage(true)} className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-200 text-sm font-semibold rounded-lg cursor-pointer transition-all">Log Wastage</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg">{error}</div>}

        <div className="flex gap-3">
          <select value={outletFilter} onChange={(e) => { setOutletFilter(e.target.value); fetchData(e.target.value); }}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="">All Outlets</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        {stock.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-slate-400 font-semibold">No stock data yet</p>
            <p className="text-slate-600 text-sm mt-1">Record your first stock movement to see stock levels here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stock.map((s, idx) => {
              const pct = s.parLevel > 0 ? Math.min(100, (s.currentStock / s.parLevel) * 100) : 100;
              return (
                <div key={idx} className={`border rounded-2xl p-5 ${s.isLowStock ? "border-amber-900/50 bg-amber-950/10" : "border-slate-800 bg-slate-900/20"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {s.isLowStock && <span className="text-amber-400 text-sm">⚠️</span>}
                        <h3 className="font-bold text-white">{s.itemName}</h3>
                        {s.category && <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-800 rounded-full">{s.category}</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Outlet · {outlets.find((o) => o.id === s.outletId)?.name ?? s.outletId}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-extrabold ${s.isLowStock ? "text-amber-400" : "text-emerald-400"}`}>
                        {s.currentStock}
                      </p>
                      <p className="text-xs text-slate-500">{UOM_LABELS[s.unitOfMeasure] ?? s.unitOfMeasure}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Reorder: {s.reorderPoint}</span>
                      <span>Par: {s.parLevel}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct < 30 ? "bg-red-500" : pct < 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Adjust Stock Modal */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold text-white">Record Stock Movement</h2>
            {error && <div className="bg-red-950/50 border border-red-800 text-red-200 text-xs px-3 py-2 rounded-lg">{error}</div>}
            <div className="space-y-3">
              <select value={adjForm.outletId} onChange={(e) => setAdjForm((f) => ({ ...f, outletId: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="">Select outlet...</option>
                {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <select value={adjForm.itemId} onChange={(e) => setAdjForm((f) => ({ ...f, itemId: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <select value={adjForm.movementType} onChange={(e) => setAdjForm((f) => ({ ...f, movementType: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                {MOVEMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input type="number" placeholder="Quantity (use negative for outgoing)" value={adjForm.quantity}
                onChange={(e) => setAdjForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
              <input placeholder="Notes (optional)" value={adjForm.notes} onChange={(e) => setAdjForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowAdjust(false); setError(""); }} className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 text-sm hover:text-white cursor-pointer">Cancel</button>
              <button onClick={handleAdjust} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">{submitting ? "Saving..." : "Record Movement"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Wastage Modal */}
      {showWastage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold text-white">🗑 Log Wastage</h2>
            {error && <div className="bg-red-950/50 border border-red-800 text-red-200 text-xs px-3 py-2 rounded-lg">{error}</div>}
            <div className="space-y-3">
              <select value={wastageForm.outletId} onChange={(e) => setWastageForm((f) => ({ ...f, outletId: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500">
                <option value="">Select outlet...</option>
                {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <select value={wastageForm.itemId} onChange={(e) => setWastageForm((f) => ({ ...f, itemId: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500">
                <option value="">Select item...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input type="number" placeholder="Quantity wasted" min={0.01} step={0.01} value={wastageForm.quantity}
                onChange={(e) => setWastageForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500" />
              <select value={wastageForm.reason} onChange={(e) => setWastageForm((f) => ({ ...f, reason: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500">
                {["EXPIRED", "DAMAGED", "SPILLAGE", "THEFT", "OVERPRODUCTION", "OTHER"].map((r) => <option key={r}>{r}</option>)}
              </select>
              <input placeholder="Notes (optional)" value={wastageForm.notes} onChange={(e) => setWastageForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowWastage(false); setError(""); }} className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 text-sm hover:text-white cursor-pointer">Cancel</button>
              <button onClick={handleWastage} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50">{submitting ? "Logging..." : "Log Wastage"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
