"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface Module {
  key: string;
  name: string;
  description: string;
  sortOrder: number;
}

interface Branding {
  name: string;
  applicationName: string;
  primaryColor: string;
  logoUrl: string | null;
}

interface DashboardMetrics {
  totalEmployees: number;
  totalOutlets: number;
  lowStockAlerts: number;
  latestPayrollStatus: string | null;
  latestPayrollNet: number | null;
  pendingSwaps: number;
}

export default function AppleTenantDashboard() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [modules, setModules] = useState<Module[]>([]);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalEmployees: 0,
    totalOutlets: 1,
    lowStockAlerts: 0,
    latestPayrollStatus: null,
    latestPayrollNet: null,
    pendingSwaps: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [resBranding, resModules, resEmployees, resOutlets, resAlerts, resPayroll] =
        await Promise.all([
          fetch(`/api/restaurant/${subdomain}/branding`),
          fetch("/api/restaurant/modules"),
          fetch("/api/restaurant/employees"),
          fetch("/api/restaurant/outlets"),
          fetch("/api/restaurant/inventory/alerts").catch(() => null),
          fetch("/api/restaurant/payroll/runs").catch(() => null),
        ]);

      const dataBranding = await resBranding.json();
      const dataModules = await resModules.json();
      const dataEmployees = resEmployees.ok ? await resEmployees.json() : null;
      const dataOutlets = resOutlets.ok ? await resOutlets.json() : null;
      const dataAlerts = resAlerts && resAlerts.ok ? await resAlerts.json() : null;
      const dataPayroll = resPayroll && resPayroll.ok ? await resPayroll.json() : null;

      if (resBranding.ok) setBranding(dataBranding);
      if (resModules.ok) setModules(dataModules.modules || []);
      else setError(dataModules.error || "Failed to load dashboard data");

      const latestRun = dataPayroll?.runs?.[0];

      setMetrics({
        totalEmployees: dataEmployees?.employees?.length || 0,
        totalOutlets: dataOutlets?.outlets?.length || 1,
        lowStockAlerts: dataAlerts?.alerts?.length || 0,
        latestPayrollStatus: latestRun?.status || null,
        latestPayrollNet: latestRun ? Number(latestRun.totalNet) : null,
        pendingSwaps: 0,
      });
    } catch {
      setError("Network error loading dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subdomain) {
      fetchData();
    }
  }, [subdomain]);

  // Deduplicate and group sub-modules into Top-Level Modules
  const uniqueModules = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{
      key: string;
      name: string;
      description: string;
      path: string;
      icon: string;
      badge?: string;
      badgeType?: "info" | "warning" | "success";
    }> = [];

    // Parent Top-Level Module Map
    const PARENT_MODULE_MAP: Record<
      string,
      {
        topKey: string;
        name: string;
        desc: string;
        path: string;
        icon: string;
      }
    > = {
      // Inventory Family
      inventory: {
        topKey: "inventory",
        name: "Inventory & Stock Control",
        desc: "Item masters, SKU stock ledgers, vendor catalogs, purchase orders & wastage logs.",
        path: `/restaurant/${subdomain}/inventory`,
        icon: "archive",
      },
      vendor_management: {
        topKey: "inventory",
        name: "Inventory & Stock Control",
        desc: "Item masters, SKU stock ledgers, vendor catalogs, purchase orders & wastage logs.",
        path: `/restaurant/${subdomain}/inventory`,
        icon: "archive",
      },
      purchase_management: {
        topKey: "inventory",
        name: "Inventory & Stock Control",
        desc: "Item masters, SKU stock ledgers, vendor catalogs, purchase orders & wastage logs.",
        path: `/restaurant/${subdomain}/inventory`,
        icon: "archive",
      },

      // Attendance & Leaves Family
      attendance: {
        topKey: "attendance",
        name: "Time & Attendance",
        desc: "Live attendance board, punch clocking kiosk, daily timesheets, and leave approvals.",
        path: `/restaurant/${subdomain}/attendance`,
        icon: "clock",
      },
      leave_management: {
        topKey: "attendance",
        name: "Time & Attendance",
        desc: "Live attendance board, punch clocking kiosk, daily timesheets, and leave approvals.",
        path: `/restaurant/${subdomain}/attendance`,
        icon: "clock",
      },

      // Workforce Family
      workforce: {
        topKey: "workforce",
        name: "Staff & Workforce",
        desc: "Employee directory, worker profiles, document checklists & onboarding workflows.",
        path: `/restaurant/${subdomain}/workforce/employees`,
        icon: "users",
      },
      hr_onboarding: {
        topKey: "workforce",
        name: "Staff & Workforce",
        desc: "Employee directory, worker profiles, document checklists & onboarding workflows.",
        path: `/restaurant/${subdomain}/workforce/employees`,
        icon: "users",
      },

      // Shifts Family
      shifts: {
        topKey: "shifts",
        name: "Shift Scheduling & Rosters",
        desc: "Weekly visual roster planner, timing templates, and shift swap approval center.",
        path: `/restaurant/${subdomain}/shifts/rosters`,
        icon: "calendar",
      },
      shift_management: {
        topKey: "shifts",
        name: "Shift Scheduling & Rosters",
        desc: "Weekly visual roster planner, timing templates, and shift swap approval center.",
        path: `/restaurant/${subdomain}/shifts/rosters`,
        icon: "calendar",
      },

      // Payroll
      payroll: {
        topKey: "payroll",
        name: "Payroll & Compensation",
        desc: "Automated wage calculation, shift hour aggregation, salary structures, tip pools, and payslips.",
        path: `/restaurant/${subdomain}/payroll/runs`,
        icon: "currency",
      },

      // POS
      pos: {
        topKey: "pos",
        name: "Point of Sale (POS)",
        desc: "Digital table order taking, menu catalog, kitchen ticketing, and bill settlement.",
        path: `/restaurant/${subdomain}/pos`,
        icon: "credit-card",
      },

      // Finance
      finance: {
        topKey: "finance",
        name: "Finance & P&L Tracker",
        desc: "Real-time P&L intelligence, automated expense sync from payroll & POs, and upcoming bill reminders.",
        path: `/restaurant/${subdomain}/finance`,
        icon: "chart-bar",
      },

      // Analytics
      analytics: {
        topKey: "analytics",
        name: "Analytics & Menu Engineering",
        desc: "Menu engineering matrix (Stars, Plowhorses, Puzzles, Dogs), food cost variance and profitability reports.",
        path: `/restaurant/${subdomain}/analytics/menu-engineering`,
        icon: "trending-up",
      },

      // Vault
      vault: {
        topKey: "vault",
        name: "Secrets Vault & 2FA",
        desc: "Zero-knowledge encrypted credential vault, 2FA authenticator, and granular role sharing.",
        path: `/restaurant/${subdomain}/vault`,
        icon: "shield-check",
      },

      // Catering
      catering: {
        topKey: "catering",
        name: "Catering & Event Management",
        desc: "Banquet orders, Pax guest headcount pricing, recipe ingredient scaling, advance deposits, and invoices.",
        path: `/restaurant/${subdomain}/catering`,
        icon: "clipboard-list",
      },
    };

    modules.forEach((m) => {
      const key = m.key.toLowerCase();
      const parent = PARENT_MODULE_MAP[key] || {
        topKey: key,
        name: m.name,
        desc: m.description || "",
        path: `/restaurant/${subdomain}/modules/${m.key}`,
        icon: "archive",
      };

      if (seen.has(parent.topKey)) return;
      seen.add(parent.topKey);

      let badge: string | undefined;
      let badgeType: "info" | "warning" | "success" | undefined;

      if (parent.topKey === "shifts") {
        badge = "Roster Live";
        badgeType = "info";
      } else if (parent.topKey === "inventory" && metrics.lowStockAlerts > 0) {
        badge = `${metrics.lowStockAlerts} Low Stock`;
        badgeType = "warning";
      } else if (parent.topKey === "payroll" && metrics.latestPayrollStatus) {
        badge = metrics.latestPayrollStatus;
        badgeType = "success";
      } else if (parent.topKey === "finance") {
        badge = "P&L Active";
        badgeType = "success";
      } else if (parent.topKey === "vault") {
        badge = "AES-256";
        badgeType = "info";
      }

      list.push({
        key: parent.topKey,
        name: parent.name,
        description: parent.desc,
        path: parent.path,
        icon: parent.icon,
        badge,
        badgeType,
      });
    });

    return list;
  }, [modules, subdomain, metrics]);

  const allowedKeys = useMemo(() => {
    const set = new Set<string>();
    modules.forEach((m) => {
      const k = m.key.toLowerCase();
      set.add(k);
      if (k === "shifts" || k === "shift_management") {
        set.add("shifts");
        set.add("shift_management");
      }
      if (k === "inventory") {
        set.add("inventory");
        set.add("vendor_management");
        set.add("purchase_management");
      }
      if (k === "attendance" || k === "leave_management") {
        set.add("attendance");
        set.add("leave_management");
      }
      if (k === "workforce" || k === "hr_onboarding") {
        set.add("workforce");
        set.add("hr_onboarding");
      }
    });
    return set;
  }, [modules]);

  const hasShiftAccess = allowedKeys.has("shifts") || allowedKeys.has("shift_management");
  const hasPayrollAccess = allowedKeys.has("payroll");
  const hasWorkforceAccess = allowedKeys.has("workforce") || allowedKeys.has("hr_onboarding");
  const hasInventoryAccess = allowedKeys.has("inventory");

  if (loading) {
    return (
      <main
        className={`flex min-h-screen items-center justify-center font-sans ${isDark ? "bg-[#090B10] text-[#8F95A3]" : "bg-[#F5F5F7] text-slate-500"
          }`}
      >
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-[#0071E3] animate-pulse" />
          <span>Loading workspace...</span>
        </div>
      </main>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased selection:bg-blue-500 selection:text-white flex flex-col transition-colors duration-200 ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
    >
      <RestaurantNavbar branding={branding} activeSection="Overview" />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-8">
        {/* Executive Hero Banner */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${isDark
            ? "bg-[#121622]/60 border-white/[0.06]"
            : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
            }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Operations Live • {metrics.totalOutlets} {metrics.totalOutlets === 1 ? "Branch" : "Branches"} Active
              </span>
            </div>
            <h2 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {branding?.name || "Restaurant Console"}
            </h2>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Unified management of shift scheduling, payroll cycles, workforce master data, and branch inventory.
            </p>
          </div>

          {/* Quick Action Buttons (Only for Permitted Modules) */}
          {(hasShiftAccess || hasPayrollAccess || hasWorkforceAccess) && (
            <div className="flex flex-wrap items-center gap-2">
              {hasShiftAccess && (
                <button
                  onClick={() => router.push(`/restaurant/${subdomain}/shifts/rosters`)}
                  className="px-3.5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-xl transition shadow-sm"
                >
                  + Schedule Shift
                </button>
              )}
              {hasPayrollAccess && (
                <button
                  onClick={() => router.push(`/restaurant/${subdomain}/payroll/runs`)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition ${isDark
                    ? "bg-white/[0.06] text-white border-white/[0.08] hover:bg-white/[0.1]"
                    : "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200"
                    }`}
                >
                  + Run Payroll
                </button>
              )}
              {hasWorkforceAccess && (
                <button
                  onClick={() => router.push(`/restaurant/${subdomain}/workforce/employees`)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition ${isDark
                    ? "bg-white/[0.03] text-[#8F95A3] border-white/[0.06] hover:text-white"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  + Add Employee
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        {/* Executive KPI Live Summary Grid (Only for Permitted Modules) */}
        {(hasWorkforceAccess || hasShiftAccess || hasPayrollAccess || hasInventoryAccess) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {hasWorkforceAccess && (
              <div
                onClick={() => router.push(`/restaurant/${subdomain}/workforce/employees`)}
                className={`p-5 rounded-2xl border transition cursor-pointer ${isDark
                  ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
                  : "bg-white border-slate-200/80 shadow-sm hover:border-slate-300"
                  }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Total Workforce
                  </span>
                  <span className="text-xs text-[#0071E3]">Manage →</span>
                </div>
                <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                  {metrics.totalEmployees}{" "}
                  <span className={`text-xs font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>Staff</span>
                </p>
                <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Across {metrics.totalOutlets} {metrics.totalOutlets === 1 ? "branch" : "branches"}
                </p>
              </div>
            )}

            {hasShiftAccess && (
              <div
                onClick={() => router.push(`/restaurant/${subdomain}/shifts/rosters`)}
                className={`p-5 rounded-2xl border transition cursor-pointer ${isDark
                  ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
                  : "bg-white border-slate-200/80 shadow-sm hover:border-slate-300"
                  }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Shift Roster
                  </span>
                  <span className="text-xs text-[#0071E3]">Schedule →</span>
                </div>
                <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                  Weekly Grid
                </p>
                <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Published & Active
                </p>
              </div>
            )}

            {hasPayrollAccess && (
              <div
                onClick={() => router.push(`/restaurant/${subdomain}/payroll/runs`)}
                className={`p-5 rounded-2xl border transition cursor-pointer ${isDark
                  ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
                  : "bg-white border-slate-200/80 shadow-sm hover:border-slate-300"
                  }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Latest Payroll
                  </span>
                  <span className="text-xs text-[#0071E3]">Runs →</span>
                </div>
                <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                  {metrics.latestPayrollNet !== null
                    ? `$${metrics.latestPayrollNet.toLocaleString()}`
                    : "Not Initiated"}
                </p>
                <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {metrics.latestPayrollStatus ? `Status: ${metrics.latestPayrollStatus}` : "Ready to compute"}
                </p>
              </div>
            )}

            {hasInventoryAccess && (
              <div
                onClick={() => router.push(`/restaurant/${subdomain}/inventory/alerts`)}
                className={`p-5 rounded-2xl border transition cursor-pointer ${isDark
                  ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
                  : "bg-white border-slate-200/80 shadow-sm hover:border-slate-300"
                  }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Inventory Health
                  </span>
                  <span className="text-xs text-[#0071E3]">Alerts →</span>
                </div>
                <p
                  className={`text-2xl font-bold tracking-tight mt-1.5 ${metrics.lowStockAlerts > 0
                    ? "text-amber-500"
                    : isDark
                      ? "text-emerald-400"
                      : "text-emerald-600"
                    }`}
                >
                  {metrics.lowStockAlerts > 0 ? `${metrics.lowStockAlerts} Deficits` : "Optimal"}
                </p>
                <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {metrics.lowStockAlerts > 0 ? "Reorder stock immediately" : "All stock levels normal"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Operational Modules Command Center */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Operational Business Modules
            </span>
            <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              {uniqueModules.length} active modules
            </span>
          </div>

          {uniqueModules.length === 0 ? (
            <div
              className={`p-8 rounded-2xl border text-center text-xs ${isDark ? "bg-[#121622]/30 border-white/[0.06] text-[#8F95A3]" : "bg-white border-slate-200 text-slate-400"
                }`}
            >
              No operational modules are currently allocated to this tenant.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {uniqueModules.map((mod) => (
                <div
                  key={mod.key}
                  onClick={() => router.push(mod.path)}
                  className={`p-6 rounded-3xl border transition flex flex-col justify-between space-y-4 cursor-pointer group ${isDark
                    ? "bg-[#121622]/60 border-white/[0.06] hover:bg-[#121622]/90 hover:border-white/[0.15]"
                    : "bg-white border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300"
                    }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
                        <h4 className={`text-sm font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                          {mod.name}
                        </h4>
                      </div>

                      {mod.badge && (
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${mod.badgeType === "warning"
                            ? isDark
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                            : mod.badgeType === "success"
                              ? isDark
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : isDark
                                ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                            }`}
                        >
                          {mod.badge}
                        </span>
                      )}
                    </div>

                    <p className={`text-xs line-clamp-2 leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      {mod.description}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-xs font-medium text-[#0071E3] group-hover:underline">
                      Launch Module
                    </span>
                    <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Administration & Master Data Grid */}
        <div className="space-y-4">
          <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
            Administration, Master Data & Access Control
          </span>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Restaurant Profile",
                desc: "Branding colors, application title, logos",
                path: `/restaurant/${subdomain}/settings/profile`,
                badge: "Branding",
              },
              {
                label: "Outlets & Branches",
                desc: "Physical locations, timezones, tax identifiers",
                path: `/restaurant/${subdomain}/settings/outlets`,
                badge: `${metrics.totalOutlets} Outlets`,
              },
              {
                label: "Master Data",
                desc: "Departments, designations",
                path: `/restaurant/${subdomain}/settings/master-data`,
                badge: "Structure",
              },
              {
                label: "Employee Directory",
                desc: "Staff profiles, worker types, code sequences",
                path: `/restaurant/${subdomain}/workforce/employees`,
                badge: `${metrics.totalEmployees} Active`,
              },
              {
                label: "HR Onboarding",
                desc: "Session approvals, checklist templates",
                path: `/restaurant/${subdomain}/workforce/onboarding`,
                badge: "Workflows",
              },
              {
                label: "Users & Staff Logins",
                desc: "Invite team members, credentials management",
                path: `/restaurant/${subdomain}/workforce/users`,
                badge: "Access",
              },
              {
                label: "Roles & Permissions",
                desc: "Custom roles, matrix permission rules",
                path: `/restaurant/${subdomain}/settings/roles-permissions`,
                badge: "Security",
              },
              {
                label: "Access Grants",
                desc: "Outlet and module scoped entitlements",
                path: `/restaurant/${subdomain}/settings/access-grants`,
                badge: "Enforcement",
              },
            ].map((item) => (
              <div
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${isDark
                  ? "bg-[#121622]/40 border-white/[0.06] hover:bg-[#121622]/80 hover:border-white/[0.12]"
                  : "bg-white border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300"
                  }`}
              >
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <h4 className={`text-xs font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {item.label}
                    </h4>
                    <span
                      className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${isDark ? "bg-white/[0.04] text-[#8F95A3]" : "bg-slate-100 text-slate-600"
                        }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {item.desc}
                  </p>
                </div>

                <div className="flex items-center text-[11px] font-medium text-[#0071E3] pt-1">
                  <span>Manage</span>
                  <span className="ml-1">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
