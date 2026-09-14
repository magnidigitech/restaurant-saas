"use client";

import React from "react";
import Link from "next/link";
import { Mail, Phone, ArrowUpRight } from "lucide-react";

export interface SiteFooterProps {
  onOpenDemo: () => void;
}

export default function SiteFooter({ onOpenDemo }: SiteFooterProps) {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 py-16 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Main Footer Links & Bio Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 border-b border-slate-100">
          {/* Col 1: Brand & Contact Info */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link href="/">
              <img
                src="/resto-bird-logo.png"
                alt="Resto Bird"
                className="h-8 w-auto object-contain"
              />
            </Link>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              The unified restaurant operating system. Complete bird&apos;s-eye visibility across
              dining room, kitchen line, and inventory operations.
            </p>

            {/* Direct Contact Details */}
            <div className="space-y-2 pt-1">
              <a
                href="mailto:getrestobird@gmail.com"
                className="flex items-center space-x-2 text-slate-700 hover:text-amber-700 transition-colors text-[11px] font-medium group"
              >
                <div className="w-6 h-6 rounded-lg bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center text-amber-700 transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">getrestobird@gmail.com</span>
              </a>

              <a
                href="tel:8184974588"
                className="flex items-center space-x-2 text-slate-700 hover:text-amber-700 transition-colors text-[11px] font-medium group"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center text-emerald-700 transition-colors">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <span>8184974588</span>
              </a>
            </div>

            {/* Social Media Platform Icons */}
            <div className="pt-2">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold mb-2">
                Connect With Us
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Facebook */}
                <a
                  href="https://www.facebook.com/getrestobird"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Resto Bird on Facebook"
                  title="Facebook - @getrestobird"
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-[#1877F2] text-slate-600 hover:text-white flex items-center justify-center transition-all shadow-xs hover:scale-105"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>

                {/* Instagram */}
                <a
                  href="https://www.instagram.com/getrestobird/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Resto Bird on Instagram"
                  title="Instagram - @getrestobird"
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-gradient-to-tr hover:from-amber-500 hover:via-rose-500 hover:to-purple-600 text-slate-600 hover:text-white flex items-center justify-center transition-all shadow-xs hover:scale-105"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>

                {/* X / Twitter */}
                <a
                  href="https://x.com/getrestobird"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Resto Bird on X"
                  title="X (Twitter) - @getrestobird"
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-black text-slate-600 hover:text-white flex items-center justify-center transition-all shadow-xs hover:scale-105"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>

                {/* Pinterest */}
                <a
                  href="https://in.pinterest.com/getrestobird/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Resto Bird on Pinterest"
                  title="Pinterest - @getrestobird"
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-[#E60023] text-slate-600 hover:text-white flex items-center justify-center transition-all shadow-xs hover:scale-105"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.592 0 12.017 0z" />
                  </svg>
                </a>

                {/* Product Hunt */}
                <a
                  href="https://www.producthunt.com/@getrestobird"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Resto Bird on Product Hunt"
                  title="Product Hunt - @getrestobird"
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-[#DA552F] text-slate-600 hover:text-white flex items-center justify-center transition-all shadow-xs hover:scale-105"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M13.604 8.4h-3.405v3.6h3.405c.995 0 1.801-.806 1.801-1.8s-.806-1.8-1.801-1.8zM12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm1.604 14.4h-3.405V18H7.8V6h5.804c2.981 0 5.401 2.42 5.401 5.4 0 2.98-2.42 5-5.401 5z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onOpenDemo}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors flex items-center space-x-1"
              >
                <span>Schedule 1-on-1 Demo</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
              </button>
            </div>
          </div>

          {/* Col 2: Front of House */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
              Front of House
            </div>
            <ul className="space-y-2">
              <li>
                <Link href="/pos" className="hover:text-slate-900 transition-colors">
                  POS Integrations (Toast, Square, Clover)
                </Link>
              </li>
              <li>
                <Link href="/pos" className="hover:text-slate-900 transition-colors">
                  Unified Orders Stream
                </Link>
              </li>
              <li>
                <Link href="/catering" className="hover:text-slate-900 transition-colors">
                  Catering & Banquets
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Back of House */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
              Kitchen & Storage
            </div>
            <ul className="space-y-2">
              <li>
                <Link href="/inventory" className="hover:text-slate-900 transition-colors">
                  Inventory & Recipe BOM
                </Link>
              </li>
              <li>
                <Link href="/analytics" className="hover:text-slate-900 transition-colors">
                  Menu Engineering Analytics
                </Link>
              </li>
              <li>
                <Link href="/inventory" className="hover:text-slate-900 transition-colors">
                  Central Commissary
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Workforce */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
              Workforce & HR
            </div>
            <ul className="space-y-2">
              <li>
                <Link href="/shifts" className="hover:text-slate-900 transition-colors">
                  Shift Rosters & Swaps
                </Link>
              </li>
              <li>
                <Link href="/attendance" className="hover:text-slate-900 transition-colors">
                  Attendance & Kiosk Clock
                </Link>
              </li>
              <li>
                <Link href="/payroll" className="hover:text-slate-900 transition-colors">
                  Payroll & Tip Pooling
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 5: Financials & Security */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
              Finance & Security
            </div>
            <ul className="space-y-2">
              <li>
                <Link href="/finance" className="hover:text-slate-900 transition-colors">
                  Finance & P&L Tracker
                </Link>
              </li>
              <li>
                <Link href="/vault" className="hover:text-slate-900 transition-colors">
                  Secrets Vault & 2FA
                </Link>
              </li>
              <li>
                <Link href="/analytics" className="hover:text-slate-900 transition-colors font-medium text-amber-700">
                  Menu Engineering →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & quick links */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div className="flex items-center space-x-6">
            <Link href="/" className="hover:text-slate-900 transition-colors font-semibold text-slate-800">
              Resto Bird Home
            </Link>
            <a href="mailto:getrestobird@gmail.com" className="hover:text-slate-900 transition-colors">
              getrestobird@gmail.com
            </a>
            <a href="tel:8184974588" className="hover:text-slate-900 transition-colors">
              8184974588
            </a>
          </div>
          <div>© {new Date().getFullYear()} Resto Bird Inc. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
}
