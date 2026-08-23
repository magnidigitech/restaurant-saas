"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { WORLDWIDE_TIMEZONES } from "@/core/constants/locales";
import { useTheme } from "@/core/theme/ThemeContext";

interface SearchableTimezoneSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

// Helper to calculate GMT offset string like "(GMT-08:00)" or "(GMT+05:30)"
function getGMTOffset(timeZone: string): string {
  try {
    const now = new Date();
    const tzString = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).format(now);

    const match = tzString.match(/GMT([+-]\d+)?(?::(\d+))?/);
    if (!match) return "(GMT+00:00)";
    if (!match[1]) return "(GMT+00:00)";

    let rawOffset = match[1];
    const isNegative = rawOffset.startsWith("-");
    const absVal = rawOffset.replace(/[+-]/, "");
    const parts = absVal.split(":");
    const hours = parseInt(parts[0], 10) || 0;
    const mins = parts[1] ? parseInt(parts[1], 10) : 0;

    const formattedHours = String(hours).padStart(2, "0");
    const formattedMins = String(mins).padStart(2, "0");
    const sign = isNegative ? "-" : "+";

    return `(GMT${sign}${formattedHours}:${formattedMins})`;
  } catch {
    return "(GMT+00:00)";
  }
}

// Helper to get formatted local time e.g. "5:36am"
function getLocalTime(timeZone: string): string {
  try {
    return new Date()
      .toLocaleTimeString("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase()
      .replace(" ", "");
  } catch {
    return "";
  }
}

export default function SearchableTimezoneSelect({
  value,
  onChange,
  className = "",
  disabled = false,
}: SearchableTimezoneSelectProps) {
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

  // Enrich timezone list with GMT offsets and live time
  const enrichedOptions = useMemo(() => {
    return WORLDWIDE_TIMEZONES.map((tz) => {
      const gmt = getGMTOffset(tz.value);
      const time = getLocalTime(tz.value);
      return {
        ...tz,
        gmt,
        time,
        cleanName: tz.label.replace(/^.*?\(|\)$/g, "").split("-")[0].trim(),
      };
    });
  }, []);

  const selectedOption = useMemo(() => {
    return enrichedOptions.find((tz) => tz.value === value) || enrichedOptions[0];
  }, [enrichedOptions, value]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return enrichedOptions;
    const term = searchTerm.toLowerCase();
    return enrichedOptions.filter(
      (tz) =>
        tz.label.toLowerCase().includes(term) ||
        tz.value.toLowerCase().includes(term) ||
        tz.region.toLowerCase().includes(term) ||
        tz.gmt.toLowerCase().includes(term)
    );
  }, [enrichedOptions, searchTerm]);

  // Group by Region
  const groupedOptions = useMemo(() => {
    const map = new Map<string, typeof enrichedOptions>();
    filteredOptions.forEach((tz) => {
      const region = tz.region || "Other";
      if (!map.has(region)) map.set(region, []);
      map.get(region)!.push(tz);
    });
    return map;
  }, [filteredOptions]);

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
        <div className="flex items-center gap-2 truncate pr-2">
          <span className="font-mono text-[11px] font-semibold text-[#0071E3] dark:text-[#64B5FF] shrink-0">
            {selectedOption.gmt}
          </span>
          <span className="truncate">{selectedOption.label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold font-mono opacity-80">{selectedOption.time}</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 opacity-60 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* DROPDOWN MENU POPOVER */}
      {isOpen && (
        <div
          className={`absolute left-0 top-full mt-1.5 z-[9999] w-[340px] sm:w-[420px] max-w-[90vw] rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? "bg-[#121622] border-white/[0.15] text-white shadow-black/90"
              : "bg-white border-slate-200 text-slate-900 shadow-slate-900/25"
          }`}
        >
          {/* SEARCH HEADER */}
          <div className={`p-2.5 border-b ${isDark ? "border-white/[0.08] bg-white/[0.03]" : "border-slate-100 bg-slate-50"}`}>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search city, region, or GMT offset (e.g. GMT-5)..."
                className={`w-full pl-8 pr-3.5 py-2 rounded-xl text-xs border focus:outline-none transition ${
                  isDark
                    ? "bg-[#090B10] border-white/[0.1] text-white placeholder-slate-400 focus:border-[#0071E3]"
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#0071E3]"
                }`}
              />
              <svg
                className="w-3.5 h-3.5 absolute left-2.5 top-3 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* LIST OF TIMEZONES */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-2.5">
            {groupedOptions.size === 0 ? (
              <div className="py-6 text-center text-xs opacity-60">No matching timezones found</div>
            ) : (
              Array.from(groupedOptions.entries()).map(([region, options]) => (
                <div key={region} className="space-y-1">
                  {/* REGION HEADER */}
                  <div
                    className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {region}
                  </div>

                  {/* REGION OPTIONS */}
                  {options.map((tz) => {
                    const isSelected = tz.value === value;
                    return (
                      <button
                        key={tz.value}
                        type="button"
                        onClick={() => {
                          onChange(tz.value);
                          setIsOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? "bg-[#0071E3] text-white shadow-md font-semibold"
                            : isDark
                            ? "hover:bg-white/[0.08] text-slate-200"
                            : "hover:bg-slate-100 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span
                            className={`font-mono text-[11px] shrink-0 font-medium ${
                              isSelected ? "text-blue-100" : "text-[#0071E3] dark:text-[#64B5FF]"
                            }`}
                          >
                            {tz.gmt}
                          </span>
                          <span className="truncate">{tz.label}</span>
                        </div>
                        <span
                          className={`font-mono text-[11px] font-bold shrink-0 ${
                            isSelected ? "text-white" : isDark ? "text-slate-300" : "text-slate-700"
                          }`}
                        >
                          {tz.time}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
