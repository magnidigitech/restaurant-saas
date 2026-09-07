"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface JourneyStep {
  id: number;
  stage: string;
  title: string;
  location: string;
  latency: string;
  description: string;
  event: string;
  payload: string;
  kpis: { label: string; value: string }[];
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: 1,
    stage: "TABLE → POS",
    title: "Order Punched at Table 18",
    location: "Floor Dining Tablet",
    latency: "62ms dispatch",
    description: "Waitstaff selects 2x Dum Handi Gosht Biryani, 4x Garlic Butter Naans, and 1x Murgh Malai Tikka on an iPad terminal. Occupancy radar updates Table 18 to active dining.",
    event: "POS_TICKET_COMMITTED",
    payload: "Ticket #4092 • Table 18 • Total: ₹1,840 • Taxes: ₹92",
    kpis: [
      { label: "Dispatch Speed", value: "< 62ms" },
      { label: "Floor Sync", value: "Instant" },
    ],
  },
  {
    id: 2,
    stage: "POS → KITCHEN",
    title: "Split Routing to KDS Screens",
    location: "Kitchen Display Screens",
    latency: "Sub-second broadcast",
    description: "Resto Bird breaks ticket items into station pipelines: Naans route to the Tandoor screen with an 8 min bake timer; Biryanis route to the Curry kettle line.",
    event: "KDS_STATION_ROUTED",
    payload: "Station 1 (Curry Line) • Station 2 (Tandoor Oven)",
    kpis: [
      { label: "Paper Slips", value: "Zero" },
      { label: "Pacing Accuracy", value: "99.8%" },
    ],
  },
  {
    id: 3,
    stage: "KITCHEN → INVENTORY",
    title: "Automatic BOM Recipe Depletion",
    location: "Central Store Inventory",
    latency: "Real-time ledger burn",
    description: "Behind the scenes, Resto Bird deducts exact recipe grammages: 500g Basmati Rice, 440g Chicken, 60ml Pure Ghee, and 400g Curd without any manual paperwork.",
    event: "BOM_INVENTORY_BURNED",
    payload: "Basmati: -0.50kg • Chicken: -0.44kg • Ghee: -0.06L",
    kpis: [
      { label: "Shrinkage Leak", value: "0.0%" },
      { label: "Par Reorder", value: "Automated" },
    ],
  },
  {
    id: 4,
    stage: "BILL → LEDGER",
    title: "Digital Checkout & Reconciliation",
    location: "Finance & Tip Pool Engine",
    latency: "Audit-ready commit",
    description: "Table 18 settles via QR/UPI. Taxes post to GST ledger accounts, and waitstaff tip pool is dynamically split between front servers and kitchen line cooks.",
    event: "LEDGER_RECONCILED",
    payload: "Net Revenue: ₹1,748 • GST: ₹92 • Tips: ₹150 (FOH 60% / BOH 40%)",
    kpis: [
      { label: "Reconciliation", value: "100%" },
      { label: "Tip Dispute", value: "Zero" },
    ],
  },
];

export default function RestoBirdOrderJourney() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev % JOURNEY_STEPS.length) + 1);
    }, 4500);
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const current = JOURNEY_STEPS.find((s) => s.id === activeStep) || JOURNEY_STEPS[0];

  return (
    <section id="order-intelligence" className="py-28 bg-[#080909] text-white border-t border-white/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono uppercase tracking-widest text-amber-400 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Operational Flow Intelligence</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            TABLE → POS → KITCHEN → BILL.
          </h2>

          <p className="text-stone-400 text-sm sm:text-base mt-2 max-w-2xl font-normal">
            Instead of explaining restaurant workflow with abstract text, Resto Bird lets you watch every transaction travel through the physical restaurant in real time.
          </p>
        </div>

        {/* 4 Pipeline Stage Steppers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {JOURNEY_STEPS.map((s) => {
            const isActive = activeStep === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActiveStep(s.id);
                  setIsAutoPlaying(false);
                }}
                className={`p-4 rounded-2xl text-left border transition-all ${
                  isActive
                    ? "bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/20"
                    : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">
                    STAGE {s.id}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isActive ? "bg-amber-400 animate-ping" : "bg-stone-700"}`} />
                </div>
                <div className="text-xs font-mono font-bold text-white mb-1">
                  {s.stage}
                </div>
                <div className="text-[11px] text-stone-400 truncate">
                  {s.title}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detailed Stage Execution Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-3xl glass-panel-dark p-6 sm:p-10 border border-white/10">
          <div className="lg:col-span-7 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-xs uppercase font-bold">
                {current.stage}
              </span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-stone-400 font-mono text-xs">
                {current.location}
              </span>
              <span className="text-xs font-mono text-emerald-400">
                Latency: {current.latency}
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold font-mono text-white">
              {current.title}
            </h3>

            <p className="text-stone-300 text-sm sm:text-base leading-relaxed font-sans">
              {current.description}
            </p>

            {/* Technical payload box */}
            <div className="p-4 rounded-xl bg-black/60 border border-white/10 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-stone-500 text-[10px] uppercase tracking-wider">
                <span>SYSTEM EVENT DISPATCH</span>
                <span className="text-amber-400">{current.event}</span>
              </div>
              <div className="text-stone-300 bg-white/5 p-2.5 rounded-lg overflow-x-auto text-[11px]">
                {current.payload}
              </div>
            </div>

            {/* Stage KPIs */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10 font-mono">
              {current.kpis.map((kpi, idx) => (
                <div key={idx}>
                  <div className="text-stone-500 text-[10px] uppercase">{kpi.label}</div>
                  <div className="text-xl font-bold text-amber-400">{kpi.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Visual Simulator Box */}
          <div className="lg:col-span-5 relative aspect-square rounded-2xl bg-stone-950 border border-white/10 p-6 flex flex-col justify-between overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:20px_20px] opacity-10" />

            <div className="relative z-10 flex items-center justify-between font-mono text-xs text-stone-400">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>RESTO BIRD TRANSACTION RADAR</span>
              </div>
              <span>ID: #RB-4092</span>
            </div>

            {/* Visual Node Flow Line */}
            <div className="relative z-10 space-y-4 my-auto">
              {JOURNEY_STEPS.map((s) => {
                const isSelected = activeStep === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveStep(s.id);
                      setIsAutoPlaying(false);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between font-mono text-xs ${
                      isSelected
                        ? "bg-amber-500/20 border-amber-500/60 text-white font-bold"
                        : "bg-white/[0.02] border-white/5 text-stone-400 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-amber-400 animate-ping" : "bg-stone-700"}`} />
                      <span>{s.stage}</span>
                    </div>
                    <span className="text-[10px] text-stone-400">{s.latency}</span>
                  </div>
                );
              })}
            </div>

            <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-stone-500 pt-3 border-t border-white/5">
              <span>{isAutoPlaying ? "AUTO-PLAYING SIMULATION" : "MANUAL STEPPING"}</span>
              <button
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className="text-amber-400 hover:underline"
              >
                {isAutoPlaying ? "Pause" : "Resume"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
