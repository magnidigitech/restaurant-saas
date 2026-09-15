"use client";

import React, { useState } from "react";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import BookDemoModal from "@/components/landing/BookDemoModal";
import { Sparkles, Mail, Phone, MapPin, Building2, ShieldCheck } from "lucide-react";

export default function AboutClient() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-900">
      <SiteHeader onOpenDemo={() => setIsDemoModalOpen(true)} />

      <main className="flex-grow">
        <section className="bg-slate-900 text-white py-16 sm:py-20 border-b border-slate-800">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-4 text-center">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>About RestoBird</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white">
              The Unified Restaurant Operating System
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              RestoBird was founded to give restaurant operators bird&apos;s-eye visibility across dining rooms, kitchen lines, inventory depletion, and shift labor.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-14 space-y-12">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 space-y-4 shadow-xs">
            <h2 className="text-2xl font-bold text-slate-900">Our Mission</h2>
            <p className="text-slate-700 text-sm leading-relaxed">
              Hospitality operators spend far too many hours juggling separate systems for POS registers, kitchen tickets, paper shift rosters, food supplier invoices, and Excel inventory sheets. RestoBird unifies these operational layers into one connected system so owners can focus on delivering memorable guest experiences while protecting dish margins.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 text-base">Direct Contact</h3>
              <p className="text-xs text-slate-600">Email: getrestobird@gmail.com</p>
              <p className="text-xs text-slate-600">Phone: +1 (818) 497-4588</p>
              <p className="text-xs text-slate-600">Domain: restobird.com</p>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 text-base">Official Brand Presentation</h3>
              <p className="text-xs text-slate-600">Official Name: RestoBird</p>
              <p className="text-xs text-slate-600">Social Handles: @getrestobird</p>
              <p className="text-xs text-slate-600">Alternate Names: Resto Bird, Get RestoBird</p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter onOpenDemo={() => setIsDemoModalOpen(true)} />
      <BookDemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </div>
  );
}
