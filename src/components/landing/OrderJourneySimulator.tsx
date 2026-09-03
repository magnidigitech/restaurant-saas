"use client";

import React, { useState, useEffect } from "react";
import Card3D from "./Card3D";

interface Step {
  id: number;
  title: string;
  badge: string;
  module: string;
  moduleRoute: string;
  color: string;
  bgLight: string;
  borderColor: string;
  summary: string;
  technicalDetails: {
    event: string;
    payload: string;
    outcome: string;
  };
  metrics: {
    label: string;
    value: string;
  }[];
}

const STEPS: Step[] = [
  {
    id: 1,
    title: "1. Table Order Billed at Table 7",
    badge: "Point of Sale",
    module: "POS Module",
    moduleRoute: "/restaurant/bahubali/pos",
    color: "text-amber-800",
    bgLight: "bg-amber-50",
    borderColor: "border-amber-200",
    summary: "Waitstaff punches 2x Royal Hyderabadi Dum Biryani, 1x Chicken 65, and 2x Fresh Mint Lassi Coolers on a handheld tablet. Table occupancy updates in real time with automatic tax computation.",
    technicalDetails: {
      event: "POS_TICKET_COMMITTED",
      payload: "Bill #4092 • Table 7 • Subtotal: $58.00 • Tax: $2.90 • Total: $60.90",
      outcome: "Ticket committed to PostgreSQL tenant database; instantly broadcasts socket event to kitchen display.",
    },
    metrics: [
      { label: "Dispatch Speed", value: "< 95ms" },
      { label: "Billing Accuracy", value: "100%" },
    ],
  },
  {
    id: 2,
    title: "2. Intelligent Kitchen Routing",
    badge: "Kitchen Display (KDS)",
    module: "Operations & KDS",
    moduleRoute: "/restaurant/bahubali/operations",
    color: "text-orange-800",
    bgLight: "bg-orange-50",
    borderColor: "border-orange-200",
    summary: "The ticket auto-routes by station: Biryani & Chicken 65 route to the Tandoor & Hot Kitchen station screen; Lassi Coolers route to the Beverage station screen. Chefs bump completed items with 1 touch.",
    technicalDetails: {
      event: "KDS_STATION_ROUTED",
      payload: "Station A (Tandoor): Biryani & Chicken 65 (Prep: 12m) | Station B (Bar): Mint Lassi (Prep: 3m)",
      outcome: "Eliminates kitchen paper loss, tracks prep bottlenecks, and sends ready ping to waitstaff.",
    },
    metrics: [
      { label: "Station Routing", value: "Multi-Screen" },
      { label: "Prep Time Lag", value: "-40% Faster" },
    ],
  },
  {
    id: 3,
    title: "3. Automatic Recipe Stock Depletion",
    badge: "Inventory & Recipes",
    module: "Inventory Module",
    moduleRoute: "/restaurant/bahubali/inventory",
    color: "text-emerald-800",
    bgLight: "bg-emerald-50",
    borderColor: "border-emerald-200",
    summary: "Behind the scenes, RestIQ's Bill of Materials engine automatically burns raw inventory: Aged Basmati Rice (-500g), Chicken (-440g), Desi Ghee (-60ml), and Curd (-400g).",
    technicalDetails: {
      event: "INVENTORY_DEPLETED",
      payload: "Basmati: -0.50kg • Chicken: -0.44kg • Ghee: -0.06L • Curd: -0.40kg • Mint: -0.04kg",
      outcome: "Stores live stock balances with 0 manual paperwork, triggering automatic purchase orders when below par levels.",
    },
    metrics: [
      { label: "Food Cost Variance", value: "< 1.5%" },
      { label: "Inventory Accuracy", value: "99.4%" },
    ],
  },
  {
    id: 4,
    title: "4. Shift Timecard & Tip Pool Sync",
    badge: "Workforce & Payroll",
    module: "Shifts & Tip Pool",
    moduleRoute: "/restaurant/bahubali/shifts",
    color: "text-amber-900",
    bgLight: "bg-amber-100/60",
    borderColor: "border-amber-300",
    summary: "Table 7 adds a $10.00 service tip. The Tip Pool rules engine splits it: 60% ($6.00) to the active waitstaff clocked into the shift, and 40% ($4.00) into the shared tandoor line cook pool.",
    technicalDetails: {
      event: "TIP_POOL_ALLOCATED",
      payload: "Tip: $10.00 • FOH Server Share: $6.00 • BOH Kitchen Pool: $4.00",
      outcome: "Calculated alongside PIN kiosk clock hours for 1-click end-of-month PDF payroll payslips.",
    },
    metrics: [
      { label: "Tip Allocation", value: "100% Transparent" },
      { label: "Payroll Admin Time", value: "1-Click Monthly" },
    ],
  },
  {
    id: 5,
    title: "5. Real-Time P&L & Vault Ledger",
    badge: "Finance & Security",
    module: "Finance & Vault",
    moduleRoute: "/restaurant/bahubali/finance",
    color: "text-stone-900",
    bgLight: "bg-stone-100",
    borderColor: "border-stone-300",
    summary: "The transaction is instantly booked to the Bahubali owner's live P&L dashboard. Revenue ($58.00) minus Recipe COGS ($16.90) and Labor ($12.50) yields a Net Contribution Margin of $28.60 (49.3%).",
    technicalDetails: {
      event: "LEDGER_ENTRY_COMMITTED",
      payload: "Gross Revenue: +$58.00 • Recipe COGS: -$16.90 • Labor Cost: -$12.50 • Net Margin: 49.3%",
      outcome: "Secured with PostgreSQL tenant isolation and client-side AES-256 encrypted credentials.",
    },
    metrics: [
      { label: "Contribution Margin", value: "49.3% Net" },
      { label: "Security Vault", value: "AES-256 Guard" },
    ],
  },
];

export default function OrderJourneySimulator() {
  const [activeStepId, setActiveStepId] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStepId((prev) => (prev >= STEPS.length ? 1 : prev + 1));
    }, 3200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const activeStep = STEPS.find((s) => s.id === activeStepId) || STEPS[0];

  return (
    <section className="relative z-10 py-24 bg-[#FAF6F0]/90 backdrop-blur-xl border-y border-[#E8DFC8]">
      <div className="max-w-7xl mx-auto px-6 space-y-12">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-100/80 border border-amber-200 text-amber-900 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
            <span>End-to-End Operational Pipeline</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-[#1a120b] tracking-tight">
            How RestIQ Unifies Restaurant Operations
          </h2>
          <p className="text-stone-600 text-base leading-relaxed">
            Follow a single table order from the moment it is punched at the POS to the exact second raw ingredients are burned, tips are allocated, and ledger margins are booked.
          </p>
        </div>

        {/* Step Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#E8DFC8] pb-6">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {STEPS.map((step) => {
              const isActive = step.id === activeStepId;
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    setIsPlaying(false);
                    setActiveStepId(step.id);
                  }}
                  className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center space-x-2 ${
                    isActive
                      ? "bg-[#1a120b] text-amber-300 shadow-md scale-105"
                      : "bg-white/80 hover:bg-white text-stone-700 border border-[#E8DFC8]"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-mono font-bold ${
                      isActive ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-700 shadow-2xs"
                    }`}
                  >
                    {step.id}
                  </span>
                  <span>{step.badge}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-5 py-2.5 text-xs font-bold rounded-full border transition-all flex items-center space-x-2 shadow-xs ${
              isPlaying
                ? "bg-amber-600 text-white border-amber-700"
                : "bg-white text-amber-900 border-amber-300 hover:bg-amber-50"
            }`}
          >
            <span>{isPlaying ? "Pause Flow" : "Auto-Play Simulator"}</span>
            {isPlaying ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Interactive Simulation View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Step Details */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${activeStep.bgLight} ${activeStep.color} ${activeStep.borderColor}`}>
                {activeStep.badge} &bull; {activeStep.module}
              </span>
              <h3 className="text-3xl font-black text-[#1a120b] tracking-tight">
                {activeStep.title}
              </h3>
              <p className="text-base text-stone-600 leading-relaxed font-normal">
                {activeStep.summary}
              </p>
            </div>

            {/* Event Payload Code Block */}
            <div className="p-5 bg-[#1a120b] rounded-2xl text-amber-50 font-mono text-xs space-y-2.5 shadow-2xl border border-[#3e2723]">
              <div className="flex justify-between items-center text-stone-400 border-b border-stone-800 pb-2">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-bold">{activeStep.technicalDetails.event}</span>
                </span>
                <span className="text-[10px] text-amber-400 font-sans">RestIQ Telemetry Pipeline</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] uppercase">Payload Data:</span>
                <span className="text-amber-200 font-semibold">{activeStep.technicalDetails.payload}</span>
              </div>
              <div className="pt-1">
                <span className="text-stone-400 block text-[10px] uppercase">Automated Outcome:</span>
                <span className="text-stone-300 font-sans">{activeStep.technicalDetails.outcome}</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              {activeStep.metrics.map((m, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white border border-[#E8DFC8] shadow-2xs">
                  <span className="text-xs text-stone-500 font-medium block">{m.label}</span>
                  <span className="text-xl font-black font-mono text-amber-900 mt-0.5 block">{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: 3D Visual Mockup */}
          <div className="lg:col-span-5">
            <Card3D maxTilt={9} scale={1.03}>
              <div className="p-6 bg-white rounded-3xl border border-[#E8DFC8] shadow-[0_20px_50px_rgba(38,28,20,0.08)] space-y-6">
                {/* Mockup Title */}
                <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-orange-600" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-600" />
                    <span className="text-xs font-semibold text-stone-600 pl-2">
                      Live Telemetry &bull; bahubali outlet
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-200">
                    STEP {activeStep.id} OF 5
                  </span>
                </div>

                {/* Step Specific Visuals */}
                {activeStep.id === 1 && (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-amber-950">
                        <span>Table 7 &bull; Waitstaff POS Terminal</span>
                        <span className="font-mono text-amber-700 font-black">$58.00</span>
                      </div>
                      <div className="space-y-1 text-xs text-stone-600">
                        <div className="flex justify-between">
                          <span>2x Royal Hyderabadi Dum Biryani</span>
                          <span className="font-mono font-bold text-stone-900">$36.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>1x Chicken 65 Starter</span>
                          <span className="font-mono font-bold text-stone-900">$12.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>2x Fresh Mint Lassi Cooler</span>
                          <span className="font-mono font-bold text-stone-900">$10.00</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2 font-semibold">
                      <span>✓</span>
                      <span>5% Restaurant GST ($2.90) auto-calculated on bill</span>
                    </div>
                  </div>
                )}

                {activeStep.id === 2 && (
                  <div className="space-y-3">
                    <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-xs space-y-1">
                      <div className="flex justify-between items-center font-bold text-orange-950">
                        <span>Hot Kitchen & Tandoor KDS</span>
                        <span className="px-2 py-0.5 bg-orange-200 text-orange-900 rounded-md font-mono text-[10px]">TICKET #104</span>
                      </div>
                      <p className="text-stone-600">2x Dum Biryani, 1x Chicken 65 &bull; Prep Timer: 04:15 / 12:00m</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                      <div className="flex justify-between items-center font-bold text-amber-950">
                        <span>Beverage Station Screen</span>
                        <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md font-mono text-[10px]">TICKET #105</span>
                      </div>
                      <p className="text-stone-600">2x Fresh Mint Lassi &bull; Ready & Bumped (01:40m)</p>
                    </div>
                  </div>
                )}

                {activeStep.id === 3 && (
                  <div className="space-y-2 text-xs">
                    <span className="text-[11px] font-bold text-[#1a120b] block uppercase tracking-wider">
                      Real-Time Recipe BOM Depletion
                    </span>
                    <div className="space-y-1.5 font-mono">
                      <div className="flex justify-between p-2 bg-[#FCF9F5] rounded-lg border border-[#EFE7DC]">
                        <span className="text-stone-700">Kohinoor Basmati Rice</span>
                        <span className="text-orange-700 font-bold">-0.500 KG</span>
                      </div>
                      <div className="flex justify-between p-2 bg-[#FCF9F5] rounded-lg border border-[#EFE7DC]">
                        <span className="text-stone-700">Tender Fresh Chicken</span>
                        <span className="text-orange-700 font-bold">-0.440 KG</span>
                      </div>
                      <div className="flex justify-between p-2 bg-[#FCF9F5] rounded-lg border border-[#EFE7DC]">
                        <span className="text-stone-700">Pure Cow Desi Ghee</span>
                        <span className="text-orange-700 font-bold">-0.060 L</span>
                      </div>
                      <div className="flex justify-between p-2 bg-[#FCF9F5] rounded-lg border border-[#EFE7DC]">
                        <span className="text-stone-700">Farm Dairy Curd</span>
                        <span className="text-orange-700 font-bold">-0.400 KG</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold pt-1">
                      • Safe par levels verified: Basmati Rice balance is 64.5kg
                    </div>
                  </div>
                )}

                {activeStep.id === 4 && (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 space-y-2 text-xs">
                      <div className="flex justify-between font-bold text-amber-950">
                        <span>Tip Rule: 60% Waitstaff / 40% Tandoor Cooks</span>
                        <span className="font-mono text-amber-800 font-black">Total $10.00</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="p-2 bg-white rounded-lg border border-amber-100">
                          <span className="text-[10px] text-stone-500 block">Server Rahul M.</span>
                          <span className="font-bold text-emerald-700 font-mono">+$6.00</span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-amber-100">
                          <span className="text-[10px] text-stone-500 block">Tandoor Cooks Pool</span>
                          <span className="font-bold text-emerald-700 font-mono">+$4.00</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-500 italic">
                      PIN clock-in hours and tip balances auto-merge into monthly payroll payslips.
                    </p>
                  </div>
                )}

                {activeStep.id === 5 && (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-[#1a120b] text-white rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-stone-400">Bill Sales Revenue</span>
                        <span className="text-emerald-400 font-bold">+$58.00</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-stone-400">Recipe Food Cost (BOM)</span>
                        <span className="text-orange-400 font-bold">-$16.90</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-stone-400">Allocated Labor Overhead</span>
                        <span className="text-amber-400 font-bold">-$12.50</span>
                      </div>
                      <div className="pt-2 border-t border-stone-800 flex justify-between items-center text-xs font-bold">
                        <span className="text-stone-200">Net Contribution Margin</span>
                        <span className="text-emerald-400 font-mono text-sm">+49.3% ($28.60)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress Indicators */}
                <div className="flex items-center space-x-1.5 pt-2">
                  {STEPS.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        setIsPlaying(false);
                        setActiveStepId(s.id);
                      }}
                      className={`h-1.5 flex-1 rounded-full cursor-pointer transition-all ${
                        s.id <= activeStepId ? "bg-amber-600" : "bg-stone-200"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </Card3D>
          </div>
        </div>
      </div>
    </section>
  );
}
