"use client";

import React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export interface SiteHeaderProps {
  onOpenDemo: () => void;
}

export default function SiteHeader({ onOpenDemo }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Main Logo */}
        <Link href="/" className="flex items-center group">
          <img
            src="/resto-bird-logo.png"
            alt="Resto Bird"
            className="h-8 sm:h-9 w-auto object-contain group-hover:opacity-85 transition-opacity"
          />
        </Link>

        {/* Navigation & CTAs */}
        <div className="flex items-center space-x-4">
          <Link
            href="/blog"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors px-2 py-1"
          >
            Blog
          </Link>
          <button
            onClick={onOpenDemo}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-full transition-all shadow-sm active:scale-95 flex items-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Book a Demo</span>
          </button>
        </div>
      </div>
    </header>
  );
}
