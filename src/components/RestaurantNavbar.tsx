"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useTheme, AppleThemeToggle } from "@/core/theme/ThemeContext";
import {
  LayoutDashboard,
  Store,
  Package,
  CalendarDays,
  Users,
  Banknote,
  BarChart3,
  UtensilsCrossed,
  ClipboardCheck,
  Sliders,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  LogOut,
  Utensils,
  ArrowRight,
} from "lucide-react";

interface RestaurantNavbarProps {
  branding?: {
    name?: string;
    applicationName?: string;
    primaryColor?: string;
    logoUrl?: string | null;
  } | null;
  activeSection?: string;
}

interface SubNavItem {
  label: string;
  desc?: string;
  href: string;
  badge?: string;
  quickAction?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  moduleKey?: string;
  children?: SubNavItem[];
}

export default function RestaurantNavbar({ branding, activeSection }: RestaurantNavbarProps) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  // Slide-out Drawer state on mobile
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Profile dropdown menu state
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Auto-expand current active module accordion tab based on pathname
  const initialExpandedMenu = useMemo(() => {
    if (pathname.includes("/inventory")) return "inventory";
    if (pathname.includes("/shifts")) return "shifts";
    if (pathname.includes("/workforce") || pathname.includes("/attendance") || pathname.includes("/leaves")) return "workforce";
    if (pathname.includes("/finance") || pathname.includes("/payroll")) return "finance";
    if (pathname.includes("/catering")) return "catering";
    if (pathname.includes("/operations")) return "operations";
    if (pathname.includes("/analytics")) return "analytics";
    if (pathname.includes("/pos")) return "pos";
    if (pathname.includes("/settings") || pathname.includes("/vault")) return "settings";
    return null;
  }, [pathname]);

  // Single-tab accordion state (auto-collapses previous tab when another is clicked)
  const [expandedMenu, setExpandedMenu] = useState<string | null>(initialExpandedMenu);

  // Sync expanded tab if pathname changes
  useEffect(() => {
    if (initialExpandedMenu) {
      setExpandedMenu(initialExpandedMenu);
    }
  }, [initialExpandedMenu]);

  // Apply layout class so the desktop body gets offset by the permanent 16rem (256px) sidebar
  useEffect(() => {
    document.documentElement.classList.add("has-tenant-sidebar");
    return () => {
      document.documentElement.classList.remove("has-tenant-sidebar");
    };
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile drawer on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isSubdomain =
    typeof window !== "undefined" &&
    (window.location.host.startsWith(`${subdomain}.`) ||
      (window.location.host.includes(".localhost") && !window.location.host.startsWith("admin.")));

  const p = (path: string) => (isSubdomain ? path : `/restaurant/${subdomain}${path}`);

  const handleLogout = async () => {
    await fetch("/api/restaurant/auth/logout", { method: "POST" });
    router.push(isSubdomain ? "/login" : `/restaurant/${subdomain}/login`);
    router.refresh();
  };

  const [activeModules, setActiveModules] = useState<string[] | null>(null);

  // Automatic Branding Fetch & Cache across all pages
  const [internalBranding, setInternalBranding] = useState<RestaurantNavbarProps["branding"] | null>(
    branding || null
  );

  useEffect(() => {
    if (branding) {
      setInternalBranding(branding);
      if (typeof window !== "undefined" && subdomain) {
        try {
          sessionStorage.setItem(`branding_${subdomain}`, JSON.stringify(branding));
        } catch {}
      }
      return;
    }

    if (typeof window !== "undefined" && subdomain) {
      try {
        const cached = sessionStorage.getItem(`branding_${subdomain}`);
        if (cached) {
          setInternalBranding(JSON.parse(cached));
        }
      } catch {}
    }

    if (!subdomain) return;

    let isMounted = true;
    fetch(`/api/restaurant/${subdomain}/branding`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setInternalBranding(data);
          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem(`branding_${subdomain}`, JSON.stringify(data));
            } catch {}
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [branding, subdomain]);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/restaurant/modules")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          if (data.modules) {
            const keys = data.modules.map((m: any) => m.key.toLowerCase());
            setActiveModules(keys);
          }
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [subdomain]);

  const effectiveBranding = branding || internalBranding;

  // Dynamic brand color consistent with profile and dashboard (#C5221F default fallback)
  const brandColor = useMemo(() => {
    return effectiveBranding?.primaryColor &&
      effectiveBranding.primaryColor.startsWith("#") &&
      effectiveBranding.primaryColor !== "#ffffff" &&
      effectiveBranding.primaryColor !== "#fff"
      ? effectiveBranding.primaryColor
      : "#C5221F";
  }, [effectiveBranding?.primaryColor]);

  const brandTint = useMemo(() => {
    return `${brandColor}18`;
  }, [brandColor]);

  // Master navigation definition matching the restaurant domain and routes
  const allNavLinks: NavItem[] = useMemo(
    () => [
      {
        id: "dashboard",
        label: "Dashboard",
        href: p("/dashboard"),
        icon: LayoutDashboard,
      },
      {
        id: "pos",
        label: "POS & Orders",
        href: p("/pos"),
        icon: Store,
        moduleKey: "pos",
        children: [
          { label: "POS Terminal", desc: "Live billing, table ordering & takeaway", href: p("/pos"), quickAction: true },
          { label: "Kitchen Display (KDS)", desc: "Real-time kitchen order tickets & prep times", href: p("/pos") },
          { label: "Table Management", desc: "Floor layout, seating status & bill splitting", href: p("/pos") },
        ],
      },
      {
        id: "inventory",
        label: "Inventory",
        href: p("/inventory"),
        icon: Package,
        moduleKey: "inventory",
        children: [
          { label: "Items & Catalog", desc: "Ingredients, SKU codes, par levels & prices", href: p("/inventory/items"), quickAction: true },
          { label: "Categories", desc: "Hierarchical category classification & assignments", href: p("/inventory/categories") },
          { label: "Stock Levels", desc: "Live physical stock ledger & quick adjustments", href: p("/inventory/stock") },
          { label: "Purchase Orders", desc: "Draft procurement orders & receive stock", href: p("/inventory/purchase-orders") },
          { label: "Vendors Directory", desc: "Supplier catalog, contacts & payment terms", href: p("/inventory/vendors") },
          { label: "Recipes & Costing", desc: "Dish ingredient formulations & food cost margins", href: p("/inventory/recipes") },
          { label: "Low Stock Alerts", desc: "Items below safe threshold requiring reorder", href: p("/inventory/alerts"), badge: "5" },
        ],
      },
      {
        id: "shifts",
        label: "Shifts & Rosters",
        href: p("/shifts/rosters"),
        icon: CalendarDays,
        moduleKey: "shift_management",
        children: [
          { label: "Staff Rosters", desc: "Weekly & daily employee shift schedules", href: p("/shifts/rosters"), quickAction: true },
          { label: "Schedule Templates", desc: "Reusable shift patterns for lunch & dinner", href: p("/shifts/templates") },
          { label: "Shift Swaps", desc: "Peer-to-peer shift trade approvals", href: p("/shifts/swaps") },
        ],
      },
      {
        id: "workforce",
        label: "Workforce & HR",
        href: p("/workforce/employees"),
        icon: Users,
        moduleKey: "hr_onboarding",
        children: [
          { label: "Employee Directory", desc: "Staff profiles, job grades & outlet allocation", href: p("/workforce/employees"), quickAction: true },
          { label: "Staff Onboarding", desc: "New hire document & compliance verification", href: p("/workforce/onboarding") },
          { label: "Roles & Permissions", desc: "User access levels & operational privileges", href: p("/workforce/users") },
          { label: "Live Attendance", desc: "Clocked-in presence, timesheets & punch logs", href: p("/attendance") },
          { label: "Leave Requests", desc: "Paid leaves, sick quotas & manager approvals", href: p("/leaves") },
        ],
      },
      {
        id: "finance",
        label: "Finance & Accounts",
        href: p("/finance"),
        icon: Banknote,
        moduleKey: "finance",
        children: [
          { label: "Financial Overview", desc: "Executive P&L statement, sales revenue & prime costs", href: p("/finance") },
          { label: "Bill Reminders", desc: "Vendor invoices, utilities, AMC & payment alerts", href: p("/finance/bill-reminders") },
          { label: "Payroll Processing", desc: "Staff salaries, tip pooling & pay run calculation", href: p("/payroll/runs"), quickAction: true },
        ],
      },
      {
        id: "catering",
        label: "Catering & Banquets",
        href: p("/catering"),
        icon: UtensilsCrossed,
        moduleKey: "catering",
        children: [
          { label: "Event Orders Board", desc: "Manage quotes, bookings & banquet logistics", href: p("/catering"), quickAction: true },
          { label: "Catering Portal", desc: "Customer self-service event menu customizer", href: p("/catering/portal") },
        ],
      },
      {
        id: "operations",
        label: "Kitchen Operations",
        href: p("/operations"),
        icon: ClipboardCheck,
        moduleKey: "shift_management",
        children: [
          { label: "Daily Checklists", desc: "Opening, closing duties & HACCP hygiene audits", href: p("/operations") },
          { label: "Kitchen SOPs & Prep", desc: "Standard recipes, line prep & equipment logs", href: p("/operations") },
        ],
      },
      {
        id: "analytics",
        label: "Analytics & Reports",
        href: p("/analytics/menu-engineering"),
        icon: BarChart3,
        moduleKey: "analytics",
        children: [
          { label: "Menu Engineering", desc: "BCG stars, plowhorses, puzzles & dogs matrix", href: p("/analytics/menu-engineering") },
          { label: "Sales & Revenue", desc: "Channel sales, peak hours & customer trends", href: p("/analytics") },
        ],
      },
      {
        id: "settings",
        label: "Administration",
        href: p("/settings/profile"),
        icon: Sliders,
        children: [
          { label: "Restaurant Profile", desc: "Branding colors, identity & restaurant details", href: p("/settings/profile") },
          { label: "Branch Outlets", desc: "Multi-branch addresses & tax registration numbers", href: p("/settings/branches") },
          { label: "Master Data & Taxes", desc: "GST, service charges & master taxonomies", href: p("/settings/master-data") },
          { label: "Security & 2FA", desc: "Two-factor authentication & recovery codes", href: p("/settings/security") },
          { label: "Zero-Knowledge Vault", desc: "Enterprise credentials, passwords & API keys", href: p("/vault") },
        ],
      },
    ],
    [subdomain]
  );

  // Filter modules based on tenant permissions
  const filteredNavLinks = useMemo(() => {
    if (activeModules === null) {
      return allNavLinks;
    }
    return allNavLinks.filter((item) => {
      if (!item.moduleKey) return true;
      const k = item.moduleKey.toLowerCase();
      return (
        activeModules.includes(k) ||
        (k === "shift_management" && activeModules.includes("shifts")) ||
        (k === "shifts" && activeModules.includes("shift_management")) ||
        (k === "hr_onboarding" && activeModules.includes("workforce")) ||
        (k === "workforce" && activeModules.includes("hr_onboarding"))
      );
    });
  }, [allNavLinks, activeModules]);

  // Helper to check if a main module link is active
  const isNavActive = (link: NavItem) => {
    if (link.id === "dashboard") {
      return pathname.endsWith("/dashboard") || pathname === "/";
    }
    if (pathname.includes(link.href)) return true;
    if (link.children && link.children.some((c) => pathname.startsWith(c.href))) return true;
    if (link.id === "inventory" && pathname.includes("/inventory")) return true;
    if (link.id === "shifts" && pathname.includes("/shifts")) return true;
    if (link.id === "workforce" && (pathname.includes("/workforce") || pathname.includes("/attendance") || pathname.includes("/leaves"))) return true;
    if (link.id === "finance" && (pathname.includes("/finance") || pathname.includes("/payroll"))) return true;
    if (link.id === "catering" && pathname.includes("/catering")) return true;
    if (link.id === "operations" && pathname.includes("/operations")) return true;
    if (link.id === "analytics" && pathname.includes("/analytics")) return true;
    if (link.id === "pos" && pathname.includes("/pos")) return true;
    if (link.id === "settings" && (pathname.includes("/settings") || pathname.includes("/vault"))) return true;
    return false;
  };

  return (
    <>
      {/* Global CSS to permanently offset the main content on desktop (w-64 = 16rem = 256px) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 1024px) {
              html.has-tenant-sidebar body {
                padding-left: 16rem !important;
              }
            }
          `,
        }}
      />

      {/* ========================================================================= */}
      {/* 1. PERSISTENT ZOHO-STYLE LEFT SIDEBAR (DESKTOP FIXED & MOBILE DRAWER)     */}
      {/* ========================================================================= */}
      {/* Backdrop for mobile drawer */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col justify-between border-r transition-transform duration-200 lg:translate-x-0 ${
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
        } ${
          isDark
            ? "bg-[#0E121D] border-white/[0.08] text-white"
            : "bg-white border-slate-200/90 text-slate-900 shadow-[1px_0_4px_rgba(0,0,0,0.02)]"
        }`}
      >
        {/* Top: Brand Logo + Tenant Identity */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="h-16 flex items-center justify-between px-5 border-b border-black/[0.05] dark:border-white/[0.06] shrink-0">
            <div
              onClick={() => router.push(p("/dashboard"))}
              className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
            >
              {effectiveBranding?.logoUrl ? (
                <img
                  src={effectiveBranding.logoUrl}
                  alt={effectiveBranding.name || "Brand Logo"}
                  className="w-8 h-8 rounded-lg object-contain shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm group-hover:brightness-110 transition"
                  style={{ backgroundColor: brandColor }}
                >
                  <Utensils className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <span className="font-bold text-sm tracking-tight truncate block text-slate-900 dark:text-white">
                  {effectiveBranding?.name || "Magni Digitech"}
                </span>
                <span className="text-[10px] opacity-60 truncate block">Restaurant Operations</span>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Context Strip (Branch & Mode info) */}
          <div className="px-5 py-2 bg-slate-50 dark:bg-white/[0.02] border-b border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-xs text-slate-500 shrink-0">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <Store className="w-3.5 h-3.5 opacity-70" />
              <span>Main Branch</span>
            </div>
            <span className="text-[10px] opacity-70">Live Suite</span>
          </div>

          {/* Scrollable Navigation List with Zoho Books styled Single-Accordion rule */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {filteredNavLinks.map((item) => {
              const IconComp = item.icon;
              const hasSubs = item.children && item.children.length > 0;
              const isExpanded = expandedMenu === item.id;
              const isActive = isNavActive(item);

              return (
                <div key={item.id} className="space-y-0.5">
                  {/* Parent Menu Item */}
                  <button
                    type="button"
                    onClick={() => {
                      if (hasSubs) {
                        // Accordion single-expansion rule: auto-collapses any previously open tab
                        setExpandedMenu((prev) => (prev === item.id ? null : item.id));
                      } else {
                        router.push(item.href);
                        setMobileDrawerOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "font-bold text-slate-900 dark:text-white"
                        : isExpanded
                        ? "font-bold text-slate-900 dark:text-white bg-slate-100/70 dark:bg-white/[0.06]"
                        : "text-slate-600 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: brandTint,
                            color: isDark ? "#ffffff" : brandColor,
                          }
                        : {}
                    }
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconComp
                        className="w-4 h-4 shrink-0"
                        style={{ color: isActive ? brandColor : undefined }}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {/* Right Caret Indicator */}
                    {hasSubs && (
                      <div className="shrink-0 text-slate-400 dark:text-slate-500">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200" />
                        )}
                      </div>
                    )}
                  </button>

                  {/* Accordion Submenu Panel */}
                  {hasSubs && isExpanded && (
                    <div className="pl-3.5 pr-1 py-1 space-y-0.5 border-l-2 ml-4 my-1 border-slate-200 dark:border-white/10 transition-all">
                      {item.children!.map((sub) => {
                        const isChildActive = pathname.startsWith(sub.href);
                        return (
                          <button
                            key={sub.label}
                            type="button"
                            onClick={() => {
                              router.push(sub.href);
                              setMobileDrawerOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition cursor-pointer group ${
                              isChildActive
                                ? isDark
                                  ? "bg-white/[0.1] text-white font-bold"
                                  : "bg-slate-100 text-slate-900 font-bold"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                            }`}
                          >
                            <span className="truncate">{sub.label}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {sub.badge && (
                                <span
                                  className="px-1.5 py-0.2 rounded-full text-[9px] font-bold text-white"
                                  style={{ backgroundColor: brandColor }}
                                >
                                  {sub.badge}
                                </span>
                              )}
                              {sub.quickAction && (
                                <span
                                  className="opacity-0 group-hover:opacity-100 transition p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                                  title="Quick Open"
                                >
                                  <Plus className="w-3 h-3 text-slate-400 dark:text-slate-300" />
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Footer Section: Settings & Tenant Card */}
        <div className="p-3 border-t border-black/[0.05] dark:border-white/[0.06] space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              router.push(p("/settings/profile"));
              setMobileDrawerOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition cursor-pointer"
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Settings</span>
          </button>

          <div
            onClick={() => {
              router.push(p("/settings/profile"));
              setMobileDrawerOpen(false);
            }}
            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition ${
              isDark
                ? "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
                : "bg-slate-50 border-slate-200/80 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                style={{ backgroundColor: brandColor }}
              >
                {effectiveBranding?.name ? effectiveBranding.name.charAt(0).toUpperCase() : "M"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate text-slate-900 dark:text-white leading-tight">
                  {effectiveBranding?.name || "Magni Digitech"}
                </div>
                <div className="text-[10px] opacity-60 truncate">Tenant: {subdomain}</div>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. CLEAN TOP HEADER BAR (NO HORIZONTAL MODULE ROW! ZERO OVERFLOW!)         */}
      {/* ========================================================================= */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-2xl border-b h-14 sm:h-16 px-4 sm:px-6 lg:px-8 transition-colors overflow-hidden ${
          isDark
            ? "bg-[#090B10]/95 border-white/[0.08]"
            : "bg-white/95 border-slate-200/80 shadow-xs shadow-slate-900/5"
        }`}
      >
        <div className="h-full flex items-center justify-between gap-3">
          {/* Left Context: Mobile Hamburger (☰) + Active Section Breadcrumb */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Mobile Hamburger toggle (visible ONLY on mobile/tablet < 1024px) */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb indicator */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-xs sm:text-sm truncate text-slate-900 dark:text-white">
                {effectiveBranding?.name || "Magni Digitech"}
              </span>
              {activeSection && (
                <>
                  <span className="text-xs text-slate-400 dark:text-slate-600">/</span>
                  <span
                    className="text-xs sm:text-sm font-bold truncate"
                    style={{ color: brandColor }}
                  >
                    {activeSection}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Controls: Quick Action (+ New Order), Theme Toggle, User Profile Avatar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick POS Order Button */}
            <button
              type="button"
              onClick={() => router.push(p("/pos"))}
              className="px-2.5 sm:px-3.5 py-1.5 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm shrink-0 hover:brightness-110 active:scale-[0.98]"
              style={{ backgroundColor: brandColor }}
            >
              <span className="hidden sm:inline">+ New Order</span>
              <span className="sm:hidden">+ Order</span>
            </button>

            {/* Dark / Light Theme Mode Switcher */}
            <AppleThemeToggle />

            {/* Profile Avatar with Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className={`px-2 py-1 rounded-xl border flex items-center gap-1.5 cursor-pointer transition ${
                  isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                }`}
                aria-label="User profile menu"
              >
                <div
                  className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                  {effectiveBranding?.name ? effectiveBranding.name.charAt(0).toUpperCase() : "M"}
                </div>
                <ChevronDown className="hidden sm:inline w-3 h-3 opacity-60" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div
                  className={`absolute right-0 mt-2 w-60 p-2 rounded-2xl border shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
                    isDark
                      ? "bg-[#11141F] border-white/[0.08] text-white shadow-black/60"
                      : "bg-white border-slate-200 text-slate-900 shadow-slate-900/15"
                  }`}
                >
                  <div className="px-3 py-2 border-b border-black/[0.06] dark:border-white/[0.06] mb-1">
                    <div className="text-xs font-bold truncate">
                      {effectiveBranding?.name || "Magni Digitech"}
                    </div>
                    <div className="text-[10px] opacity-60 truncate">Tenant: {subdomain}</div>
                  </div>

                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        router.push(p("/dashboard"));
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/[0.05] transition cursor-pointer flex items-center gap-2"
                    >
                      <LayoutDashboard className="w-4 h-4 opacity-70" />
                      <span>Executive Dashboard</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        router.push(p("/settings/profile"));
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/[0.05] transition cursor-pointer flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4 opacity-70" />
                      <span>Restaurant Settings</span>
                    </button>

                    <div className="border-t border-black/[0.06] dark:border-white/[0.06] my-1 pt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
