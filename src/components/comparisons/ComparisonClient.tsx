"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ComparisonItem } from "@/lib/comparisonsData";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import BookDemoModal from "@/components/landing/BookDemoModal";
import { Sparkles, Check, X, HelpCircle } from "lucide-react";

export default function ComparisonClient({ comparison }: { comparison: ComparisonItem }) {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-900">
      <SiteHeader onOpenDemo={() => setIsDemoModalOpen(true)} />

      <main className="flex-grow">
        {/* Hero */}
        <section className="bg-slate-900 text-white py-16 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Honest Product Comparison • {comparison.heroBadge}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
              {comparison.title}
            </h1>
            <p className="text-amber-300 text-base sm:text-lg font-medium">
              {comparison.subtitle}
            </p>
          </div>
        </section>

        {/* Verdict Box */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="text-xs font-mono font-bold text-amber-600 uppercase tracking-wider">Executive Verdict</div>
            <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
              {comparison.verdictSummary}
            </p>
          </div>
        </section>

        {/* Target Fit */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-emerald-50/60 rounded-3xl p-6 border border-emerald-200 space-y-2">
              <h3 className="text-base font-bold text-emerald-900">Choose RestoBird if:</h3>
              <p className="text-xs text-slate-700 leading-relaxed">{comparison.bestSuitedFor.restobird}</p>
            </div>
            <div className="bg-slate-100 rounded-3xl p-6 border border-slate-200 space-y-2">
              <h3 className="text-base font-bold text-slate-800">Choose Alternatives if:</h3>
              <p className="text-xs text-slate-700 leading-relaxed">{comparison.bestSuitedFor.competitor}</p>
            </div>
          </div>
        </section>

        {/* Feature Comparison Matrix Table */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Feature-by-Feature Matrix</h2>
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white font-mono uppercase text-[11px]">
                  <tr>
                    <th className="p-4">Feature</th>
                    <th className="p-4 text-amber-400 font-bold">RestoBird</th>
                    <th className="p-4 text-slate-300">Alternative</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparison.comparisonMatrix.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-semibold text-slate-900">{row.feature}</td>
                      <td className="p-4 text-slate-800 font-medium bg-amber-50/30">{row.restobird}</td>
                      <td className="p-4 text-slate-600">{row.competitor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {comparison.faqs.map((faq, i) => (
              <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200 space-y-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{faq.question}</span>
                </h3>
                <p className="text-xs text-slate-600 pl-6 leading-relaxed">{faq.answer}</p>
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
