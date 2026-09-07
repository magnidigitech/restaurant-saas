"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

type OrderStage = "STARTED" | "PREPARING" | "READY" | "DISPATCHED";

export default function KitchenIntelligenceScene() {
  const [stage, setStage] = useState<OrderStage>("PREPARING");
  const [bottleneckActive, setBottleneckActive] = useState<boolean>(false);
  const [cookSeconds, setCookSeconds] = useState<number>(342); // 5m 42s
  const [selectedStation, setSelectedStation] = useState<"prep" | "saute" | "tandoor" | "pass">("tandoor");

  useEffect(() => {
    const interval = setInterval(() => {
      setCookSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const stations = {
    prep: {
      name: "Prep Island & Salads",
      load: "42% Load",
      leadTime: "3.5 min",
      status: "Optimal",
      statusColor: "text-emerald-400 bg-emerald-950/40 border-emerald-500/30",
      description: "Vegetable mise en place, marinations, and cold appetizer assembly.",
    },
    saute: {
      name: "Sauté & Curry Ranges",
      load: "78% Load",
      leadTime: "7.2 min",
      status: "Active Rush",
      statusColor: "text-amber-400 bg-amber-950/40 border-amber-500/30",
      description: "Butter chicken simmer kettles, dal makhani pots, and wok stir-fry stations.",
    },
    tandoor: {
      name: "Tandoor & Clay Oven",
      load: bottleneckActive ? "96% Backlog" : "84% High Load",
      leadTime: bottleneckActive ? "14.5 min" : "8.0 min",
      status: bottleneckActive ? "Bottleneck Alert" : "Heavy Queue",
      statusColor: bottleneckActive
        ? "text-rose-400 bg-rose-950/60 border-rose-500/40 animate-pulse"
        : "text-amber-400 bg-amber-950/40 border-amber-500/30",
      description: "Garlic naans, tandoori rotis, and char-grilled chicken tikka skewers.",
    },
    pass: {
      name: "Chef Expediter Pass",
      load: "55% Load",
      leadTime: "1.2 min",
      status: "Expediting",
      statusColor: "text-emerald-400 bg-emerald-950/40 border-emerald-500/30",
      description: "Final plate garnishes, ticket reconciliation, and server tray dispatch.",
    },
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <section id="kitchen-intelligence" className="py-28 bg-[#080909] text-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono uppercase tracking-widest text-amber-400 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>Back of House Intelligence</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Kitchen Intelligence as a Living 3D World.
            </h2>
            <p className="text-stone-400 text-sm sm:text-base mt-2 max-w-2xl font-normal">
              Tickets flow visually through stations. When a delay begins brewing at the tandoor or range, Resto Bird detects the bottleneck before food gets cold.
            </p>
          </div>

          {/* Action Trigger for Bottleneck Simulation */}
          <div className="shrink-0 flex items-center space-x-3">
            <button
              onClick={() => setBottleneckActive(!bottleneckActive)}
              className={`px-4 py-2 rounded-full font-mono text-xs uppercase tracking-wider transition-all border ${
                bottleneckActive
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-lg shadow-rose-500/20"
                  : "bg-white/5 text-stone-300 border-white/10 hover:bg-white/10"
              }`}
            >
              {bottleneckActive ? "Reset Rush Bottleneck" : "Simulate Tandoor Backlog"}
            </button>
          </div>
        </div>

        {/* 3D Cutaway Environment with Interactive Hotspots */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Visual Cutaway (8 cols) */}
          <div className="lg:col-span-8 relative aspect-[16/10] rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-stone-950">
            <Image
              src="/images/resto-bird/scene-kitchen.jpg"
              alt="3D Kitchen Environment"
              fill
              className="object-cover brightness-90 contrast-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080909] via-transparent to-transparent opacity-70" />

            {/* Spatial Station Pins */}
            <div className="absolute inset-0 pointer-events-none p-6">
              {/* Station Pin: Prep */}
              <button
                onClick={() => setSelectedStation("prep")}
                className={`absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-transform hover:scale-110 p-2 rounded-xl glass-panel-dark border ${
                  selectedStation === "prep" ? "border-amber-400 shadow-lg" : "border-white/20"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-mono font-bold text-white uppercase">Prep Island</span>
                </div>
              </button>

              {/* Station Pin: Saute / Ranges */}
              <button
                onClick={() => setSelectedStation("saute")}
                className={`absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-transform hover:scale-110 p-2 rounded-xl glass-panel-dark border ${
                  selectedStation === "saute" ? "border-amber-400 shadow-lg" : "border-white/20"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[10px] font-mono font-bold text-white uppercase">Curry Ranges</span>
                </div>
              </button>

              {/* Station Pin: Tandoor */}
              <button
                onClick={() => setSelectedStation("tandoor")}
                className={`absolute top-1/4 right-1/3 -translate-x-1/2 -translate-y-1/2 pointer-events-auto transition-transform hover:scale-110 p-2 rounded-xl glass-panel-dark border ${
                  selectedStation === "tandoor"
                    ? "border-amber-400 shadow-lg"
                    : bottleneckActive
                    ? "border-rose-400 animate-pulse"
                    : "border-white/20"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${bottleneckActive ? "bg-rose-500 animate-ping" : "bg-amber-400"}`} />
                  <span className="text-[10px] font-mono font-bold text-white uppercase">Tandoor Oven</span>
                </div>
              </button>

              {/* Station Pin: Pass */}
              <button
                onClick={() => setSelectedStation("pass")}
                className={`absolute bottom-12 right-1/4 -translate-x-1/2 pointer-events-auto transition-transform hover:scale-110 p-2 rounded-xl glass-panel-dark border ${
                  selectedStation === "pass" ? "border-amber-400 shadow-lg" : "border-white/20"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-[10px] font-mono font-bold text-white uppercase">Expediter Pass</span>
                </div>
              </button>

              {/* Bottleneck Warning Overlay if Active */}
              {bottleneckActive && (
                <div className="absolute top-6 left-6 p-4 rounded-xl glass-panel-dark border border-rose-500/60 bg-rose-950/60 backdrop-blur-xl shadow-2xl max-w-sm pointer-events-auto animate-bounce">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-mono font-bold text-rose-300 uppercase tracking-widest">
                      Kitchen Bottleneck Detected
                    </span>
                  </div>
                  <p className="text-xs text-stone-300">
                    Tandoor bread queue exceeding par threshold (+6.5 min variance). Resto Bird auto-notifies Expediter Pass to pace curry dispatches.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom HUD Bar */}
            <div className="absolute bottom-4 left-6 right-6 hidden sm:flex items-center justify-between p-3 rounded-xl glass-panel-dark border border-white/10 text-[11px] font-mono text-stone-300">
              <div>KDS Station Stream: Active (4/4 stations connected)</div>
              <div className="text-amber-400">Resto Bird Watching Back of House</div>
            </div>
          </div>

          {/* Right Ticket Tracker & Station Detail (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Live Ticket Card */}
            <div className="p-6 rounded-3xl glass-panel-dark border border-white/10 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-stone-400 uppercase tracking-widest block">Live KDS Ticket</span>
                  <span className="text-xl font-bold font-mono text-white">ORDER #2841</span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs text-stone-400 uppercase block">Cook Elapsed</span>
                  <span className="text-lg font-bold text-amber-400">{formatTime(cookSeconds)}</span>
                </div>
              </div>

              {/* Order Pipeline Steps */}
              <div className="space-y-2 pt-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-stone-400">
                  Ticket Lifecycle
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["STARTED", "PREPARING", "READY", "DISPATCHED"] as OrderStage[]).map((st) => {
                    const isCurrent = stage === st;
                    const stagesList = ["STARTED", "PREPARING", "READY", "DISPATCHED"];
                    const isPassed = stagesList.indexOf(st) <= stagesList.indexOf(stage);

                    return (
                      <button
                        key={st}
                        onClick={() => setStage(st)}
                        className={`p-2 text-center rounded-lg border transition-all text-[9px] font-mono uppercase tracking-wider ${
                          isCurrent
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold shadow-sm"
                            : isPassed
                            ? "bg-white/5 text-stone-300 border-white/10"
                            : "bg-transparent text-stone-600 border-white/5"
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Items in ticket */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-stone-300">
                  <span>2x Dum Handi Gosht Biryani</span>
                  <span className="text-amber-400">READY</span>
                </div>
                <div className="flex items-center justify-between text-stone-300">
                  <span>4x Garlic Butter Naan</span>
                  <span className={bottleneckActive ? "text-rose-400 font-bold" : "text-stone-400"}>
                    {bottleneckActive ? "WAITING (QUEUE)" : "IN TANDOOR"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-stone-300">
                  <span>1x Murgh Malai Tikka</span>
                  <span className="text-amber-400">PLATING</span>
                </div>
              </div>
            </div>

            {/* Selected Station Card */}
            <div className="p-6 rounded-3xl glass-panel-dark border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-stone-400">
                  Selected Line Station
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${stations[selectedStation].statusColor}`}>
                  {stations[selectedStation].status}
                </span>
              </div>

              <div className="text-lg font-bold text-white font-mono">
                {stations[selectedStation].name}
              </div>

              <p className="text-xs text-stone-300 leading-relaxed font-sans">
                {stations[selectedStation].description}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 font-mono text-xs">
                <div>
                  <div className="text-stone-500 text-[10px] uppercase">Current Load</div>
                  <div className="text-white font-bold">{stations[selectedStation].load}</div>
                </div>
                <div>
                  <div className="text-stone-500 text-[10px] uppercase">Avg Station Lead</div>
                  <div className="text-amber-400 font-bold">{stations[selectedStation].leadTime}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
