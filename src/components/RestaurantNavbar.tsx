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
  Sun,
  Moon,
  Search,
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
  const { isDark, toggleTheme } = useTheme();

  // Slide-out Drawer state on mobile
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Desktop Hover-to-expand state: collapses to icon-only rail when hover is lost
  const [isHovered, setIsHovered] = useState(false);

  // Quick instant search state across all modules and child features
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Apply layout class so desktop content is offset by the 68px icon rail
  useEffect(() => {
    document.documentElement.classList.add("has-tenant-sidebar");
    return () => {
      document.documentElement.classList.remove("has-tenant-sidebar");
    };
  }, []);



  // Close mobile drawer on Escape key & global search shortcut listener
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const activeTag = document.activeElement?.tagName;
      const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA";

      if ((event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) && !isTyping) {
        event.preventDefault();
        setIsHovered(true);
        setIsSearchFocused(true);
        setTimeout(() => searchInputRef.current?.focus(), 80);
      }

      if (event.key === "Escape") {
        if (searchQuery) {
          setSearchQuery("");
        } else {
          setIsSearchFocused(false);
          searchInputRef.current?.blur();
          setMobileDrawerOpen(false);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchQuery]);

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
        id: "analytics",
        label: "Analytics & Intelligence",
        href: p("/analytics/menu-engineering"),
        icon: BarChart3,
        moduleKey: "analytics",
        children: [
          { label: "Menu Engineering", desc: "BCG stars, plowhorses, puzzles & dogs matrix", href: p("/analytics/menu-engineering") },
          { label: "Sales & Revenue", desc: "Channel sales, peak hours & customer trends", href: p("/analytics") },
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

  // Instant search results indexing all modules and sub-pages
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const list: Array<{
      id: string;
      moduleLabel: string;
      moduleIcon: React.ElementType;
      label: string;
      desc?: string;
      href: string;
      badge?: string;
      isSubItem: boolean;
    }> = [];

    filteredNavLinks.forEach((mod) => {
      const modMatches =
        mod.label.toLowerCase().includes(q) ||
        mod.id.toLowerCase().includes(q);

      if (modMatches) {
        list.push({
          id: `${mod.id}-main`,
          moduleLabel: mod.label,
          moduleIcon: mod.icon,
          label: mod.label,
          desc: `Main ${mod.label} Module`,
          href: mod.href,
          isSubItem: false,
        });
      }

      if (mod.children) {
        mod.children.forEach((sub, sIdx) => {
          const labelMatches = sub.label.toLowerCase().includes(q);
          const descMatches = sub.desc ? sub.desc.toLowerCase().includes(q) : false;
          const parentMatches = mod.label.toLowerCase().includes(q);

          if (labelMatches || descMatches || parentMatches) {
            const exists = list.some((item) => item.href === sub.href && item.label === sub.label);
            if (!exists) {
              list.push({
                id: `${mod.id}-sub-${sIdx}`,
                moduleLabel: mod.label,
                moduleIcon: mod.icon,
                label: sub.label,
                desc: sub.desc,
                href: sub.href,
                badge: sub.badge,
                isSubItem: true,
              });
            }
          }
        });
      }
    });

    return list;
  }, [searchQuery, filteredNavLinks]);

  const isExpandedView = isHovered || mobileDrawerOpen || Boolean(searchQuery.trim()) || isSearchFocused;

  return (
    <>
      {/* Global CSS to permanently offset the main content on desktop (w-[68px] = 68px) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 1024px) {
              html.has-tenant-sidebar body {
                padding-left: 68px !important;
              }
            }
          `,
        }}
      />

      {/* ========================================================================= */}
      {/* 1. COLLAPSIBLE ICON RAIL SIDEBAR (EXPANDS ON HOVER, COLLAPSES ON HOVER LOST) */}
      {/* ========================================================================= */}
      {/* Backdrop for mobile drawer */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between border-r transition-all duration-300 ease-in-out ${
          mobileDrawerOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
        } ${
          isHovered ? "lg:w-64 shadow-2xl" : "lg:w-[68px]"
        } ${
          isDark
            ? "bg-[#0E121D] border-white/[0.08] text-white"
            : "bg-white border-slate-200/90 text-slate-900 shadow-[1px_0_4px_rgba(0,0,0,0.02)]"
        }`}
      >
        {/* Top: Brand Logo + Tenant Identity */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="h-16 flex items-center justify-between px-3.5 border-b border-black/[0.05] dark:border-white/[0.06] shrink-0">
            <div
              onClick={() => router.push(p("/dashboard"))}
              className={`flex items-center gap-2.5 min-w-0 cursor-pointer group ${
                !isExpandedView ? "mx-auto justify-center" : ""
              }`}
            >
              {effectiveBranding?.logoUrl ? (
                <img
                  src={effectiveBranding.logoUrl}
                  alt={effectiveBranding.name || "Brand Logo"}
                  className="w-9 h-9 rounded-xl object-contain shrink-0 shadow-2xs"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm group-hover:brightness-110 transition"
                  style={{ backgroundColor: brandColor }}
                >
                  <Utensils className="w-4 h-4" />
                </div>
              )}

              {isExpandedView && (
                <div className="min-w-0 animate-in fade-in duration-200">
                  <span className="font-bold text-sm tracking-tight truncate block text-slate-900 dark:text-white">
                    {effectiveBranding?.name || "Magni Digitech"}
                  </span>
                  <span className="text-[10px] opacity-60 truncate block">Restaurant Operations</span>
                </div>
              )}
            </div>

            {/* Mobile close button */}
            {mobileDrawerOpen && (
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick POS Action: + New Order */}
          <div className="p-2 border-b border-black/[0.05] dark:border-white/[0.06] shrink-0">
            {!isExpandedView ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => router.push(p("/pos"))}
                  title="+ New Order (POS)"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold transition shadow-sm hover:brightness-110 active:scale-95 cursor-pointer"
                  style={{ backgroundColor: brandColor }}
                >
                  <Plus className="w-4 h-4 shrink-0" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  router.push(p("/pos"));
                  setMobileDrawerOpen(false);
                }}
                className="w-full py-2 px-3 text-white text-xs font-bold rounded-xl transition shadow-sm hover:brightness-110 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 animate-in fade-in duration-150"
                style={{ backgroundColor: brandColor }}
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>+ New Order</span>
              </button>
            )}
          </div>

          {/* Quick Search in Sidebar (Instant On-Typing Ajax/Filter) */}
          {!isExpandedView ? (
            <div className="p-2 border-b border-black/[0.05] dark:border-white/[0.06] shrink-0 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setIsHovered(true);
                  setIsSearchFocused(true);
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
                title="Quick Search Modules (Press / or ⌘K)"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                <Search className="w-4 h-4 shrink-0" />
              </button>
            </div>
          ) : (
            <div className="p-2.5 border-b border-black/[0.05] dark:border-white/[0.06] shrink-0 animate-in fade-in duration-150">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    setTimeout(() => setIsSearchFocused(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchResults.length > 0) {
                      router.push(searchResults[0].href);
                      setSearchQuery("");
                      setIsSearchFocused(false);
                      setMobileDrawerOpen(false);
                    }
                  }}
                  placeholder="Quick search modules..."
                  className={`w-full pl-8 pr-7 py-1.5 rounded-xl text-xs font-medium transition placeholder:text-slate-400 focus:outline-none ${
                    isDark
                      ? "bg-white/[0.05] border border-white/[0.08] text-white focus:border-white/20"
                      : "bg-slate-100/80 border border-slate-200/80 text-slate-900 focus:bg-white focus:border-slate-300 shadow-2xs"
                  }`}
                  style={{ caretColor: brandColor }}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block absolute right-2 text-[10px] font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-slate-400 select-none">
                    /
                  </kbd>
                )}
              </div>
            </div>
          )}

          {/* Context Strip (Shown only when expanded) */}
          {isExpandedView && (
            <div className="px-5 py-2 bg-slate-50 dark:bg-white/[0.02] border-b border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-xs text-slate-500 shrink-0 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                <Store className="w-3.5 h-3.5 opacity-70" />
                <span>Main Branch</span>
              </div>
              <span className="text-[10px] opacity-70">Live Suite</span>
            </div>
          )}

          {/* Scrollable Navigation List: Instant Search Results OR Clean Accordion Nav */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            {searchQuery.trim() ? (
              <div className="space-y-1 animate-in fade-in duration-150">
                <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  <span>Results ({searchResults.length})</span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-[10px] hover:underline cursor-pointer lowercase tracking-normal text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    clear
                  </button>
                </div>

                {searchResults.length === 0 ? (
                  <div className="py-8 px-3 text-center">
                    <div className="w-8 h-8 mx-auto mb-2 rounded-xl bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No matching pages</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      Try &quot;items&quot;, &quot;shifts&quot;, &quot;roster&quot;, &quot;payroll&quot;, &quot;alerts&quot;, &quot;catering&quot;
                    </p>
                  </div>
                ) : (
                  searchResults.map((res) => {
                    const IconComp = res.moduleIcon;
                    return (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => {
                          router.push(res.href);
                          setSearchQuery("");
                          setIsSearchFocused(false);
                          setMobileDrawerOpen(false);
                        }}
                        className="w-full p-2 rounded-xl text-left transition flex items-start gap-2.5 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] group cursor-pointer"
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5 shadow-2xs"
                          style={{ backgroundColor: brandColor }}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                              {res.label}
                            </span>
                            {res.badge && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                                {res.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
                            <span>{res.moduleLabel}</span>
                            {res.isSubItem && <span>› {res.label}</span>}
                          </div>
                          {res.desc && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate opacity-80 mt-0.5">
                              {res.desc}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              filteredNavLinks.map((item) => {
              const IconComp = item.icon;
              const hasSubs = item.children && item.children.length > 0;
              const isExpanded = expandedMenu === item.id;
              const isActive = isNavActive(item);

              // 1. COLLAPSED VIEW (ICON-ONLY RAIL)
              if (!isExpandedView) {
                return (
                  <div key={item.id} className="flex justify-center">
                    <button
                      type="button"
                      title={item.label}
                      onClick={() => {
                        router.push(item.href);
                      }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isActive
                          ? "font-bold text-white shadow-sm"
                          : "text-slate-600 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.06]"
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: brandColor,
                              color: "#ffffff",
                            }
                          : {}
                      }
                    >
                      <IconComp className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                );
              }

              // 2. EXPANDED VIEW (FULL ACCORDION ON HOVER)
              return (
                <div key={item.id} className="space-y-0.5 animate-in fade-in duration-150">
                  {/* Parent Menu Item */}
                  <button
                    type="button"
                    onClick={() => {
                      if (hasSubs) {
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
            })
          )}
          </nav>
        </div>

        {/* Bottom Footer Section: Compact icon buttons when collapsed, Full controls when hovered */}
        <div className="p-2.5 border-t border-black/[0.05] dark:border-white/[0.06] space-y-2 shrink-0">
          {!isExpandedView ? (
            <div className="space-y-2 flex flex-col items-center">
              <button
                type="button"
                onClick={toggleTheme}
                title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>

              <button
                type="button"
                onClick={() => router.push(p("/settings/profile"))}
                title="Restaurant Settings"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>

              <div
                onClick={() => router.push(p("/settings/profile"))}
                title={`${effectiveBranding?.name || "Magni Digitech"} (Tenant: ${subdomain})`}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs cursor-pointer shadow-sm hover:brightness-110 transition"
                style={{ backgroundColor: brandColor }}
              >
                {effectiveBranding?.name ? effectiveBranding.name.charAt(0).toUpperCase() : "M"}
              </div>
            </div>
          ) : (
            <div className="space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100/70 dark:bg-white/[0.04]">
                <span className="text-xs font-semibold text-slate-700 dark:text-[#8F95A3] flex items-center gap-2">
                  {isDark ? <Moon className="w-4 h-4 text-blue-300" /> : <Sun className="w-4 h-4 text-amber-500" />}
                  <span>Appearance</span>
                </span>
                <AppleThemeToggle />
              </div>

              <button
                type="button"
                onClick={() => {
                  router.push(p("/settings/profile"));
                  setMobileDrawerOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Restaurant Settings</span>
              </button>

              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                  isDark
                    ? "bg-white/[0.03] border-white/[0.06]"
                    : "bg-slate-50 border-slate-200/80"
                }`}
              >
                <div
                  onClick={() => {
                    router.push(p("/settings/profile"));
                    setMobileDrawerOpen(false);
                  }}
                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition"
                  title="Tenant settings"
                >
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

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Floating mobile navigation toggle (visible only on mobile/tablet < 1024px) */}
      <button
        type="button"
        onClick={() => setMobileDrawerOpen(true)}
        aria-label="Open navigation menu"
        className="lg:hidden fixed top-3 left-3 z-40 w-9 h-9 rounded-xl flex items-center justify-center bg-white/95 dark:bg-[#0A0D14]/95 backdrop-blur-md border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 shadow-md hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition cursor-pointer"
      >
        <Menu className="w-4 h-4" />
      </button>
    </>
  );
}
