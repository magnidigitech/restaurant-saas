"use client";

import React, { useState, useEffect } from "react";
import {
  Check,
  Copy,
  Clock,
  Shield,
  Zap,
  Flame,
  Scale,
  DollarSign,
  TrendingUp,
  Users,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Star,
  HelpCircle,
  TrendingDown,
} from "lucide-react";

interface SimulatorProps {
  moduleSlug: string;
}

export default function ModuleInteractiveSimulator({ moduleSlug }: SimulatorProps) {
  switch (moduleSlug) {
    case "pos":
      return <POSSimulator />;
    case "inventory":
      return <InventorySimulator />;
    case "catering":
      return <CateringSimulator />;
    case "shifts":
      return <ShiftsSimulator />;
    case "attendance":
      return <AttendanceSimulator />;
    case "payroll":
      return <PayrollSimulator />;
    case "finance":
      return <FinanceSimulator />;
    case "vault":
      return <VaultSimulator />;
    case "analytics":
      return <AnalyticsSimulator />;
    default:
      return null;
  }
}

/* -------------------------------------------------------------
   1. POS INTEGRATIONS & ORDERS HUB SIMULATOR
------------------------------------------------------------- */
function POSSimulator() {
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [simulatedOrders, setSimulatedOrders] = useState<
    Array<{
      id: string;
      orderNumber: string;
      provider: "TOAST" | "SQUARE" | "CLOVER";
      outlet: string;
      items: string;
      modifiers: string;
      total: number;
      net: number;
      tax: number;
      tip: number;
      time: string;
      status: "COMPLETED" | "REFUNDED";
    }>
  >([
    {
      id: "ord-1",
      orderNumber: "TST-4102",
      provider: "TOAST",
      outlet: "Downtown Bistro",
      items: "Dry-Aged Ribeye 12oz + Craft IPA",
      modifiers: "Medium Rare, Truffle Glaze",
      total: 68.5,
      net: 53.02,
      tax: 5.48,
      tip: 10.0,
      time: "2m ago",
      status: "COMPLETED",
    },
    {
      id: "ord-2",
      orderNumber: "SQ-8910",
      provider: "SQUARE",
      outlet: "Express Kiosk SFO",
      items: "2x Oat Flat White, Almond Croissant",
      modifiers: "Oat Milk, Extra Shot, Warmed",
      total: 22.85,
      net: 18.0,
      tax: 1.85,
      tip: 3.0,
      time: "6m ago",
      status: "COMPLETED",
    },
    {
      id: "ord-3",
      orderNumber: "CLV-7041",
      provider: "CLOVER",
      outlet: "Downtown Bistro",
      items: "2x Grilled Chilean Sea Bass",
      modifiers: "Lemon Herb Beurre Blanc",
      total: 94.5,
      net: 71.94,
      tax: 7.56,
      tip: 15.0,
      time: "14m ago",
      status: "COMPLETED",
    },
    {
      id: "ord-4",
      orderNumber: "TST-4098",
      provider: "TOAST",
      outlet: "Downtown Bistro",
      items: "Double Smash Burger Combo",
      modifiers: "Gluten-Free Bun",
      total: 45.0,
      net: 0,
      tax: 3.6,
      tip: 0,
      time: "32m ago",
      status: "REFUNDED",
    },
  ]);

  const [notification, setNotification] = useState<string | null>(null);

  const simulateIncomingOrder = (prov: "TOAST" | "SQUARE" | "CLOVER") => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderPrefix = prov === "TOAST" ? "TST" : prov === "SQUARE" ? "SQ" : "CLV";
    const sampleItems =
      prov === "TOAST"
        ? { items: "Truffle Arancini + Margherita Pizza", mod: "Extra Mozzarella", total: 42.5, net: 34.1, tax: 3.4, tip: 5.0 }
        : prov === "SQUARE"
        ? { items: "Matcha Latte + Avocado Toast", mod: "Add Smoked Salmon", total: 24.5, net: 19.5, tax: 2.0, tip: 3.0 }
        : { items: "Prime Filet Mignon + Pinot Noir", mod: "Rare, Herb Butter", total: 88.0, net: 67.2, tax: 6.8, tip: 14.0 };

    const newOrder = {
      id: `sim-${Date.now()}`,
      orderNumber: `${orderPrefix}-${randomSuffix}`,
      provider: prov,
      outlet: "Downtown Bistro",
      items: sampleItems.items,
      modifiers: sampleItems.mod,
      total: sampleItems.total,
      net: sampleItems.net,
      tax: sampleItems.tax,
      tip: sampleItems.tip,
      time: "Just now",
      status: "COMPLETED" as const,
    };

    setSimulatedOrders((prev) => [newOrder, ...prev.slice(0, 5)]);
    setNotification(`[POS Webhook] Ingested new ticket ${newOrder.orderNumber} from ${prov} API!`);
    setTimeout(() => setNotification(null), 4000);
  };

  const filtered =
    selectedProvider === "ALL"
      ? simulatedOrders
      : simulatedOrders.filter((o) => o.provider === selectedProvider);

  const totalGross = filtered.reduce((s, o) => s + (o.status === "COMPLETED" ? o.total : 0), 0);
  const totalTips = filtered.reduce((s, o) => s + o.tip, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 text-slate-800 font-sans">
      {/* Integrations Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            POS Connectors: 3 Healthy & Polling
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500 font-mono">Toast • Square • Clover</span>
        </div>
        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-medium">
          <Shield className="w-3 h-3 text-emerald-600" />
          <span>Idempotent Ingestion Active</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-4">
        {/* Left: Provider Selector & Simulator Triggers */}
        <div className="md:col-span-4 space-y-3">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex justify-between">
            <span>Filter Stream</span>
            <span>{filtered.length} Orders</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "ALL", label: "Unified (All)", color: "text-slate-700" },
              { id: "TOAST", label: "Toast POS", color: "text-orange-600" },
              { id: "SQUARE", label: "Square POS", color: "text-blue-600" },
              { id: "CLOVER", label: "Clover POS", color: "text-emerald-600" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`py-2 px-3 rounded-xl text-left border text-xs font-medium transition-all ${
                  selectedProvider === p.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Simulate Incoming Tickets */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Simulate Ingesting POS Ticket
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => simulateIncomingOrder("TOAST")}
                className="py-1.5 px-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-semibold transition-all"
              >
                + Toast
              </button>
              <button
                onClick={() => simulateIncomingOrder("SQUARE")}
                className="py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-all"
              >
                + Square
              </button>
              <button
                onClick={() => simulateIncomingOrder("CLOVER")}
                className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-all"
              >
                + Clover
              </button>
            </div>
          </div>

          {/* Quick Telemetry */}
          <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/60 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Gross Ingested</span>
              <span className="font-mono font-bold text-slate-900">${totalGross.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tips Reconciled</span>
              <span className="font-mono font-bold text-indigo-600">+${totalTips.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Right: Consolidated Live Stream */}
        <div className="md:col-span-8 bg-slate-50/50 rounded-xl border border-slate-200/80 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Consolidated Orders Feed</h4>
                <p className="text-[11px] text-slate-500">
                  Imported directly from restaurant POS devices • Read-only
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                LIVE POLLING
              </span>
            </div>

            {/* Orders Feed */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {filtered.map((ord) => (
                <div
                  key={ord.id}
                  className="p-2.5 rounded-xl bg-white border border-slate-200/70 text-xs flex items-center justify-between shadow-xs hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{ord.orderNumber}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                          ord.provider === "TOAST"
                            ? "bg-orange-100 text-orange-700"
                            : ord.provider === "SQUARE"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {ord.provider}
                      </span>
                      <span className="text-[10px] text-slate-400">• {ord.outlet}</span>
                    </div>
                    <p className="text-slate-700 font-medium">{ord.items}</p>
                    <p className="text-[10px] text-slate-400 italic">{ord.modifiers}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900">${ord.total.toFixed(2)}</p>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                        ord.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-rose-50 text-rose-600"
                      }`}
                    >
                      {ord.status}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{ord.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {notification && (
            <div className="mt-3 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-center font-medium animate-fadeIn">
              {notification}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   2. INVENTORY & RECIPE BOM SIMULATOR
------------------------------------------------------------- */
function InventorySimulator() {
  const [billedDishes, setBilledDishes] = useState<number>(65);

  // Ingredients depleted per dish (averaged)
  const riceDepletionPerDish = 0.22; // 220g per dish
  const paneerDepletionPerDish = 0.12; // 120g per dish
  const gheeDepletionPerDish = 0.045; // 45ml per dish
  const spicesDepletionPerDish = 0.025; // 25g

  const initialRice = 35.0; // kg
  const initialPaneer = 12.0; // kg
  const initialGhee = 8.0; // L
  const initialSpices = 5.0; // kg

  const currentRice = Math.max(0, initialRice - billedDishes * riceDepletionPerDish);
  const currentPaneer = Math.max(0, initialPaneer - billedDishes * paneerDepletionPerDish);
  const currentGhee = Math.max(0, initialGhee - billedDishes * gheeDepletionPerDish);
  const currentSpices = Math.max(0, initialSpices - billedDishes * spicesDepletionPerDish);

  const parRice = 10.0;
  const parPaneer = 4.0;
  const parGhee = 3.0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 text-slate-800 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Gram-Level Recipe Depletion Engine</h4>
          <p className="text-xs text-slate-500">
            Simulate POS ticket sales and watch raw storage inventory deplete down to the gram.
          </p>
        </div>
        <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-semibold">
          99.8% BOM Precision
        </div>
      </div>

      {/* Interactive Sales Slider */}
      <div className="py-4 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-700">Simulated POS Dishes Billed Tonight:</span>
          <span className="font-mono font-bold text-sm text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            {billedDishes} Dishes Sold
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="120"
          value={billedDishes}
          onChange={(e) => setBilledDishes(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>Early Dinner (10 orders)</span>
          <span>Peak Dinner Rush (65 orders)</span>
          <span>Full House Close (120 orders)</span>
        </div>
      </div>

      {/* Stock Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {/* Ingredient 1 */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-xs text-slate-900">Aged Basmati Rice (Central Store)</span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                currentRice < parRice
                  ? "bg-rose-100 text-rose-700"
                  : currentRice < parRice * 1.5
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {currentRice < parRice ? "PO TRIGGERED" : "OPTIMAL"}
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-xl font-bold text-slate-900">{currentRice.toFixed(1)} kg</span>
            <span className="text-xs text-rose-600 font-semibold">
              -{(billedDishes * riceDepletionPerDish).toFixed(1)} kg depleted
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                currentRice < parRice ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{ width: `${(currentRice / initialRice) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Par Level: {parRice.toFixed(0)} kg</span>
            <span>Batch Capacity: {initialRice.toFixed(0)} kg</span>
          </div>
        </div>

        {/* Ingredient 2 */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-xs text-slate-900">Fresh Paneer Block (Walk-in Cooler)</span>
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                currentPaneer < parPaneer
                  ? "bg-rose-100 text-rose-700"
                  : currentPaneer < parPaneer * 1.5
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {currentPaneer < parPaneer ? "AUTO-PO DISPATCHED" : "HEALTHY"}
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-xl font-bold text-slate-900">{currentPaneer.toFixed(1)} kg</span>
            <span className="text-xs text-rose-600 font-semibold">
              -{(billedDishes * paneerDepletionPerDish).toFixed(1)} kg depleted
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                currentPaneer < parPaneer ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{ width: `${(currentPaneer / initialPaneer) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Par Level: {parPaneer.toFixed(0)} kg</span>
            <span>Batch Capacity: {initialPaneer.toFixed(0)} kg</span>
          </div>
        </div>
      </div>

      {/* Reorder Recommendation Box */}
      <div className="mt-4 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start space-x-2.5">
        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold text-amber-900">Resto Bird Predictive Intelligence:</span>
          <span className="text-amber-800 ml-1">
            Based on current depletion velocity, fresh paneer will breach minimum safety par within 3.5 hours.
            A draft Purchase Order for 15.0 kg has been pre-staged for vendor dispatch.
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   3. CATERING & BANQUETS SIMULATOR
------------------------------------------------------------- */
function CateringSimulator() {
  const [pax, setPax] = useState<number>(350);
  const [tier, setTier] = useState<"standard" | "royal" | "luxury">("royal");

  const tierRates = {
    standard: { rate: 38.0, name: "3-Course Classic" },
    royal: { rate: 52.0, name: "5-Course Royal Banquet" },
    luxury: { rate: 75.0, name: "7-Course Imperial Feast" },
  };

  const selectedTier = tierRates[tier];
  const contractTotal = pax * selectedTier.rate;
  const advanceDeposit = contractTotal * 0.5;

  // Bulk raw ingredient scaling
  const poultryKg = (pax * 0.28).toFixed(0);
  const riceKg = (pax * 0.14).toFixed(0);
  const appetizersCount = pax * 4;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 text-slate-800 font-sans space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Automated Banquet Multiplier & BEO Calculator</h4>
          <p className="text-xs text-slate-500">
            Slide the guest headcount and watch contract value, deposit schedule, and raw prep scale automatically.
          </p>
        </div>
        <div className="px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-mono font-semibold">
          10x Faster Quotations
        </div>
      </div>

      {/* Guest Headcount Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-700">Guest Count (PAX Scaling):</span>
          <span className="font-mono font-bold text-sm text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
            {pax} Guests
          </span>
        </div>
        <input
          type="range"
          min="50"
          max="800"
          step="25"
          value={pax}
          onChange={(e) => setPax(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>50 PAX (Intimate)</span>
          <span>350 PAX (Grand Wedding)</span>
          <span>800 PAX (Corporate Gala)</span>
        </div>
      </div>

      {/* Tier Selector */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {(["standard", "royal", "luxury"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
              tier === t
                ? "bg-sky-500 text-white border-sky-600 shadow-sm font-bold"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            <div className="text-[10px] uppercase opacity-80">{t}</div>
            <div className="text-xs sm:text-sm font-bold">${tierRates[t].rate}/guest</div>
          </button>
        ))}
      </div>

      {/* Live Financials & Raw BOM Scaling Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="font-bold text-slate-900 border-b border-slate-200 pb-1.5">
            Contract Financial Milestones
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Gross Contract Value:</span>
            <span className="font-mono font-bold text-slate-900">${contractTotal.toLocaleString()}.00</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">50% Advance Required:</span>
            <span className="font-mono font-bold text-emerald-700">${advanceDeposit.toLocaleString()}.00</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Per Plate Tier:</span>
            <span>{selectedTier.name}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="font-bold text-slate-900 border-b border-slate-200 pb-1.5">
            Automated Kitchen Prep Scaling
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Bulk Poultry Prep:</span>
            <span className="font-mono font-bold text-sky-700">{poultryKg} kg required</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Aged Basmati Rice:</span>
            <span className="font-mono font-bold text-sky-700">{riceKg} kg required</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Passed Hors d&apos;oeuvres:</span>
            <span className="font-mono font-bold text-sky-700">{appetizersCount} portions</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   4. SHIFTS & ROSTERS SIMULATOR
------------------------------------------------------------- */
function ShiftsSimulator() {
  const [swapApproved, setSwapApproved] = useState<boolean>(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 text-slate-800 font-sans space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Friday Dinner Rush Roster & Shift Trade Board</h4>
          <p className="text-xs text-slate-500">
            Peer-to-peer shift swaps with 1-tap manager approval and overtime protection.
          </p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
            swapApproved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {swapApproved ? "100% COVERAGE GUARANTEED" : "1 PENDING SHIFT TRADE"}
        </span>
      </div>

      {/* Roster Table */}
      <div className="space-y-2 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-900">Vikram R. (Executive Chef)</div>
            <div className="text-[11px] text-slate-500">Hot Kitchen Line • 14:00 - 23:00</div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-semibold">
            ASSIGNED • 38 hrs
          </span>
        </div>

        {/* Interactive Swap Row */}
        <div
          className={`p-3 rounded-xl border transition-all ${
            swapApproved
              ? "bg-emerald-50/70 border-emerald-200"
              : "bg-amber-50/70 border-amber-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900">
                {swapApproved ? "Sofia T. (Cover Accepted)" : "Liam K. (Original Assignee)"}
              </div>
              <div className="text-[11px] text-slate-600">
                Lead Bartender • 17:00 - 01:30 (Peak Bar Rush)
              </div>
            </div>
            <div className="text-right">
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  swapApproved ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900"
                }`}
              >
                {swapApproved ? "TRADE APPROVED" : "SWAP REQUESTED"}
              </span>
            </div>
          </div>

          {!swapApproved ? (
            <div className="mt-2.5 pt-2 border-t border-amber-200/80 flex items-center justify-between">
              <span className="text-[11px] text-amber-800">
                Sofia T. (32 hrs this week) offered to cover. Zero overtime violation.
              </span>
              <button
                onClick={() => setSwapApproved(true)}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95"
              >
                Approve Trade
              </button>
            </div>
          ) : (
            <div className="mt-2 pt-2 border-t border-emerald-200 text-[11px] text-emerald-800 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Shift transferred to Sofia T. Both employees notified via SMS & mobile push.</span>
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-900">Elena M. (Floor Captain)</div>
            <div className="text-[11px] text-slate-500">Dining Room • 16:30 - 00:00</div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-semibold">
            ASSIGNED • 36 hrs
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   5. ATTENDANCE & KIOSK SIMULATOR
------------------------------------------------------------- */
function AttendanceSimulator() {
  const [pin, setPin] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [clockedInCount, setClockedInCount] = useState<number>(24);

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        // Auto submit
        submitPin(nextPin);
      }
    }
  };

  const handleClear = () => {
    setPin("");
    setStatusMsg(null);
  };

  const submitPin = (enteredPin: string) => {
    setTimeout(() => {
      if (enteredPin === "1234" || enteredPin === "4821") {
        setStatusMsg("VERIFIED: Marcus Vance (Executive Sous Chef) Clocked In at 16:58:20");
        setClockedInCount((prev) => prev + 1);
        setPin("");
      } else {
        setStatusMsg(`PUNCH RECORDED: Staff ID #${enteredPin} Clocked In Successfully`);
        setClockedInCount((prev) => prev + 1);
        setPin("");
      }
    }, 400);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 text-slate-800 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Tablet Kiosk Time Clock Simulation</h4>
          <p className="text-xs text-slate-500">
            Mount any iPad or Android tablet at the kitchen entrance for 3-second PIN punches.
          </p>
        </div>
        <div className="px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-xs font-mono font-semibold">
          100% Time Theft Elimination
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-4 items-center">
        {/* Left: PIN Pad Simulator */}
        <div className="md:col-span-6 bg-slate-50/80 p-4 rounded-xl border border-slate-200 max-w-xs mx-auto w-full text-center space-y-3">
          <div className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">
            ENTER 4-DIGIT EMPLOYEE PIN
          </div>

          {/* PIN display dots */}
          <div className="flex justify-center space-x-3 py-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full border ${
                  i < pin.length ? "bg-slate-900 border-slate-900 scale-110" : "bg-white border-slate-300"
                } transition-all`}
              />
            ))}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"].map((key) => (
              <button
                key={key}
                onClick={() => {
                  if (key === "C") handleClear();
                  else if (key === "OK") {
                    if (pin.length > 0) submitPin(pin);
                  } else handleKeyPress(key);
                }}
                className="py-2.5 rounded-lg bg-white hover:bg-slate-200/80 text-slate-800 font-mono font-bold text-sm border border-slate-200/80 shadow-xs active:scale-95 transition-all"
              >
                {key}
              </button>
            ))}
          </div>

          <div className="text-[10px] text-slate-400">
            Demo: Type any 4 digits or click &ldquo;OK&rdquo; to simulate instant punch.
          </div>
        </div>

        {/* Right: Live Floor Presence Board */}
        <div className="md:col-span-6 space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-900 flex justify-between">
              <span>Live Floor Attendance Board</span>
              <span className="text-emerald-600 font-mono">Synced</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
              <div className="p-2 rounded-lg bg-white border border-slate-200">
                <div className="text-xl font-bold text-slate-900">{clockedInCount}</div>
                <div className="text-[9px] text-emerald-600 font-semibold uppercase">On Floor Now</div>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200">
                <div className="text-xl font-bold text-slate-900">3</div>
                <div className="text-[9px] text-amber-600 font-semibold uppercase">On Break</div>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200">
                <div className="text-xl font-bold text-slate-900">0</div>
                <div className="text-[9px] text-slate-400 uppercase">Unexcused</div>
              </div>
            </div>
          </div>

          {statusMsg ? (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium space-y-1 animate-fadeIn">
              <div className="flex items-center space-x-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Camera Verification Passed</span>
              </div>
              <p className="text-[11px] text-emerald-800">{statusMsg}</p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs flex items-center space-x-2">
              <Clock className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Kiosk waiting for next shift punch... Instant face photo audit enabled.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   6. PAYROLL & TIP POOL SIMULATOR
------------------------------------------------------------- */
function PayrollSimulator() {
  const [totalTips, setTotalTips] = useState<number>(3850);
  const [model, setModel] = useState<"hours" | "points">("hours");
  const [payslipsGenerated, setPayslipsGenerated] = useState<boolean>(false);

  // Split: 70% FOH, 30% BOH
  const fohShare = totalTips * 0.7;
  const bohShare = totalTips * 0.3;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 text-slate-800 font-sans space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Dynamic Tip Pool & 1-Click Salary Run</h4>
          <p className="text-xs text-slate-500">
            Distribute digital tips transparently and generate itemized staff payslips with zero disputes.
          </p>
        </div>
        <div className="px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono font-semibold">
          1-Click Salary Run
        </div>
      </div>

      {/* Tip Amount Slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-700">Weekly Card Tips Collected (POS Synced):</span>
          <span className="font-mono font-bold text-sm text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
            ${totalTips.toLocaleString()}.00
          </span>
        </div>
        <input
          type="range"
          min="1500"
          max="8000"
          step="250"
          value={totalTips}
          onChange={(e) => setTotalTips(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
        />
      </div>

      {/* Tip Distribution Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
          <div className="flex justify-between font-bold text-slate-900 border-b border-slate-200 pb-1">
            <span>Front of House Pool (70%)</span>
            <span className="text-rose-700 font-mono">${fohShare.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Eligible Server Hours:</span>
            <span className="font-mono">160 hrs</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Effective Tip Hourly Bump:</span>
            <span className="font-mono font-semibold text-emerald-700">+${(fohShare / 160).toFixed(2)}/hr</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
          <div className="flex justify-between font-bold text-slate-900 border-b border-slate-200 pb-1">
            <span>Back of House Kitchen (30%)</span>
            <span className="text-rose-700 font-mono">${bohShare.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Eligible Cook Hours:</span>
            <span className="font-mono">140 hrs</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Cook Tip Distribution:</span>
            <span className="font-mono font-semibold text-emerald-700">+${(bohShare / 140).toFixed(2)}/hr</span>
          </div>
        </div>
      </div>

      {/* 1-Click Action */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          Syncs verified kiosk clock hours, base pay, and overtime multiples into NACHA bank files.
        </div>
        <button
          onClick={() => setPayslipsGenerated(true)}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center space-x-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-rose-400" />
          <span className="inline-flex items-center gap-1.5">
            {payslipsGenerated ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>32 Payslips Dispatched</span>
              </>
            ) : (
              "Run 1-Click Payroll Batch"
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   7. FINANCE & P&L SIMULATOR
------------------------------------------------------------- */
function FinanceSimulator() {
  const [revenue, setRevenue] = useState<number>(135000);
  const [cogsPercent, setCogsPercent] = useState<number>(28);
  const [laborPercent, setLaborPercent] = useState<number>(29);

  const cogsAmount = revenue * (cogsPercent / 100);
  const laborAmount = revenue * (laborPercent / 100);
  const fixedOverhead = 22500; // Rent, utilities, licenses
  const netEbitda = revenue - cogsAmount - laborAmount - fixedOverhead;
  const ebitdaMargin = (netEbitda / revenue) * 100;
  const primeCost = cogsPercent + laborPercent;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 text-slate-800 font-sans space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Real-Time EBITDA & Prime Cost Simulator</h4>
          <p className="text-xs text-slate-500">
            Simulate food and labor cost shifts to see how restaurant net profitability reacts in real time.
          </p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
            primeCost <= 60 ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          Prime Cost: {primeCost.toFixed(1)}% {primeCost <= 60 ? "(Target Safe)" : "(High Risk >60%)"}
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="font-semibold text-slate-700">Monthly Gross Revenue:</span>
            <span className="font-mono font-bold text-slate-900">${revenue.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min="60000"
            max="250000"
            step="5000"
            value={revenue}
            onChange={(e) => setRevenue(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="font-semibold text-slate-700">Food Cost (COGS %):</span>
            <span className="font-mono font-bold text-slate-900">{cogsPercent}%</span>
          </div>
          <input
            type="range"
            min="24"
            max="38"
            value={cogsPercent}
            onChange={(e) => setCogsPercent(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
          />
        </div>
      </div>

      {/* Live Waterfall Statement */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs space-y-2">
        <div className="flex justify-between font-bold text-slate-900 pb-1 border-b border-slate-200">
          <span>Gross POS Sales Revenue</span>
          <span>+${revenue.toLocaleString()}.00</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>- Cost of Goods Sold (COGS {cogsPercent}%)</span>
          <span className="text-rose-600">-${cogsAmount.toLocaleString()}.00</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>- Total Shift Labor & Payroll ({laborPercent}%)</span>
          <span className="text-rose-600">-${laborAmount.toLocaleString()}.00</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>- Commercial Rent & Fixed Utilities</span>
          <span className="text-rose-600">-${fixedOverhead.toLocaleString()}.00</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-300 font-bold text-sm">
          <span className="text-slate-900">Net Operating EBITDA ({ebitdaMargin.toFixed(1)}%)</span>
          <span className={netEbitda >= 0 ? "text-emerald-700" : "text-rose-600"}>
            {netEbitda >= 0 ? `+$${netEbitda.toLocaleString()}.00` : `-$${Math.abs(netEbitda).toLocaleString()}.00`}
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   8. SECRETS VAULT & 2FA SIMULATOR
------------------------------------------------------------- */
function VaultSimulator() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(24);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard?.writeText?.(code.replace(/\s+/g, ""));
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 text-slate-800 font-sans space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-teal-600" />
          <h4 className="text-sm font-bold text-slate-900">Zero-Knowledge Encrypted Vault</h4>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <span className="text-xs font-mono font-bold text-teal-800">
            2FA TOTP: {secondsRemaining}s remaining
          </span>
        </div>
      </div>

      <div className="space-y-2.5 text-xs">
        {[
          {
            service: "UberEats Merchant Manager",
            user: "ops@restobird.com",
            code: "582 914",
            tag: "Delivery Aggregator",
          },
          {
            service: "DoorDash Merchant Portal",
            user: "director@restobird.com",
            code: "391 802",
            tag: "Delivery Aggregator",
          },
          {
            service: "Commercial Business Banking",
            user: "cfo@restobird.com",
            code: "831 409",
            tag: "Restricted: Owner Only",
          },
        ].map((item, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between hover:bg-slate-100/70 transition-all"
          >
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900">{item.service}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600 font-mono">
                  {item.tag}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">{item.user}</div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="text-right">
                <div className="font-mono font-bold text-sm tracking-widest text-teal-800">
                  {item.code}
                </div>
                <div className="text-[9px] text-slate-400 font-mono">Rolls in {secondsRemaining}s</div>
              </div>
              <button
                onClick={() => copyCode(item.code, idx)}
                className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-200 text-slate-700 transition-all active:scale-95"
                title="Copy 2FA Code"
              >
                {copiedIndex === idx ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-200/80 text-xs text-teal-900 flex items-center space-x-2">
        <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
        <span>
          <strong>No more late night calls:</strong> Store managers view the live rolling 2FA codes without
          calling the owner for SMS codes.
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   9. MENU ENGINEERING & BCG ANALYTICS SIMULATOR
------------------------------------------------------------- */
function AnalyticsSimulator() {
  const [selectedQuadrant, setSelectedQuadrant] = useState<"stars" | "plowhorses" | "puzzles" | "dogs">(
    "plowhorses"
  );
  const [priceBumpApplied, setPriceBumpApplied] = useState<boolean>(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6 text-slate-800 font-sans space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-bold text-slate-900">BCG Menu Engineering Matrix Explorer</h4>
          <p className="text-xs text-slate-500">
            Cross-references dish sales volume against raw recipe food cost to uncover hidden profit.
          </p>
        </div>
        <div className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-semibold">
          +14.8% Margin Lift
        </div>
      </div>

      {/* 2x2 Matrix Grid */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        {/* Stars */}
        <button
          onClick={() => setSelectedQuadrant("stars")}
          className={`p-3 rounded-xl text-left border transition-all ${
            selectedQuadrant === "stars"
              ? "bg-emerald-500 text-white border-emerald-600 shadow-sm font-bold"
              : "bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-950 border-emerald-200"
          }`}
        >
          <div className="text-[10px] uppercase tracking-wider opacity-80">High Volume • High Margin</div>
          <div className="font-bold text-sm mt-0.5 inline-flex items-center gap-1.5">
            <span>STARS</span>
            <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-400" />
          </div>
          <div className="text-[11px] opacity-90 mt-1">Chicken Dum Biryani (44% Margin)</div>
        </button>

        {/* Plowhorses */}
        <button
          onClick={() => setSelectedQuadrant("plowhorses")}
          className={`p-3 rounded-xl text-left border transition-all ${
            selectedQuadrant === "plowhorses"
              ? "bg-amber-500 text-white border-amber-600 shadow-sm font-bold"
              : "bg-amber-50/70 hover:bg-amber-100/70 text-amber-950 border-amber-200"
          }`}
        >
          <div className="text-[10px] uppercase tracking-wider opacity-80">High Volume • Low Margin</div>
          <div className="font-bold text-sm mt-0.5 inline-flex items-center gap-1.5">
            <span>PLOWHORSES</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div className="text-[11px] opacity-90 mt-1">Butter Naan (18% Margin)</div>
        </button>

        {/* Puzzles */}
        <button
          onClick={() => setSelectedQuadrant("puzzles")}
          className={`p-3 rounded-xl text-left border transition-all ${
            selectedQuadrant === "puzzles"
              ? "bg-sky-500 text-white border-sky-600 shadow-sm font-bold"
              : "bg-sky-50/70 hover:bg-sky-100/70 text-sky-950 border-sky-200"
          }`}
        >
          <div className="text-[10px] uppercase tracking-wider opacity-80">Low Volume • High Margin</div>
          <div className="font-bold text-sm mt-0.5 inline-flex items-center gap-1.5">
            <span>PUZZLES</span>
            <HelpCircle className="w-3.5 h-3.5" />
          </div>
          <div className="text-[11px] opacity-90 mt-1">Wild Truffle Risotto (58% Margin)</div>
        </button>

        {/* Dogs */}
        <button
          onClick={() => setSelectedQuadrant("dogs")}
          className={`p-3 rounded-xl text-left border transition-all ${
            selectedQuadrant === "dogs"
              ? "bg-rose-500 text-white border-rose-600 shadow-sm font-bold"
              : "bg-rose-50/70 hover:bg-rose-100/70 text-rose-950 border-rose-200"
          }`}
        >
          <div className="text-[10px] uppercase tracking-wider opacity-80">Low Volume • Low Margin</div>
          <div className="font-bold text-sm mt-0.5 inline-flex items-center gap-1.5">
            <span>UNDERPERFORMERS</span>
            <TrendingDown className="w-3.5 h-3.5" />
          </div>
          <div className="text-[11px] opacity-90 mt-1">Braised Lamb Shank (16% Margin)</div>
        </button>
      </div>

      {/* Resto Bird Tactical Action Recommendation */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <div className="font-bold text-slate-900 flex justify-between items-center">
          <span>
            Resto Bird Menu Engineering Recommendation:{" "}
            <span className="uppercase text-amber-700">{selectedQuadrant}</span>
          </span>
        </div>

        {selectedQuadrant === "plowhorses" && (
          <div className="space-y-2">
            <p className="text-slate-600">
              <strong>Butter Naan</strong> sells 1,450 orders monthly, but rising butter and flour prices
              eroded gross profit margin down to 18%.
            </p>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
              <span className="text-amber-900 font-medium">
                Recommendation: Bump price from $3.50 to $4.25 (+$0.75)
              </span>
              <button
                onClick={() => setPriceBumpApplied(!priceBumpApplied)}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded text-xs transition-all"
              >
                {priceBumpApplied ? "Revert Test" : "Simulate Price Bump"}
              </button>
            </div>
            {priceBumpApplied && (
              <div className="text-emerald-700 font-bold text-xs flex items-center space-x-1 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Impact: +$1,087.50 in pure monthly net margin with zero sales volume loss!</span>
              </div>
            )}
          </div>
        )}

        {selectedQuadrant === "stars" && (
          <p className="text-slate-600">
            <strong>Chicken Dum Biryani:</strong> Outstanding performance! Maintain recipe portion consistency
            and feature prominently in the top right corner of digital and print menus.
          </p>
        )}

        {selectedQuadrant === "puzzles" && (
          <p className="text-slate-600">
            <strong>Wild Truffle Risotto:</strong> High 58% margin but low guest ordering frequency. Train
            servers to recommend it as a dinner pairing special, or move it to chef recommendations.
          </p>
        )}

        {selectedQuadrant === "dogs" && (
          <p className="text-slate-600">
            <strong>Braised Lamb Shank:</strong> Ties up high prep labor and expensive cooler space with poor
            sales velocity. Candidate for immediate menu phase-out or 86.
          </p>
        )}
      </div>
    </div>
  );
}
