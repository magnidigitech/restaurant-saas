"use client";

import React from "react";

type PlaceZone = "all" | "kitchen" | "storage" | "dining" | "pos";

interface RestoBirdTelemetryOverlayProps {
  onFocusZone?: (zone: PlaceZone) => void;
  activeZone?: PlaceZone;
}

export default function RestoBirdTelemetryOverlay({
  onFocusZone,
  activeZone = "all",
}: RestoBirdTelemetryOverlayProps) {
  const places = [
    {
      id: "kitchen" as PlaceZone,
      badge: "BACK OF HOUSE",
      title: "KITCHEN LINE",
      location: "Prep Island & Stoves",
      summary: "Orders moving through cook stations",
      telemetry: "KDS Queue Active • 8 min lead",
      posClass: "top-14 left-3 sm:left-5",
      code: "ZONE-BOH",
      color: "text-amber-400",
      border: "border-amber-500/40",
      pulse: "bg-amber-400",
    },
    {
      id: "dining" as PlaceZone,
      badge: "FRONT OF HOUSE",
      title: "DINING TABLES",
      location: "Table 18 & Floor Seating",
      summary: "Guest table turnover & occupancy",
      telemetry: "Table 18 Active • Table 4 Occupied",
      posClass: "top-14 right-3 sm:right-5",
      code: "ZONE-FOH",
      color: "text-amber-400",
      border: "border-amber-500/40",
      pulse: "bg-amber-400",
    },
    {
      id: "pos" as PlaceZone,
      badge: "FRONT COUNTER",
      title: "POS & DISPATCH",
      location: "Cashier & Dispatch Desk",
      summary: "High-speed table ordering & billing",
      telemetry: "Sub-second ticket commit (<62ms)",
      posClass: "bottom-12 left-3 sm:left-5",
      code: "ZONE-POS",
      color: "text-cyan-400",
      border: "border-cyan-500/40",
      pulse: "bg-cyan-400",
    },
    {
      id: "storage" as PlaceZone,
      badge: "STORAGE & RECIPES",
      title: "INVENTORY STORAGE",
      location: "Cold Store & Dry Pantry",
      summary: "Bill of materials & par levels",
      telemetry: "Raw ingredients tracking",
      posClass: "bottom-12 right-3 sm:right-5",
      code: "ZONE-BOM",
      color: "text-emerald-400",
      border: "border-emerald-500/40",
      pulse: "bg-emerald-400",
    },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none p-3 sm:p-4 select-none overflow-hidden">
      {/* 1. Top Places Navigation Switcher (Zero Emojis, Clean Monospace Badges) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center space-x-1 p-1 rounded-full glass-panel-dark border border-white/10 shadow-2xl max-w-[95%] overflow-x-auto">
        <button
          onClick={() => onFocusZone?.("all")}
          className={`px-3 py-1 text-[10px] font-mono tracking-wider uppercase rounded-full whitespace-nowrap transition-all ${
            activeZone === "all"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold"
              : "text-stone-400 hover:text-white"
          }`}
        >
          Full Floor
        </button>
        <button
          onClick={() => onFocusZone?.("dining")}
          className={`px-3 py-1 text-[10px] font-mono tracking-wider uppercase rounded-full whitespace-nowrap transition-all ${
            activeZone === "dining"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold"
              : "text-stone-400 hover:text-white"
          }`}
        >
          Tables
        </button>
        <button
          onClick={() => onFocusZone?.("kitchen")}
          className={`px-3 py-1 text-[10px] font-mono tracking-wider uppercase rounded-full whitespace-nowrap transition-all ${
            activeZone === "kitchen"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold"
              : "text-stone-400 hover:text-white"
          }`}
        >
          Kitchen
        </button>
        <button
          onClick={() => onFocusZone?.("storage")}
          className={`px-3 py-1 text-[10px] font-mono tracking-wider uppercase rounded-full whitespace-nowrap transition-all ${
            activeZone === "storage"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold"
              : "text-stone-400 hover:text-white"
          }`}
        >
          Inventory
        </button>
        <button
          onClick={() => onFocusZone?.("pos")}
          className={`px-3 py-1 text-[10px] font-mono tracking-wider uppercase rounded-full whitespace-nowrap transition-all ${
            activeZone === "pos"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold"
              : "text-stone-400 hover:text-white"
          }`}
        >
          POS
        </button>
      </div>

      {/* 2. Interactive Spatial Place Cards in 4 Corners */}
      {places.map((place) => {
        const isSelected = activeZone === place.id;
        return (
          <div
            key={place.id}
            onClick={() => onFocusZone?.(place.id)}
            className={`absolute ${place.posClass} pointer-events-auto transition-all duration-300 transform hover:scale-105 cursor-pointer group`}
          >
            <div
              className={`p-3 rounded-2xl glass-panel-dark border transition-all ${
                isSelected
                  ? "border-amber-400 ring-2 ring-amber-400/40 bg-amber-950/80 shadow-2xl scale-105"
                  : `${place.border} bg-black/60 hover:border-white/30`
              } backdrop-blur-xl max-w-[190px] sm:max-w-[220px] shadow-xl`}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-[9px] font-mono tracking-wider font-bold uppercase text-white">
                    {place.title}
                  </span>
                </div>
                <span className="text-[8px] font-mono text-stone-500">
                  {place.code}
                </span>
              </div>

              <div className="text-[10px] font-mono text-stone-300 truncate mb-1">
                {place.location}
              </div>

              <div className="flex items-center justify-between pt-1.5 border-t border-white/10 text-[9px] font-mono">
                <span className={isSelected ? "text-amber-300 font-semibold" : "text-stone-400"}>
                  {place.telemetry}
                </span>
                <span className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Fly →
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* 3. Bottom Status Radar Bar */}
      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[9px] font-mono text-stone-400 pointer-events-none px-2">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-white uppercase font-semibold">
            CAMERA: {activeZone === "all" ? "FULL BIRD'S-EYE VIEW" : activeZone.toUpperCase()}
          </span>
        </div>
        <div className="hidden sm:block text-stone-500">
          CLICK ANY PLACE TO FLY &amp; INSPECT
        </div>
      </div>
    </div>
  );
}
