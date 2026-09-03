"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export interface DetailedModule {
  id: string;
  name: string;
  category: "FOH" | "KITCHEN" | "WORKFORCE" | "FINANCE";
  badge: string;
  icon?: string;
  iconBg: string;
  iconColor: string;
  description: string;
  useCase: string;
  roiMetric: string;
  highlights: string[];
  roles: string[];
  beforeRestIQ: string;
  withRestIQ: string;
  demoUrl: string;
}

interface ModuleDetailModalProps {
  module: DetailedModule | null;
  onClose: () => void;
}

export default function ModuleDetailModal({ module, onClose }: ModuleDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (module) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [module, onClose]);

  if (!module) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-[#1a120b]/70 backdrop-blur-md transition-opacity animate-in fade-in"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#E8DFC8] overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="p-6 sm:p-8 bg-[#FAF6F0] border-b border-[#E8DFC8] flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${module.iconBg}`}>
                {module.badge}
              </span>
              <span className="text-xs font-mono text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                {module.roiMetric}
              </span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-[#1a120b] tracking-tight">
              {module.name}
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed max-w-xl">
              {module.description}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-700 flex items-center justify-center transition-colors text-lg font-bold"
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Target Roles */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 block mb-2">
              Restaurant Stakeholders & Roles
            </span>
            <div className="flex flex-wrap gap-2">
              {module.roles.map((role, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-950 text-xs font-semibold rounded-full border border-amber-200"
                >
                  <svg className="w-3.5 h-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{role}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Before vs With RestIQ Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-orange-50/70 rounded-2xl border border-orange-200 space-y-1.5">
              <span className="text-xs font-bold text-orange-800 uppercase tracking-wider flex items-center space-x-1">
                <span>✕</span>
                <span>Without RestIQ</span>
              </span>
              <p className="text-xs text-orange-950 leading-relaxed">
                {module.beforeRestIQ}
              </p>
            </div>

            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-1.5">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center space-x-1">
                <span>✓</span>
                <span>With RestIQ</span>
              </span>
              <p className="text-xs text-emerald-950 leading-relaxed">
                {module.withRestIQ}
              </p>
            </div>
          </div>

          {/* Operational Use Case */}
          <div className="p-4 bg-[#FCF9F5] rounded-2xl border border-[#EFE7DC] space-y-1">
            <span className="text-xs font-bold text-[#1a120b] uppercase tracking-wider block">
              Day-to-Day Restaurant Scenario
            </span>
            <p className="text-xs text-stone-600 italic leading-relaxed">
              &quot;{module.useCase}&quot;
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block">
              Native Capabilities in Bahubali Workspace
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {module.highlights.map((h, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-[#FCF9F5] border border-[#EFE7DC] text-xs text-stone-700 flex items-center space-x-2 font-medium"
                >
                  <span className="text-amber-600 font-bold">✓</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-[#FAF6F0] border-t border-[#E8DFC8] flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-xs text-stone-500">
            Active in Bahubali Restaurant space.
          </span>
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-300 bg-white"
            >
              Close
            </button>
            <Link
              href={module.demoUrl}
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 transition-all shadow-sm flex items-center justify-center space-x-1.5"
            >
              <span>Open Module in Bahubali</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
