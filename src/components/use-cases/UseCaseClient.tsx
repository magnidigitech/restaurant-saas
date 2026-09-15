"use client";

import React, { useState } from "react";
import Link from "next/link";
import { UseCaseItem } from "@/lib/useCasesData";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import BookDemoModal from "@/components/landing/BookDemoModal";
import ContentClusterLinks from "@/components/common/ContentClusterLinks";
import { Sparkles, ArrowRight, CheckCircle2, HelpCircle } from "lucide-react";

export default function UseCaseClient({ useCase }: { useCase: UseCaseItem }) {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-900">
      <SiteHeader onOpenDemo={() => setIsDemoModalOpen(true)} />

      <main className="flex-grow">
        {/* Hero */}
        <section className="bg-slate-900 text-white py-16 sm:py-20 border-b border-slate-800 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Use Case & Problem Solver • {useCase.heroBadge}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
              {useCase.title}
            </h1>
            <p className="text-amber-300 text-base sm:text-lg font-medium">
              {useCase.subtitle}
            </p>
            <div className="pt-4">
              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="px-6 py-3.5 bg-amber-400 text-slate-950 font-bold rounded-2xl text-xs sm:text-sm hover:bg-amber-300 transition-all"
              >
                Book a Demo to Solve This
              </button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-white border-b border-slate-200 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {useCase.keyStats.map((st, i) => (
              <div key={i} className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <div className="text-2xl sm:text-4xl font-extrabold text-slate-900">{st.value}</div>
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">{st.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* The Problem */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="max-w-2xl space-y-2 mb-8">
            <span className="text-xs font-mono text-amber-700 font-bold uppercase tracking-wider">The Root Problem</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Why Restaurants Suffer from This</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {useCase.problemDetails.map((pd, i) => (
              <div key={i} className="p-6 rounded-3xl bg-white border border-slate-200 space-y-2">
                <h3 className="text-base font-bold text-slate-900">{pd.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{pd.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The RestoBird Solution */}
        <section className="bg-white border-t border-b border-slate-200 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-2xl space-y-2 mb-8">
              <span className="text-xs font-mono text-amber-700 font-bold uppercase tracking-wider">The Solution</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">How RestoBird Solves It</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {useCase.solutionFeatures.map((sf, i) => (
                <div key={i} className="p-6 rounded-3xl bg-slate-50 border border-slate-200 space-y-2">
                  <h3 className="text-base font-bold text-slate-900">{sf.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{sf.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Step by step */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">3-Step Implementation Workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {useCase.stepByStepProcess.map((step, i) => (
              <div key={i} className="p-6 rounded-3xl bg-white border border-slate-200 space-y-2">
                <span className="text-xs font-mono font-bold text-amber-600">STEP {step.step}</span>
                <h3 className="text-base font-bold text-slate-900">{step.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Internal Content Cluster Links */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <ContentClusterLinks categoryTitle="Related Operational Solutions" />
        </section>

        {/* FAQs */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {useCase.faqs.map((faq, i) => (
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
