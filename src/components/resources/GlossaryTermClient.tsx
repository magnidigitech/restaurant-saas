"use client";

import React, { useState } from "react";
import Link from "next/link";
import { GlossaryTerm } from "@/lib/glossaryData";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import BookDemoModal from "@/components/landing/BookDemoModal";
import { Sparkles, HelpCircle, ArrowRight, BookOpen } from "lucide-react";

export default function GlossaryTermClient({ term }: { term: GlossaryTerm }) {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-900">
      <SiteHeader onOpenDemo={() => setIsDemoModalOpen(true)} />

      <main className="flex-grow">
        {/* Header */}
        <section className="bg-slate-900 text-white py-16 border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>RestoBird Restaurant Glossary • {term.category}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white">
              {term.term}
            </h1>
          </div>
        </section>

        {/* Definition Card */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          <div className="bg-amber-50 border-l-4 border-amber-400 p-6 rounded-r-3xl text-slate-800 text-base sm:text-lg font-medium leading-relaxed">
            <span className="font-bold text-amber-900 block text-xs uppercase tracking-wider mb-1 font-mono">Definition</span>
            {term.definition}
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Detailed Explanation</h2>
            <p className="text-slate-700 text-sm leading-relaxed">{term.explanation}</p>

            {term.keyFormula && (
              <div className="bg-slate-900 text-amber-300 font-mono text-xs p-4 rounded-2xl border border-slate-800">
                <span className="text-slate-400 text-[10px] block uppercase font-bold mb-1">Key Calculation Formula</span>
                {term.keyFormula}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Why It Matters for Restaurant Profitability</h2>
            <p className="text-slate-700 text-sm leading-relaxed">{term.whyItMatters}</p>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 space-y-4 border border-slate-800">
            <h2 className="text-xl font-bold text-white">How RestoBird Solves This</h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">{term.howRestoBirdHelps}</p>
            <div className="pt-2">
              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-all"
              >
                Schedule RestoBird Walkthrough
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
