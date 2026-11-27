"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
  searchText?: string;
}

interface SearchableComboboxProps {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isDark?: boolean;
  error?: string | null;
  modalContainerRef?: React.RefObject<HTMLElement | null>;
}

export default function SearchableCombobox({
  id,
  label,
  required,
  value,
  onChange,
  options,
  placeholder = "Search or select...",
  isOpen,
  onOpenChange,
  isDark = false,
  error,
  modalContainerRef,
}: SearchableComboboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  const [query, setQuery] = useState("");
  const [hasTyped, setHasTyped] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const [panelMaxHeight, setPanelMaxHeight] = useState<number>(220);

  // Restore selected label whenever closed or value changes externally
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setHasTyped(false);
    }
  }, [isOpen, value]);

  const filteredOptions = useMemo(() => {
    const q = hasTyped ? query.trim().toLowerCase() : "";
    const matches = q
      ? options.filter((o) =>
          (o.searchText || o.label).toLowerCase().includes(q)
        )
      : options;
    return matches.slice(0, 5);
  }, [options, query, hasTyped]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  // Compute placement (above vs below) and max height inside visible modal & visualViewport
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const inputEl = inputRef.current;
      if (!inputEl) return;

      const rect = inputEl.getBoundingClientRect();
      const vv = window.visualViewport;
      const vpTop = vv ? vv.offsetTop : 0;
      const vpHeight = vv ? vv.height : window.innerHeight;
      const vpBottom = vpTop + vpHeight;

      const modalRect = modalContainerRef?.current?.getBoundingClientRect();
      const boundTop = modalRect ? Math.max(vpTop, modalRect.top) : vpTop;
      const boundBottom = modalRect ? Math.min(vpBottom, modalRect.bottom) : vpBottom;

      const spaceBelow = Math.max(0, boundBottom - rect.bottom - 8);
      const spaceAbove = Math.max(0, rect.top - boundTop - 8);

      if (spaceBelow < 160 && spaceAbove > spaceBelow) {
        setPlacement("top");
        setPanelMaxHeight(Math.max(88, Math.min(220, spaceAbove)));
      } else {
        setPlacement("bottom");
        setPanelMaxHeight(Math.max(88, Math.min(220, spaceBelow)));
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    const modalEl = modalContainerRef?.current;
    modalEl?.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
      modalEl?.removeEventListener("scroll", updatePosition);
    };
  }, [isOpen, modalContainerRef]);

  // Dismiss on outside click/tap
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [isOpen, onOpenChange]);

  const selectOption = (opt: ComboboxOption) => {
    onChange(opt.value);
    setQuery("");
    setHasTyped(false);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      onOpenChange(true);
      return;
    }

    if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setQuery("");
        setHasTyped(false);
        onOpenChange(false);
      }
      return;
    }

    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filteredOptions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        setActiveIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = filteredOptions[activeIndex];
      if (chosen) {
        selectOption(chosen);
      }
    } else if (e.key === "Tab") {
      onOpenChange(false);
    }
  };

  const displayValue = isOpen && hasTyped ? query : selectedOption?.label ?? "";
  const listboxId = `${id}-listbox`;
  const errorId = `${id}-error`;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block font-medium mb-1 opacity-70">
        {label}
        {required ? " *" : ""}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && filteredOptions[activeIndex]
              ? `${id}-option-${activeIndex}`
              : undefined
          }
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          required={required}
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => {
            if (!isOpen) {
              setHasTyped(false);
              setQuery("");
              onOpenChange(true);
            }
          }}
          onClick={() => {
            if (!isOpen) {
              setHasTyped(false);
              setQuery("");
              onOpenChange(true);
            }
          }}
          onChange={(e) => {
            setHasTyped(true);
            setQuery(e.target.value);
            if (!isOpen) onOpenChange(true);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full pr-8 pl-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-[#0071E3] ${
            error
              ? "border-rose-500"
              : isDark
              ? "bg-[#0A0C12] border-white/10 text-white"
              : "bg-slate-50 border-slate-200 text-slate-900"
          } ${isDark ? "bg-[#0A0C12] text-white" : "bg-slate-50 text-slate-900"}`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Toggle ${label} options`}
          onClick={() => {
            if (isOpen) {
              onOpenChange(false);
            } else {
              setHasTyped(false);
              setQuery("");
              onOpenChange(true);
              inputRef.current?.focus();
            }
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-[11px] text-rose-500 mt-1">
          {error}
        </p>
      )}

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          style={{ maxHeight: `${panelMaxHeight}px` }}
          className={`absolute left-0 right-0 z-50 overflow-y-auto rounded-xl border shadow-xl py-1 text-xs ${
            placement === "top" ? "bottom-full mb-1" : "top-full mt-1"
          } ${
            isDark
              ? "bg-[#161B29] border-white/15 text-white"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2.5 text-slate-400 select-none">No matches found</li>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === activeIndex;
              return (
                <li
                  key={`${opt.value}-${idx}`}
                  id={`${id}-option-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(opt);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`px-3 py-2.5 min-h-[40px] flex items-center justify-between cursor-pointer select-none ${
                    isHighlighted
                      ? isDark
                        ? "bg-[#0071E3]/25 text-white"
                        : "bg-blue-50 text-blue-900"
                      : ""
                  } ${isSelected ? "font-semibold" : ""}`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <span className="text-[10px] text-[#0071E3] ml-2 shrink-0">Selected</span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
