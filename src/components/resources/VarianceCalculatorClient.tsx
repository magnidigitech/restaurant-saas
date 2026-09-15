"use client";

import React, { useState } from "react";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import BookDemoModal from "@/components/landing/BookDemoModal";
import { Sparkles, Calculator, ArrowRight, ShieldAlert } from "lucide-react";

export default function VarianceCalculatorClient() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  // Calculator state
  const [monthlyPurchases, setMonthlyPurchases] = useState<number>(45000);
  const [estimatedVariancePct, setEstimatedVariancePct] = useState<number>(4.5);

  const monthlyLoss = (monthlyPurchases * estimatedVariancePct) / 100;
  const annualLoss = monthlyLoss * 12;
  const potentialSavingsWithRestoBird = annualLoss * 0.75; // RestoBird recovers ~75% of waste loss

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-900">
      <SiteHeader onOpenDemo={() => setIsDemoModalOpen(true)} />

      <main className="flex-grow">
        <section className="bg-slate-900 text-white py-16 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Loss Audit Tool</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white">
              Restaurant Inventory Variance & Shrinkage Loss Calculator
            </h1>
            <p className="text-amber-300 text-sm sm:text-base max-w-2xl">
              Audit how much money your kitchen loses to unrecorded waste, over-portioning, and inventory shrinkage.
            </p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Input Controls */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 space-y-6 shadow-xs">
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <Calculator className="w-5 h-5 text-amber-500" />
                <span>Monthly Store Metrics</span>
              </h2>

              <div className="space-y-6 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Monthly Food & Beverage Purchases ($)</label>
                  <input
                    type="number"
                    step="1000"
                    value={monthlyPurchases}
                    onChange={(e) => setMonthlyPurchases(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-slate-700 mb-1">
                    <span>Estimated Inventory Variance (%)</span>
                    <span className="text-amber-700 font-bold">{estimatedVariancePct}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="0.5"
                    value={estimatedVariancePct}
                    onChange={(e) => setEstimatedVariancePct(parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                    <span>1% (Optimal)</span>
                    <span>5% (Industry Avg)</span>
                    <span>12% (Severe Loss)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-5 bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-6 shadow-xl flex flex-col justify-between">
              <div className="space-y-6">
                <div className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Annual Financial Impact</span>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Monthly Inventory Loss</span>
                    <span className="text-xl font-extrabold text-rose-400">${monthlyLoss.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Annual Profit Loss</span>
                    <span className="text-xl font-extrabold text-rose-400">${annualLoss.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-between">
                    <span className="text-xs text-amber-300 font-medium">Recoverable with RestoBird</span>
                    <span className="text-xl font-extrabold text-emerald-400">${potentialSavingsWithRestoBird.toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-2xl transition-all flex items-center justify-center space-x-2"
              >
                <span>Stop Food Cost Leakage Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter onOpenDemo={() => setIsDemoModalOpen(true)} />
      <BookDemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </div>
  );
}
