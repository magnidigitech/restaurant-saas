"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { WORLDWIDE_CURRENCIES, CurrencyOption } from "@/core/constants/locales";
import { useTheme } from "@/core/theme/ThemeContext";

interface SearchableCurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export default function SearchableCurrencySelect({
  value,
  onChange,
  className = "",
  disabled = false,
}: SearchableCurrencySelectProps) {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  const selectedCurrency = useMemo(() => {
    return WORLDWIDE_CURRENCIES.find((c) => c.code === value) || WORLDWIDE_CURRENCIES[0];
  }, [value]);

  const filteredCurrencies = useMemo(() => {
    if (!searchTerm.trim()) return WORLDWIDE_CURRENCIES;
    const term = searchTerm.toLowerCase();
    return WORLDWIDE_CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(term) ||
        c.name.toLowerCase().includes(term) ||
        c.symbol.toLowerCase().includes(term) ||
        c.label.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition cursor-pointer ${
          isDark
            ? "bg-[#0A0C12] border-white/[0.08] text-white hover:border-white/[0.18]"
            : "bg-[#F5F5F7] border-slate-200 text-slate-900 hover:border-slate-300"
        } ${isOpen ? "ring-2 ring-[#0071E3]/50 border-[#0071E3]" : ""}`}
      >
        <div className="flex items-center gap-2 truncate">
          <span className="font-bold text-[11px] px-1.5 py-0.5 rounded bg-blue-500/10 text-[#0071E3] dark:text-[#64B5FF]">
            {selectedCurrency.symbol}
          </span>
          <span className="font-semibold">{selectedCurrency.code}</span>
          <span className="opacity-60 text-[11px] truncate">({selectedCurrency.name})</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 opacity-60 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
            isDark ? "bg-[#121622]/95 border-white/[0.12] text-white shadow-black/80" : "bg-white/95 border-slate-200 text-slate-900 shadow-slate-900/15"
          }`}
        >
          {/* SEARCH INPUT */}
          <div className={`p-2.5 border-b ${isDark ? "border-white/[0.08] bg-white/[0.02]" : "border-slate-100 bg-slate-50/50"}`}>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search currency code, symbol, or country..."
                className={`w-full pl-8 pr-3.5 py-2 rounded-xl text-xs border focus:outline-none transition ${
                  isDark
                    ? "bg-[#090B10] border-white/[0.08] text-white placeholder-slate-500 focus:border-[#0071E3]"
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#0071E3]"
                }`}
              />
              <svg
                className="w-3.5 h-3.5 absolute left-2.5 top-3 opacity-40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* CURRENCY OPTIONS LIST */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {filteredCurrencies.length === 0 ? (
              <div className="py-6 text-center text-xs opacity-50">No matching currencies found</div>
            ) : (
              filteredCurrencies.map((c) => {
                const isSelected = c.code === value;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onChange(c.code);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? "bg-[#0071E3] text-white shadow-sm"
                        : isDark
                        ? "hover:bg-white/[0.06] text-slate-200"
                        : "hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? "bg-white/20 text-white" : "bg-slate-500/10 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {c.symbol}
                      </span>
                      <span className="font-semibold">{c.code}</span>
                      <span className={`text-[11px] truncate ${isSelected ? "text-blue-100" : "opacity-60"}`}>{c.name}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
