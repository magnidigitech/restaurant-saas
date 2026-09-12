"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  RESTO_BIRD_MODULES,
  MODULE_CATEGORIES,
  ModuleData,
} from "@/lib/modulesData";
import {
  ArrowRight,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  Check,
  X,
  Layers,
  ShieldCheck,
  TrendingUp,
  MonitorSmartphone,
  Boxes,
  CalendarDays,
  Clock4,
  Receipt,
  LineChart,
  PieChart,
} from "lucide-react";

function getModuleIcon(slug: string) {
  switch (slug) {
    case "pos":
      return MonitorSmartphone;
    case "inventory":
      return Boxes;
    case "catering":
      return Sparkles;
    case "shifts":
      return CalendarDays;
    case "attendance":
      return Clock4;
    case "payroll":
      return Receipt;
    case "finance":
      return LineChart;
    case "vault":
      return ShieldCheck;
    case "analytics":
      return PieChart;
    default:
      return Sparkles;
  }
}

export default function ModulesCatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const modulesList = Object.values(RESTO_BIRD_MODULES);

  const filteredModules =
    selectedCategory === "all"
      ? modulesList
      : modulesList.filter((m) => m.category === selectedCategory);

  return (
    <div className="pb-24">
      {/* 1. HERO SECTION */}
      <section className="pt-10 pb-10 sm:pt-16 sm:pb-16 bg-gradient-to-b from-white via-slate-50/40 to-[#FAFAFA] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-4 sm:space-y-6">
          {/* Eyebrow badge (Single line, no awkward wrapping) */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50/90 border border-amber-200/80 text-amber-900 text-[11px] sm:text-xs font-mono font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>9 Unified Restaurant Modules</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.12] sm:leading-[1.08] max-w-3xl mx-auto">
            Every station. Every shift.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 block sm:inline">
              One operating system.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-base text-slate-500 max-w-xl mx-auto leading-relaxed font-normal px-2">
            Resto Bird replaces 7+ fragmented apps with a single, crash-proof platform.
            From front-of-house table turns and kitchen display routing to gram-level recipe
            depletion and automated payroll.
          </p>

          {/* Category Filter Pills (Apple Segmented Bar Style) */}
          <div className="pt-2 sm:pt-3 max-w-full overflow-x-auto scrollbar-none flex justify-start sm:justify-center px-1">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100/90 rounded-2xl sm:rounded-full border border-slate-200/70 shadow-xs">
              {MODULE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl sm:rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      isSelected
                        ? "bg-white text-slate-900 shadow-sm font-semibold ring-1 ring-slate-200/60"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    }`}
                  >
                    {cat.label}
                    {cat.id === "all" ? ` (${modulesList.length})` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 2. MODULE CARDS GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModules.map((module) => {
            const Icon = getModuleIcon(module.slug);
            return (
              <Link
                key={module.slug}
                href={`/${module.slug}`}
                className="group bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.07)] transition-all duration-300 p-6 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Icon + Stat Badge */}
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-200">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-sm font-bold text-slate-900 block">
                        {module.primaryStat}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                        {module.primaryStatLabel}
                      </span>
                    </div>
                  </div>

                  {/* Category & Title */}
                  <div className="mt-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {module.categoryLabel}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-700 transition-colors mt-0.5">
                      {module.name}
                    </h3>
                  </div>

                  {/* Clean 1-sentence value proposition (drop dense paragraph & italic quotes) */}
                  <p className="text-xs text-slate-500 leading-relaxed mt-2 line-clamp-2">
                    {module.tagline}
                  </p>

                  {/* Clean Feature Badges with Lucide Icons */}
                  <div className="flex flex-wrap gap-1.5 mt-4 pt-3.5 border-t border-slate-100">
                    {module.features.slice(0, 3).map((feat, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 text-[11px] font-medium text-slate-600 border border-slate-200/60"
                      >
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate max-w-[170px]">{feat.title}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Action Link */}
                <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-800 group-hover:text-amber-700 transition-colors">
                  <span>Explore {module.shortName}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. UNIFIED VS FRAGMENTED COMPARISON */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-24">
        <div className="rounded-3xl bg-white border border-slate-200 p-8 sm:p-12 shadow-sm space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-[11px] font-mono text-amber-700 font-bold uppercase tracking-wider">
              Total Cost of Ownership & Operations
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Why restaurants switch from fragmented tools to Resto Bird.
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Stop paying 6 different SaaS subscriptions for tools that don&apos;t talk to each other.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            {/* The Old Way */}
            <div className="p-6 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-3 text-xs">
              <div className="flex items-center space-x-2 font-bold text-rose-800 text-sm">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>The Fragmented Restaurant Stack</span>
              </div>
              <ul className="space-y-2 text-rose-900/80">
                <li className="flex items-start gap-2">
                  <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span>Separate POS that crashes when internet goes down</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span>Weekly inventory calculated in messy Excel spreadsheets</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span>Shift scheduling managed in chaotic WhatsApp group chats</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span>High employee time theft from buddy punching on punch clocks</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span>Tip pooling arguments between front and back of house</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span>Passwords stuck on Post-it notes near POS registers</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <span>$850 - $1,400 / month across 6 different software subscriptions</span>
                </li>
              </ul>
            </div>

            {/* The Resto Bird Way */}
            <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-3 text-xs">
              <div className="flex items-center space-x-2 font-bold text-emerald-800 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>The Resto Bird Unified Operating System</span>
              </div>
              <ul className="space-y-2 text-emerald-950">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Sub-second KDS with offline peer-to-peer mesh resilience</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Gram-level recipe depletion with automated vendor purchase orders</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Conflict-free shift scheduling with peer-to-peer trade board</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>100% time theft elimination with PIN & camera-verified tablet kiosk</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Automated tip pooling and 1-click monthly salary disbursements</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Zero-knowledge encrypted vault with built-in rolling 2FA authenticator</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>One simple, predictable monthly fee with 24/7 hospitality support</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BOTTOM BANNER */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 text-center space-y-6">
        <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
          Ready to see your restaurant differently?
        </h3>
        <p className="text-sm text-slate-500 max-w-xl mx-auto">
          Schedule a 15-minute 1-on-1 walkthrough with a restaurant operations specialist. We will
          simulate your exact floor plan, menu items, and station routing.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/restaurant/bahubali/login"
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full transition-all shadow-md active:scale-95"
          >
            Access Live Demo Outlet →
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs rounded-full transition-all"
          >
            Back to Overview
          </Link>
        </div>
      </section>
    </div>
  );
}
