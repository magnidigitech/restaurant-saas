"use client";

import React, { useState } from "react";

interface MidShiftScenario {
  id: string;
  tag: string;
  title: string;
  realityCheck: string;
  restoSolution: string;
  speedMetric: string;
  metricLabel: string;
  interactiveLabel: string;
  actionText: string;
  activeStatus: string;
  resolvedStatus: string;
}

const SCENARIOS: MidShiftScenario[] = [
  {
    id: "item-86",
    tag: "STOCK RUNOUT",
    title: "Instant 86-ing Across All Terminals",
    realityCheck: "The kitchen uses the last portion of Dum Biryani at 8:20 PM. If floor waitstaff don't know immediately, 5 more tables will order it, leading to furious guests and comped meals.",
    restoSolution: "One tap on any kitchen screen or manager tablet strikes the item globally across all server handhelds, counter POS terminals, and customer QR menus in under 45ms.",
    speedMetric: "< 45ms",
    metricLabel: "Global 86 sync latency",
    interactiveLabel: "Menu Item: Handi Gosht Biryani",
    actionText: "Tap to 86 Item Mid-Rush",
    activeStatus: "Available (3 portions left)",
    resolvedStatus: "86'd Globally • Terminals & QR Menus Locked",
  },
  {
    id: "table-swap",
    tag: "FLOOR CHAOS",
    title: "Table Transfers & Seat Splits On the Fly",
    realityCheck: "A party at Table 7 decides to move outside to Patio 4 mid-appetizer, while a table of 6 asks to split the check 4 ways by item right as dessert arrives.",
    restoSolution: "Drag and drop Table 7 to Patio 4 without interrupting the kitchen course fire sequence. Split checks by seat, item, or percentage in two taps with zero cashier queue delay.",
    speedMetric: "2 Taps",
    metricLabel: "To transfer or split checks",
    interactiveLabel: "Active Check: Table 7 ($184.50)",
    actionText: "Transfer to Patio 4 & Split 3 Ways",
    activeStatus: "Table 7 • 1 Master Check • Course 2 in Prep",
    resolvedStatus: "Transferred to Patio 4 • Split into 3 Checks • Tickets Intact",
  },
  {
    id: "offline-rush",
    tag: "NETWORK FAILURE",
    title: "Bulletproof Offline Rush Resilience",
    realityCheck: "The restaurant internet drops during a thunderstorm at 8:45 PM on a Saturday. Traditional cloud POS systems freeze, locking out credit cards and stopping kitchen ticket printing.",
    restoSolution: "Resto Bird maintains a local peer-to-peer mesh. Tablets continue taking orders, ESC/POS LAN printers keep printing tickets, and offline card payments queue with AES-256 encryption.",
    speedMetric: "100%",
    metricLabel: "Service uptime during outages",
    interactiveLabel: "Network Status: Cloud Uplink",
    actionText: "Simulate Internet Drop at 8:45 PM",
    activeStatus: "Online (Cloud Sync Active)",
    resolvedStatus: "Offline Mesh Active • 14 Tickets Printed • 0 Lost Sales",
  },
  {
    id: "kds-pacing",
    tag: "LINE BOTTLENECK",
    title: "Kitchen Station Pacing & Course Holds",
    realityCheck: "The sauté station gets slammed with 16 curries while the grill station is completely idle. Food arrives cold at tables because entrees were fired before appetizers cleared.",
    restoSolution: "Smart course pacing holds main tickets until appetizers are bumped on the expeditor screen. Line bottlenecks automatically trigger rerouting of side prep to idle stations.",
    speedMetric: "-40%",
    metricLabel: "Reduction in cold food complaints",
    interactiveLabel: "Curry Range Load: 94%",
    actionText: "Auto-Balance Line Load",
    activeStatus: "Sauté Range: 16 Tickets • Grill: 2 Tickets",
    resolvedStatus: "Balanced: 4 Side Tickets Rerouted to Prep Line • Course Fire Paced",
  },
  {
    id: "manager-radar",
    tag: "LABOR & COMPS",
    title: "Live Manager Pocket Radar & Comps",
    realityCheck: "Managers are on the floor bussing tables and running food. They can't stay glued to a back-office terminal to approve voids or watch labor cost percentages spike.",
    restoSolution: "Real-time alerts push directly to the manager's phone: 1-touch biometric approval for discounts and comps, live labor cost % versus hourly revenue, and overtime warnings.",
    speedMetric: "< 5 sec",
    metricLabel: "Mobile void approval turnaround",
    interactiveLabel: "Void Request: Server Mike (Table 12 - $24)",
    actionText: "Approve Void via Mobile Radar",
    activeStatus: "Pending Manager Approval • Floor Waiting",
    resolvedStatus: "Approved via Mobile Radar • Shift Audit Logged",
  },
];

export default function MidShiftIntelligenceSection() {
  const [selectedId, setSelectedId] = useState<string>("item-86");
  const [isActionTriggered, setIsActionTriggered] = useState<boolean>(false);

  const current = SCENARIOS.find((s) => s.id === selectedId) || SCENARIOS[0];

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setIsActionTriggered(false);
  };

  return (
    <section id="mid-shift" className="py-28 lg:py-36 bg-[#080909] text-white border-t border-white/5 relative overflow-hidden">
      {/* Subtle Apple-style radial ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-amber-500/5 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono uppercase tracking-widest text-amber-400 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Live Service Resilience</span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.04] text-white mb-3">
            Designed for what happens <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">
              mid-shift.
            </span>
          </h2>

          <p className="text-stone-300 text-base sm:text-lg font-normal leading-relaxed">
            Peak dinner rush is when traditional POS systems buckle. Ingredients run out. Guests swap tables. Internet connections drop. Resto Bird is engineered for the exact moments service gets chaotic.
          </p>
        </div>

        {/* 5 Scenario Selector Tabs */}
        <div className="flex items-center space-x-2 p-1.5 rounded-2xl glass-panel-dark border border-white/10 overflow-x-auto mb-12 max-w-full">
          {SCENARIOS.map((scenario) => {
            const isActive = selectedId === scenario.id;
            return (
              <button
                key={scenario.id}
                onClick={() => handleSelect(scenario.id)}
                className={`py-3 px-4 sm:px-5 rounded-xl text-left transition-all whitespace-nowrap font-mono text-xs uppercase tracking-wider shrink-0 ${
                  isActive
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold"
                    : "text-stone-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="block text-[9px] text-stone-500 mb-0.5">{scenario.tag}</span>
                <span>{scenario.title.split(" ")[0]} {scenario.title.split(" ")[1]}</span>
              </button>
            );
          })}
        </div>

        {/* Active Scenario Interactive Showcase Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center rounded-3xl glass-panel-dark p-6 sm:p-12 border border-white/10">
          {/* Left Narrative Diagnosis (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono uppercase tracking-widest text-amber-400">
              <span>SCENARIO: {current.tag}</span>
            </div>

            <h3 className="text-2xl sm:text-4xl font-black tracking-tight text-white font-mono">
              {current.title}
            </h3>

            {/* The Reality vs Solution comparison */}
            <div className="space-y-4 pt-2">
              <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/20 border border-rose-500/20">
                <div className="text-[10px] font-mono text-rose-400 uppercase tracking-widest font-bold mb-1">
                  The Mid-Shift Pain (Without Resto Bird)
                </div>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-sans">
                  {current.realityCheck}
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/20 border border-amber-500/20">
                <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold mb-1">
                  The Resto Bird Resolution
                </div>
                <p className="text-xs sm:text-sm text-stone-200 leading-relaxed font-sans">
                  {current.restoSolution}
                </p>
              </div>
            </div>

            {/* Metric highlight */}
            <div className="pt-4 border-t border-white/10 flex items-center space-x-8 font-mono">
              <div>
                <div className="text-3xl sm:text-4xl font-black text-amber-400">
                  {current.speedMetric}
                </div>
                <div className="text-[10px] uppercase text-stone-400 tracking-wider mt-0.5">
                  {current.metricLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Right Interactive Live Simulation Stage (5 Cols) */}
          <div className="lg:col-span-5 p-6 sm:p-8 rounded-2xl bg-stone-950 border border-white/10 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between text-xs font-mono text-stone-400 border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${isActionTriggered ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`} />
                <span className="text-white font-bold uppercase">LIVE SIMULATOR</span>
              </div>
              <span className="text-[10px] text-stone-500">SERVICE CLOCK: 20:24</span>
            </div>

            {/* Target Item / Subject */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 font-mono">
              <div className="text-[10px] uppercase text-stone-500 tracking-widest">
                Target Subject
              </div>
              <div className="text-sm font-bold text-white">
                {current.interactiveLabel}
              </div>
            </div>

            {/* Live Operational State Box */}
            <div className={`p-4 rounded-xl border transition-all font-mono text-xs ${
              isActionTriggered
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                : "bg-amber-950/30 border-amber-500/30 text-amber-200"
            }`}>
              <div className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">
                Current Operational State
              </div>
              <div className="font-semibold leading-relaxed">
                {isActionTriggered ? current.resolvedStatus : current.activeStatus}
              </div>
            </div>

            {/* Trigger Button */}
            <button
              onClick={() => setIsActionTriggered(!isActionTriggered)}
              className={`w-full py-3.5 px-4 rounded-xl font-mono text-xs uppercase font-bold tracking-wider transition-all shadow-lg active:scale-95 ${
                isActionTriggered
                  ? "bg-white/10 text-stone-300 hover:bg-white/15 border border-white/20"
                  : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-amber-500/20"
              }`}
            >
              {isActionTriggered ? "Reset Simulation" : current.actionText}
            </button>

            <div className="text-[10px] font-mono text-stone-500 text-center">
              Experience the sub-second speed of the mid-shift engine.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
