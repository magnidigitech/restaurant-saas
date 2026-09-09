"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import { ArrowLeft, AlertTriangle, ShieldCheck } from "lucide-react";

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
          className={`p-4 sm:p-5 rounded-2xl border transition relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 ${
            isDark
              ? "bg-gradient-to-br from-[#121829] via-[#0E1320] to-[#0A0D14] border-white/[0.08] shadow-xl shadow-black/20"
              : "bg-gradient-to-br from-blue-50/80 via-indigo-50/25 to-white border-blue-100/80 shadow-sm shadow-blue-500/5"
          }`}
        >
          {/* Ambient Glow Orbs */}
          <div className="absolute -right-16 -top-16 w-72 h-72 bg-amber-500/10 dark:bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-1/3 -bottom-16 w-60 h-60 bg-rose-500/10 dark:bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Left: Nav & Title */}
          <div className="relative z-10 space-y-2 sm:space-y-2.5 w-full md:w-auto min-w-0">
            <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/inventory`)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                  isDark
                    ? "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs"
                }`}
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Inventory</span>
              </button>
              <span className="hidden sm:inline text-slate-300 dark:text-white/20">•</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                alerts.length > 0
                  ? isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/25" : "bg-amber-100 text-amber-800 border-amber-200"
                  : isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${alerts.length > 0 ? "bg-amber-500" : "bg-emerald-500"}`} />
                <span>Deficit Control</span>
              </span>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-md shrink-0 border border-white/20 text-white ${
                alerts.length > 0
                  ? "bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 shadow-amber-500/20"
                  : "bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 shadow-emerald-500/20"
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className={`text-base sm:text-xl font-extrabold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                  Low-Stock Deficit Alerts
                </h1>
                <p className={`text-[10px] sm:text-xs mt-0.5 truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Items that have fallen below minimum safe reorder thresholds across branch outlets.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Actions & Status Capsule */}
          <div className="relative z-10 flex flex-wrap items-center gap-2.5 shrink-0">
            <div className={`hidden lg:flex p-2.5 px-3 rounded-xl border items-center gap-2.5 ${
              isDark
                ? "bg-[#141A29]/80 border-white/[0.08] shadow-sm"
                : "bg-white/90 backdrop-blur-xs border-slate-200/80 shadow-xs"
            }`}>
              <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                alerts.length > 0
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              }`}>
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full animate-pulse ${alerts.length > 0 ? "bg-amber-500" : "bg-emerald-500"}`} />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {alerts.length > 0 ? `${alerts.length} Deficits` : "All Healthy"}
                  </span>
                </div>
                <span className={`text-[10px] font-medium block mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Reorder Thresholds Active
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/inventory/purchase-orders`)}
                className="px-3.5 py-1.5 sm:py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer whitespace-nowrap"
              >
                + Requisition PO
              </button>
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/inventory/stock`)}
                className={`px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                  isDark
                    ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                    : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-xs"
                }`}
              >
                Adjust Stock
              </button>
            </div>
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
