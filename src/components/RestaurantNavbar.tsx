"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useTheme, AppleThemeToggle } from "@/core/theme/ThemeContext";

interface RestaurantNavbarProps {
  branding?: {
    name?: string;
    applicationName?: string;
    primaryColor?: string;
    logoUrl?: string | null;
  } | null;
  activeSection?: string;
}

export default function RestaurantNavbar({ branding, activeSection }: RestaurantNavbarProps) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setAdminDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/restaurant/auth/logout", { method: "POST" });
    router.push(`/restaurant/${subdomain}/login`);
    router.refresh();
  };

  const [activeModules, setActiveModules] = useState<string[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({});
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Automatic Branding Fetch & Cache across all pages
  const [internalBranding, setInternalBranding] = useState<RestaurantNavbarProps["branding"] | null>(branding || null);

  useEffect(() => {
    if (branding) {
      setInternalBranding(branding);
      if (typeof window !== "undefined" && subdomain) {
        try {
          sessionStorage.setItem(`branding_${subdomain}`, JSON.stringify(branding));
        } catch { }
      }
      return;
    }

    if (typeof window !== "undefined" && subdomain) {
      try {
        const cached = sessionStorage.getItem(`branding_${subdomain}`);
        if (cached) {
          setInternalBranding(JSON.parse(cached));
        }
      } catch { }
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
            } catch { }
          }
        }
      })
      .catch(() => { });

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
          setIsAdmin(!!data.isAdmin);
        }
      })
      .catch(() => { });
    return () => {
      isMounted = false;
    };
  }, [subdomain]);

  interface NavChild {
    label: string;
    desc: string;
    href: string;
  }

  interface NavItem {
    label: string;
    href: string;
    moduleKey?: string;
    children?: NavChild[];
  }

  const allNavLinks: NavItem[] = [
    { label: "Dashboard", href: `/restaurant/${subdomain}/dashboard` },
    { label: "POS", href: `/restaurant/${subdomain}/pos`, moduleKey: "pos" },
    {
      label: "Attendance",
      href: `/restaurant/${subdomain}/attendance`,
      moduleKey: "attendance",
      children: [
        {
          label: "Live Board & Timesheets",
          desc: "Clocked-in presence, daily attendance & punch logs",
          href: `/restaurant/${subdomain}/attendance`,
        },
        {
          label: "Leave Management",
          desc: "Paid leaves, sick quotas & supervisor approvals",
          href: `/restaurant/${subdomain}/attendance/leaves`,
        },
        {
          label: "Tablet Kiosk Terminal",
          desc: "PIN-based clocking terminal for staff",
          href: `/restaurant/${subdomain}/attendance/kiosk`,
        },
      ],
    },
    {
      label: "Inventory",
      href: `/restaurant/${subdomain}/inventory`,
      moduleKey: "inventory",
      children: [
        {
          label: "Item Master & SKUs",
          desc: "Raw ingredients, units, par levels & deficit alerts",
          href: `/restaurant/${subdomain}/inventory/items`,
        },
        {
          label: "Recipes & Costing",
          desc: "Dish formulation, plate cost & gross profit analysis",
          href: `/restaurant/${subdomain}/inventory/recipes`,
        },
        {
          label: "Vendor Management",
          desc: "Supplier directory, contacts & payment terms",
          href: `/restaurant/${subdomain}/inventory/vendors`,
        },
        {
          label: "Purchase Orders",
          desc: "Draft procurement orders & receive stock shipments",
          href: `/restaurant/${subdomain}/inventory/purchase-orders`,
        },
        {
          label: "Stock Ledger & Wastage",
          desc: "Live branch stock ledger, audits & wastage logs",
          href: `/restaurant/${subdomain}/inventory/stock`,
        },
        {
          label: "Categories Hierarchy",
          desc: "Organize ingredients into category tree tiers",
          href: `/restaurant/${subdomain}/inventory/categories`,
        },
      ],
    },
    { label: "Shifts", href: `/restaurant/${subdomain}/shifts/rosters`, moduleKey: "shift_management" },
    {
      label: "Operations",
      href: `/restaurant/${subdomain}/operations`,
      moduleKey: "shift_management",
      children: [
        {
          label: "Shift Checklists",
          desc: "Opening, closing, SOP duties & HACCP temperature logs",
          href: `/restaurant/${subdomain}/operations`,
        },
      ],
    },
    {
      label: "Finance",
      href: `/restaurant/${subdomain}/finance`,
      moduleKey: "finance",
      children: [
        {
          label: "Financial Performance",
          desc: "Executive P&L Statement, revenue, prime costs & general ledger",
          href: `/restaurant/${subdomain}/finance`,
        },
        {
          label: "Bill Reminders",
          desc: "Vendor invoices, utilities, AMC, credit cards & payables",
          href: `/restaurant/${subdomain}/finance/bill-reminders`,
        },
      ],
    },
    { label: "Analytics", href: `/restaurant/${subdomain}/analytics/menu-engineering`, moduleKey: "analytics" },
    {
      label: "Workforce",
      href: `/restaurant/${subdomain}/workforce/employees`,
      moduleKey: "hr_onboarding",
      children: [
        {
          label: "Employee Directory",
          desc: "Staff profiles, job grades & outlet assignments",
          href: `/restaurant/${subdomain}/workforce/employees`,
        },
        {
          label: "Onboarding Portal",
          desc: "New hire checklists & compliance verification",
          href: `/restaurant/${subdomain}/workforce/onboarding`,
        },
      ],
    },
    {
      label: "Catering",
      href: `/restaurant/${subdomain}/catering`,
      moduleKey: "catering",
      children: [
        {
          label: "Event Orders Board",
          desc: "Manage quotes, bookings & active event orders",
          href: `/restaurant/${subdomain}/catering`,
        },
        {
          label: "Ingredient Scaler",
          desc: "Calculate bulk raw materials based on Pax & linked recipes",
          href: `/restaurant/${subdomain}/catering?tab=ingredients`,
        },
        {
          label: "Invoices & Deposits",
          desc: "Track client quotes, advance payments & final billing",
          href: `/restaurant/${subdomain}/catering?tab=invoices`,
        },
      ],
    },
  ];

  const mainNavLinks = React.useMemo(() => {
    if (activeModules === null) {
      return allNavLinks.filter((item) => !item.moduleKey || item.label === activeSection);
    }
    return allNavLinks.filter((item) => {
      if (!item.moduleKey) return true;
      const k = item.moduleKey.toLowerCase();
      return (
        activeModules.includes(k) ||
        (k === "shift_management" && activeModules.includes("shifts")) ||
        (k === "shifts" && activeModules.includes("shift_management"))
      );
    });
  }, [activeModules, activeSection, subdomain]);

  const toggleMobileExpand = (label: string) => {
    setMobileExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleMouseEnter = (label: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredNav(label);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredNav(null);
    }, 150);
  };

  const adminNavLinks = [
    {
      label: "Restaurant Profile",
      desc: "Branding colors, identity & subscriptions",
      href: `/restaurant/${subdomain}/settings/profile`,
    },
    ...(activeModules === null || activeModules.includes("vault")
      ? [
        {
          label: "Zero-Knowledge Vault",
          desc: "Enterprise credentials, passwords & API keys",
          href: `/restaurant/${subdomain}/vault`,
        },
      ]
      : []),
    {
      label: "Outlets & Branches",
      desc: "Physical locations & operational timezones",
      href: `/restaurant/${subdomain}/settings/outlets`,
    },
    {
      label: "Master Data",
      desc: "Departments, designations, grades & cost centers",
      href: `/restaurant/${subdomain}/settings/master-data`,
    },
    {
      label: "Roles & Permissions",
      desc: "Custom roles & matrix permission policies",
      href: `/restaurant/${subdomain}/settings/roles-permissions`,
    },
    {
      label: "Access Grants",
      desc: "Outlet and module-scoped entitlements",
      href: `/restaurant/${subdomain}/settings/access-grants`,
    },
    {
      label: "User Accounts & Logins",
      desc: "App user memberships & staff invitations",
      href: `/restaurant/${subdomain}/workforce/users`,
    },
    {
      label: "Onboarding Templates",
      desc: "Compliance verification checklists",
      href: `/restaurant/${subdomain}/workforce/onboarding/templates`,
    },
  ];

  const isAdminActive =
    pathname.includes("/settings/") ||
    pathname.includes("/workforce/users") ||
    pathname.includes("/workforce/onboarding/templates");

  const effectiveBranding = branding || internalBranding;

  const brandColor =
    effectiveBranding?.primaryColor &&
      effectiveBranding.primaryColor !== "#ffffff" &&
      effectiveBranding.primaryColor !== "#fff"
      ? effectiveBranding.primaryColor
      : "#0071E3";

  return (
    <header
      className={`sticky top-0 z-40 backdrop-blur-2xl border-b px-4 sm:px-6 py-2.5 transition-colors ${isDark
        ? "bg-[#090B10]/90 border-white/[0.08]"
        : "bg-white/90 border-black/[0.06] shadow-sm shadow-slate-900/5"
        }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Brand & Breadcrumb */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div
            onClick={() => router.push(`/restaurant/${subdomain}/dashboard`)}
            className="flex items-center space-x-2 cursor-pointer group flex-shrink-0"
          >
            {effectiveBranding?.logoUrl ? (
              <img src={effectiveBranding.logoUrl} alt="Logo" className="h-7 w-auto max-w-[90px] object-contain rounded-md" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-sm group-hover:opacity-90 transition"
                style={{ backgroundColor: brandColor }}
              >
                {effectiveBranding?.name ? effectiveBranding.name.charAt(0).toUpperCase() : "R"}
              </div>
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-xs font-semibold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                {effectiveBranding?.name || "Restaurant Console"}
              </span>
              <span
                className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border hidden sm:inline-block ${isDark
                  ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]"
                  : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
              >
                {subdomain}
              </span>
            </div>
          </div>

          {activeSection && (
            <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-300 dark:border-white/10 truncate">
              <span className={`text-xs font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                /
              </span>
              <span className={`text-xs font-medium truncate ${isDark ? "text-white" : "text-slate-800"}`}>
                {activeSection}
              </span>
            </div>
          )}
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {mainNavLinks.map((link) => {
            const hasChildren = Boolean(link.children && link.children.length > 0);
            const isParentActive =
              pathname === link.href ||
              (link.children && link.children.some((c) => pathname.startsWith(c.href))) ||
              (link.label === "Inventory" && pathname.includes("/inventory")) ||
              (link.label === "Attendance" && pathname.includes("/attendance")) ||
              (link.label === "Workforce" && pathname.includes("/workforce"));

            const isHovered = hoveredNav === link.label;

            if (hasChildren) {
              return (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => handleMouseEnter(link.label)}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    onClick={() => router.push(link.href)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${isParentActive || isHovered
                      ? isDark
                        ? "bg-white/[0.08] text-white font-semibold"
                        : "bg-slate-100 text-[#0071E3] font-semibold"
                      : isDark
                        ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                  >
                    <span>{link.label}</span>
                    <svg
                      className={`w-3 h-3 transition-transform duration-200 opacity-60 ${isHovered ? "rotate-180" : ""
                        }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Desktop Hover Dropdown Menu */}
                  {isHovered && link.children && (
                    <div
                      className={`absolute left-0 mt-1.5 w-72 p-2 rounded-2xl border shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150 ${isDark
                        ? "bg-[#11141F]/95 border-white/[0.08] text-white shadow-black/70"
                        : "bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-900/15"
                        }`}
                    >
                      <div className="px-3 py-1.5 mb-1 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          {link.label} Suite
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        {link.children.map((child) => {
                          const isChildActive = pathname === child.href || (child.href !== link.href && pathname.startsWith(child.href));
                          return (
                            <button
                              key={child.label}
                              onClick={() => {
                                setHoveredNav(null);
                                router.push(child.href);
                              }}
                              className={`w-full p-2.5 rounded-xl text-left transition cursor-pointer flex flex-col group ${isChildActive
                                ? isDark
                                  ? "bg-[#0071E3]/20 text-[#64B5FF]"
                                  : "bg-blue-50 text-[#0071E3]"
                                : isDark
                                  ? "hover:bg-white/[0.05] text-white"
                                  : "hover:bg-slate-50 text-slate-800"
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">{child.label}</span>
                                <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                              </div>
                              <span className={`text-[10px] leading-tight mt-0.5 truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                {child.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={link.label}
                onClick={() => router.push(link.href)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${isParentActive
                  ? isDark
                    ? "bg-white/[0.08] text-white font-semibold"
                    : "bg-slate-100 text-[#0071E3] font-semibold"
                  : isDark
                    ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
              >
                {link.label}
              </button>
            );
          })}
          {/* Administration Dropdown Menu (Only for Admins) */}
          {isAdmin && (
            <div className="relative" ref={adminDropdownRef}>
              <button
                onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${isAdminActive || adminDropdownOpen
                  ? isDark
                    ? "bg-white/[0.08] text-white font-semibold"
                    : "bg-slate-100 text-[#0071E3] font-semibold"
                  : isDark
                    ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
              >
                <span>Administration</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 opacity-70 ${adminDropdownOpen ? "rotate-180" : ""
                    }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {adminDropdownOpen && (
                <div
                  className={`absolute right-0 mt-2 w-72 p-2 rounded-2xl border shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 ${isDark
                    ? "bg-[#121622] border-white/[0.08] text-white shadow-black/60"
                    : "bg-white border-slate-200 text-slate-900 shadow-slate-900/15"
                    }`}
                >
                  <div className="px-3 py-1.5 mb-1 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      System & Access Controls
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {adminNavLinks.map((item) => {
                      const isItemActive = pathname.startsWith(item.href);
                      return (
                        <button
                          key={item.label}
                          onClick={() => {
                            setAdminDropdownOpen(false);
                            router.push(item.href);
                          }}
                          className={`w-full p-2.5 rounded-xl text-left transition cursor-pointer flex flex-col ${isItemActive
                            ? isDark
                              ? "bg-[#0071E3]/20 text-[#64B5FF]"
                              : "bg-blue-50 text-[#0071E3]"
                            : isDark
                              ? "hover:bg-white/[0.04] text-white"
                              : "hover:bg-slate-50 text-slate-800"
                            }`}
                        >
                          <span className="text-xs font-semibold">{item.label}</span>
                          <span className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            {item.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Right: Controls & Mobile Hamburger */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <AppleThemeToggle />

          <button
            onClick={handleLogout}
            className={`hidden md:block text-xs font-medium px-2.5 py-1.5 rounded-xl transition cursor-pointer ${isDark
              ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
          >
            Sign Out
          </button>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden p-2 rounded-xl border text-xs transition cursor-pointer flex items-center justify-center ${isDark
              ? "bg-white/[0.04] border-white/[0.08] text-white hover:bg-white/[0.08]"
              : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
              }`}
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden mt-2.5 p-3 rounded-2xl border space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 ${isDark
            ? "bg-[#121622] border-white/[0.08]"
            : "bg-white border-slate-200 shadow-lg shadow-slate-900/5"
            }`}
        >
          {/* Core Modules Grid & Accordion */}
          <div>
            <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 px-1 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Core Modules
            </span>
            <div className="space-y-1.5">
              {mainNavLinks.map((link) => {
                const hasChildren = Boolean(link.children && link.children.length > 0);
                const isExpanded = Boolean(mobileExpanded[link.label]);
                const isActive =
                  pathname === link.href ||
                  (link.children && link.children.some((c) => pathname.startsWith(c.href))) ||
                  (link.label === "Inventory" && pathname.includes("/inventory"));

                if (hasChildren) {
                  return (
                    <div
                      key={link.label}
                      className={`rounded-xl border transition ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50 border-slate-200/80"
                        }`}
                    >
                      <div className="flex items-center justify-between p-1">
                        <button
                          onClick={() => {
                            setMobileMenuOpen(false);
                            router.push(link.href);
                          }}
                          className={`flex-1 px-2.5 py-1.5 text-xs font-medium text-left cursor-pointer ${isActive
                            ? isDark
                              ? "text-[#64B5FF] font-semibold"
                              : "text-[#0071E3] font-semibold"
                            : isDark
                              ? "text-white"
                              : "text-slate-800"
                            }`}
                        >
                          {link.label}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleMobileExpand(link.label)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs cursor-pointer border transition ${isExpanded
                            ? "bg-[#0071E3] text-white border-[#0071E3]"
                            : isDark
                              ? "bg-white/[0.06] text-[#8F95A3] border-white/[0.08] hover:text-white"
                              : "bg-white text-slate-600 border-slate-200 hover:text-slate-900"
                            }`}
                          aria-label={`Toggle ${link.label} sub-items`}
                        >
                          {isExpanded ? "−" : "+"}
                        </button>
                      </div>

                      {/* Expandable Sub-items on Mobile */}
                      {isExpanded && link.children && (
                        <div className="pl-3 pr-2 py-1.5 border-t border-black/[0.04] dark:border-white/[0.04] space-y-1 animate-in slide-in-from-top-1 duration-150">
                          {link.children.map((child) => {
                            const isChildActive = pathname === child.href;
                            return (
                              <button
                                key={child.label}
                                onClick={() => {
                                  setMobileMenuOpen(false);
                                  router.push(child.href);
                                }}
                                className={`w-full px-2.5 py-1.5 rounded-lg text-[11px] text-left transition cursor-pointer flex items-center justify-between ${isChildActive
                                  ? isDark
                                    ? "bg-[#0071E3]/20 text-[#64B5FF] font-semibold"
                                    : "bg-blue-50 text-[#0071E3] font-semibold"
                                  : isDark
                                    ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                  }`}
                              >
                                <span>{child.label}</span>
                                <span className="opacity-50 text-[10px]">→</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={link.label}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push(link.href);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium transition text-left cursor-pointer ${isActive
                      ? isDark
                        ? "bg-[#0071E3]/20 text-[#64B5FF] border border-[#0071E3]/30 font-semibold"
                        : "bg-blue-50 text-[#0071E3] font-semibold border border-blue-200"
                      : isDark
                        ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                        : "text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                  >
                    {link.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Administration Section (Only for Admins) */}
          {isAdmin && (
            <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 px-1 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Administration & Access
              </span>
              <div className="grid grid-cols-1 gap-1">
                {adminNavLinks.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        router.push(item.href);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition text-left cursor-pointer flex items-center justify-between ${isActive
                        ? isDark
                          ? "bg-[#0071E3]/20 text-[#64B5FF] font-semibold"
                          : "bg-blue-50 text-[#0071E3] font-semibold"
                        : isDark
                          ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                          : "text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                        }`}
                    >
                      <span>{item.label}</span>
                      <span className="text-xs opacity-60">→</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex justify-between items-center px-1">
            <span className={`text-[11px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Tenant: {subdomain}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer py-1 px-2"
            >
              Sign Out →
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
