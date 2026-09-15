"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, Menu, X } from "lucide-react";
import BookDemoModal from "@/components/landing/BookDemoModal";

export interface SiteHeaderProps {
  onOpenDemo?: () => void;
}

export default function SiteHeader({ onOpenDemo }: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [internalDemoOpen, setInternalDemoOpen] = useState(false);

  const handleDemoClick = () => {
    if (onOpenDemo) {
      onOpenDemo();
    } else {
      setInternalDemoOpen(true);
    }
  };

  const navLinks = [
    { label: "Solutions", href: "/solutions" },
    { label: "Use Cases", href: "/use-cases" },
    { label: "Comparisons", href: "/comparisons" },
    { label: "Pricing", href: "/pricing" },
    { label: "Blog", href: "/blog" },
    { label: "About", href: "/about" },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Main Logo */}
          <Link href="/" className="flex items-center group">
            <img
              src="/resto-bird-logo.png"
              alt="RestoBird"
              className="h-8 sm:h-9 w-auto object-contain group-hover:opacity-85 transition-opacity"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-100/80"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Header CTAs */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleDemoClick}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-full transition-all shadow-sm active:scale-95 flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Book a Demo</span>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1 shadow-lg">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-xs font-semibold text-slate-700 hover:text-amber-700 px-3 py-2 rounded-lg hover:bg-amber-50"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Internal Book Demo Modal Fallback */}
      {!onOpenDemo && (
        <BookDemoModal
          isOpen={internalDemoOpen}
          onClose={() => setInternalDemoOpen(false)}
        />
      )}
    </>
  );
}
