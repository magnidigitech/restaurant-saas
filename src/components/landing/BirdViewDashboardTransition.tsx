"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function BirdViewDashboardTransition() {
  const [viewMode, setViewMode] = useState<"physical" | "intelligence">("intelligence");

  return (
    <section id="dashboard" className="py-28 lg:py-36 bg-[#080909] text-white border-t border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono uppercase tracking-widest text-amber-400 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>The Platform Transition</span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.06] text-white mb-2">
            From restaurant <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">
              to intelligence.
            </span>
          </h2>

          <p className="text-stone-400 text-sm sm:text-base font-normal leading-relaxed mt-4">
            Resto Bird lifts the physical complexity of dining rooms, kitchen lines, and storage rooms into a single, cohesive operating software console.
          </p>
        </div>

        {/* View Switcher Toggle */}
        <div className="flex items-center justify-center mb-10">
          <div className="p-1 rounded-2xl glass-panel-dark border border-white/10 flex items-center space-x-1">
            <button
              onClick={() => setViewMode("physical")}
              className={`px-5 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all ${
                viewMode === "physical"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              1. Physical Restaurant Floor
            </button>
            <div className="text-stone-600 font-mono text-xs px-1">→</div>
            <button
              onClick={() => setViewMode("intelligence")}
              className={`px-5 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all ${
                viewMode === "intelligence"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold"
                  : "text-stone-400 hover:text-white"
              }`}
            >
              2. Resto Bird Intelligence Console
            </button>
          </div>
        </div>

        {/* Main Showcase Canvas */}
        <div className="relative rounded-3xl glass-panel-dark border border-white/10 p-4 sm:p-8 overflow-hidden shadow-2xl">
          {viewMode === "physical" ? (
            /* Physical 3D Architectural View */
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-white/10 bg-stone-950">
              <Image
                src="/images/resto-bird/scene-hero.jpg"
                alt="Physical Restaurant Architecture"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080909] via-transparent to-transparent opacity-60" />

              {/* Spatial labels */}
              <div className="absolute top-8 left-8 p-4 rounded-xl glass-panel-dark border border-white/15 max-w-xs">
                <div className="text-xs font-mono text-amber-400 font-bold uppercase mb-1">
                  Physical Floor Reality
                </div>
                <div className="text-[11px] text-stone-300">
                  Guest dining tables, host stand, and open service lines.
                </div>
              </div>

              <div className="absolute bottom-8 right-8 p-4 rounded-xl glass-panel-dark border border-white/15">
                <button
                  onClick={() => setViewMode("intelligence")}
                  className="px-4 py-2 bg-amber-500 text-stone-950 font-mono font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-amber-400 transition-all flex items-center space-x-2"
                >
                  <span>Activate Intelligence Layer</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          ) : (
            /* The Live Intelligence Console Dashboard */
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-white/10 bg-stone-950">
              <Image
                src="/images/resto-bird/scene-dining.jpg"
                alt="Resto Bird Intelligence Console"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080909] via-transparent to-transparent opacity-40" />

              {/* Live Overlay HUD Pills */}
              <div className="absolute top-6 left-6 flex items-center space-x-2 px-3 py-1.5 rounded-xl glass-panel-dark border border-white/15 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-white font-bold">PRODUCTION TELEMETRY LIVE</span>
              </div>

              {/* Direct Demo Portal Link in Bottom Right */}
              <div className="absolute bottom-6 right-6 flex items-center space-x-3">
                <Link
                  href="/restaurant/bahubali/pos"
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg flex items-center space-x-2"
                >
                  <span>Launch Live POS Console</span>
                  <span>↗</span>
                </Link>
                <Link
                  href="/restaurant/bahubali/inventory"
                  className="px-4 py-2.5 rounded-xl glass-panel-dark border border-white/20 hover:border-white/40 text-white font-mono text-xs font-semibold uppercase tracking-wider transition-all"
                >
                  <span>Inspect Recipe BOM</span>
                </Link>
              </div>
            </div>
          )}

          {/* Feature Highlights Grid Below Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10 font-mono text-xs">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <div className="text-amber-400 font-bold uppercase">Table Radar Occupancy</div>
              <div className="text-stone-400 text-[11px]">Real-time visual table turnover times, active bill totals, and guest status.</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <div className="text-amber-400 font-bold uppercase">Sub-Second KDS Pacing</div>
              <div className="text-stone-400 text-[11px]">Sub-station load balancing, cook timer warnings, and expediter dispatch.</div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <div className="text-amber-400 font-bold uppercase">Automatic Recipe BOM Burn</div>
              <div className="text-stone-400 text-[11px]">POS sales burn store ingredients instantly to eliminate food cost leaks.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
