"use client";

import React, { useState } from "react";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import BookDemoModal from "@/components/landing/BookDemoModal";
import { Sparkles, Check, ArrowRight, HelpCircle } from "lucide-react";

export default function PricingClient() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const plans = [
    {
      name: "Starter",
      badge: "Single Outlet",
      price: "$49",
      period: "/ month per location",
      description: "Ideal for independent cafes, bistros, and single-location restaurants needing core POS integration and inventory depletion.",
      features: [
        "Toast, Square, Clover POS Webhook Sync",
        "Gram-Level Recipe Depletion (BOM)",
        "Sub-Second Kitchen Display System (KDS)",
        "Basic Vendor Purchase Orders",
        "PIN-Verified Timeclock Kiosk",
        "Email & Chat Support"
      ],
      highlight: false,
    },
    {
      name: "Multi-Outlet Pro",
      badge: "Most Popular",
      price: "$119",
      period: "/ month per location",
      description: "Built for multi-location groups, high-volume QSRs, and expanding concepts needing vendor invoice auditing & tip pooling.",
      features: [
        "Everything in Starter Plan",
        "Automated Vendor Invoice Line-Item Audit",
        "Dynamic Par-Level Stockout Alerts",
        "Points & Hours-Based Automated Tip Pooling",
        "Inter-Store Inventory Transfers",
        "Menu Engineering Matrix Analytics",
        "Priority 24/7 Operations Support"
      ],
      highlight: true,
    },
    {
      name: "Enterprise Chain",
      badge: "Franchise & Custom",
      price: "Custom",
      period: "Tailored Billing",
      description: "For franchise networks, regional chains, and multi-unit groups needing dedicated SLA, custom API integrations, and secrets vaulting.",
      features: [
        "Everything in Multi-Outlet Pro",
        "Master Recipe Hierarchy Locks",
        "RestoBird Secrets Vault & 2FA Governance",
        "Dedicated Account Director",
        "Custom ERP & EDI Vendor Integrations",
        "Guaranteed 99.99% Uptime SLA"
      ],
      highlight: false,
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-900">
      <SiteHeader onOpenDemo={() => setIsDemoModalOpen(true)} />

      <main className="flex-grow">
        {/* Hero */}
        <section className="bg-slate-900 text-white py-16 border-b border-slate-800 text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simple, Transparent Pricing</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white">
              RestoBird Plans & Pricing
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
              No hidden hardware lock-ins. Simple pricing that scales with your restaurant outlets and transaction volume.
            </p>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, idx) => (
              <div
                key={idx}
                className={`rounded-3xl p-8 border flex flex-col justify-between transition-all ${
                  plan.highlight
                    ? "bg-slate-900 text-white border-slate-800 shadow-2xl scale-105"
                    : "bg-white text-slate-900 border-slate-200 shadow-xs"
                }`}
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        plan.highlight
                          ? "bg-amber-400 text-slate-950"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {plan.badge}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-2xl font-extrabold">{plan.name}</h2>
                    <div className="mt-2 flex items-baseline space-x-1">
                      <span className="text-4xl font-black">{plan.price}</span>
                      <span className={`text-xs ${plan.highlight ? "text-slate-400" : "text-slate-500"}`}>
                        {plan.period}
                      </span>
                    </div>
                  </div>

                  <p className={`text-xs leading-relaxed ${plan.highlight ? "text-slate-300" : "text-slate-600"}`}>
                    {plan.description}
                  </p>

                  <div className="space-y-3 pt-4 border-t border-slate-200/20">
                    <div className={`text-xs font-bold uppercase tracking-wider ${plan.highlight ? "text-amber-400" : "text-slate-700"}`}>
                      What&apos;s Included:
                    </div>
                    <ul className="space-y-2.5 text-xs">
                      {plan.features.map((ft, fIdx) => (
                        <li key={fIdx} className="flex items-start space-x-2.5">
                          <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? "text-amber-400" : "text-emerald-600"}`} />
                          <span className={plan.highlight ? "text-slate-200" : "text-slate-700"}>{ft}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    onClick={() => setIsDemoModalOpen(true)}
                    className={`w-full py-3.5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
                      plan.highlight
                        ? "bg-amber-400 hover:bg-amber-300 text-slate-950"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                  >
                    <span>Book Product Demo</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter onOpenDemo={() => setIsDemoModalOpen(true)} />
      <BookDemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </div>
  );
}
