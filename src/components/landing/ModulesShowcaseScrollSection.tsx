"use client";

import React, { useState, useEffect, useRef } from "react";

interface RestaurantModule {
  id: string;
  name: string;
  tag: string;
  takeaway: string;
  description: string;
  stat: string;
  statLabel: string;
  accentColor: string;
  previewType:
    | "pos"
    | "inventory"
    | "catering"
    | "shifts"
    | "attendance"
    | "payroll"
    | "finance"
    | "vault"
    | "analytics";
}

const MODULES_DATA: RestaurantModule[] = [
  {
    id: "pos",
    name: "Point of Sale (POS)",
    tag: "OFFLINE MESH & KDS",
    takeaway: "Keep serving customers, even without internet.",
    description:
      "Digital floor table management, lightning-fast split checks, course pacing, and sub-second KDS kitchen routing powered by peer-to-peer offline local mesh resilience.",
    stat: "< 45ms",
    statLabel: "KDS ticket dispatch latency",
    accentColor: "amber",
    previewType: "pos",
  },
  {
    id: "inventory",
    name: "Inventory & Recipe BOM",
    tag: "CENTRAL STORE & GRAM-LEVEL DEPLETION",
    takeaway: "Every dish billed depletes raw stock down to the gram.",
    description:
      "Real-time central storage ledger, automated par-level reorders before rush, wastage logs, and multi-unit recipe costing that eliminates unexplained shrinkage.",
    stat: "99.8%",
    statLabel: "Recipe yield precision",
    accentColor: "emerald",
    previewType: "inventory",
  },
  {
    id: "catering",
    name: "Catering & Banquets",
    tag: "BANQUETS & PAX SCALING",
    takeaway: "Scale 500-guest banquets and bulk raw material purchase orders in seconds.",
    description:
      "End-to-end banquet workflow: per-pax tiered packages, automated ingredient scaling multiplier, advance deposit tracking, and printable contract invoicing.",
    stat: "10x",
    statLabel: "Faster quotation & prep scaling",
    accentColor: "sky",
    previewType: "catering",
  },
  {
    id: "shifts",
    name: "Shift Rosters & Swaps",
    tag: "AI SCHEDULING & ROSTERS",
    takeaway: "Auto-balance overtime and let staff swap shifts in two taps.",
    description:
      "Conflict-free shift scheduling, staff availability collection, automated overtime fatigue warnings, and manager-approved peer-to-peer shift trade board.",
    stat: "0%",
    statLabel: "Uncovered rush shifts",
    accentColor: "indigo",
    previewType: "shifts",
  },
  {
    id: "attendance",
    name: "Attendance & Kiosk",
    tag: "PIN & KIOSK CLOCK-IN",
    takeaway: "PIN-verified terminal punch with live floor attendance board.",
    description:
      "Dedicated tablet kiosk mode, secure PIN punch, break time tracking, geofence validation, and live floor presence sync directly to the manager console.",
    stat: "100%",
    statLabel: "Time theft elimination",
    accentColor: "purple",
    previewType: "attendance",
  },
  {
    id: "payroll",
    name: "Payroll & Tip Pooling",
    tag: "AUTOMATED PAYROLL & TIPS",
    takeaway: "Fair tip pool distribution and 1-click monthly salary disbursements.",
    description:
      "Dynamic hours-based and point-based tip distribution rules, automated tax/PF deductions, shift attendance auto-sync, and downloadable payslips.",
    stat: "1-Click",
    statLabel: "Salary run & payslip dispatch",
    accentColor: "rose",
    previewType: "payroll",
  },
  {
    id: "finance",
    name: "Finance & P&L Tracker",
    tag: "REAL-TIME EBITDA & BILL REMINDERS",
    takeaway: "Automated expense aggregation with zero manual bookkeeping.",
    description:
      "Synchronizes daily POS revenue, purchase order invoices, and payroll runs across 15 standard accounting categories with automated recurring bill reminders.",
    stat: "Real-time",
    statLabel: "EBITDA & net margin visibility",
    accentColor: "amber",
    previewType: "finance",
  },
  {
    id: "vault",
    name: "Secrets Vault & 2FA",
    tag: "ZERO-KNOWLEDGE CREDENTIAL VAULT",
    takeaway: "Enterprise zero-knowledge security for aggregator & banking credentials.",
    description:
      "Bank-grade encrypted credential storage for UberEats, DoorDash, Swiggy, banking portals, and Wi-Fi router keys with built-in 2FA TOTP authenticator and role sharing.",
    stat: "AES-256",
    statLabel: "Zero-knowledge encryption",
    accentColor: "teal",
    previewType: "vault",
  },
  {
    id: "analytics",
    name: "Menu Engineering Analytics",
    tag: "BCG MATRIX & PROFIT EXPANSION",
    takeaway: "Identify Stars, Plowhorses, Puzzles, and Dogs in real time.",
    description:
      "Cross-references dish sales volume against raw ingredient margin. Uncovers hidden food cost variances and recommends menu price adjustments before margins slip.",
    stat: "+14.8%",
    statLabel: "Gross margin expansion",
    accentColor: "amber",
    previewType: "analytics",
  },
];

export default function ModulesShowcaseScrollSection() {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const outerSectionRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeModule = MODULES_DATA[activeIndex];

  const isClickingRef = useRef<boolean>(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // APPLE-STYLE PINNED SCROLL PROGRESSION:
  // As the user scrolls down the page, this section pins to the viewport,
  // switching through tabs 01 to 09, and naturally unpins to the next section at the end.
  useEffect(() => {
    const handleScroll = () => {
      // Ignore scroll events during programmatic tab clicks to prevent intermediate flickering
      if (isClickingRef.current) return;

      const outer = outerSectionRef.current;
      if (!outer) return;

      const rect = outer.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const totalScrollDistance = rect.height - windowHeight;

      if (totalScrollDistance <= 0) return;

      // Distance scrolled into the pinned section
      const currentScroll = -rect.top;

      if (currentScroll <= 0) {
        setActiveIndex(0);
      } else if (currentScroll >= totalScrollDistance) {
        setActiveIndex(MODULES_DATA.length - 1);
      } else {
        const progress = currentScroll / totalScrollDistance;
        const rawIndex = Math.floor(progress * MODULES_DATA.length);
        const clampedIndex = Math.min(Math.max(rawIndex, 0), MODULES_DATA.length - 1);
        setActiveIndex(clampedIndex);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Smoothly center the active item in the list container using absolute offsetTop
  useEffect(() => {
    const activeEl = itemRefs.current[activeIndex];
    const container = listContainerRef.current;
    if (activeEl && container) {
      const targetTop = activeEl.offsetTop - container.clientHeight / 2 + activeEl.clientHeight / 2;
      container.scrollTo({ top: targetTop, behavior: "smooth" });
    }
  }, [activeIndex]);

  // Direct Click on a Tab: instantly switch active tab and silently align scroll position
  const handleSelectTab = (idx: number) => {
    // Lock scroll listener to prevent intermediate tab cycling glitch
    isClickingRef.current = true;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

    setActiveIndex(idx);

    const outer = outerSectionRef.current;
    if (outer) {
      const rect = outer.getBoundingClientRect();
      const currentScrollY = window.scrollY || document.documentElement.scrollTop;
      const totalScrollDistance = rect.height - window.innerHeight;
      const targetProgress = (idx + 0.15) / MODULES_DATA.length;
      const targetY = currentScrollY + rect.top + targetProgress * totalScrollDistance;
      
      // Instantly align page scroll runway so subsequent wheel scrolls start from this tab
      window.scrollTo({ top: targetY, behavior: "instant" });
    }

    // Release scroll lock after the browser settles
    clickTimeoutRef.current = setTimeout(() => {
      isClickingRef.current = false;
    }, 250);
  };

  return (
    <div
      ref={outerSectionRef}
      id="modules"
      className="relative w-full"
      style={{
        // 300vh provides a smooth, responsive runway (approx 22vh per module)
        height: "300vh",
      }}
    >
      {/* STICKY VIEWPORT CONTAINER: Pinned while user scrolls through all modules */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-center overflow-hidden bg-[#050505] text-white border-t border-white/[0.08] select-none">
        {/* Ambient background glow */}
        <div className="absolute top-1/3 left-1/4 w-[700px] h-[500px] bg-amber-500/[0.04] rounded-full blur-[180px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 w-full py-4 sm:py-6 relative z-10">
          {/* Compact Section Header */}
          <div className="max-w-3xl mb-5 sm:mb-7 space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-amber-400 text-xs font-mono uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Operational Architecture</span>
            </div>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08]">
              Every station. Every shift.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 block sm:inline">
                Seen from above.
              </span>
            </h2>
          </div>

          {/* Two-Column Sticky Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
            {/* LEFT: Scrolling Modules List (Ticker Wheel) */}
            <div className="lg:col-span-5 flex flex-col justify-center space-y-2.5">
              <div className="text-[11px] font-mono text-stone-500 uppercase tracking-widest px-3 flex items-center justify-between">
                <span>ACTIVE SYSTEM MODULES</span>
                <span className="text-amber-400 font-bold">
                  {String(activeIndex + 1).padStart(2, "0")} / {String(MODULES_DATA.length).padStart(2, "0")}
                </span>
              </div>

              {/* Scrubbing Progress Bar */}
              <div className="mx-3 h-1 bg-white/[0.08] rounded-full overflow-hidden mb-1">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
                  style={{
                    width: `${((activeIndex + 1) / MODULES_DATA.length) * 100}%`,
                  }}
                />
              </div>

              {/* Vertical Scroll List with Mask Fade Top & Bottom */}
              <div
                ref={listContainerRef}
                className="relative max-h-[340px] sm:max-h-[380px] overflow-y-auto px-3 py-2.5 space-y-2.5 scrollbar-none"
                style={{
                  maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
                }}
              >
                {MODULES_DATA.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      onClick={() => handleSelectTab(idx)}
                      className={`w-full text-left transition-all duration-200 rounded-2xl flex items-center justify-between group ${
                        isActive
                          ? "p-4 bg-white/[0.09] border border-amber-500/50 shadow-xl shadow-black/80 ring-1 ring-amber-500/20"
                          : "p-3 opacity-35 hover:opacity-75 hover:bg-white/[0.02] border border-transparent"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2.5">
                          <span
                            className={`font-mono text-[10px] sm:text-[11px] tracking-wider uppercase ${
                              isActive ? "text-amber-400 font-bold" : "text-stone-500"
                            }`}
                          >
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <h3
                            className={`text-lg sm:text-xl font-bold tracking-tight transition-colors ${
                              isActive ? "text-white" : "text-stone-400 group-hover:text-stone-200"
                            }`}
                          >
                            {item.name}
                          </h3>
                        </div>
                      </div>

                      {/* Arrow Indicator on Active */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          isActive
                            ? "bg-amber-500 text-stone-950 font-black shadow-md shadow-amber-500/30 scale-100"
                            : "border border-white/10 text-stone-600 group-hover:border-white/20 group-hover:text-stone-400 scale-90"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Bottom Scroller Hint */}
              <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 border-t border-white/[0.06] pt-2 px-3">
                <span>SCROLL PAGE TO REVEAL TABS</span>
                <span className="text-amber-400">
                  {activeIndex === MODULES_DATA.length - 1 ? "CONTINUE SCROLLING TO NEXT SECTION ↓" : "SCROLL DOWN ↓"}
                </span>
              </div>
            </div>

            {/* RIGHT: High-Fidelity Module Showcase Card (Toast Right Pane) */}
            <div className="lg:col-span-7">
              <div className="relative rounded-[28px] sm:rounded-[36px] bg-[#0c0e12] border border-white/[0.12] p-5 sm:p-7 shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden min-h-[420px] sm:min-h-[460px] flex flex-col justify-between transition-all">
                {/* Background gradient ambient */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/[0.06] rounded-full blur-[140px] pointer-events-none" />

                {/* Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/[0.08] relative z-10">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-mono text-amber-400 tracking-widest uppercase">
                      {activeModule.tag}
                    </div>
                    <h4 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {activeModule.name}
                    </h4>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                      {activeModule.stat}
                    </div>
                    <div className="text-[10px] text-stone-400 uppercase tracking-wider">
                      {activeModule.statLabel}
                    </div>
                  </div>
                </div>

                {/* Interactive Mock Interface Preview for the Active Module */}
                <div className="my-4 relative z-10">
                  <ModuleVisualPreview type={activeModule.previewType} />
                </div>

                {/* Card Footer: The Hero Takeaway (Toast Style) */}
                <div className="pt-3.5 border-t border-white/[0.08] relative z-10 space-y-1.5">
                  <p className="text-base sm:text-xl font-bold text-white tracking-tight leading-snug">
                    &ldquo;{activeModule.takeaway}&rdquo;
                  </p>
                  <p className="text-stone-400 text-xs sm:text-sm leading-relaxed max-w-xl">
                    {activeModule.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponent: High-Fidelity Mock Visual Preview for each module
function ModuleVisualPreview({ type }: { type: RestaurantModule["previewType"] }) {
  switch (type) {
    case "pos":
      return (
        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3 font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-bold">MESH OFFLINE RESILIENCE ACTIVE</span>
            </div>
            <span className="text-stone-500">TERMINAL #04 • FLOOR</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { table: "Table 04", status: "Dining (34m)", bill: "$142.50", badge: "KDS Synced" },
              { table: "Table 07", status: "Bill Printed", bill: "$88.00", badge: "Ready" },
              { table: "Table 18", status: "Entree Fired", bill: "$210.00", badge: "Course 2" },
            ].map((t) => (
              <div key={t.table} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                <div className="text-stone-300 font-bold text-[11px]">{t.table}</div>
                <div className="text-amber-400 text-[11px]">{t.bill}</div>
                <div className="text-stone-500 text-[10px]">{t.badge}</div>
              </div>
            ))}
          </div>
        </div>
      );

    case "inventory":
      return (
        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2.5 font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between text-stone-400 border-b border-white/[0.08] pb-2 text-[10px]">
            <span>CENTRAL INGREDIENT</span>
            <span>PAR LEVEL BALANCE</span>
            <span>DEPLETION RATE</span>
          </div>
          {[
            { item: "Aged Basmati Rice", balance: "42.5 kg", pct: "85%", status: "Optimal" },
            { item: "Fresh Paneer Block", balance: "8.2 kg", pct: "34%", status: "Reorder Par" },
            { item: "Pure Cow Ghee", balance: "14.8 L", pct: "74%", status: "Optimal" },
          ].map((r) => (
            <div key={r.item} className="flex items-center justify-between py-1 border-b border-white/[0.04] text-[11px]">
              <span className="text-white font-semibold">{r.item}</span>
              <div className="flex items-center space-x-2">
                <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full ${r.pct === "34%" ? "bg-amber-400" : "bg-emerald-400"}`}
                    style={{ width: r.pct }}
                  />
                </div>
                <span className="text-stone-300 text-[10px]">{r.balance}</span>
              </div>
              <span className={`text-[10px] ${r.pct === "34%" ? "text-amber-400" : "text-emerald-400"}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      );

    case "catering":
      return (
        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2.5 font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <div>
              <span className="text-white font-bold">Grand Royal Wedding Reception</span>
              <span className="text-stone-500 ml-2">#EV-2026-089</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[10px]">
              CONFIRMED • 450 PAX
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10px]">
            <div className="p-2 rounded-lg bg-white/[0.03]">
              <div className="text-stone-500 text-[9px]">TIER PACKAGE</div>
              <div className="text-white font-bold">5-Course Premium</div>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.03]">
              <div className="text-stone-500 text-[9px]">TOTAL CONTRACT</div>
              <div className="text-amber-400 font-bold">$18,450.00</div>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.03]">
              <div className="text-stone-500 text-[9px]">ADVANCE RECEIVED</div>
              <div className="text-emerald-400 font-bold">$9,225.00 (50%)</div>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.03]">
              <div className="text-stone-500 text-[9px]">BOM SCALE MULTIPLIER</div>
              <div className="text-sky-400 font-bold">4.5x Auto-PO</div>
            </div>
          </div>
        </div>
      );

    case "shifts":
      return (
        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2.5 font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <span className="text-stone-300 font-bold">WEEK 36 DINNER ROSTER</span>
            <span className="text-emerald-400 text-[10px]">100% COVERAGE GUARANTEED</span>
          </div>
          {[
            { role: "Executive Chef", staff: "Vikram R.", time: "14:00 - 23:00", status: "Assigned" },
            { role: "Line Cook (Curry)", staff: "Arjun K.", time: "16:00 - 00:30", status: "Swap Requested" },
            { role: "Head Bartender", staff: "Elena M.", time: "17:00 - 01:00", status: "Assigned" },
          ].map((s) => (
            <div key={s.role} className="flex items-center justify-between py-1 border-b border-white/[0.04] text-[11px]">
              <div>
                <span className="text-white font-semibold">{s.staff}</span>
                <span className="text-stone-500 ml-2 text-[10px]">({s.role})</span>
              </div>
              <span className="text-stone-400 text-[10px]">{s.time}</span>
              <span className={`text-[10px] ${s.status === "Swap Requested" ? "text-amber-400" : "text-emerald-400"}`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      );

    case "attendance":
      return (
        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2.5 font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <span className="text-purple-400 font-bold">LIVE KIOSK ATTENDANCE BOARD</span>
            <span className="text-stone-500">OUTLET: RESTO BIRD DOWNTOWN</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-xl font-bold text-white">28</div>
              <div className="text-[10px] text-emerald-400 uppercase mt-0.5">Clocked In Now</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-xl font-bold text-white">0</div>
              <div className="text-[10px] text-stone-400 uppercase mt-0.5">Unexcused Absence</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-xl font-bold text-white">4</div>
              <div className="text-[10px] text-amber-400 uppercase mt-0.5">On Scheduled Break</div>
            </div>
          </div>
        </div>
      );

    case "payroll":
      return (
        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2.5 font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <span className="text-rose-400 font-bold">MONTHLY PAYROLL & TIP POOL RUN</span>
            <span className="text-stone-400">SEPTEMBER 2026</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-white/[0.03]">
              <div className="text-stone-500 text-[9px]">TOTAL DISBURSED</div>
              <div className="text-white font-bold text-xs sm:text-sm">$48,290.00</div>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.03]">
              <div className="text-stone-500 text-[9px]">TIP POOL DIVIDEND</div>
              <div className="text-amber-400 font-bold text-xs sm:text-sm">$7,840.00</div>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.03]">
              <div className="text-stone-500 text-[9px]">PAYSLIPS GENERATED</div>
              <div className="text-emerald-400 font-bold text-xs sm:text-sm">32 / 32 Ready</div>
            </div>
          </div>
        </div>
      );

    case "finance":
      return (
        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2 font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5">
            <span className="text-amber-400 font-bold">REAL-TIME P&L SUMMARY</span>
            <span className="text-emerald-400 font-bold">NET EBITDA: +23.4%</span>
          </div>
          <div className="space-y-1 pt-1 text-[11px]">
            <div className="flex justify-between text-stone-300">
              <span>Gross POS Revenue</span>
              <span className="text-white font-bold">$124,580.00</span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>Cost of Goods Sold (COGS)</span>
              <span className="text-rose-400">-$34,880.00 (28.0%)</span>
            </div>
            <div className="flex justify-between text-stone-400">
              <span>Labor & Shift Payroll</span>
              <span className="text-rose-400">-$36,120.00 (29.0%)</span>
            </div>
            <div className="flex justify-between border-t border-white/[0.08] pt-1 text-white font-bold">
              <span>Net Operating Profit</span>
              <span className="text-emerald-400">+$29,150.00</span>
            </div>
          </div>
        </div>
      );

    case "vault":
      return (
        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2.5 font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-teal-400 font-bold">ZERO-KNOWLEDGE SECRETS VAULT</span>
            </div>
            <span className="text-stone-500">2FA TOTP ENABLED</span>
          </div>
          <div className="space-y-1.5">
            {[
              { service: "UberEats Merchant Portal", user: "ops@restobird.com", otp: "582 914", rem: "18s" },
              { service: "Commercial Banking Portal", user: "finance@restobird.com", otp: "831 409", rem: "24s" },
            ].map((v) => (
              <div key={v.service} className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-[11px]">
                <div>
                  <div className="text-white font-bold">{v.service}</div>
                  <div className="text-stone-500 text-[10px]">{v.user}</div>
                </div>
                <div className="text-right">
                  <div className="text-amber-400 font-bold text-xs sm:text-sm tracking-widest">{v.otp}</div>
                  <div className="text-stone-500 text-[9px]">{v.rem} remaining</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "analytics":
    default:
      return (
        <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2.5 font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <span className="text-amber-400 font-bold">BCG MENU ENGINEERING MATRIX</span>
            <span className="text-stone-400">LAST 30 DAYS</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-emerald-400 font-bold">STARS (High Vol / High Margin)</div>
              <div className="text-stone-300 mt-1">Chicken Dum Biryani (42% margin)</div>
            </div>
            <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <div className="text-sky-400 font-bold">PLOWHORSES (High Vol / Low Margin)</div>
              <div className="text-stone-300 mt-1">Butter Naan (+12% price bump advised)</div>
            </div>
          </div>
        </div>
      );
  }
}
