"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import {
  Package,
  Clock,
  Users,
  CalendarDays,
  Banknote,
  CreditCard,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  UtensilsCrossed,
  Sliders,
  ClipboardCheck,
  Lock,
  Store,
  MapPin,
  Database,
  UserCheck,
  FileCheck2,
  UserPlus,
  Shield,
  KeyRound,
  Info,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

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

// Reusable Apple / Linear-grade interactive tooltip
function InfoTooltip({
  title,
  description,
  category,
}: {
  title: string;
  description: string;
  category?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen((prev) => !prev);
      }}
    >
      <button
        type="button"
        aria-label={`About ${title}`}
        className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus:outline-none"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full right-0 mb-2.5 w-64 p-3 bg-[#0B0F19]/95 dark:bg-[#151A28]/95 backdrop-blur-xl text-white rounded-2xl shadow-2xl border border-white/15 text-left z-50 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-white/10">
            <span className="text-xs font-semibold text-white tracking-tight">{title}</span>
            {category && (
              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-blue-300">
                {category}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
            {description}
          </p>
          {/* Tooltip diamond arrow notch */}
          <div className="absolute top-full right-2 -mt-1 w-2 h-2 rotate-45 bg-[#0B0F19]/95 dark:bg-[#151A28]/95 border-r border-b border-white/15" />
        </div>
      )}
    </div>
  );
}

// Module configuration: icons, categories, accent color schemes, and feature tags
const MODULE_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    category: string;
    featureTag: string;
    bgLight: string;
    textLight: string;
    borderLight: string;
    bgDark: string;
    textDark: string;
    borderDark: string;
  }
> = {
  inventory: {
    icon: Package,
    category: "Supply Chain",
    featureTag: "SKU Ledgers & POs",
    bgLight: "bg-amber-500/10",
    textLight: "text-amber-600",
    borderLight: "border-amber-500/25",
    bgDark: "bg-amber-500/10",
    textDark: "text-amber-400",
    borderDark: "border-amber-500/20",
  },
  attendance: {
    icon: Clock,
    category: "Time Tracking",
    featureTag: "Kiosk & Punch Timesheets",
    bgLight: "bg-sky-500/10",
    textLight: "text-sky-600",
    borderLight: "border-sky-500/25",
    bgDark: "bg-sky-500/10",
    textDark: "text-sky-400",
    borderDark: "border-sky-500/20",
  },
  workforce: {
    icon: Users,
    category: "People & HR",
    featureTag: "Directory & Checklists",
    bgLight: "bg-blue-500/10",
    textLight: "text-blue-600",
    borderLight: "border-blue-500/25",
    bgDark: "bg-blue-500/10",
    textDark: "text-blue-400",
    borderDark: "border-blue-500/20",
  },
  shifts: {
    icon: CalendarDays,
    category: "Scheduling",
    featureTag: "Visual Grid & Roster Swaps",
    bgLight: "bg-indigo-500/10",
    textLight: "text-indigo-600",
    borderLight: "border-indigo-500/25",
    bgDark: "bg-indigo-500/10",
    textDark: "text-indigo-400",
    borderDark: "border-indigo-500/20",
  },
  payroll: {
    icon: Banknote,
    category: "Compensation",
    featureTag: "Automated Wages & Tips",
    bgLight: "bg-emerald-500/10",
    textLight: "text-emerald-600",
    borderLight: "border-emerald-500/25",
    bgDark: "bg-emerald-500/10",
    textDark: "text-emerald-400",
    borderDark: "border-emerald-500/20",
  },
  pos: {
    icon: CreditCard,
    category: "Front of House",
    featureTag: "Tables, Orders & KOT",
    bgLight: "bg-violet-500/10",
    textLight: "text-violet-600",
    borderLight: "border-violet-500/25",
    bgDark: "bg-violet-500/10",
    textDark: "text-violet-400",
    borderDark: "border-violet-500/20",
  },
  finance: {
    icon: TrendingUp,
    category: "Accounting",
    featureTag: "Real-time P&L Sync",
    bgLight: "bg-teal-500/10",
    textLight: "text-teal-600",
    borderLight: "border-teal-500/25",
    bgDark: "bg-teal-500/10",
    textDark: "text-teal-400",
    borderDark: "border-teal-500/20",
  },
  vault: {
    icon: ShieldCheck,
    category: "Security",
    featureTag: "Zero-Knowledge AES-256",
    bgLight: "bg-rose-500/10",
    textLight: "text-rose-600",
    borderLight: "border-rose-500/25",
    bgDark: "bg-rose-500/10",
    textDark: "text-rose-400",
    borderDark: "border-rose-500/20",
  },
  analytics: {
    icon: BarChart3,
    category: "Intelligence",
    featureTag: "Menu Matrix & Margins",
    bgLight: "bg-purple-500/10",
    textLight: "text-purple-600",
    borderLight: "border-purple-500/25",
    bgDark: "bg-purple-500/10",
    textDark: "text-purple-400",
    borderDark: "border-purple-500/20",
  },
  catering: {
    icon: UtensilsCrossed,
    category: "Hospitality",
    featureTag: "Banquet Pax & Event Invoices",
    bgLight: "bg-pink-500/10",
    textLight: "text-pink-600",
    borderLight: "border-pink-500/25",
    bgDark: "bg-pink-500/10",
    textDark: "text-pink-400",
    borderDark: "border-pink-500/20",
  },
  masterdata: {
    icon: Sliders,
    category: "Configuration",
    featureTag: "Multi-Outlet Tax & Profiles",
    bgLight: "bg-cyan-500/10",
    textLight: "text-cyan-600",
    borderLight: "border-cyan-500/25",
    bgDark: "bg-cyan-500/10",
    textDark: "text-cyan-400",
    borderDark: "border-cyan-500/20",
  },
  operations: {
    icon: ClipboardCheck,
    category: "Quality & SOP",
    featureTag: "Opening/Closing Audits",
    bgLight: "bg-emerald-500/10",
    textLight: "text-emerald-600",
    borderLight: "border-emerald-500/25",
    bgDark: "bg-emerald-500/10",
    textDark: "text-emerald-400",
    borderDark: "border-emerald-500/20",
  },
  rbac: {
    icon: Lock,
    category: "Governance",
    featureTag: "Matrix Roles & Entitlements",
    bgLight: "bg-orange-500/10",
    textLight: "text-orange-600",
    borderLight: "border-orange-500/25",
    bgDark: "bg-orange-500/10",
    textDark: "text-orange-400",
    borderDark: "border-orange-500/20",
  },
};

const DEFAULT_MODULE_CONFIG = {
  icon: Package,
  category: "Module",
  featureTag: "Operational",
  bgLight: "bg-slate-100",
  textLight: "text-slate-600",
  borderLight: "border-slate-200",
  bgDark: "bg-white/[0.06]",
  textDark: "text-slate-300",
  borderDark: "border-white/[0.08]",
};

export default function AppleTenantDashboard() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [modules, setModules] = useState<Module[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
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

  const isSubdomain =
    typeof window !== "undefined" &&
    (window.location.host.startsWith(`${subdomain}.`) ||
      (window.location.host.includes(".localhost") && !window.location.host.startsWith("admin.")));

  const p = (path: string) => (isSubdomain ? path : `/restaurant/${subdomain}${path}`);

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

      if (resModules.status === 401) {
        router.push(p("/login"));
        return;
      }

      if (resBranding.ok) setBranding(dataBranding);
      if (resModules.ok) {
        setModules(dataModules.modules || []);
        setIsAdmin(!!dataModules.isAdmin);
      } else {
        setError(dataModules.error || "Failed to load dashboard data");
      }

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
      }
    > = {
      // Inventory Family
      inventory: {
        topKey: "inventory",
        name: "Inventory & Stock Control",
        desc: "Item masters, SKU stock ledgers, vendor catalogs, purchase orders & wastage logs.",
        path: "/inventory",
      },
      vendor_management: {
        topKey: "inventory",
        name: "Inventory & Stock Control",
        desc: "Item masters, SKU stock ledgers, vendor catalogs, purchase orders & wastage logs.",
        path: "/inventory",
      },
      purchase_management: {
        topKey: "inventory",
        name: "Inventory & Stock Control",
        desc: "Item masters, SKU stock ledgers, vendor catalogs, purchase orders & wastage logs.",
        path: "/inventory",
      },

      // Attendance & Leaves Family
      attendance: {
        topKey: "attendance",
        name: "Time & Attendance",
        desc: "Live attendance board, punch clocking kiosk, daily timesheets, and leave approvals.",
        path: "/attendance",
      },
      leave_management: {
        topKey: "attendance",
        name: "Time & Attendance",
        desc: "Live attendance board, punch clocking kiosk, daily timesheets, and leave approvals.",
        path: "/attendance",
      },

      // Workforce Family
      workforce: {
        topKey: "workforce",
        name: "Staff & Workforce",
        desc: "Employee directory, worker profiles, document checklists & onboarding workflows.",
        path: "/workforce/employees",
      },
      hr_onboarding: {
        topKey: "workforce",
        name: "Staff & Workforce",
        desc: "Employee directory, worker profiles, document checklists & onboarding workflows.",
        path: "/workforce/employees",
      },

      // Shifts Family
      shifts: {
        topKey: "shifts",
        name: "Shift Scheduling & Rosters",
        desc: "Weekly visual roster planner, timing templates, and shift swap approval center.",
        path: "/shifts/rosters",
      },
      shift_management: {
        topKey: "shifts",
        name: "Shift Scheduling & Rosters",
        desc: "Weekly visual roster planner, timing templates, and shift swap approval center.",
        path: "/shifts/rosters",
      },

      // Payroll
      payroll: {
        topKey: "payroll",
        name: "Payroll & Compensation",
        desc: "Automated wage calculation, shift hour aggregation, salary structures, tip pools, and payslips.",
        path: "/payroll/runs",
      },

      // POS
      pos: {
        topKey: "pos",
        name: "Point of Sale (POS)",
        desc: "Digital table order taking, menu catalog, kitchen ticketing, and bill settlement.",
        path: "/pos",
      },

      // Finance
      finance: {
        topKey: "finance",
        name: "Finance & P&L Tracker",
        desc: "Real-time P&L intelligence, automated expense sync from payroll & POs, and upcoming bill reminders.",
        path: "/finance",
      },

      // Analytics
      analytics: {
        topKey: "analytics",
        name: "Analytics & Menu Engineering",
        desc: "Menu engineering matrix (Stars, Plowhorses, Puzzles, Dogs), food cost variance and profitability reports.",
        path: "/analytics/menu-engineering",
      },

      // Vault
      vault: {
        topKey: "vault",
        name: "Secrets Vault & 2FA",
        desc: "Zero-knowledge encrypted credential vault, 2FA authenticator, and granular role sharing.",
        path: "/vault",
      },

      // Catering
      catering: {
        topKey: "catering",
        name: "Catering & Event Management",
        desc: "Banquet orders, Pax guest headcount pricing, recipe ingredient scaling, advance deposits, and invoices.",
        path: "/catering",
      },

      // Master Data
      masterdata: {
        topKey: "masterdata",
        name: "Master Data Settings",
        desc: "Multi-outlet profiles, tax rates, operational categories, and organizational taxonomies.",
        path: "/settings/master-data",
      },

      // Operations & Checklists
      operations: {
        topKey: "operations",
        name: "Operations & Checklists",
        desc: "Opening/closing operational checklists, shift handovers, and food safety SOP temperature audits.",
        path: "/operations",
      },

      // RBAC
      rbac: {
        topKey: "rbac",
        name: "Role-Based Access Controls",
        desc: "Custom role definitions, granular matrix permissions, and staff authorization scoping.",
        path: "/settings/roles-permissions",
      },
    };

    // Administrative modules already represented in the Administration section below:
    // - workforce / hr_onboarding -> Employee Directory & HR Onboarding
    // - masterdata -> Master Data
    // - rbac -> Roles & Permissions
    const ADMIN_MODULE_KEYS = new Set(["workforce", "hr_onboarding", "masterdata", "rbac"]);

    modules.forEach((m) => {
      const key = m.key.toLowerCase();
      const parent = PARENT_MODULE_MAP[key] || {
        topKey: key,
        name: m.name,
        desc: m.description || "",
        path: `/modules/${m.key}`,
      };

      // Skip administrative modules from the top operational modules grid
      if (ADMIN_MODULE_KEYS.has(parent.topKey) || ADMIN_MODULE_KEYS.has(key)) return;

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
        badge,
        badgeType,
      });
    });

    return list;
  }, [modules, metrics]);

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
        className={`flex min-h-screen items-center justify-center font-sans ${
          isDark ? "bg-[#090B10] text-[#8F95A3]" : "bg-[#F5F5F7] text-slate-500"
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
      className={`min-h-screen font-sans antialiased selection:bg-blue-500 selection:text-white flex flex-col transition-colors duration-200 ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar branding={branding} activeSection="Overview" />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8 space-y-8">
        {/* Executive Hero Banner */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06] shadow-xl shadow-black/20"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  isDark ? "text-emerald-400" : "text-emerald-700"
                }`}
              >
                Operations Live • {metrics.totalOutlets}{" "}
                {metrics.totalOutlets === 1 ? "Branch" : "Branches"} Active
              </span>
            </div>
            <h2
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {branding?.name || "Restaurant Console"}
            </h2>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Unified management of shift scheduling, payroll cycles, workforce master data, and branch inventory.
            </p>
          </div>

          {/* Quick Action Buttons */}
          {(hasShiftAccess || hasPayrollAccess || hasWorkforceAccess) && (
            <div className="flex flex-wrap items-center gap-2.5">
              {hasShiftAccess && (
                <button
                  onClick={() => router.push(p("/shifts/rosters"))}
                  className="px-3.5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 hover:shadow-blue-500/20"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>+ Schedule Shift</span>
                </button>
              )}
              {hasPayrollAccess && (
                <button
                  onClick={() => router.push(p("/payroll/runs"))}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                    isDark
                      ? "bg-white/[0.06] text-white border-white/[0.08] hover:bg-white/[0.1]"
                      : "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>+ Run Payroll</span>
                </button>
              )}
              {hasWorkforceAccess && (
                <button
                  onClick={() => router.push(p("/workforce/employees"))}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                    isDark
                      ? "bg-white/[0.03] text-[#8F95A3] border-white/[0.06] hover:text-white"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add Employee</span>
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs px-4 py-3 rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Executive Live KPI Cards */}
        {(hasWorkforceAccess || hasShiftAccess || hasPayrollAccess || hasInventoryAccess) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {hasWorkforceAccess && (
              <div
                onClick={() => router.push(p("/workforce/employees"))}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer group ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.14] hover:bg-[#121622]/80"
                    : "bg-white border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      isDark ? "text-[#8F95A3]" : "text-slate-500"
                    }`}
                  >
                    Total Workforce
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                      isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className={`text-2xl font-bold tracking-tight mt-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  {metrics.totalEmployees}{" "}
                  <span className={`text-xs font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>Staff</span>
                </p>
                <div className="flex justify-between items-center mt-2 text-[11px]">
                  <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>
                    Across {metrics.totalOutlets} {metrics.totalOutlets === 1 ? "branch" : "branches"}
                  </span>
                  <span className="text-[#0071E3] font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Manage <ArrowRight className="w-3 h-3 inline" />
                  </span>
                </div>
              </div>
            )}

            {hasShiftAccess && (
              <div
                onClick={() => router.push(p("/shifts/rosters"))}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer group ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.14] hover:bg-[#121622]/80"
                    : "bg-white border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      isDark ? "text-[#8F95A3]" : "text-slate-500"
                    }`}
                  >
                    Shift Roster
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                      isDark ? "bg-indigo-500/10 text-indigo-400" : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className={`text-2xl font-bold tracking-tight mt-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  Weekly Grid
                </p>
                <div className="flex justify-between items-center mt-2 text-[11px]">
                  <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Published & Active</span>
                  <span className="text-[#0071E3] font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Schedule <ArrowRight className="w-3 h-3 inline" />
                  </span>
                </div>
              </div>
            )}

            {hasPayrollAccess && (
              <div
                onClick={() => router.push(p("/payroll/runs"))}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer group ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.14] hover:bg-[#121622]/80"
                    : "bg-white border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      isDark ? "text-[#8F95A3]" : "text-slate-500"
                    }`}
                  >
                    Latest Payroll
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                      isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className={`text-2xl font-bold tracking-tight mt-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  {metrics.latestPayrollNet !== null
                    ? `$${metrics.latestPayrollNet.toLocaleString()}`
                    : "Not Initiated"}
                </p>
                <div className="flex justify-between items-center mt-2 text-[11px]">
                  <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>
                    {metrics.latestPayrollStatus ? `Status: ${metrics.latestPayrollStatus}` : "Ready to compute"}
                  </span>
                  <span className="text-[#0071E3] font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Runs <ArrowRight className="w-3 h-3 inline" />
                  </span>
                </div>
              </div>
            )}

            {hasInventoryAccess && (
              <div
                onClick={() => router.push(p("/inventory/alerts"))}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer group ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.14] hover:bg-[#121622]/80"
                    : "bg-white border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider ${
                      isDark ? "text-[#8F95A3]" : "text-slate-500"
                    }`}
                  >
                    Inventory Health
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                      metrics.lowStockAlerts > 0
                        ? isDark
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-amber-50 text-amber-600"
                        : isDark
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    <Package className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p
                  className={`text-2xl font-bold tracking-tight mt-2 ${
                    metrics.lowStockAlerts > 0
                      ? "text-amber-500"
                      : isDark
                      ? "text-emerald-400"
                      : "text-emerald-600"
                  }`}
                >
                  {metrics.lowStockAlerts > 0 ? `${metrics.lowStockAlerts} Deficits` : "Optimal"}
                </p>
                <div className="flex justify-between items-center mt-2 text-[11px]">
                  <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>
                    {metrics.lowStockAlerts > 0 ? "Reorder stock" : "All stock normal"}
                  </span>
                  <span className="text-[#0071E3] font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                    Alerts <ArrowRight className="w-3 h-3 inline" />
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Operational Business Modules Grid (Clean, Card-Icon Aesthetic with Tooltip Descriptions) */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                isDark ? "text-[#8F95A3]" : "text-slate-500"
              }`}
            >
              Operational Business Modules
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                isDark
                  ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.06]"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {uniqueModules.length} Active Modules
            </span>
          </div>

          {uniqueModules.length === 0 ? (
            <div
              className={`p-8 rounded-2xl border text-center text-xs ${
                isDark
                  ? "bg-[#121622]/30 border-white/[0.06] text-[#8F95A3]"
                  : "bg-white border-slate-200 text-slate-400"
              }`}
            >
              No operational modules are currently allocated to this tenant.
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {uniqueModules.map((mod) => {
                const conf = MODULE_CONFIG[mod.key] || DEFAULT_MODULE_CONFIG;
                const IconComponent = conf.icon;

                return (
                  <div
                    key={mod.key}
                    onClick={() => router.push(p(mod.path))}
                    className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer group flex flex-col justify-between gap-3 ${
                      isDark
                        ? "bg-[#121622]/60 border-white/[0.06] hover:bg-[#121622]/90 hover:border-white/[0.14] hover:shadow-lg hover:shadow-black/20"
                        : "bg-white border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300"
                    }`}
                  >
                    {/* Header Row: Icon + Name + Badge + Tooltip */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 duration-200 ${
                            isDark
                              ? `${conf.bgDark} ${conf.textDark} ${conf.borderDark}`
                              : `${conf.bgLight} ${conf.textLight} ${conf.borderLight}`
                          }`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span
                            className={`block text-[10px] font-semibold uppercase tracking-wider truncate ${
                              isDark ? "text-[#8F95A3]" : "text-slate-400"
                            }`}
                          >
                            {conf.category}
                          </span>
                          <h4
                            className={`text-sm font-semibold tracking-tight truncate group-hover:text-[#0071E3] dark:group-hover:text-blue-400 transition-colors ${
                              isDark ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {mod.name}
                          </h4>
                        </div>
                      </div>

                      {/* Right Controls: Badge + Tooltip */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {mod.badge && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                              mod.badgeType === "warning"
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

                        {/* Interactive Tooltip Trigger for Description */}
                        <InfoTooltip
                          title={mod.name}
                          description={mod.description}
                          category={conf.category}
                        />
                      </div>
                    </div>

                    {/* Footer Row: Feature tag & sleek launch CTA */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.04] text-xs">
                      <span className={`text-[11px] font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                        {conf.featureTag}
                      </span>
                      <span className="font-semibold text-[#0071E3] dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform text-[11px]">
                        Launch <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Administration & Master Data Grid (Clean & Iconified with Tooltips) */}
        {isAdmin && (
          <div className="space-y-4">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                isDark ? "text-[#8F95A3]" : "text-slate-500"
              }`}
            >
              Administration, Master Data & Access Control
            </span>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Restaurant & Outlets",
                  category: "Brand & Branches",
                  desc: "Brand identity, logos, theme colors, and multi-branch physical locations, timezones & currencies.",
                  path: "/settings/profile",
                  badge: `${metrics.totalOutlets} ${metrics.totalOutlets === 1 ? "Outlet" : "Outlets"} • Branding`,
                  icon: Store,
                  bgLight: "bg-blue-50 text-blue-600 border-blue-200/80",
                  bgDark: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                },
                {
                  label: "Master Data",
                  category: "Structure",
                  desc: "Departments, designations, job hierarchies, and system taxonomy.",
                  path: "/settings/master-data",
                  badge: "Structure",
                  icon: Database,
                  bgLight: "bg-indigo-50 text-indigo-600 border-indigo-200/80",
                  bgDark: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
                },
                {
                  label: "Employee Directory",
                  category: "Personnel",
                  desc: "Staff profiles, worker types, code sequences, and active roster members.",
                  path: "/workforce/employees",
                  badge: `${metrics.totalEmployees} Active`,
                  icon: UserCheck,
                  bgLight: "bg-sky-50 text-sky-600 border-sky-200/80",
                  bgDark: "bg-sky-500/10 text-sky-400 border-sky-500/20",
                },
                {
                  label: "HR Onboarding",
                  category: "Workflows",
                  desc: "Session approvals, checklist templates, and worker onboarding workflows.",
                  path: "/workforce/onboarding",
                  badge: "Workflows",
                  icon: FileCheck2,
                  bgLight: "bg-amber-50 text-amber-600 border-amber-200/80",
                  bgDark: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                },
                {
                  label: "Users & Staff Logins",
                  category: "Access",
                  desc: "Invite team members, manage passkeys, and manage staff credential provisioning.",
                  path: "/workforce/users",
                  badge: "Access",
                  icon: UserPlus,
                  bgLight: "bg-violet-50 text-violet-600 border-violet-200/80",
                  bgDark: "bg-violet-500/10 text-violet-400 border-violet-500/20",
                },
                {
                  label: "Roles & Permissions",
                  category: "Security",
                  desc: "Custom roles, matrix permission rules, and capability allocations.",
                  path: "/settings/roles-permissions",
                  badge: "Security",
                  icon: Shield,
                  bgLight: "bg-rose-50 text-rose-600 border-rose-200/80",
                  bgDark: "bg-rose-500/10 text-rose-400 border-rose-500/20",
                },
                {
                  label: "Security & 2FA",
                  category: "MFA",
                  desc: "Authenticator app, TOTP verification, and backup recovery codes.",
                  path: "/settings/security",
                  badge: "MFA",
                  icon: KeyRound,
                  bgLight: "bg-purple-50 text-purple-600 border-purple-200/80",
                  bgDark: "bg-purple-500/10 text-purple-400 border-purple-500/20",
                },
                {
                  label: "Access Grants",
                  category: "Enforcement",
                  desc: "Outlet and module scoped entitlements and fine-grained permissions.",
                  path: "/settings/access-grants",
                  badge: "Enforcement",
                  icon: Lock,
                  bgLight: "bg-orange-50 text-orange-600 border-orange-200/80",
                  bgDark: "bg-orange-500/10 text-orange-400 border-orange-500/20",
                },
              ].map((item) => {
                const AdminIcon = item.icon;

                return (
                  <div
                    key={item.path}
                    onClick={() => router.push(p(item.path))}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer group flex items-center justify-between gap-3 ${
                      isDark
                        ? "bg-[#121622]/40 border-white/[0.06] hover:bg-[#121622]/80 hover:border-white/[0.12]"
                        : "bg-white border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 duration-200 ${
                          isDark ? item.bgDark : item.bgLight
                        }`}
                      >
                        <AdminIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4
                            className={`text-xs font-semibold tracking-tight truncate group-hover:text-[#0071E3] dark:group-hover:text-blue-400 transition-colors ${
                              isDark ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {item.label}
                          </h4>
                        </div>
                        <span className={`text-[10px] block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          {item.badge}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Tooltip for description */}
                      <InfoTooltip
                        title={item.label}
                        description={item.desc}
                        category={item.category}
                      />
                      <span className="text-[11px] font-semibold text-[#0071E3] dark:text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
