"use client";

import React, { useState } from "react";

export default function MultiOutletZoomSection() {
  const [scaleTier, setScaleTier] = useState<"1" | "5" | "25" | "100">("5");

  const tiers = {
    "1": {
      name: "1 Outlet",
      badge: "Flagship Precision",
      headline: "Local Kitchen Sovereignty",
      desc: "Instant live table occupancy, line cook pacing, recipe BOM depletion down to the gram, and daily cashier cash-drawer settlement.",
      nodes: [
        { name: "Downtown Flagship", revenue: "₹1,42,800 / day", status: "Active Rush", lat: "50%", lng: "50%" },
      ],
      kpis: [
        { label: "Active Floor Tables", value: "32" },
        { label: "Food Cost Variance", value: "<1.1%" },
        { label: "Average Ticket Time", value: "11 min" },
      ],
    },
    "5": {
      name: "5 Outlets",
      badge: "Regional Group",
      headline: "Regional Store Transfers & Unified Menu",
      desc: "Synchronize menu engineering across city branches. Balance stock deficits by transferring ingredients between nearby outlets before dinner rushes.",
      nodes: [
        { name: "Connaught Place", revenue: "₹1,85,400", status: "Optimal", lat: "38%", lng: "44%" },
        { name: "Cyber Hub", revenue: "₹2,10,200", status: "Peak Rush", lat: "52%", lng: "56%" },
        { name: "Indiranagar", revenue: "₹1,64,000", status: "Optimal", lat: "62%", lng: "48%" },
        { name: "Bandra West", revenue: "₹1,94,800", status: "Active Rush", lat: "45%", lng: "36%" },
        { name: "Koramangala", revenue: "₹1,72,500", status: "Optimal", lat: "58%", lng: "62%" },
      ],
      kpis: [
        { label: "Combined Revenue / Day", value: "₹9,26,900" },
        { label: "Active Outlets Online", value: "5 / 5" },
        { label: "Inter-Store Transfers", value: "14 Today" },
      ],
    },
    "25": {
      name: "25 Outlets",
      badge: "Franchise Scale",
      headline: "Central Commissary & Bulk Vendor Power",
      desc: "Aggregate raw material purchasing across 25 locations to negotiate lower vendor tier pricing. Central kitchen preps base gravies with identical consistency.",
      nodes: [
        { name: "North Region (9 Outlets)", revenue: "₹14.2L / day", status: "Active", lat: "35%", lng: "48%" },
        { name: "West Region (8 Outlets)", revenue: "₹12.8L / day", status: "Active", lat: "48%", lng: "32%" },
        { name: "South Region (8 Outlets)", revenue: "₹13.5L / day", status: "Active", lat: "65%", lng: "54%" },
      ],
      kpis: [
        { label: "Network Orders / Day", value: "18,400+" },
        { label: "Procurement Savings", value: "22.4%" },
        { label: "Recipe Uniformity", value: "99.8%" },
      ],
    },
    "100": {
      name: "100+ Outlets",
      badge: "Enterprise Brand",
      headline: "Global Brand Governance & Real-Time Telemetry",
      desc: "Complete executive visibility into nationwide sales velocity, localized tax compliance, franchisee royalty calculations, and supply chain lead times.",
      nodes: [
        { name: "Tier 1 Metros (54 Outlets)", revenue: "₹82.4L / day", status: "Operational", lat: "46%", lng: "48%" },
        { name: "Tier 2 Growth (38 Outlets)", revenue: "₹46.1L / day", status: "Operational", lat: "55%", lng: "58%" },
        { name: "Airport Concessions (12 Outlets)", revenue: "₹24.8L / day", status: "High Velocity", lat: "38%", lng: "38%" },
      ],
      kpis: [
        { label: "Monthly Gross Volume", value: "₹45+ Cr" },
        { label: "Franchise Compliance", value: "100%" },
        { label: "Global Shrinkage", value: "<0.8%" },
      ],
    },
  };

  const currentTier = tiers[scaleTier];

  return (
    <section className="py-28 bg-[#080909] text-white border-t border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono uppercase tracking-widest text-amber-400 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Multi-Unit Architecture</span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.08] text-white mb-3">
            One bird&apos;s-eye view. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">
              Every outlet.
            </span>
          </h2>

          <p className="text-stone-400 text-sm sm:text-base font-normal leading-relaxed">
            Whether you manage one high-volume dining hall or a 100-unit national franchise, Resto Bird scales your operational intelligence seamlessly.
          </p>
        </div>

        {/* Altitude Switcher Bar */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl glass-panel-dark border border-white/10 max-w-xl mb-12">
          {(
            [
              { id: "1", label: "1 Outlet" },
              { id: "5", label: "5 Outlets" },
              { id: "25", label: "25 Outlets" },
              { id: "100", label: "100+ Outlets" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setScaleTier(t.id)}
              className={`flex-1 min-w-[110px] py-2.5 px-4 rounded-xl text-center font-mono text-xs uppercase tracking-wider transition-all ${
                scaleTier === t.id
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold"
                  : "text-stone-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scale Display Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-3xl glass-panel-dark p-6 sm:p-10 border border-white/10">
          {/* Left Details */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs font-mono uppercase">
              <span>{currentTier.badge}</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold font-mono text-white">
              {currentTier.headline}
            </h3>

            <p className="text-stone-300 text-sm sm:text-base leading-relaxed">
              {currentTier.desc}
            </p>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10 font-mono">
              {currentTier.kpis.map((kpi, idx) => (
                <div key={idx}>
                  <div className="text-stone-400 text-[10px] uppercase tracking-wider">
                    {kpi.label}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Radar Map Network Simulation */}
          <div className="lg:col-span-6 relative aspect-[16/10] rounded-2xl bg-stone-950 border border-white/10 overflow-hidden p-6 flex flex-col justify-between">
            {/* Grid background */}
            <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-stone-950/40" />

            {/* Simulated Geographic Nodes */}
            {currentTier.nodes.map((node, i) => (
              <div
                key={i}
                className="absolute z-10 transition-all duration-700"
                style={{ top: node.lat, left: node.lng }}
              >
                <div className="relative group -translate-x-1/2 -translate-y-1/2">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-400 block ring-4 ring-amber-400/20 animate-pulse" />
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 py-1 rounded-lg glass-panel-dark border border-white/10 text-[10px] font-mono text-white shadow-xl">
                    <div className="font-bold">{node.name}</div>
                    <div className="text-amber-400">{node.revenue} • {node.status}</div>
                  </div>
                </div>
              </div>
            ))}

            {/* Radar Sweep HUD Header */}
            <div className="relative z-20 flex items-center justify-between text-[11px] font-mono text-stone-400">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>RESTO BIRD GLOBAL RADAR</span>
              </div>
              <span className="text-amber-400">ALTITUDE: TIER {scaleTier}</span>
            </div>

            {/* Footer telemetry */}
            <div className="relative z-20 flex items-center justify-between text-[10px] font-mono text-stone-500 pt-4 border-t border-white/5">
              <span>LATENCY: 42ms REAL-TIME</span>
              <span>SYNCHRONIZED: 100%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
