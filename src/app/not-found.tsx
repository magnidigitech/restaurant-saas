"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Home, Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col items-center justify-center p-6 text-center antialiased">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/80">
          <Sparkles className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-amber-700 uppercase tracking-wider bg-amber-50 px-3 py-1 rounded-full border border-amber-200/60">
            404 - Page Not Found
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight pt-2">
            Looking for a Resto Bird Station?
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            The page or route you requested does not exist or has been relocated.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center space-x-2"
          >
            <Home className="w-4 h-4 text-amber-400" />
            <span>Return to Resto Bird Home</span>
          </Link>
          <Link
            href="/pos"
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span>Explore Modules & POS Integrations</span>
          </Link>
        </div>

        <div className="text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-100">
          Resto Bird Unified Operating System | getrestobird@gmail.com
        </div>
      </div>
    </div>
  );
}
