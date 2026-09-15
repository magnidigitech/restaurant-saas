"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SolutionItem, SOLUTIONS_DATA } from "@/lib/solutionsData";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import BookDemoModal from "@/components/landing/BookDemoModal";
import ContentClusterLinks from "@/components/common/ContentClusterLinks";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Boxes,
  MonitorSmartphone,
  Receipt,
  Users,
  LineChart,
  Coffee,
  HelpCircle,
  Zap,
} from "lucide-react";

export default function SolutionClient({ solution }: { solution: SolutionItem }) {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-900">
      <SiteHeader onOpenDemo={() => setIsDemoModalOpen(true)} />

      <main className="flex-grow">
        {/* Hero Banner */}
        <section className="relative overflow-hidden bg-slate-900 text-white py-16 sm:py-20 border-b border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/20 via-slate-900 to-slate-950 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>RestoBird Solutions • {solution.heroBadge}</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                {solution.title}
              </h1>
              <p className="text-amber-300 text-base sm:text-lg font-medium">
                {solution.subtitle}
              </p>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                {solution.description}
              </p>
              <div className="pt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setIsDemoModalOpen(true)}
                  className="px-6 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold rounded-2xl transition-all shadow-lg active:scale-95 flex items-center space-x-2 text-xs sm:text-sm"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>Book a Product Demo</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="bg-white border-b border-slate-200 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {solution.stats.map((st, i) => (
                <div key={i} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                  <div className="text-2xl sm:text-4xl font-extrabold text-slate-900">{st.value}</div>
                  <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">{st.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Operational Challenges Solved */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="max-w-2xl space-y-2 mb-8">
            <span className="text-xs font-mono text-amber-700 font-bold uppercase tracking-wider">Operational Reality</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Challenges Solved for {solution.targetAudience}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {solution.keyChallenges.map((ch, idx) => (
              <div key={idx} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-base font-bold text-slate-900">{ch.problem}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{ch.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* RestoBird Capabilities */}
        <section className="bg-white border-t border-b border-slate-200 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-2xl space-y-2 mb-8">
              <span className="text-xs font-mono text-amber-700 font-bold uppercase tracking-wider">RestoBird Engine</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Capabilities Built for Your Concept</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {solution.restobirdSolutions.map((sol, idx) => (
                <div key={idx} className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="text-base font-bold text-slate-900">{sol.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{sol.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Internal Content Cluster Links */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <ContentClusterLinks categoryTitle={`Related Systems for ${solution.title}`} />
        </section>

        {/* FAQs */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {solution.faqs.map((faq, i) => (
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
