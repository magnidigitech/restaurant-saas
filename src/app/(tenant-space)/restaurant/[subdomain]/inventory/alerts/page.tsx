"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

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
  KG: "kg",
  G: "g",
  L: "L",
  ML: "ml",
  PIECES: "pcs",
  DOZEN: "doz",
  BOX: "box",
  PACKET: "pkt",
};

export default function InventoryAlertsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [outletFilter, setOutletFilter] = useState("");
  const [error, setError] = useState("");

  const fetchData = async (outlet = outletFilter) => {
    try {
      const p = new URLSearchParams();
      if (outlet) p.set("outletId", outlet);
      const [resAlerts, resOutlets] = await Promise.all([
        fetch(`/api/restaurant/inventory/alerts?${p}`),
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
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Stock Alerts...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Low Stock Alerts" />

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
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                alerts.length > 0
                  ? isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/25" : "bg-amber-100 text-amber-800 border-amber-200"
                  : isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
              }`}>
                {alerts.length > 0 ? `${alerts.length} Deficits Detected` : "All Healthy"}
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Low-Stock Deficit Alerts
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Items that have fallen below minimum safe reorder thresholds across your branch outlets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/inventory/purchase-orders`)}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              + Create Requisition PO
            </button>
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/inventory/stock`)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                  : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-xs"
              }`}
            >
              Adjust Stock
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

        {/* Alerts Grid */}
        {alerts.length === 0 ? (
          <div
            className={`p-12 text-center rounded-3xl border text-xs space-y-2 ${
              isDark ? "bg-[#121622]/40 border-white/[0.06] text-[#8F95A3]" : "bg-white border-slate-200 text-slate-500 shadow-xs"
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-sm">All Inventory Stock Levels Are Optimal</p>
            <p className="opacity-75">No catalog items have fallen below their configured reorder thresholds.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((a, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-3xl border transition space-y-4 flex flex-col justify-between ${
                  isDark ? "bg-amber-500/[0.04] border-amber-500/30" : "bg-amber-50/40 border-amber-200 shadow-xs"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-bold uppercase px-2 py-0.2 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                        Deficit Alert
                      </span>
                      <h3 className={`text-base font-bold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                        {a.itemName}
                      </h3>
                      <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        {outlets.find((o) => o.id === a.outletId)?.name ?? "Branch Location"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-black text-amber-500">
                        {a.currentStock}
                      </p>
                      <p className={`text-[11px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        {UOM_LABELS[a.unitOfMeasure] ?? a.unitOfMeasure}
                      </p>
                    </div>
                  </div>

                  <div className={`p-3 rounded-2xl border text-xs space-y-1 ${
                    isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-white border-slate-200"
                  }`}>
                    <div className="flex justify-between">
                      <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Reorder Threshold:</span>
                      <span className="font-semibold">{a.reorderPoint}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Target Par Level:</span>
                      <span className="font-semibold">{a.parLevel}</span>
                    </div>
                    <div className="flex justify-between text-[#0071E3] font-bold pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                      <span>Suggested Order:</span>
                      <span>+{a.suggestedOrder} {UOM_LABELS[a.unitOfMeasure] ?? a.unitOfMeasure}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/restaurant/${subdomain}/inventory/purchase-orders`)}
                  className="w-full py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs"
                >
                  Order Restock →
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
