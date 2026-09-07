"use client";

import React, { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import SmoothScrollProvider from "@/components/landing/SmoothScrollProvider";
import SpotlightFocusSection from "@/components/landing/SpotlightFocusSection";
import ModulesShowcaseScrollSection from "@/components/landing/ModulesShowcaseScrollSection";

const RestoBirdThreeScene = dynamic(
  () => import("@/components/landing/RestoBirdThreeScene"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[480px] flex items-center justify-center bg-[#080909]">
        <div className="flex items-center space-x-3 text-stone-500 font-mono text-xs uppercase tracking-widest">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>Initializing 3D Surveillance...</span>
        </div>
      </div>
    ),
  }
);

type ShowcaseTab = "floor" | "kitchen" | "inventory" | "console";

export default function RestoBirdLandingPage() {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("floor");
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);
  const [demoEmail, setDemoEmail] = useState<string>("");
  const [demoSubmitted, setDemoSubmitted] = useState<boolean>(false);

  const tabToZone: Record<ShowcaseTab, "dining" | "kitchen" | "storage" | "all"> = {
    floor: "dining",
    kitchen: "kitchen",
    inventory: "storage",
    console: "all",
  };

  const showcaseData: Record<
    ShowcaseTab,
    {
      title: string;
      image: string;
      badge: string;
      stat: string;
      statLabel: string;
      description: string;
    }
  > = {
    floor: {
      title: "Floor & Tables",
      image: "/images/resto-bird/scene-hero.jpg",
      badge: "FRONT OF HOUSE",
      stat: "34 min",
      statLabel: "Average table turnover",
      description: "Complete visual occupancy map. Monitor active bills, seating duration, and server section pacing in real time.",
    },
    kitchen: {
      title: "Kitchen Line",
      image: "/images/resto-bird/scene-kitchen.jpg",
      badge: "BACK OF HOUSE",
      stat: "< 11 min",
      statLabel: "Average cook duration",
      description: "Live station load balancing across ranges, ovens, and prep counters with sub-second KDS routing.",
    },
    inventory: {
      title: "Recipe BOM",
      image: "/images/resto-bird/scene-storage.jpg",
      badge: "CENTRAL STORAGE",
      stat: "99.8%",
      statLabel: "Recipe yield precision",
      description: "Automatic ingredient depletion down to the gram upon every POS sale, triggering par-level reorders before rush.",
    },
    console: {
      title: "Live Console",
      image: "/images/resto-bird/scene-dining.jpg",
      badge: "INTELLIGENCE LAYER",
      stat: "< 45ms",
      statLabel: "Sub-second event dispatch",
      description: "All signals from dining tables, line cook stations, and raw inventory unified into one responsive operating console.",
    },
  };



  return (
    <SmoothScrollProvider>
      <div className="min-h-screen bg-[#050505] text-[#F5F5F7] font-sans selection:bg-amber-500 selection:text-black relative overflow-x-clip antialiased">
        {/* 1. APPLE MINIMALIST NAVBAR */}
        <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#050505]/80 backdrop-blur-2xl transition-all">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            {/* Main Logo */}
            <Link href="/" className="flex items-center group">
              <img
                src="/resto-bird-logo.png"
                alt="Resto Bird"
                width={180}
                height={36}
                className="h-8 sm:h-9 w-auto object-contain group-hover:opacity-90 transition-opacity"
              />
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center space-x-8 text-[13px] font-medium text-stone-300">
              <a href="#overview" className="hover:text-white transition-colors">
                Platform
              </a>
              <a href="#modules" className="hover:text-white transition-colors">
                Modules
              </a>
              <a href="#scale" className="hover:text-white transition-colors">
                Multi-Outlet
              </a>
              <a href="#radar" className="hover:text-white transition-colors">
                Live Radar
              </a>
            </nav>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              <Link
                href="/restaurant/bahubali/login"
                className="text-[13px] font-medium text-stone-300 hover:text-white transition-colors px-2 py-1"
              >
                Sign In
              </Link>
              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-950 text-xs font-semibold rounded-full transition-all shadow-md active:scale-95"
              >
                Book a Demo
              </button>
            </div>
          </div>
        </header>

        {/* 2. HERO SECTION (Apple Clean Style) */}
        <section id="overview" className="pt-20 pb-28 md:pt-28 md:pb-36 relative overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-500/[0.04] rounded-full blur-[160px] pointer-events-none" />

          <div className="max-w-5xl mx-auto px-6 text-center space-y-7 relative z-10">
            {/* Eyebrow */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-amber-400/90 text-xs font-mono uppercase tracking-[0.2em]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Restaurant Operating Intelligence</span>
            </div>

            {/* Giant Apple Typography */}
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[1.02]">
              See your restaurant <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-stone-400">
                differently.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-stone-400 max-w-2xl mx-auto font-normal leading-relaxed">
              The intelligent operating system that gives you a complete bird&apos;s-eye view across kitchen, inventory, and floor operations.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="px-7 py-3.5 bg-white hover:bg-stone-200 text-stone-950 font-mono font-bold text-xs uppercase tracking-wider rounded-full transition-all shadow-xl active:scale-95"
              >
                Book a Demo
              </button>
              <a
                href="#modules"
                className="px-7 py-3.5 rounded-full border border-white/15 hover:border-white/30 text-stone-300 hover:text-white font-mono text-xs uppercase tracking-wider transition-all hover:bg-white/[0.03]"
              >
                Explore Modules ↓
              </a>
            </div>

            {/* 3. HERO CENTERPIECE SHOWCASE FRAME */}
            <div className="pt-14">
              {/* Clean Minimalist Tab Bar */}
              <div className="inline-flex items-center justify-center p-1.5 rounded-full bg-[#121417]/90 border border-white/10 max-w-xl mx-auto mb-7 backdrop-blur-2xl shadow-xl">
                {(["floor", "kitchen", "inventory", "console"] as ShowcaseTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-3 sm:px-5 rounded-full text-[11px] sm:text-xs font-mono tracking-wider uppercase transition-all ${
                      activeTab === tab
                        ? "bg-white/20 text-white font-bold shadow-md"
                        : "text-stone-400 hover:text-white"
                    }`}
                  >
                    {showcaseData[tab].title}
                  </button>
                ))}
              </div>

              {/* The Cinematic 3D Restaurant Canvas with Flying Surveillance Bird */}
              <div className="relative aspect-[16/10] sm:aspect-[16/9] min-h-[460px] sm:min-h-[580px] w-full rounded-[28px] sm:rounded-[36px] overflow-hidden border border-white/[0.1] bg-[#080909] shadow-[0_0_90px_rgba(0,0,0,0.85)]">
                <RestoBirdThreeScene focusedZone={tabToZone[activeTab]} />

                {/* Bottom Spec Pill */}
                <div className="absolute bottom-5 left-5 right-5 sm:bottom-6 sm:left-6 sm:right-6 p-4 sm:p-5 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left pointer-events-auto z-20 shadow-2xl">
                  <div>
                    <div className="text-[10px] font-mono text-amber-400 tracking-widest uppercase mb-1">
                      {showcaseData[activeTab].badge}
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-white max-w-2xl leading-relaxed">
                      {showcaseData[activeTab].description}
                    </div>
                  </div>
                  <div className="sm:text-right shrink-0 font-mono">
                    <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {showcaseData[activeTab].stat}
                    </div>
                    <div className="text-[10px] text-stone-400 uppercase tracking-wider">
                      {showcaseData[activeTab].statLabel}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. DESIGNED FOR WHAT HAPPENS MID-SHIFT (Toast-Style Interactive Scrolling Modules Showcase) */}
        <ModulesShowcaseScrollSection />

        {/* 5. MULTI-OUTLET SCALE */}
        <section id="scale" className="py-28 md:py-36 border-t border-white/[0.08] relative">
          <div className="max-w-6xl mx-auto px-6">
            <div className="rounded-[36px] bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-10 sm:p-16 text-center space-y-8">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-amber-400 text-xs font-mono uppercase tracking-widest">
                <span>Enterprise Architecture</span>
              </div>

              <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight max-w-3xl mx-auto">
                One bird&apos;s-eye view. <br />
                Every outlet.
              </h2>

              <p className="text-stone-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                Whether managing a flagship fine-dining room or scaling 100+ franchise locations across multiple cities, Resto Bird maintains single-pane operational clarity.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 max-w-3xl mx-auto font-mono text-xs">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="text-xl font-bold text-white">1 Outlet</div>
                  <div className="text-stone-400 text-[10px] uppercase mt-1">Station Precision</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="text-xl font-bold text-white">5 Outlets</div>
                  <div className="text-stone-400 text-[10px] uppercase mt-1">Store Transfers</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="text-xl font-bold text-white">25 Outlets</div>
                  <div className="text-stone-400 text-[10px] uppercase mt-1">BOM Uniformity</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="text-xl font-bold text-white">100+ Outlets</div>
                  <div className="text-stone-400 text-[10px] uppercase mt-1">National Telemetry</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. HARDWARE AGNOSTIC */}
        <section className="py-20 border-t border-white/[0.08] text-center">
          <div className="max-w-4xl mx-auto px-6 space-y-6">
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Runs on the devices you already own.
            </h3>
            <p className="text-stone-400 text-sm max-w-xl mx-auto">
              100% web-native. Compatible with iPads, Android terminals, standard thermal ESC/POS network printers, and digital scales.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-xs text-stone-300 pt-2">
              {["iPad iOS", "Android POS", "Thermal Printers", "Kitchen Displays", "Digital Scales"].map((hw) => (
                <span key={hw} className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08]">
                  {hw}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 8. INTERACTIVE SPOTLIGHT FOCUS SECTION (Tracks mouse cursor) */}
        <SpotlightFocusSection onBookDemo={() => setIsDemoModalOpen(true)} />

        {/* 9. MINIMALIST APPLE FOOTER */}
        <footer className="border-t border-white/[0.08] bg-[#030303] text-stone-400 py-16 font-mono text-xs">
          <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-3">
              <img
                src="/resto-bird-logo.png"
                alt="Resto Bird"
                className="h-7 w-auto object-contain"
              />
            </div>

            <div className="flex items-center space-x-6 text-stone-400 text-[11px]">
              <Link href="/restaurant/bahubali/login" className="hover:text-white transition-colors">
                Resto Bird Portal
              </Link>
              <a href="https://admin.restobird.com" className="hover:text-white transition-colors">
                Super Admin
              </a>
              <span className="text-stone-600">© {new Date().getFullYear()} Resto Bird Inc.</span>
            </div>
          </div>
        </footer>

        {/* BOOK A DEMO MODAL */}
        {isDemoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <div className="p-8 rounded-[32px] bg-stone-950 border border-white/15 max-w-md w-full shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <img
                  src="/resto-bird-logo.png"
                  alt="Resto Bird"
                  className="h-6 w-auto object-contain"
                />
                <button
                  onClick={() => setIsDemoModalOpen(false)}
                  className="text-stone-400 hover:text-white font-mono text-xs"
                >
                  ✕
                </button>
              </div>

              <div>
                <h3 className="text-2xl font-bold tracking-tight text-white">
                  See your restaurant differently.
                </h3>
                <p className="text-stone-400 text-xs mt-1">
                  Schedule a 15-minute 1-on-1 walkthrough tailored to your restaurant outlets.
                </p>
              </div>

              {demoSubmitted ? (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs text-center">
                  Request received. Our restaurant operations specialist will contact you shortly.
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (demoEmail) setDemoSubmitted(true);
                  }}
                  className="space-y-4 font-mono text-xs"
                >
                  <div>
                    <label className="text-stone-400 text-[10px] uppercase block mb-1">
                      Business Email
                    </label>
                    <input
                      type="email"
                      required
                      value={demoEmail}
                      onChange={(e) => setDemoEmail(e.target.value)}
                      placeholder="owner@restaurant.com"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/15 text-white placeholder:text-stone-600 focus:outline-none focus:border-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-white text-stone-950 font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg hover:bg-stone-200"
                  >
                    Confirm Walkthrough
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </SmoothScrollProvider>
  );
}
