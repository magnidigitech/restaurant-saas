import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, BookOpen, Layers, Target, ShieldCheck } from "lucide-react";

export interface ClusterLinkProps {
  categoryTitle?: string;
}

export default function ContentClusterLinks({ categoryTitle = "Explore RestoBird Network" }: ClusterLinkProps) {
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs my-10 space-y-6">
      <div className="flex items-center space-x-2 text-xs font-mono font-bold text-amber-700 uppercase tracking-wider">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span>{categoryTitle}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* 1. Core Feature Module Link */}
        <Link
          href="/inventory"
          className="group p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-amber-300 transition-all space-y-2"
        >
          <div className="flex items-center justify-between text-slate-500 font-mono text-[10px] uppercase font-bold">
            <span>Core System Module</span>
            <Layers className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <h4 className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
            Inventory & Recipe Depletion →
          </h4>
          <p className="text-[11px] text-slate-600">Track gram-level recipe ingredient usage from live POS tickets.</p>
        </Link>

        {/* 2. Solution Concept Link */}
        <Link
          href="/solutions/multi-location-restaurants"
          className="group p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-amber-300 transition-all space-y-2"
        >
          <div className="flex items-center justify-between text-slate-500 font-mono text-[10px] uppercase font-bold">
            <span>Concept Solution</span>
            <Target className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <h4 className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
            Multi-Outlet Chain Management →
          </h4>
          <p className="text-[11px] text-slate-600">Centralize store stock transfers, vendor POs, and outlet P&Ls.</p>
        </Link>

        {/* 3. Educational Guide Link */}
        <Link
          href="/use-cases/reduce-food-waste"
          className="group p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-amber-300 transition-all space-y-2"
        >
          <div className="flex items-center justify-between text-slate-500 font-mono text-[10px] uppercase font-bold">
            <span>Educational Playbook</span>
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <h4 className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
            Reduce Food Waste Guide →
          </h4>
          <p className="text-[11px] text-slate-600">Audit kitchen prep waste, over-portioning, and expired stock.</p>
        </Link>

        {/* 4. Conversion / Pricing Link */}
        <Link
          href="/pricing"
          className="group p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 hover:border-amber-400 transition-all space-y-2"
        >
          <div className="flex items-center justify-between text-amber-400 font-mono text-[10px] uppercase font-bold">
            <span>Plans & Pricing</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <h4 className="font-bold text-white group-hover:text-amber-300 transition-colors">
            Explore RestoBird Plans →
          </h4>
          <p className="text-[11px] text-slate-300">Compare Starter, Multi-Outlet Pro, and Enterprise setups.</p>
        </Link>
      </div>
    </div>
  );
}
