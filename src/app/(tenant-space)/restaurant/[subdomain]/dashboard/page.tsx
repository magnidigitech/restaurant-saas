"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
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
  Activity,
  Grid,
  ShoppingBag,
  ArrowUpRight,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Percent,
  Check,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Bell,
  Flame,
  Layers,
  LayoutDashboard,
  Utensils,
  Receipt,
  Truck,
  Settings,
  MoreHorizontal,
  FolderOpen,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Plus,
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
    category: "Store Audits",
    featureTag: "SOPs, Temps & Handovers",
    bgLight: "bg-lime-500/10",
    textLight: "text-lime-600",
    borderLight: "border-lime-500/25",
    bgDark: "bg-lime-500/10",
    textDark: "text-lime-400",
    borderDark: "border-lime-500/20",
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

  // Sidebar toggle state on mobile/smaller viewports
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Desktop Hover-to-expand state: collapses to icon-only rail when hover is lost
  const [isHovered, setIsHovered] = useState(false);

  // Single expanded accordion menu state in sidebar (auto-collapses when another expands)
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  // Tab switch: "operations" (Data-First Dashboard - Default) vs "modules" (Original Complete Modules Directory)
  const [activeTab, setActiveTab] = useState<"operations" | "modules">("operations");
  const [salesPeriod, setSalesPeriod] = useState<"today" | "yesterday" | "week">("today");
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(4); // Default to 6 PM peak bar

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

  // Primary brand color dynamically inherited from restaurant profile setup
  // with premium default crimson/ruby red (#C5221F) visually consistent with reference design
  const brandColor = useMemo(() => {
    return branding?.primaryColor && branding.primaryColor.startsWith("#")
      ? branding.primaryColor
      : "#C5221F";
  }, [branding?.primaryColor]);

  // Subtle brand tint for badges, hover states, and active pills
  const brandTint = useMemo(() => {
    return `${brandColor}18`; // ~10% alpha
  }, [brandColor]);

  // Live Operations Business Metrics
  const [liveOps, setLiveOps] = useState({
    todaySales: 84520,
    yesterdaySales: 74930,
    salesGrowth: 12.8,
    totalOrders: 428,
    ordersGrowth: 8.2,
    avgOrderValue: 197,
    aovGrowth: 3.1,
    grossProfit: 28410,
    profitMargin: 33.6,
    profitGrowth: 14.4,
    foodCostPct: 31.4,
    staffOnDuty: { present: 18, total: 21, late: 2, absent: 1 },
    lowStockAlerts: 5,
    pendingActions: 7,
    channelBreakdown: {
      dineIn: { count: 186, percentage: 43.5, amount: 41200 },
      delivery: { count: 148, percentage: 34.5, amount: 28920 },
      takeaway: { count: 94, percentage: 22.0, amount: 14400 },
    },
    fulfillment: {
      completed: 391,
      inProgress: 22,
      cancelled: 15,
    },
  });

  // Hourly sales progression for bar chart
  const hourlyBars = [
    { time: "10 AM", sales: 2400, orders: 14, heightPct: 22 },
    { time: "", sales: 3200, orders: 18, heightPct: 28 },
    { time: "12 PM", sales: 6500, orders: 36, heightPct: 45 },
    { time: "", sales: 7800, orders: 42, heightPct: 52 },
    { time: "2 PM", sales: 9100, orders: 49, heightPct: 62 },
    { time: "", sales: 11200, orders: 58, heightPct: 75 },
    { time: "4 PM", sales: 12800, orders: 67, heightPct: 82 },
    { time: "", sales: 8400, orders: 46, heightPct: 56 },
    { time: "6 PM", sales: 9420, orders: 52, heightPct: 65 }, // Hovered by default
    { time: "", sales: 13900, orders: 74, heightPct: 88 },
    { time: "8 PM", sales: 15800, orders: 85, heightPct: 100 },
    { time: "", sales: 12400, orders: 66, heightPct: 80 },
    { time: "10 PM", sales: 8600, orders: 44, heightPct: 58 },
  ];

  const criticalInventoryList = [
    { name: "Chicken Breast", qty: "1.2 kg left", status: "critical", dotColor: "bg-rose-500" },
    { name: "Basmati Rice", qty: "2.0 L left", status: "low", dotColor: "bg-amber-500" },
    { name: "Olive Oil Extra Virgin", qty: "2.5 L left", status: "low", dotColor: "bg-amber-500" },
    { name: "Fresh Whole Milk", qty: "3.2 L left", status: "low", dotColor: "bg-amber-500" },
    { name: "Tomato Puree", qty: "1.5 kg left", status: "low", dotColor: "bg-amber-500" },
  ];

  const topSellingDishes = [
    { id: 1, name: "Chicken Biryani", qty: 86, revenue: 21500, icon: "🍗" },
    { id: 2, name: "Paneer Tikka", qty: 54, revenue: 12960, icon: "🧀" },
    { id: 3, name: "Veg Fried Rice", qty: 48, revenue: 9600, icon: "🍚" },
    { id: 4, name: "Butter Naan", qty: 46, revenue: 6900, icon: "🫓" },
    { id: 5, name: "Chicken Tikka Masala", qty: 42, revenue: 11760, icon: "🥘" },
  ];

  const recentActivities = [
    {
      time: "10:42 AM",
      title: "Inventory Stock Inward",
      desc: "Chicken Breast received from Metro Foods",
      author: "Ravi K. (Inventory)",
      badge: "+50 KG",
      dot: "bg-rose-500",
    },
    {
      time: "10:31 AM",
      title: "Shift Schedule Published",
      desc: "Dinner rush coverage for Kitchen & Dining",
      author: "Admin Console",
      badge: "Published",
      dot: "bg-amber-500",
    },
    {
      time: "10:12 AM",
      title: "Monthly Payroll Initiated",
      desc: "September payroll cycle started",
      author: "Finance Lead",
      badge: "In Progress",
      dot: "bg-slate-700 dark:bg-slate-300",
    },
    {
      time: "09:54 AM",
      title: "Staff Onboarding Completed",
      desc: "Rahul Sharma (Commis Chef II)",
      author: "HR Desk",
      badge: "Verified",
      dot: "bg-emerald-500",
    },
    {
      time: "09:15 AM",
      title: "Opening HACCP Inspection",
      desc: "Walk-in freezer temp log: 4.2°C",
      author: "Head Chef Anand",
      badge: "Passed",
      dot: "bg-emerald-500",
    },
    {
      time: "08:38 AM",
      title: "POS Till #1 Float Opened",
      desc: "Front counter cash verified at ₹5,000",
      author: "Cashier Priya",
      badge: "Ready",
      dot: "bg-amber-500",
    },
  ];

  const isSubdomain =
    typeof window !== "undefined" &&
    (window.location.host.startsWith(`${subdomain}.`) ||
      (window.location.host.includes(".localhost") && !window.location.host.startsWith("admin.")));

  const p = (path: string) => (isSubdomain ? path : `/restaurant/${subdomain}${path}`);

  const fetchData = async () => {
    try {
      const [
        resBranding,
        resModules,
        resEmployees,
        resOutlets,
        resAlerts,
        resPayroll,
        resPos,
        resAttendance,
        resFinance,
      ] = await Promise.all([
        fetch(`/api/restaurant/${subdomain}/branding`),
        fetch("/api/restaurant/modules"),
        fetch("/api/restaurant/employees"),
        fetch("/api/restaurant/outlets"),
        fetch("/api/restaurant/inventory/alerts").catch(() => null),
        fetch("/api/restaurant/payroll/runs").catch(() => null),
        fetch("/api/restaurant/pos/orders?limit=100").catch(() => null),
        fetch("/api/restaurant/attendance/live-board").catch(() => null),
        fetch("/api/restaurant/finance/pnl").catch(() => null),
      ]);

      const dataBranding = await resBranding.json();
      const dataModules = await resModules.json();
      const dataEmployees = resEmployees.ok ? await resEmployees.json() : null;
      const dataOutlets = resOutlets.ok ? await resOutlets.json() : null;
      const dataAlerts = resAlerts && resAlerts.ok ? await resAlerts.json() : null;
      const dataPayroll = resPayroll && resPayroll.ok ? await resPayroll.json() : null;
      const dataPos = resPos && resPos.ok ? await resPos.json() : null;
      const dataAttendance = resAttendance && resAttendance.ok ? await resAttendance.json() : null;
      const dataFinance = resFinance && resFinance.ok ? await resFinance.json() : null;

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
      const totalEmp = dataEmployees?.employees?.length || 21;
      const lowStockCount = dataAlerts?.alerts?.length ?? 5;

      setMetrics({
        totalEmployees: totalEmp,
        totalOutlets: dataOutlets?.outlets?.length || 2,
        lowStockAlerts: lowStockCount,
        latestPayrollStatus: latestRun?.status || null,
        latestPayrollNet: latestRun ? Number(latestRun.totalNet) : null,
        pendingSwaps: 0,
      });

      // Synchronize live orders data if available
      if (dataPos?.orders && dataPos.orders.length > 0) {
        const ords = dataPos.orders;
        const totalSales = ords.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
        const dineIn = ords.filter((o: any) => o.orderType === "DINE_IN").length;
        const delivery = ords.filter((o: any) => o.orderType === "DELIVERY").length;
        const takeaway = ords.filter((o: any) => o.orderType === "TAKEAWAY").length;
        const completed = ords.filter((o: any) => o.status === "COMPLETED" || o.status === "SETTLED").length;
        const inProg = ords.filter((o: any) => o.status === "PENDING" || o.status === "PREPARING").length;
        const cancelled = ords.filter((o: any) => o.status === "CANCELLED").length;

        setLiveOps((prev) => ({
          ...prev,
          todaySales: totalSales > 0 ? Math.round(totalSales) : prev.todaySales,
          totalOrders: ords.length > 0 ? ords.length : prev.totalOrders,
          avgOrderValue: ords.length > 0 ? Math.round(totalSales / ords.length) : prev.avgOrderValue,
          channelBreakdown: {
            dineIn: { count: dineIn || 186, percentage: ords.length ? Math.round((dineIn / ords.length) * 1000) / 10 : 43.5, amount: Math.round(totalSales * 0.435) },
            delivery: { count: delivery || 148, percentage: ords.length ? Math.round((delivery / ords.length) * 1000) / 10 : 34.5, amount: Math.round(totalSales * 0.345) },
            takeaway: { count: takeaway || 94, percentage: ords.length ? Math.round((takeaway / ords.length) * 1000) / 10 : 22.0, amount: Math.round(totalSales * 0.22) },
          },
          fulfillment: {
            completed: completed || 391,
            inProgress: inProg || 22,
            cancelled: cancelled || 15,
          },
        }));
      }

      if (dataAttendance?.counts) {
        const attCounts = dataAttendance.counts;
        setLiveOps((prev) => ({
          ...prev,
          staffOnDuty: {
            present: attCounts.present ?? 18,
            total: totalEmp || 21,
            late: attCounts.late ?? 2,
            absent: attCounts.absent ?? 1,
          },
        }));
      }

      if (dataFinance?.pnl) {
        const pnl = dataFinance.pnl;
        const rev = Number(pnl.totalRevenue || 84520);
        const gross = Number(pnl.grossProfit || 28410);
        setLiveOps((prev) => ({
          ...prev,
          grossProfit: Math.round(gross),
          profitMargin: rev > 0 ? Math.round((gross / rev) * 1000) / 10 : 33.6,
        }));
      }
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

    const PARENT_MODULE_MAP: Record<string, { topKey: string; name: string; desc: string; path: string }> = {
      inventory: { topKey: "inventory", name: "Inventory & Stock Control", desc: "Item masters, SKU stock ledgers, vendor catalogs, purchase orders & wastage logs.", path: "/inventory" },
      vendor_management: { topKey: "inventory", name: "Inventory & Stock Control", desc: "Item masters, SKU stock ledgers, vendor catalogs, purchase orders & wastage logs.", path: "/inventory" },
      purchase_management: { topKey: "inventory", name: "Inventory & Stock Control", desc: "Item masters, SKU stock ledgers, vendor catalogs, purchase orders & wastage logs.", path: "/inventory" },
      attendance: { topKey: "attendance", name: "Time & Attendance", desc: "Live attendance board, punch clocking kiosk, daily timesheets, and leave approvals.", path: "/attendance" },
      leave_management: { topKey: "attendance", name: "Time & Attendance", desc: "Live attendance board, punch clocking kiosk, daily timesheets, and leave approvals.", path: "/attendance" },
      workforce: { topKey: "workforce", name: "Staff & Workforce", desc: "Employee directory, worker profiles, document checklists & onboarding workflows.", path: "/workforce/employees" },
      hr_onboarding: { topKey: "workforce", name: "Staff & Workforce", desc: "Employee directory, worker profiles, document checklists & onboarding workflows.", path: "/workforce/employees" },
      shifts: { topKey: "shifts", name: "Shift Scheduling & Rosters", desc: "Weekly visual roster planner, timing templates, and shift swap approval center.", path: "/shifts/rosters" },
      shift_management: { topKey: "shifts", name: "Shift Scheduling & Rosters", desc: "Weekly visual roster planner, timing templates, and shift swap approval center.", path: "/shifts/rosters" },
      payroll: { topKey: "payroll", name: "Payroll & Compensation", desc: "Automated wage calculation, shift hour aggregation, salary structures, tip pools, and payslips.", path: "/payroll/runs" },
      pos: { topKey: "pos", name: "Point of Sale (POS)", desc: "Digital table order taking, menu catalog, kitchen ticketing, and bill settlement.", path: "/pos" },
      finance: { topKey: "finance", name: "Finance & P&L Tracker", desc: "Real-time P&L intelligence, automated expense sync from payroll & POs, and upcoming bill reminders.", path: "/finance" },
      analytics: { topKey: "analytics", name: "Analytics & Menu Engineering", desc: "Menu engineering matrix (Stars, Plowhorses, Puzzles, Dogs), food cost variance and profitability reports.", path: "/analytics/menu-engineering" },
      catering: { topKey: "catering", name: "Catering & Banquets", desc: "Event quotation engine, per-pax formula costing, dietary packages, and client banquet proposals.", path: "/catering" },
      vault: { topKey: "vault", name: "Encrypted Secure Vault", desc: "Zero-knowledge AES-256 confidential storage for supplier contracts, food hygiene certificates & tax docs.", path: "/vault" },
      masterdata: { topKey: "masterdata", name: "Master Data Settings", desc: "Multi-outlet profiles, tax rates, operational categories, and organizational taxonomies.", path: "/settings/master-data" },
      operations: { topKey: "operations", name: "Operations & Checklists", desc: "Opening/closing operational checklists, shift handovers, and food safety SOP temperature audits.", path: "/operations" },
      rbac: { topKey: "rbac", name: "Role-Based Access Controls", desc: "Custom role definitions, granular matrix permissions, and staff authorization scoping.", path: "/settings/roles-permissions" },
    };

    const ADMIN_MODULE_KEYS = new Set(["workforce", "hr_onboarding", "masterdata", "rbac"]);

    modules.forEach((m) => {
      const key = m.key.toLowerCase();
      const parent = PARENT_MODULE_MAP[key] || {
        topKey: key,
        name: m.name,
        desc: m.description || "",
        path: `/modules/${m.key}`,
      };

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
      if (k === "pos") set.add("pos");
      if (k === "finance") set.add("finance");
      if (k === "operations") set.add("operations");
      if (k === "catering") set.add("catering");
    });
    return set;
  }, [modules]);

  const hasShiftAccess = allowedKeys.has("shifts") || allowedKeys.has("shift_management");
  const hasPayrollAccess = allowedKeys.has("payroll");
  const hasWorkforceAccess = allowedKeys.has("workforce") || allowedKeys.has("hr_onboarding");
  const hasInventoryAccess = allowedKeys.has("inventory");
  const hasPosAccess = allowedKeys.has("pos");
  const hasFinanceAccess = allowedKeys.has("finance");
  const hasOperationsAccess = allowedKeys.has("operations");

  interface SubNavItem {
    label: string;
    path: string;
    badge?: string;
    quickAction?: boolean;
  }

  interface NavItem {
    id: string;
    label: string;
    path: string;
    icon: React.ElementType;
    active?: boolean;
    subItems?: SubNavItem[];
  }

  // Left Sidebar Nav Items with rich submenus and Zoho Books styled accordion
  const sidebarNavItems: NavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      active: activeTab === "operations",
    },
    {
      id: "pos",
      label: "POS & Orders",
      path: "/pos",
      icon: Store,
      subItems: [
        { label: "POS Terminal", path: "/pos", quickAction: true },
        { label: "Kitchen Orders (KDS)", path: "/pos" },
        { label: "Table Management", path: "/pos" },
        { label: "Order History", path: "/pos" },
      ],
    },
    {
      id: "inventory",
      label: "Inventory",
      path: "/inventory",
      icon: Package,
      subItems: [
        { label: "Items & Catalog", path: "/inventory/items", quickAction: true },
        { label: "Categories", path: "/inventory/categories" },
        { label: "Stock Levels", path: "/inventory/stock" },
        { label: "Purchase Orders", path: "/inventory/purchase-orders" },
        { label: "Vendors Directory", path: "/inventory/vendors" },
        { label: "Recipes & Costing", path: "/inventory/recipes" },
        { label: "Low Stock Alerts", path: "/inventory/alerts", badge: "5" },
      ],
    },
    {
      id: "shifts",
      label: "Shifts & Rosters",
      path: "/shifts/rosters",
      icon: CalendarDays,
      subItems: [
        { label: "Staff Rosters", path: "/shifts/rosters", quickAction: true },
        { label: "Schedule Templates", path: "/shifts/templates" },
        { label: "Shift Swaps", path: "/shifts/swaps" },
      ],
    },
    {
      id: "workforce",
      label: "Workforce & HR",
      path: "/workforce/employees",
      icon: Users,
      subItems: [
        { label: "Employees Directory", path: "/workforce/employees", quickAction: true },
        { label: "Staff Onboarding", path: "/workforce/onboarding" },
        { label: "Roles & Permissions", path: "/workforce/users" },
        { label: "Live Attendance", path: "/attendance" },
        { label: "Leave Requests", path: "/leaves" },
      ],
    },
    {
      id: "finance",
      label: "Finance & Accounts",
      path: "/finance",
      icon: Banknote,
      subItems: [
        { label: "Financial Overview", path: "/finance" },
        { label: "Bill Reminders", path: "/finance/bill-reminders" },
        { label: "Payroll Processing", path: "/payroll/runs", quickAction: true },
      ],
    },
    {
      id: "analytics",
      label: "Analytics & Intelligence",
      path: "/analytics/menu-engineering",
      icon: BarChart3,
      subItems: [
        { label: "Menu Engineering", path: "/analytics/menu-engineering" },
        { label: "Sales & Revenue", path: "/analytics" },
        { label: "Labor & Costs", path: "/analytics" },
      ],
    },
    {
      id: "catering",
      label: "Catering & Banquets",
      path: "/catering",
      icon: UtensilsCrossed,
      subItems: [
        { label: "Event Bookings", path: "/catering", quickAction: true },
        { label: "Catering Portal", path: "/catering/portal" },
      ],
    },
    {
      id: "operations",
      label: "Kitchen Operations",
      path: "/operations",
      icon: ClipboardCheck,
      subItems: [
        { label: "Daily Checklists", path: "/operations" },
        { label: "Kitchen SOPs & Tasks", path: "/operations" },
      ],
    },
    {
      id: "settings",
      label: "Administration",
      path: "/settings/profile",
      icon: Sliders,
      subItems: [
        { label: "Restaurant Profile", path: "/settings/profile" },
        { label: "Branch Outlets", path: "/settings/branches" },
        { label: "Master Data & Taxes", path: "/settings/master-data" },
      ],
    },
  ];

  if (loading) {
    return (
      <main
        className={`flex min-h-screen items-center justify-center font-sans ${
          isDark ? "bg-[#090B10] text-[#8F95A3]" : "bg-[#F5F5F7] text-slate-500"
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: brandColor }} />
          <span>Loading restaurant intelligence...</span>
        </div>
      </main>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased flex ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F8F9FA] text-[#1D1D1F]"
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR (COLLAPSIBLE / ICON-RAIL WHEN HOVER LOST)                 */}
      {/* ========================================================================= */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between border-r transition-all duration-300 ease-in-out ${
          mobileSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
        } ${
          isHovered ? "lg:w-64 shadow-2xl" : "lg:w-[68px]"
        } ${
          isDark
            ? "bg-[#0E121D] border-white/[0.08]"
            : "bg-white border-slate-200/80 shadow-[1px_0_4px_rgba(0,0,0,0.02)]"
        }`}
      >
        {/* Top: Brand Logo + Identity */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="h-16 flex items-center justify-between px-3.5 border-b border-black/[0.05] dark:border-white/[0.06] shrink-0">
            <div
              onClick={() => {
                setActiveTab("operations");
              }}
              className={`flex items-center gap-2.5 min-w-0 cursor-pointer group ${
                !isHovered && !mobileSidebarOpen ? "mx-auto justify-center" : ""
              }`}
            >
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.name || "Brand Logo"}
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

              {(isHovered || mobileSidebarOpen) && (
                <div className="min-w-0 animate-in fade-in duration-200">
                  <span className="font-bold text-sm tracking-tight truncate block text-slate-900 dark:text-white">
                    {branding?.name || "Magni Digitech"}
                  </span>
                  <span className="text-[10px] opacity-60 truncate block">Operations Suite</span>
                </div>
              )}
            </div>

            {/* Mobile close button */}
            {mobileSidebarOpen && (
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile Context Strip (Shown only when expanded) */}
          {(isHovered || mobileSidebarOpen) && (
            <div className="px-5 py-2 bg-slate-50 dark:bg-white/[0.02] border-b border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-xs text-slate-500 shrink-0 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                <Store className="w-3.5 h-3.5 opacity-70" />
                <span>All Branches ({metrics.totalOutlets})</span>
              </div>
              <span className="text-[10px] opacity-70">Today, 11 Sep</span>
            </div>
          )}

          {/* Scrollable Navigation List: Clean Icon Rail when collapsed, Full Accordion when hovered */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            {sidebarNavItems.map((item) => {
              const IconComp = item.icon;
              const hasSubs = item.subItems && item.subItems.length > 0;
              const isExpanded = expandedMenu === item.id;
              const isParentActive = item.active && activeTab === "operations";

              // 1. COLLAPSED VIEW (ICON-ONLY RAIL)
              if (!isHovered && !mobileSidebarOpen) {
                return (
                  <div key={item.id} className="flex justify-center">
                    <button
                      type="button"
                      title={item.label}
                      onClick={() => {
                        if (item.id === "dashboard") {
                          setActiveTab("operations");
                        } else {
                          router.push(p(item.path));
                        }
                      }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        isParentActive
                          ? "font-bold text-white shadow-sm"
                          : "text-slate-600 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.06]"
                      }`}
                      style={
                        isParentActive
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
                  {/* Parent Nav Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (hasSubs) {
                        setExpandedMenu((prev) => (prev === item.id ? null : item.id));
                      } else {
                        if (item.id === "dashboard") {
                          setActiveTab("operations");
                        } else {
                          router.push(p(item.path));
                        }
                        setMobileSidebarOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isParentActive
                        ? "text-slate-900 dark:text-white font-bold"
                        : isExpanded
                        ? "text-slate-900 dark:text-white font-bold bg-slate-100/70 dark:bg-white/[0.06]"
                        : "text-slate-600 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                    }`}
                    style={
                      isParentActive
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
                        style={{ color: isParentActive ? brandColor : undefined }}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {/* Right Caret Indicator for expandable items */}
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
                      {item.subItems!.map((sub) => (
                        <button
                          key={sub.label}
                          type="button"
                          onClick={() => {
                            router.push(p(sub.path));
                            setMobileSidebarOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05] group"
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
                                title={`Quick action`}
                              >
                                <Plus className="w-3 h-3 text-slate-400 dark:text-slate-300" />
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Controls: Settings & Tenant Profile Badge */}
        <div className="p-2.5 border-t border-black/[0.05] dark:border-white/[0.06] space-y-2 shrink-0">
          {!isHovered && !mobileSidebarOpen ? (
            <div className="space-y-1.5 flex flex-col items-center">
              <button
                type="button"
                onClick={() => router.push(p("/settings/profile"))}
                title="Settings"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>

              <div
                onClick={() => router.push(p("/settings/profile"))}
                title={branding?.name || "Magni Digitech"}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs cursor-pointer shadow-sm hover:brightness-110 transition"
                style={{ backgroundColor: brandColor }}
              >
                MD
              </div>
            </div>
          ) : (
            <div className="space-y-2 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => {
                  router.push(p("/settings/profile"));
                  setMobileSidebarOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>

              <div
                onClick={() => {
                  router.push(p("/settings/profile"));
                  setMobileSidebarOpen(false);
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
                    MD
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate text-slate-900 dark:text-white leading-tight">
                      {branding?.name || "Magni Digitech"}
                    </div>
                    <div className="text-[10px] opacity-60 truncate">2 Branches</div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA (OFFSET BY 68PX / ICON RAIL ON LG SCREENS)           */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[68px]">
        {/* Top Horizontal Bar (Global Controls & Action Row - No horizontal scroll on mobile!) */}
        <header
          className={`h-16 px-3 sm:px-6 lg:px-8 border-b flex items-center justify-between gap-2 sm:gap-3 sticky top-0 z-30 overflow-hidden ${
            isDark
              ? "bg-[#090B10]/95 border-white/[0.08] backdrop-blur-xl"
              : "bg-white/95 border-slate-200/80 backdrop-blur-xl"
          }`}
        >
          {/* Left Context: Hamburger + Brand Name on mobile / Operations Live on desktop */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Tenant Name Header */}
            <div className="flex sm:hidden items-center gap-1.5 min-w-0">
              <span className="font-bold text-xs truncate text-slate-900 dark:text-white">
                {branding?.name || "Magni Digitech"}
              </span>
            </div>

            {/* Desktop / Tablet Live Pulse Indicator */}
            <div className="hidden sm:flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Operations Live
              </span>
            </div>
          </div>

          {/* Right Global Selectors & Action Buttons (Clean flex, zero overflow scroll!) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Branch Selector: Visible on sm+ */}
            <div
              className={`hidden sm:flex px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.08] text-slate-200"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <Store className="w-3.5 h-3.5 opacity-60" />
              <span>All Branches ({metrics.totalOutlets})</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </div>

            {/* Date Selector: Visible on md+ */}
            <div
              className={`hidden md:flex px-3 py-1.5 rounded-xl border text-xs font-semibold items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.08] text-slate-200"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 opacity-60" />
              <span>Today, 11 Sep</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </div>

            {/* Notifications Bell */}
            <div
              className={`w-8 h-8 rounded-xl border flex items-center justify-center relative cursor-pointer ${
                isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-slate-50 border-slate-200"
              }`}
            >
              <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: brandColor }}
              >
                1
              </span>
            </div>

            {/* User Profile Avatar */}
            <div
              onClick={() => router.push(p("/settings/profile"))}
              className={`px-2 sm:px-2.5 py-1 rounded-xl border flex items-center gap-1.5 cursor-pointer ${
                isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-slate-50 border-slate-200"
              }`}
            >
              <div
                className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                style={{ backgroundColor: brandColor }}
              >
                MD
              </div>
              <ChevronDown className="hidden sm:inline w-3 h-3 opacity-60" />
            </div>

            {/* Primary Action Button: + New Order on desktop, + Order on mobile */}
            {hasPosAccess && (
              <button
                type="button"
                onClick={() => router.push(p("/pos"))}
                className="px-2.5 sm:px-3.5 py-1.5 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm shrink-0 hover:brightness-110 active:scale-[0.98]"
                style={{ backgroundColor: brandColor }}
              >
                <span className="hidden sm:inline">+ New Order</span>
                <span className="sm:hidden">+ Order</span>
              </button>
            )}

            {/* Schedule Shift Button (Desktop lg+) */}
            {hasShiftAccess && (
              <button
                type="button"
                onClick={() => router.push(p("/shifts/rosters"))}
                className={`hidden lg:flex px-3 py-1.5 rounded-xl text-xs font-semibold border transition items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  isDark
                    ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-200"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 opacity-60" />
                <span>Schedule Shift</span>
              </button>
            )}

            {/* Run Payroll Button (Desktop xl+) */}
            {hasPayrollAccess && (
              <button
                type="button"
                onClick={() => router.push(p("/payroll/runs"))}
                className={`hidden xl:flex px-3 py-1.5 rounded-xl text-xs font-semibold border transition items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  isDark
                    ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-200"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <Banknote className="w-3.5 h-3.5 opacity-60" />
                <span>Run Payroll</span>
              </button>
            )}

            {/* Modules Hub Switcher / Mode Switcher */}
            <button
              type="button"
              onClick={() => setActiveTab((prev) => (prev === "operations" ? "modules" : "operations"))}
              className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "modules"
                  ? "text-white"
                  : isDark
                  ? "bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              }`}
              style={activeTab === "modules" ? { backgroundColor: brandColor } : {}}
              title={activeTab === "operations" ? "Switch to Modules Hub" : "Back to Live Ops"}
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {activeTab === "operations" ? "Modules Hub" : "Back to Live Ops"}
              </span>
            </button>
          </div>
        </header>

        {/* ===================================================================== */}
        {/* MAIN BODY CANVAS                                                      */}
        {/* ===================================================================== */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Greeting & Header Banner */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-[#8F95A3]">
              Good Evening,
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {branding?.name || "Magni Digitech"}
            </h1>
            <p className={`text-xs sm:text-sm ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Your restaurant at a glance — live sales, operations, workforce and supply chain.
            </p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs px-4 py-3 rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 1: DATA-FIRST DASHBOARD (DEFAULT)                              */}
          {/* =================================================================== */}
          {activeTab === "operations" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* 1. TOP ROW: 6 KPI CARDS WITH SMOOTH MINI SPARKLINE SVGS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
                {/* 1. Today's Sales */}
                <div
                  onClick={() => hasFinanceAccess && router.push(p("/finance"))}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8F95A3] block">
                      Today&apos;s Sales
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                      ₹{liveOps.todaySales.toLocaleString()}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-500 flex items-center gap-0.5 mt-1">
                      <span>↑ +12.8%</span>
                    </div>
                  </div>
                  {/* Mini Red Sparkline SVG */}
                  <svg viewBox="0 0 100 24" className="w-full h-6 mt-2 overflow-visible">
                    <path
                      d="M 0,18 C 20,18 30,12 45,14 C 60,16 75,4 100,2"
                      fill="none"
                      stroke="#E11D48"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* 2. Total Orders */}
                <div
                  onClick={() => hasPosAccess && router.push(p("/pos"))}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8F95A3] block">
                      Total Orders
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                      {liveOps.totalOrders}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-500 flex items-center gap-0.5 mt-1">
                      <span>↑ +8.2%</span>
                    </div>
                  </div>
                  {/* Mini Orange Sparkline SVG */}
                  <svg viewBox="0 0 100 24" className="w-full h-6 mt-2 overflow-visible">
                    <path
                      d="M 0,20 C 25,20 35,16 55,10 C 75,4 85,8 100,2"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* 3. Avg. Order Value */}
                <div
                  onClick={() => hasFinanceAccess && router.push(p("/finance"))}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-600 flex items-center justify-center">
                    <Receipt className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8F95A3] block">
                      Avg. Order Value
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                      ₹{liveOps.avgOrderValue}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-500 flex items-center gap-0.5 mt-1">
                      <span>↑ +3.1%</span>
                    </div>
                  </div>
                  {/* Mini Red Sparkline SVG */}
                  <svg viewBox="0 0 100 24" className="w-full h-6 mt-2 overflow-visible">
                    <path
                      d="M 0,22 C 30,22 40,16 65,12 C 85,8 90,4 100,2"
                      fill="none"
                      stroke="#E11D48"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* 4. Gross Profit */}
                <div
                  onClick={() => hasFinanceAccess && router.push(p("/finance"))}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8F95A3] block">
                      Gross Profit
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                      ₹{liveOps.grossProfit.toLocaleString()}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-500 flex items-center gap-0.5 mt-1">
                      <span>↑ +14.4%</span>
                    </div>
                  </div>
                  {/* Mini Amber Sparkline SVG */}
                  <svg viewBox="0 0 100 24" className="w-full h-6 mt-2 overflow-visible">
                    <path
                      d="M 0,20 C 35,20 45,14 70,10 C 85,6 95,2 100,2"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* 5. Food Cost % */}
                <div
                  onClick={() => router.push(p("/analytics/food-cost-variance"))}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-600 flex items-center justify-center">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8F95A3] block">
                      Food Cost %
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {liveOps.foodCostPct}%
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        Optimal
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Target &lt; 33%
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "70%" }} />
                  </div>
                </div>

                {/* 6. Staff On Duty */}
                <div
                  onClick={() => router.push(p("/attendance"))}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8F95A3] block">
                      Staff On Duty
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                      {liveOps.staffOnDuty.present} / {liveOps.staffOnDuty.total}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      85.7%
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "85.7%" }} />
                  </div>
                </div>
              </div>

              {/* 2. ROW 2: SALES PERFORMANCE (BAR CHART) & ORDERS BY CHANNEL (DONUT) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Card: Sales Performance (8 Cols) - Cleaned of duplicate stats footer */}
                <div
                  className={`lg:col-span-8 p-5 sm:p-6 rounded-3xl border transition flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div>
                    {/* Header with period toggle & filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                        Sales Performance
                      </h3>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-xs font-semibold">
                          {(["today", "yesterday", "week"] as const).map((period) => (
                            <button
                              key={period}
                              type="button"
                              onClick={() => setSalesPeriod(period)}
                              className={`px-3 py-1 rounded-lg capitalize transition cursor-pointer text-xs ${
                                salesPeriod === period
                                  ? "text-white shadow-xs font-bold"
                                  : "text-slate-600 dark:text-[#8F95A3] hover:text-slate-900 dark:hover:text-white"
                              }`}
                              style={salesPeriod === period ? { backgroundColor: brandColor } : {}}
                            >
                              {period === "week" ? "This Week" : period}
                            </button>
                          ))}
                        </div>

                        <div className="px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300">
                          <span>Sales</span>
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </div>
                      </div>
                    </div>

                    {/* Bar Chart with Y-axis markers and interactive bars */}
                    <div className="relative pt-6 pb-2">
                      {/* Interactive Tooltip Card for 6 PM Peak (or Hovered Bar) */}
                      {hoveredBarIdx !== null && (
                        <div
                          className="absolute -top-1 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] text-center shadow-lg pointer-events-none transform -translate-x-1/2 z-20"
                          style={{
                            left: `${((hoveredBarIdx + 0.5) / hourlyBars.length) * 90 + 5}%`,
                          }}
                        >
                          <div className="font-semibold opacity-75">
                            {hourlyBars[hoveredBarIdx].time || "Peak"}
                          </div>
                          <div className="font-extrabold text-xs">
                            ₹{hourlyBars[hoveredBarIdx].sales.toLocaleString()}
                          </div>
                          <div className="opacity-70 text-[9px]">
                            {hourlyBars[hoveredBarIdx].orders} orders
                          </div>
                        </div>
                      )}

                      {/* Chart Area with Gridlines */}
                      <div className="flex items-end justify-between h-44 sm:h-48 border-b border-slate-100 dark:border-white/[0.06] px-2 gap-2">
                        {hourlyBars.map((bar, idx) => {
                          const isHovered = hoveredBarIdx === idx;

                          return (
                            <div
                              key={idx}
                              className="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group"
                              onMouseEnter={() => setHoveredBarIdx(idx)}
                            >
                              <div
                                className="w-full max-w-[18px] rounded-t-md transition-all duration-200"
                                style={{
                                  height: `${bar.heightPct}%`,
                                  backgroundColor: isHovered ? brandColor : `${brandColor}CC`,
                                  transform: isHovered ? "scaleY(1.05)" : undefined,
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* X-axis Time Labels */}
                      <div className="flex justify-between px-2 pt-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                        <span>10 AM</span>
                        <span>12 PM</span>
                        <span>2 PM</span>
                        <span>4 PM</span>
                        <span>6 PM</span>
                        <span>8 PM</span>
                        <span>10 PM</span>
                      </div>
                    </div>
                  </div>
                  {/* Cleaned: Redundant metrics strip beneath chart removed per user request */}
                </div>

                {/* Right Card: Orders by Channel (Donut Chart) (4 Cols) */}
                <div
                  className={`lg:col-span-4 p-5 sm:p-6 rounded-3xl border transition flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                        Orders by Channel
                      </h3>
                      <button
                        type="button"
                        onClick={() => router.push(p("/pos"))}
                        className="text-xs font-semibold text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                        style={{ color: brandColor }}
                      >
                        <span>View Orders</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Donut Chart & Legend */}
                    <div className="flex items-center justify-center gap-6 py-2">
                      {/* SVG Donut */}
                      <div className="relative w-36 h-36 shrink-0">
                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                          {/* Slices: Dine-in 43.5%, Delivery 34.5%, Takeaway 22% */}
                          <circle
                            cx="50"
                            cy="50"
                            r="36"
                            fill="none"
                            stroke="#1E293B"
                            strokeWidth="14"
                            strokeDasharray="226"
                            strokeDashoffset="0"
                            className="dark:stroke-white/10"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="36"
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="14"
                            strokeDasharray="226"
                            strokeDashoffset="50"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="36"
                            fill="none"
                            stroke={brandColor}
                            strokeWidth="14"
                            strokeDasharray="226"
                            strokeDashoffset="128"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-xl font-black text-slate-900 dark:text-white">428</span>
                          <span className="text-[10px] font-semibold text-slate-400">Orders</span>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-4 font-semibold">
                          <span className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: brandColor }} />
                            Dine-in
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">186 <span className="text-[10px] opacity-60">43.5%</span></span>
                        </div>
                        <div className="flex items-center justify-between gap-4 font-semibold">
                          <span className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                            Delivery
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">148 <span className="text-[10px] opacity-60">34.5%</span></span>
                        </div>
                        <div className="flex items-center justify-between gap-4 font-semibold">
                          <span className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 dark:bg-white/40 shrink-0" />
                            Takeaway
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">94 <span className="text-[10px] opacity-60">22.0%</span></span>
                        </div>
                      </div>
                    </div>

                    {/* 3 Status summary cards */}
                    <div className="grid grid-cols-3 gap-2 mt-5 text-center">
                      <div className={`p-2.5 rounded-2xl border ${isDark ? "bg-[#151A28] border-white/[0.06]" : "bg-slate-50 border-slate-200/80"}`}>
                        <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold mx-auto flex items-center justify-center">
                          ✓
                        </div>
                        <div className="text-sm font-black mt-1 text-slate-900 dark:text-white">391</div>
                        <div className="text-[10px] opacity-60">Completed 91.4%</div>
                      </div>
                      <div className={`p-2.5 rounded-2xl border ${isDark ? "bg-[#151A28] border-white/[0.06]" : "bg-slate-50 border-slate-200/80"}`}>
                        <div className="w-4 h-4 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold mx-auto flex items-center justify-center">
                          ⧗
                        </div>
                        <div className="text-sm font-black mt-1 text-slate-900 dark:text-white">22</div>
                        <div className="text-[10px] opacity-60">In Progress 5.1%</div>
                      </div>
                      <div className={`p-2.5 rounded-2xl border ${isDark ? "bg-[#151A28] border-white/[0.06]" : "bg-slate-50 border-slate-200/80"}`}>
                        <div className="w-4 h-4 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold mx-auto flex items-center justify-center">
                          ✕
                        </div>
                        <div className="text-sm font-black mt-1 text-slate-900 dark:text-white">15</div>
                        <div className="text-[10px] opacity-60">Cancelled 3.5%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. ROW 3: 4 OPERATIONAL SNAPSHOT CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Inventory Alerts */}
                <div
                  className={`p-4 sm:p-5 rounded-3xl border transition flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Inventory Alerts</h4>
                      <button
                        type="button"
                        onClick={() => router.push(p("/inventory/alerts"))}
                        className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                        style={{ color: brandColor }}
                      >
                        <span>View All</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-base font-black text-slate-900 dark:text-white">5</div>
                        <div className="text-[10px] text-slate-400">Low Stock Items</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {criticalInventoryList.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-800 dark:text-slate-200 py-0.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${item.dotColor}`} />
                          <span className="truncate">{item.name} ({item.qty})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Today's Shifts */}
                <div
                  className={`p-4 sm:p-5 rounded-3xl border transition flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Today&apos;s Shifts</h4>
                      <button
                        type="button"
                        onClick={() => router.push(p("/shifts/rosters"))}
                        className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                        style={{ color: brandColor }}
                      >
                        <span>View Roster</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-base font-black text-slate-900 dark:text-white">3</div>
                        <div className="text-[10px] text-slate-400">Open Positions</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-600 dark:text-slate-400">Morning (08:00 - 16:00)</span>
                        <span className="font-bold text-emerald-500">8 / 8</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-600 dark:text-slate-400">Afternoon (12:00 - 20:00)</span>
                        <span className="font-bold text-amber-500">7 / 8</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-600 dark:text-slate-400">Evening (16:00 - 00:00)</span>
                        <span className="font-bold text-amber-500">6 / 7</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Workforce Today */}
                <div
                  className={`p-4 sm:p-5 rounded-3xl border transition flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Workforce Today</h4>
                      <button
                        type="button"
                        onClick={() => router.push(p("/attendance"))}
                        className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                        style={{ color: brandColor }}
                      >
                        <span>View All</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-base font-black text-slate-900 dark:text-white">18 / 21</div>
                          <div className="text-[10px] text-slate-400">Present</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        85.7%
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between py-0.5">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          Present
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">18</span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          Late
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">2</span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          Absent
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">1</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Financial Snapshot */}
                <div
                  className={`p-4 sm:p-5 rounded-3xl border transition flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Financial Snapshot</h4>
                      <button
                        type="button"
                        onClick={() => router.push(p("/finance"))}
                        className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                        style={{ color: brandColor }}
                      >
                        <span>View Report</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500 dark:text-[#8F95A3]">Revenue</span>
                        <span className="font-bold text-slate-900 dark:text-white">₹84,520</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500 dark:text-[#8F95A3]">Operating Expenses</span>
                        <span className="font-bold text-slate-900 dark:text-white">₹56,110</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500 dark:text-[#8F95A3]">Gross Profit</span>
                        <span className="font-bold text-emerald-500">₹28,410</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500 dark:text-[#8F95A3]">Food Cost %</span>
                        <span className="font-bold text-slate-900 dark:text-white">31.4%</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500 dark:text-[#8F95A3]">Other Expenses %</span>
                        <span className="font-bold text-slate-900 dark:text-white">12.2%</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-100 dark:border-white/[0.06]">
                        <span className="text-slate-500 dark:text-[#8F95A3] font-semibold">Net Margin</span>
                        <span className="font-bold text-emerald-500">33.6%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. ROW 4: "NEEDS ATTENTION" (ACTION BUTTONS UNIFIED WITH PRIMARY BRAND COLOR) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-black"
                      style={{ backgroundColor: brandColor }}
                    >
                      !
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Needs Attention</h3>
                      <p className="text-[11px] text-slate-400">7 action items requiring manager attention</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                    style={{ color: brandColor }}
                  >
                    <span>View All</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {/* Alert 1: Low Stock */}
                  <div
                    className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          5 inventory items are below minimum reorder point
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Chicken Breast (1.2 kg left), Extra Virgin Olive Oil (2.0 L left), and 3 more items.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      <span className="text-[11px] text-slate-400">Today, 10:42 AM</span>
                      {/* Unified button styling matching primary brand color */}
                      <button
                        type="button"
                        onClick={() => router.push(p("/inventory/alerts"))}
                        className="px-3.5 py-1.5 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs hover:brightness-110 active:scale-[0.98]"
                        style={{ backgroundColor: brandColor }}
                      >
                        <span>Review Stock</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Alert 2: Unassigned Shifts */}
                  <div
                    className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          3 shifts are still unassigned for tonight&apos;s dinner rush
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Line Cook (Station 2) and 2 Floor Stewards need assignment.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      <span className="text-[11px] text-slate-400">Today, 10:31 AM</span>
                      {/* Unified button styling matching primary brand color */}
                      <button
                        type="button"
                        onClick={() => router.push(p("/shifts/rosters"))}
                        className="px-3.5 py-1.5 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs hover:brightness-110 active:scale-[0.98]"
                        style={{ backgroundColor: brandColor }}
                      >
                        <span>Assign Staff</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Alert 3: Payroll Cycle */}
                  <div
                    className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          Monthly payroll cycle has not been initiated
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          September payroll is due in 5 days.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      <span className="text-[11px] text-slate-400">Today, 09:54 AM</span>
                      {/* Unified button styling matching primary brand color */}
                      <button
                        type="button"
                        onClick={() => router.push(p("/payroll/runs"))}
                        className="px-3.5 py-1.5 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs hover:brightness-110 active:scale-[0.98]"
                        style={{ backgroundColor: brandColor }}
                      >
                        <span>Run Payroll</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Alert 4: HR Onboarding */}
                  <div
                    className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          2 employees have incomplete onboarding verification
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Government ID and food safety documentation pending.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      <span className="text-[11px] text-slate-400">Today, 09:12 AM</span>
                      {/* Unified button styling matching primary brand color */}
                      <button
                        type="button"
                        onClick={() => router.push(p("/workforce/employees"))}
                        className="px-3.5 py-1.5 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs hover:brightness-110 active:scale-[0.98]"
                        style={{ backgroundColor: brandColor }}
                      >
                        <span>Review HR</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. ROW 5: TOP SELLING ITEMS & LIVE ACTIVITY */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Card: Top Selling Items (6 Cols) */}
                <div
                  className={`lg:col-span-6 p-5 sm:p-6 rounded-3xl border transition flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                        Top Selling Items
                      </h3>

                      <div className="flex items-center gap-2">
                        <div className="px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300">
                          <span>By Quantity</span>
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </div>
                        <button
                          type="button"
                          onClick={() => router.push(p("/pos"))}
                          className="text-xs font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                          style={{ color: brandColor }}
                        >
                          <span>View Menu</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
                      {topSellingDishes.map((dish) => (
                        <div key={dish.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-slate-400 font-bold text-xs w-4">{dish.id}</span>
                            <span className="text-xl shrink-0">{dish.icon}</span>
                            <span className="font-bold text-slate-900 dark:text-white truncate">
                              {dish.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 font-mono">
                            <span className="text-slate-500 dark:text-[#8F95A3]">{dish.qty}</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              ₹{dish.revenue.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Card: Live Activity (6 Cols) */}
                <div
                  className={`lg:col-span-6 p-5 sm:p-6 rounded-3xl border transition flex flex-col justify-between ${
                    isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                        Live Activity
                      </h3>
                      <button
                        type="button"
                        className="text-xs font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                        style={{ color: brandColor }}
                      >
                        <span>All Activity</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
                      {recentActivities.map((act, idx) => (
                        <div key={idx} className="py-2.5 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${act.dot}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {act.title}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
                                  {act.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {act.desc}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] opacity-60 font-mono">{act.time}</div>
                            <div className="text-[10px] opacity-60">{act.author}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 2: COMPLETE MODULES DIRECTORY & MASTER DATA (PRESERVED VIEW)   */}
          {/* =================================================================== */}
          {activeTab === "modules" && (
            <div className="space-y-8 animate-in fade-in duration-150">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Operational Business Modules
                </h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
                  {uniqueModules.length} Active Modules
                </span>
              </div>

              {/* Operational Business Modules Grid */}
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
                          ? "bg-[#0E121D] border-white/[0.08] hover:bg-white/[0.04]"
                          : "bg-white border-slate-200/90 shadow-2xs hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                              isDark
                                ? `${conf.bgDark} ${conf.textDark} ${conf.borderDark}`
                                : `${conf.bgLight} ${conf.textLight} ${conf.borderLight}`
                            }`}
                          >
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                              {conf.category}
                            </span>
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {mod.name}
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {mod.badge && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                              {mod.badge}
                            </span>
                          )}
                          <InfoTooltip
                            title={mod.name}
                            description={mod.description}
                            category={conf.category}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.04] text-xs">
                        <span className="text-[11px] font-medium text-slate-400">
                          {conf.featureTag}
                        </span>
                        <span
                          className="font-semibold text-xs flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                          style={{ color: brandColor }}
                        >
                          Launch <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Administration & Master Data Grid */}
              {isAdmin && (
                <div className="space-y-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Administration, Master Data &amp; Access Control
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      {
                        label: "Restaurant & Outlets",
                        category: "Brand & Branches",
                        desc: "Brand identity, logos, theme colors, and multi-branch locations.",
                        path: "/settings/profile",
                        badge: `${metrics.totalOutlets} Outlets`,
                        icon: Store,
                      },
                      {
                        label: "Master Data & Roles",
                        category: "Access & Structure",
                        desc: "Team credentials, customized authorization roles, and master structure.",
                        path: "/settings/master-data",
                        badge: "Roles & Users",
                        icon: Users,
                      },
                      {
                        label: "Employee Onboarding",
                        category: "Personnel & HR",
                        desc: "Staff profiles, document verification checklists, and intake workflows.",
                        path: "/workforce/employees",
                        badge: `${metrics.totalEmployees} Active`,
                        icon: UserCheck,
                      },
                      {
                        label: "Security & 2FA",
                        category: "MFA",
                        desc: "Authenticator app, TOTP verification, and recovery codes.",
                        path: "/settings/security",
                        badge: "MFA Active",
                        icon: KeyRound,
                      },
                    ].map((item) => {
                      const AdminIcon = item.icon;

                      return (
                        <div
                          key={item.path}
                          onClick={() => router.push(p(item.path))}
                          className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                            isDark
                              ? "bg-[#0E121D] border-white/[0.08] hover:bg-white/[0.04]"
                              : "bg-white border-slate-200/90 shadow-2xs hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                              <AdminIcon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {item.label}
                              </h4>
                              <span className="text-[10px] text-slate-400 block">{item.badge}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
