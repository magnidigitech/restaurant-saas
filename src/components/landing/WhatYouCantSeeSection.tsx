"use client";

import React, { useState } from "react";
import Image from "next/image";

export default function WhatYouCantSeeSection() {
  const [activeLens, setActiveLens] = useState<"orders" | "kitchen" | "inventory" | "profitability">("orders");

  const lenses = [
    {
      id: "orders" as const,
      num: "01",
      title: "Orders",
      tagline: "Ticket friction & pacing latency",
      hiddenProblem: "Orders punched on paper or legacy terminals get lost in peak rush. Table 18 waits 18 minutes while Table 4 has already finished.",
      restoBirdSolution: "Direct sub-second ticket routing from floor tablets to KDS stations with real-time order pacing and delay alarms.",
      stat: "45%",
      statLabel: "Faster order dispatch to stations",
      telemetryBadge: "Table 18 → Kitchen → 8 min",
      badgeColor: "text-amber-400 bg-amber-950/60 border-amber-500/40",
      imageSrc: "/images/resto-bird/scene-dining.jpg",
    },
    {
      id: "kitchen" as const,
      num: "02",
      title: "Kitchen",
      tagline: "Station bottlenecks & prep queues",
      hiddenProblem: "The executive chef cannot see which cook line station is drowning until guest complaints reach the floor.",
      restoBirdSolution: "Live station load balancing. Resto Bird alerts when the Tandoor or Sauté station backlog exceeds 10 minutes.",
      stat: "<12 min",
      statLabel: "Average ticket cook duration",
      telemetryBadge: "Bottleneck Detected: Tandoor Station",
      badgeColor: "text-rose-400 bg-rose-950/60 border-rose-500/40",
      imageSrc: "/images/resto-bird/scene-kitchen.jpg",
    },
    {
      id: "inventory" as const,
      num: "03",
      title: "Inventory",
      tagline: "Silent shrinkage & unrecorded burns",
      hiddenProblem: "Ingredients disappear through untracked over-portioning and sudden stockouts mid-service without any warning.",
      restoBirdSolution: "Every bill automatically deducts raw grams of Basmati rice, chicken, and ghee from central inventory using BOM yields.",
      stat: "1.2%",
      statLabel: "Food cost variance maintained",
      telemetryBadge: "Low Stock: Paneer → 12% remaining",
      badgeColor: "text-amber-400 bg-amber-950/60 border-amber-500/40",
      imageSrc: "/images/resto-bird/scene-storage.jpg",
    },
    {
      id: "profitability" as const,
      num: "04",
      title: "Profitability",
      tagline: "Margin leakage & plate cost variances",
      hiddenProblem: "Restaurants sell dishes that lose money because no one connects wholesale ingredient price spikes with menu prices.",
      restoBirdSolution: "Continuous Boston Consulting Group menu engineering matrix: Stars, Plowhorses, Puzzles, and Dogs calculated automatically.",
      stat: "+14.8%",
      statLabel: "Average gross profit margin expansion",
      telemetryBadge: "Waste Alert: Trim Loss → ₹2,840",
      badgeColor: "text-emerald-400 bg-emerald-950/60 border-emerald-500/40",
      imageSrc: "/images/resto-bird/scene-overhead.jpg",
    },
  ];

  const current = lenses.find((l) => l.id === activeLens) || lenses[0];

  return (
    <section className="relative py-28 lg:py-36 bg-[#080909] text-white border-t border-b border-white/5 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header Statement */}
        <div className="max-w-4xl mb-20">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-stone-400 text-xs font-mono uppercase tracking-widest mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Operational Blindspots</span>
          </div>

          <p className="text-stone-500 text-xs uppercase font-mono tracking-widest mb-3">
            Restaurants are complex.
          </p>

          <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.06] mb-4 text-white">
            You can&apos;t see everything.
          </h2>

          <h3 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.06] text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">
            But Resto Bird can.
          </h3>
        </div>

        {/* 4 Interactive Lens Selectors */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-12">
          {lenses.map((lens) => {
            const isActive = activeLens === lens.id;
            return (
              <button
                key={lens.id}
                onClick={() => setActiveLens(lens.id)}
                className={`p-5 rounded-2xl text-left transition-all duration-300 border ${
                  isActive
                    ? "bg-amber-950/20 border-amber-500/60 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/20"
                    : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-stone-500">{lens.num}</span>
                  <span
                    className={`w-2 h-2 rounded-full transition-all ${
                      isActive ? "bg-amber-400 scale-125" : "bg-stone-700"
                    }`}
                  />
                </div>
                <div className="text-xl font-bold tracking-tight text-white mb-1">
                  {lens.title}
                </div>
                <div className="text-xs text-stone-400 font-mono line-clamp-1">
                  {lens.tagline}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Lens Detail Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-3xl glass-panel-dark p-6 sm:p-10 border border-white/10">
          {/* Left: Deep Operational Diagnosis */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border text-xs font-mono uppercase tracking-wider backdrop-blur-md shadow-sm">
              <span className={`px-2 py-0.5 rounded-full border ${current.badgeColor}`}>
                {current.telemetryBadge}
              </span>
            </div>

            <div>
              <h4 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                {current.title} Intelligence
              </h4>
              <p className="text-stone-400 text-sm sm:text-base leading-relaxed">
                {current.tagline}
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20">
                <div className="text-[11px] font-mono text-rose-400 uppercase tracking-wider mb-1">
                  Without Resto Bird (The Invisible Blindspot)
                </div>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                  {current.hiddenProblem}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20">
                <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider mb-1">
                  With Resto Bird (The Intelligence Layer)
                </div>
                <p className="text-xs sm:text-sm text-stone-200 leading-relaxed">
                  {current.restoBirdSolution}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-6 pt-4 border-t border-white/10">
              <div>
                <div className="text-3xl sm:text-4xl font-black font-mono text-amber-400">
                  {current.stat}
                </div>
                <div className="text-[11px] font-mono text-stone-400 uppercase tracking-wider mt-1">
                  {current.statLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Isometric Cutaway Render with Overlay HUD */}
          <div className="lg:col-span-6 relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-stone-950 group">
            <Image
              src={current.imageSrc}
              alt={current.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Cinematic Gradient Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#080909] via-transparent to-transparent opacity-80" />
            <div className="absolute inset-0 bg-amber-500/5 mix-blend-overlay" />

            {/* Live Telemetry Pill on Image */}
            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl glass-panel-dark border border-white/15 backdrop-blur-xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <div>
                  <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    {current.title} Perspective Active
                  </div>
                  <div className="text-[10px] font-mono text-stone-400">
                    Live Bird-Eye Sensor Stream #RB-804
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-mono text-amber-400 font-semibold uppercase">
                Active 24/7
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
