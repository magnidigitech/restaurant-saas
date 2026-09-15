"use client";

import React, { useState } from "react";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import BookDemoModal from "@/components/landing/BookDemoModal";
import { Sparkles, Calculator, RefreshCw, ArrowRight } from "lucide-react";

export default function FoodCostCalculatorClient() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  // State for Food Cost Calculator
  const [sellingPrice, setSellingPrice] = useState<number>(24.00);
  const [proteinCost, setProteinCost] = useState<number>(5.50);
  const [produceCost, setProduceCost] = useState<number>(1.20);
  const [dairyCost, setDairyCost] = useState<number>(0.80);
  const [otherCost, setOtherCost] = useState<number>(0.50);

  const totalPlateCost = proteinCost + produceCost + dairyCost + otherCost;
  const foodCostPercentage = sellingPrice > 0 ? (totalPlateCost / sellingPrice) * 100 : 0;
  const grossProfitMargin = sellingPrice - totalPlateCost;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-900">
      <SiteHeader onOpenDemo={() => setIsDemoModalOpen(true)} />

      <main className="flex-grow">
        <section className="bg-slate-900 text-white py-16 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Financial Tool</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white">
              Free Restaurant Food Cost & Dish Margin Calculator
            </h1>
            <p className="text-amber-300 text-sm sm:text-base max-w-2xl">
              Calculate exact cost-per-plate, food cost percentage, and gross profit margin in real time.
            </p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Inputs */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 space-y-6 shadow-xs">
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <Calculator className="w-5 h-5 text-amber-500" />
                <span>Recipe Ingredient Costs ($)</span>
              </h2>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Menu Dish Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.50"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Protein Cost ($)</label>
                    <input
                      type="number"
                      step="0.10"
                      value={proteinCost}
                      onChange={(e) => setProteinCost(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Produce Cost ($)</label>
                    <input
                      type="number"
                      step="0.10"
                      value={produceCost}
                      onChange={(e) => setProduceCost(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dairy & Oils ($)</label>
                    <input
                      type="number"
                      step="0.10"
                      value={dairyCost}
                      onChange={(e) => setDairyCost(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Spices & Packaging ($)</label>
                    <input
                      type="number"
                      step="0.10"
                      value={otherCost}
                      onChange={(e) => setOtherCost(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Calculations Result Output Card */}
            <div className="lg:col-span-5 bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-6 shadow-xl flex flex-col justify-between">
              <div className="space-y-6">
                <div className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider">Calculated Profitability</div>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Total Cost Per Plate</span>
                    <span className="text-xl font-extrabold text-white">${totalPlateCost.toFixed(2)}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Food Cost Percentage</span>
                    <span className={`text-xl font-extrabold ${foodCostPercentage <= 30 ? "text-emerald-400" : "text-amber-400"}`}>
                      {foodCostPercentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Gross Profit Per Dish</span>
                    <span className="text-xl font-extrabold text-emerald-400">${grossProfitMargin.toFixed(2)}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-xs text-amber-300 space-y-1">
                  <span className="font-bold uppercase tracking-wider block text-[10px]">Industry Benchmark</span>
                  <p>Target food cost % for full-service dining is between 28% and 32%.</p>
                </div>
              </div>

              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-2xl transition-all flex items-center justify-center space-x-2"
              >
                <span>Automate Food Costing with RestoBird</span>
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
