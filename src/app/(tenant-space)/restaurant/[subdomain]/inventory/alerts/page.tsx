"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Alert {
  itemId: string;
  outletId: string;
  itemName: string;
  category?: string | null;
  unitOfMeasure: string;
  currentStock: number;
  reorderPoint: number;
  parLevel: number;
  suggestedOrder: number;
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

export default function InventoryAlertsPage() {
  const router = useRouter();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [outletFilter, setOutletFilter] = useState("");
  const [error, setError] = useState("");

  const fetchData = async (outlet = outletFilter) => {
    try {
      const params = new URLSearchParams();
      if (outlet) params.set("outletId", outlet);
      const [resAlerts, resOutlets] = await Promise.all([
        fetch(`/api/restaurant/inventory/alerts?${params}`),
        fetch("/api/restaurant/outlets"),
      ]);
      if (resAlerts.ok) setAlerts((await resAlerts.json()).alerts || []);
      if (resOutlets.ok) setOutlets((await resOutlets.json()).outlets || []);
    } catch {
      setError("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">
        Loading low-stock alerts...
      </main>
    );
  }

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
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              Low-Stock Alerts
              {alerts.length > 0 && (
                <span className="text-xs px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold">
                  {alerts.length} Low
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-500">Items that have fallen below reorder threshold point</p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/inventory/stock`)}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl cursor-pointer transition-all"
        >
          Adjust Stock
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl font-semibold">{error}</div>}

        <div>
          <select
            value={outletFilter}
            onChange={(e) => { setOutletFilter(e.target.value); fetchData(e.target.value); }}
            className="bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-indigo-600 shadow-sm cursor-pointer"
          >
            <option value="">All Outlets</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-gray-300 bg-white rounded-2xl space-y-2">
            <p className="text-emerald-700 font-bold text-xl">All Items Are Well-Stocked</p>
            <p className="text-gray-500 text-xs">No items are currently below their reorder threshold{outletFilter ? " for this outlet" : ""}.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-1">
              <p className="text-amber-900 font-bold text-base">{alerts.length} item{alerts.length !== 1 ? "s" : ""} require restocking</p>
              <p className="text-xs text-amber-700">Review suggested order quantities below and place purchase orders directly with vendors.</p>
            </div>

            {alerts.map((alert, idx) => {
              const uom = UOM_LABELS[alert.unitOfMeasure] ?? alert.unitOfMeasure;
              const deficit = Math.max(0, alert.reorderPoint - alert.currentStock);
              const severityPct = alert.reorderPoint > 0 ? Math.min(100, (alert.currentStock / alert.reorderPoint) * 100) : 0;
              const outletName = outlets.find((o) => o.id === alert.outletId)?.name ?? "Unknown outlet";

              return (
                <div key={idx} className="border border-gray-200 bg-white rounded-2xl p-6 shadow-sm space-y-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 text-lg">{alert.itemName}</h3>
                        {alert.category && <span className="text-[11px] font-semibold text-gray-600 px-2.5 py-0.5 bg-gray-100 border border-gray-200 rounded-full">{alert.category}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Outlet: {outletName}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-3xl font-extrabold text-amber-600 font-mono">{alert.currentStock} <span className="text-sm font-normal text-gray-500">{uom}</span></p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Current Stock</span>
                    </div>
                  </div>

                  {/* Stock Level Visual Bar */}
                  <div className="space-y-1">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${Math.max(4, severityPct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-500 font-mono font-medium pt-1">
                      <span>0</span>
                      <span className="text-amber-700 font-bold">Reorder Threshold: {alert.reorderPoint} {uom}</span>
                      <span>Par Level: {alert.parLevel} {uom}</span>
                    </div>
                  </div>

                  {/* Action & Metric Row */}
                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100 flex-wrap">
                    <div className="flex gap-8">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Deficit</span>
                        <p className="font-bold text-red-600 text-sm font-mono">{deficit} {uom}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Suggested Order Quantity</span>
                        <p className="font-extrabold text-indigo-600 text-base font-mono">{alert.suggestedOrder} {uom}</p>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        router.push(
                          `/inventory/purchase-orders?itemId=${alert.itemId}&suggestedQty=${alert.suggestedOrder}&outletId=${alert.outletId}`
                        )
                      }
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-sm"
                    >
                      Place Purchase Order →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
