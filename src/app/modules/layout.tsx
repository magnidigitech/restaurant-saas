"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RESTO_BIRD_MODULES } from "@/lib/modulesData";
import { ChevronDown, ArrowLeft, Check, Sparkles, X } from "lucide-react";

export default function ModulesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPhone, setDemoPhone] = useState("");
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  // Group modules by category for dropdown and footer
  const modulesList = Object.values(RESTO_BIRD_MODULES);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans antialiased selection:bg-amber-100 selection:text-amber-900">
      {/* 1. MINIMALIST APPLE/LINEAR LIGHT HEADER */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo */}
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

      {/* 2. PAGE CONTENT */}
      <main>{children}</main>

      {/* 3. MINIMALIST CLEAN LIGHT FOOTER */}
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
              <Link href="/" className="hover:text-slate-900 transition-colors">
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

      {/* 4. SHARED BOOK A DEMO MODAL (LIGHT MINIMALIST AESTHETIC) */}
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
                Experience Resto Bird in action.
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                See how our unified platform connects your kitchen line, floor tables, and inventory
                depletion in real time.
              </p>
            </div>

            {demoSubmitted ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1 text-center">
                <div className="font-bold flex items-center justify-center space-x-1">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Demo Request Confirmed!</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  Our restaurant operations specialist will reach out within 2 hours to confirm your
                  personalized walkthrough.
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
                    Work Email Address
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
                  Schedule Personalized Walkthrough →
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
