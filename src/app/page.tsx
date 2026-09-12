"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  RESTO_BIRD_MODULES,
  MODULE_CATEGORIES,
} from "@/lib/modulesData";
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronDown,
  X,
  Check,
  MonitorSmartphone,
  Boxes,
  CalendarDays,
  Clock4,
  Receipt,
  LineChart,
  ShieldCheck,
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

export default function RestoBirdMainLandingPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);
  const [demoEmail, setDemoEmail] = useState<string>("");
  const [demoPhone, setDemoPhone] = useState<string>("");
  const [demoSubmitted, setDemoSubmitted] = useState<boolean>(false);

  const modulesList = Object.values(RESTO_BIRD_MODULES);

  const filteredModules =
    selectedCategory === "all"
      ? modulesList
      : modulesList.filter((m) => m.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans antialiased selection:bg-amber-100 selection:text-amber-900">
      {/* 1. MINIMALIST APPLE/LINEAR LIGHT HEADER */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Main Logo */}
          <Link href="/" className="flex items-center group">
            <img
              src="/resto-bird-logo.png"
              alt="Resto Bird"
              className="h-8 sm:h-9 w-auto object-contain group-hover:opacity-85 transition-opacity"
            />
          </Link>

          {/* Action CTAs: Only Sign In & Book a Demo */}
          <div className="flex items-center space-x-3">
            <Link
              href="/restaurant/bahubali/login"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 transition-colors"
            >
              Sign In
            </Link>
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-full transition-all shadow-sm active:scale-95 flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Book a Demo</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="pt-10 pb-10 sm:pt-16 sm:pb-16 bg-gradient-to-b from-white via-slate-50/40 to-[#FAFAFA] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-4 sm:space-y-6">
          {/* Eyebrow badge (Single line, no awkward wrapping) */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50/90 border border-amber-200/80 text-amber-900 text-[11px] sm:text-xs font-mono font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>9 Unified Restaurant Modules</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.12] sm:leading-[1.08] max-w-4xl mx-auto">
            Restaurant Management Software for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 block sm:inline">
              Every Station & Shift.
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

      {/* 3. MODULE CARDS GRID */}
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

      {/* 4. UNIFIED VS FRAGMENTED COMPARISON */}
      <section id="comparison" className="max-w-6xl mx-auto px-4 sm:px-6 pt-24">
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
                  <span>Eliminate buddy punching with PIN & camera-verified tablet kiosk</span>
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

      {/* 5. BOTTOM CALL TO ACTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center space-y-6">
        <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
          Ready to see your restaurant differently?
        </h3>
        <p className="text-sm text-slate-500 max-w-xl mx-auto">
          Schedule a 15-minute 1-on-1 walkthrough with a restaurant operations specialist. We will
          simulate your exact floor plan, menu items, and station routing.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full transition-all shadow-md active:scale-95 flex items-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Schedule 1-on-1 Walkthrough</span>
          </button>
          <Link
            href="/restaurant/bahubali/login"
            className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs rounded-full transition-all"
          >
            Access Live Demo Outlet →
          </Link>
        </div>
      </section>

      {/* 6. MINIMALIST CLEAN LIGHT FOOTER */}
      <footer className="border-t border-slate-200 bg-white text-slate-600 py-16 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-slate-100">
            {/* Col 1: Brand */}
            <div className="col-span-2 md:col-span-1 space-y-3">
              <Link href="/">
                <img
                  src="/resto-bird-logo.png"
                  alt="Resto Bird"
                  className="h-8 w-auto object-contain"
                />
              </Link>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                The unified restaurant operating system. Complete bird&apos;s-eye visibility across
                dining room, kitchen line, and inventory operations.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsDemoModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors"
                >
                  Schedule 1-on-1 Demo →
                </button>
              </div>
            </div>

            {/* Col 2: Front of House */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Front of House
              </div>
              <ul className="space-y-2">
                <li>
                  <Link href="/pos" className="hover:text-slate-900 transition-colors">
                    Point of Sale (POS)
                  </Link>
                </li>
                <li>
                  <Link href="/pos" className="hover:text-slate-900 transition-colors">
                    Sub-second KDS Kitchen
                  </Link>
                </li>
                <li>
                  <Link href="/catering" className="hover:text-slate-900 transition-colors">
                    Catering & Banquets
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Back of House */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Kitchen & Storage
              </div>
              <ul className="space-y-2">
                <li>
                  <Link href="/inventory" className="hover:text-slate-900 transition-colors">
                    Inventory & Recipe BOM
                  </Link>
                </li>
                <li>
                  <Link href="/analytics" className="hover:text-slate-900 transition-colors">
                    Menu Engineering Analytics
                  </Link>
                </li>
                <li>
                  <Link href="/inventory" className="hover:text-slate-900 transition-colors">
                    Central Commissary
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Workforce */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Workforce & HR
              </div>
              <ul className="space-y-2">
                <li>
                  <Link href="/shifts" className="hover:text-slate-900 transition-colors">
                    Shift Rosters & Swaps
                  </Link>
                </li>
                <li>
                  <Link href="/attendance" className="hover:text-slate-900 transition-colors">
                    Attendance & Kiosk Clock
                  </Link>
                </li>
                <li>
                  <Link href="/payroll" className="hover:text-slate-900 transition-colors">
                    Payroll & Tip Pooling
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 5: Financials & Security */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Finance & Security
              </div>
              <ul className="space-y-2">
                <li>
                  <Link href="/finance" className="hover:text-slate-900 transition-colors">
                    Finance & P&L Tracker
                  </Link>
                </li>
                <li>
                  <Link href="/vault" className="hover:text-slate-900 transition-colors">
                    Secrets Vault & 2FA
                  </Link>
                </li>
                <li>
                  <Link href="/analytics" className="hover:text-slate-900 transition-colors font-medium text-amber-700">
                    Menu Engineering →
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <div className="flex items-center space-x-6">
              <Link href="/" className="hover:text-slate-900 transition-colors font-semibold text-slate-800">
                Resto Bird Home
              </Link>
              <Link href="/restaurant/bahubali/login" className="hover:text-slate-900 transition-colors">
                Restaurant Portal
              </Link>
              <a href="https://admin.restobird.com" className="hover:text-slate-900 transition-colors">
                Super Admin
              </a>
            </div>
            <div>© {new Date().getFullYear()} Resto Bird Inc. All rights reserved.</div>
          </div>
        </div>
      </footer>

      {/* 7. BOOK A DEMO MODAL */}
      {isDemoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between">
              <img
                src="/resto-bird-logo.png"
                alt="Resto Bird"
                className="h-7 w-auto object-contain"
              />
              <button
                onClick={() => setIsDemoModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-mono uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>15-Minute Operational Walkthrough</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                See your restaurant differently.
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Schedule a 1-on-1 walkthrough tailored to your dining floor, kitchen stations,
                and raw recipe inventory.
              </p>
            </div>

            {demoSubmitted ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1 text-center">
                <div className="font-bold flex items-center justify-center space-x-1">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Request Received!</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Our restaurant operations specialist will contact you shortly to confirm your session.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (demoEmail) setDemoSubmitted(true);
                }}
                className="space-y-3.5 text-xs"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Business Email
                  </label>
                  <input
                    type="email"
                    required
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    placeholder="owner@yourrestaurant.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={demoPhone}
                    onChange={(e) => setDemoPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95"
                >
                  Confirm Walkthrough →
                </button>

                <p className="text-[10px] text-center text-slate-400">
                  No credit card required. Hardware agnostic deployment in 48 hours.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
