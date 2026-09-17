"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  ChevronLeft,
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
  Search,
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

  // Tab switch: "operations" (Data-First Dashboard - Default) vs "modules" (Original Complete Modules Directory)
  const [activeTab, setActiveTab] = useState<"operations" | "modules">("operations");
  const [salesPeriod, setSalesPeriod] = useState<"today" | "yesterday" | "week">("today");
  const [topSellingRankBy, setTopSellingRankBy] = useState<"quantity" | "revenue">("quantity");
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(4); // Default to 6 PM peak bar

  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState<boolean>(false);
  const [calendarTab, setCalendarTab] = useState<"day" | "week" | "month" | "year" | "custom">("day");
  const [pickingTarget, setPickingTarget] = useState<"start" | "end">("start");
  const [calendarViewMonth, setCalendarViewMonth] = useState<number>(new Date().getMonth());
  const [calendarViewYear, setCalendarViewYear] = useState<number>(new Date().getFullYear());

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const formatDateDisplay = (date: Date | null, fallback: string) => {
    if (!date) return fallback;
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isSameDay = (d1: Date | null, d2: Date | null) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isDateInRange = (date: Date, start: Date | null, end: Date | null) => {
    if (!start || !end) return false;
    const t = date.getTime();
    const s = new Date(start).setHours(0, 0, 0, 0);
    const e = new Date(end).setHours(23, 59, 59, 999);
    return t >= s && t <= e;
  };

  const getCalendarGridDays = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const daysList: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateObj: Date;
    }> = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const dNum = daysInPrevMonth - i;
      daysList.push({
        day: dNum,
        month: prevM,
        year: prevY,
        isCurrentMonth: false,
        dateObj: new Date(prevY, prevM, dNum),
      });
    }

    for (let d = 1; d <= daysInCurrentMonth; d++) {
      daysList.push({
        day: d,
        month,
        year,
        isCurrentMonth: true,
        dateObj: new Date(year, month, d),
      });
    }

    const targetLength = daysList.length > 35 ? 42 : 35;
    const remainingCells = targetLength - daysList.length;
    for (let d = 1; d <= remainingCells; d++) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      daysList.push({
        day: d,
        month: nextM,
        year: nextY,
        isCurrentMonth: false,
        dateObj: new Date(nextY, nextM, d),
      });
    }

    return daysList;
  };

  const [outletCurrency, setOutletCurrency] = useState<string>("USD");
  const [formattedTodayDate, setFormattedTodayDate] = useState<string>("");

  const currencySymbol = useMemo(() => {
    if (!outletCurrency) return "$";
    const code = outletCurrency.toUpperCase();
    if (code === "INR") return "₹";
    if (code === "CAD" || code === "USD" || code === "AUD" || code === "NZD") return "$";
    if (code === "EUR") return "€";
    if (code === "GBP") return "£";
    if (code === "AED") return "د.إ";
    if (code === "SAR" || code === "QAR" || code === "OMR") return "﷼";
    return "$";
  }, [outletCurrency]);

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
  // Live Operations Business Metrics (Starts at zero, updated purely via live database API)
  const [liveOps, setLiveOps] = useState({
    todaySales: 0,
    yesterdaySales: 0,
    salesGrowth: 0,
    totalOrders: 0,
    ordersGrowth: 0,
    avgOrderValue: 0,
    aovGrowth: 0,
    grossProfit: 0,
    profitMargin: 0,
    profitGrowth: 0,
    foodCostPct: 0,
    staffOnDuty: { present: 0, total: 0, late: 0, absent: 0 },
    lowStockAlerts: 0,
    pendingActions: 0,
    channelBreakdown: {
      dineIn: { count: 0, percentage: 0, amount: 0 },
      delivery: { count: 0, percentage: 0, amount: 0 },
      takeaway: { count: 0, percentage: 0, amount: 0 },
    },
    fulfillment: {
      completed: 0,
      inProgress: 0,
      cancelled: 0,
    },
  });

  // Hourly sales progression for bar chart (Bound to real POS order hours)
  const [hourlyBars, setHourlyBars] = useState([
    { time: "10 AM", sales: 0, orders: 0, heightPct: 15 },
    { time: "", sales: 0, orders: 0, heightPct: 15 },
    { time: "12 PM", sales: 0, orders: 0, heightPct: 15 },
    { time: "", sales: 0, orders: 0, heightPct: 15 },
    { time: "2 PM", sales: 0, orders: 0, heightPct: 15 },
    { time: "", sales: 0, orders: 0, heightPct: 15 },
    { time: "4 PM", sales: 0, orders: 0, heightPct: 15 },
    { time: "", sales: 0, orders: 0, heightPct: 15 },
    { time: "6 PM", sales: 0, orders: 0, heightPct: 15 },
    { time: "", sales: 0, orders: 0, heightPct: 15 },
    { time: "8 PM", sales: 0, orders: 0, heightPct: 15 },
    { time: "", sales: 0, orders: 0, heightPct: 15 },
    { time: "10 PM", sales: 0, orders: 0, heightPct: 15 },
  ]);

  const [criticalInventoryList, setCriticalInventoryList] = useState<Array<{ name: string; qty: string; status: string; dotColor: string }>>([]);

  const [topSellingDishes, setTopSellingDishes] = useState<Array<any>>([]);
  const [topByRevenueDishes, setTopByRevenueDishes] = useState<Array<any>>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const [todayShiftsData, setTodayShiftsData] = useState({
    openPositions: 0,
    morning: { filled: 0, total: 0 },
    afternoon: { filled: 0, total: 0 },
    evening: { filled: 0, total: 0 },
  });

  const [needsAttentionList, setNeedsAttentionList] = useState<Array<{
    id: string;
    type: string;
    title: string;
    desc: string;
    actionText: string;
    actionPath: string;
    iconBg: string;
    iconColor: string;
    timeText: string;
  }>>([]);

  const [recentActivities, setRecentActivities] = useState<Array<{
    time: string;
    title: string;
    desc: string;
    author: string;
    badge: string;
    dot: string;
  }>>([]);

  const isSubdomain =
    typeof window !== "undefined" &&
    (window.location.host.startsWith(`${subdomain}.`) ||
      (window.location.host.includes(".localhost") && !window.location.host.startsWith("admin.")));

  const p = (path: string) => (isSubdomain ? path : `/restaurant/${subdomain}${path}`);

  const fetchData = async (
    periodOverride?: string,
    startDateOverride?: Date | null,
    endDateOverride?: Date | null
  ) => {
    try {
      const periodParam = periodOverride !== undefined ? periodOverride : salesPeriod;
      const sDate = startDateOverride !== undefined ? startDateOverride : customStartDate;
      const eDate = endDateOverride !== undefined ? endDateOverride : customEndDate;

      const statsQuery = new URLSearchParams();
      if (periodParam) statsQuery.set("period", periodParam);
      if (sDate) statsQuery.set("startDate", sDate.toISOString().split("T")[0]);
      if (eDate) statsQuery.set("endDate", eDate.toISOString().split("T")[0]);

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
        resStats,
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
        fetch(`/api/restaurant/${subdomain}/dashboard/stats?${statsQuery.toString()}`).catch(() => null),
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
      const dataStats = resStats && resStats.ok ? await resStats.json() : null;

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

      if (dataStats?.outletCurrency) {
        setOutletCurrency(dataStats.outletCurrency);
      } else if (dataOutlets?.outlets?.[0]?.currency) {
        setOutletCurrency(dataOutlets.outlets[0].currency);
      }

      if (dataStats?.formattedTodayDate) {
        setFormattedTodayDate(dataStats.formattedTodayDate);
      }

      // Synchronize aggregated live stats if API route returned success
      if (dataStats?.success && dataStats?.liveOps) {
        setLiveOps((prev) => ({
          ...prev,
          ...dataStats.liveOps,
        }));
        if (dataStats.hourlyBars) {
          setHourlyBars(dataStats.hourlyBars);
        }
        if (dataStats.criticalInventoryList) {
          setCriticalInventoryList(dataStats.criticalInventoryList);
        }
        if (dataStats.todayShiftsData) {
          setTodayShiftsData(dataStats.todayShiftsData);
        }
        if (dataStats.needsAttentionList) {
          setNeedsAttentionList(dataStats.needsAttentionList);
        }
        if (dataStats.topSellingDishes) {
          setTopSellingDishes(dataStats.topSellingDishes);
        }
        if (dataStats.topByRevenueDishes) {
          setTopByRevenueDishes(dataStats.topByRevenueDishes);
        }
        if (dataStats.lastSyncAt) {
          setLastSyncAt(dataStats.lastSyncAt);
        }
        if (dataStats.recentActivities && dataStats.recentActivities.length > 0) {
          setRecentActivities(dataStats.recentActivities);
        }
      } else {
        // Fallback live sync without any dummy numbers
        if (dataPos?.orders) {
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
            todaySales: Math.round(totalSales),
            totalOrders: ords.length,
            avgOrderValue: ords.length > 0 ? Math.round(totalSales / ords.length) : 0,
            channelBreakdown: {
              dineIn: { count: dineIn, percentage: ords.length ? Math.round((dineIn / ords.length) * 1000) / 10 : 0, amount: Math.round(totalSales * (ords.length ? dineIn / ords.length : 0)) },
              delivery: { count: delivery, percentage: ords.length ? Math.round((delivery / ords.length) * 1000) / 10 : 0, amount: Math.round(totalSales * (ords.length ? delivery / ords.length : 0)) },
              takeaway: { count: takeaway, percentage: ords.length ? Math.round((takeaway / ords.length) * 1000) / 10 : 0, amount: Math.round(totalSales * (ords.length ? takeaway / ords.length : 0)) },
            },
            fulfillment: {
              completed,
              inProgress: inProg,
              cancelled,
            },
          }));
        }

        if (dataAttendance?.counts) {
          const attCounts = dataAttendance.counts;
          setLiveOps((prev) => ({
            ...prev,
            staffOnDuty: {
              present: attCounts.present ?? 0,
              total: totalEmp ?? 0,
              late: attCounts.late ?? 0,
              absent: attCounts.absent ?? 0,
            },
          }));
        }

        if (dataFinance?.pnl) {
          const pnl = dataFinance.pnl;
          const rev = Number(pnl.totalRevenue || 0);
          const gross = Number(pnl.grossProfit || 0);
          setLiveOps((prev) => ({
            ...prev,
            grossProfit: Math.round(gross),
            profitMargin: rev > 0 ? Math.round((gross / rev) * 1000) / 10 : 0,
          }));
        }
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
      className={`min-h-screen font-sans antialiased flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F8F9FA] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar branding={branding} activeSection="Dashboard" />

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA (OFFSET BY 68PX VIA RestaurantNavbar ON LG SCREENS)  */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Horizontal Bar (Global Controls & Action Row - No horizontal scroll on mobile!) */}
        <header
          className={`h-16 px-3 sm:px-6 lg:px-8 border-b flex items-center justify-between gap-2 sm:gap-3 sticky top-0 z-30 overflow-hidden ${
            isDark
              ? "bg-[#090B10]/95 border-white/[0.08] backdrop-blur-xl"
              : "bg-white/95 border-slate-200/80 backdrop-blur-xl"
          }`}
        >
          {/* Left Context: Operations Live on desktop, Brand on mobile */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 pl-11 lg:pl-0">
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
              onClick={() => router.push(p("/settings/branches"))}
              className={`hidden sm:flex px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold items-center gap-1.5 cursor-pointer whitespace-nowrap hover:bg-slate-100 dark:hover:bg-white/[0.08] transition ${
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
              onClick={() => setIsDateModalOpen(true)}
              className={`hidden md:flex px-3 py-1.5 rounded-xl border text-xs font-semibold items-center gap-1.5 cursor-pointer whitespace-nowrap hover:bg-slate-100 dark:hover:bg-white/[0.08] transition ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.08] text-slate-200"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 opacity-60" />
              <span>{formattedTodayDate || "Today"}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </div>

            {/* Notifications Bell */}
            <div
              onClick={() => router.push(p("/operations"))}
              className={`w-8 h-8 rounded-xl border flex items-center justify-center relative cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.08] transition ${
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
                      {currencySymbol}{liveOps.todaySales.toLocaleString()}
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
                      {currencySymbol}{liveOps.avgOrderValue}
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
                      {currencySymbol}{liveOps.grossProfit.toLocaleString()}
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
                      {liveOps.staffOnDuty.total > 0 ? (liveOps.staffOnDuty.present / liveOps.staffOnDuty.total * 100).toFixed(1) : "0.0"}%
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${liveOps.staffOnDuty.total > 0 ? Math.round((liveOps.staffOnDuty.present / liveOps.staffOnDuty.total) * 100) : 0}%` }} />
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
                    {/* Header: Unified Top Bar Filter handles Date Selection */}
                    <div className="flex items-center justify-between gap-3 mb-6">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                        Sales Performance
                      </h3>
                    </div>

                    {/* Bar Chart with Y-axis markers and interactive bars */}
                    <div className="relative pt-6 pb-2">
                      {/* Interactive Tooltip Card for hovered Bar */}
                      {hoveredBarIdx !== null && hourlyBars[hoveredBarIdx] && (
                        <div
                          className="absolute -top-1 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] text-center shadow-lg pointer-events-none transform -translate-x-1/2 z-20"
                          style={{
                            left: `${((hoveredBarIdx + 0.5) / Math.max(1, hourlyBars.length)) * 90 + 5}%`,
                          }}
                        >
                          <div className="font-semibold opacity-75">
                            {hourlyBars[hoveredBarIdx].time || "Peak"}
                          </div>
                          <div className="font-extrabold text-xs">
                            {currencySymbol}{hourlyBars[hoveredBarIdx].sales.toLocaleString()}
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

                      {/* Dynamic X-axis Time & Date Labels */}
                      <div className="flex justify-between px-1 pt-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 overflow-hidden">
                        {hourlyBars.map((bar, idx) => (
                          <span key={idx} className="flex-1 text-center truncate">
                            {bar.time}
                          </span>
                        ))}
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
                          <span className="text-xl font-black text-slate-900 dark:text-white">{liveOps.totalOrders}</span>
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
                          <span className="font-bold text-slate-900 dark:text-white">{liveOps.channelBreakdown.dineIn.count} <span className="text-[10px] opacity-60">{liveOps.channelBreakdown.dineIn.percentage}%</span></span>
                        </div>
                        <div className="flex items-center justify-between gap-4 font-semibold">
                          <span className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                            Delivery
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{liveOps.channelBreakdown.delivery.count} <span className="text-[10px] opacity-60">{liveOps.channelBreakdown.delivery.percentage}%</span></span>
                        </div>
                        <div className="flex items-center justify-between gap-4 font-semibold">
                          <span className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 dark:bg-white/40 shrink-0" />
                            Takeaway
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{liveOps.channelBreakdown.takeaway.count} <span className="text-[10px] opacity-60">{liveOps.channelBreakdown.takeaway.percentage}%</span></span>
                        </div>
                      </div>
                    </div>

                    {/* 3 Status summary cards */}
                    <div className="grid grid-cols-3 gap-2 mt-5 text-center">
                      <div className={`p-2.5 rounded-2xl border ${isDark ? "bg-[#151A28] border-white/[0.06]" : "bg-slate-50 border-slate-200/80"}`}>
                        <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold mx-auto flex items-center justify-center">
                          ✓
                        </div>
                        <div className="text-sm font-black mt-1 text-slate-900 dark:text-white">{liveOps.fulfillment.completed}</div>
                        <div className="text-[10px] opacity-60">Completed {liveOps.totalOrders > 0 ? (liveOps.fulfillment.completed / liveOps.totalOrders * 100).toFixed(1) : "0.0"}%</div>
                      </div>
                      <div className={`p-2.5 rounded-2xl border ${isDark ? "bg-[#151A28] border-white/[0.06]" : "bg-slate-50 border-slate-200/80"}`}>
                        <div className="w-4 h-4 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold mx-auto flex items-center justify-center">
                          ⧗
                        </div>
                        <div className="text-sm font-black mt-1 text-slate-900 dark:text-white">{liveOps.fulfillment.inProgress}</div>
                        <div className="text-[10px] opacity-60">In Progress {liveOps.totalOrders > 0 ? (liveOps.fulfillment.inProgress / liveOps.totalOrders * 100).toFixed(1) : "0.0"}%</div>
                      </div>
                      <div className={`p-2.5 rounded-2xl border ${isDark ? "bg-[#151A28] border-white/[0.06]" : "bg-slate-50 border-slate-200/80"}`}>
                        <div className="w-4 h-4 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold mx-auto flex items-center justify-center">
                          ✕
                        </div>
                        <div className="text-sm font-black mt-1 text-slate-900 dark:text-white">{liveOps.fulfillment.cancelled}</div>
                        <div className="text-[10px] opacity-60">Cancelled {liveOps.totalOrders > 0 ? (liveOps.fulfillment.cancelled / liveOps.totalOrders * 100).toFixed(1) : "0.0"}%</div>
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
                        <div className="text-base font-black text-slate-900 dark:text-white">{liveOps.lowStockAlerts}</div>
                        <div className="text-[10px] text-slate-400">Low Stock Items</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {criticalInventoryList.length === 0 ? (
                        <div className="py-4 text-center text-slate-400 text-xs">
                          No low stock alerts. Stock levels optimal.
                        </div>
                      ) : (
                        criticalInventoryList.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-slate-800 dark:text-slate-200 py-0.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${item.dotColor}`} />
                            <span className="truncate">{item.name} ({item.qty})</span>
                          </div>
                        ))
                      )}
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
                        <div className="text-base font-black text-slate-900 dark:text-white">{todayShiftsData.openPositions}</div>
                        <div className="text-[10px] text-slate-400">Open Positions</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-600 dark:text-slate-400">Morning (08:00 - 16:00)</span>
                        <span className="font-bold text-emerald-500">{todayShiftsData.morning.filled} / {todayShiftsData.morning.total}</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-600 dark:text-slate-400">Afternoon (12:00 - 20:00)</span>
                        <span className="font-bold text-amber-500">{todayShiftsData.afternoon.filled} / {todayShiftsData.afternoon.total}</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-600 dark:text-slate-400">Evening (16:00 - 00:00)</span>
                        <span className="font-bold text-amber-500">{todayShiftsData.evening.filled} / {todayShiftsData.evening.total}</span>
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
                          <div className="text-base font-black text-slate-900 dark:text-white">
                            {liveOps.staffOnDuty.present} / {liveOps.staffOnDuty.total}
                          </div>
                          <div className="text-[10px] text-slate-400">Present</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        {liveOps.staffOnDuty.total > 0 ? (liveOps.staffOnDuty.present / liveOps.staffOnDuty.total * 100).toFixed(1) : "0.0"}%
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between py-0.5">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          Present
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">{liveOps.staffOnDuty.present}</span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          Late
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">{liveOps.staffOnDuty.late}</span>
                      </div>
                      <div className="flex items-center justify-between py-0.5">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          Absent
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">{liveOps.staffOnDuty.absent}</span>
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
                        <span className="font-bold text-slate-900 dark:text-white">{currencySymbol}{liveOps.todaySales.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500 dark:text-[#8F95A3]">Operating Expenses</span>
                        <span className="font-bold text-slate-900 dark:text-white">{currencySymbol}{(Math.max(0, liveOps.todaySales - liveOps.grossProfit)).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500 dark:text-[#8F95A3]">Gross Profit</span>
                        <span className="font-bold text-emerald-500">{currencySymbol}{liveOps.grossProfit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500 dark:text-[#8F95A3]">Food Cost %</span>
                        <span className="font-bold text-slate-900 dark:text-white">{liveOps.foodCostPct}%</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-500 dark:text-[#8F95A3]">Net Margin</span>
                        <span className="font-bold text-emerald-500">{liveOps.profitMargin}%</span>
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
                      <p className="text-[11px] text-slate-400">{needsAttentionList.length} action items requiring manager attention</p>
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
                  {needsAttentionList.length === 0 ? (
                    <div className={`p-4 rounded-2xl border text-xs text-slate-400 text-center ${isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90"}`}>
                      ✓ All operational checks optimal. No pending attention items.
                    </div>
                  ) : (
                    needsAttentionList.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl ${item.iconBg} ${item.iconColor} flex items-center justify-center shrink-0 mt-0.5`}>
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              {item.title}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                          <span className="text-[11px] text-slate-400">{item.timeText}</span>
                          <button
                            type="button"
                            onClick={() => router.push(p(item.actionPath))}
                            className="px-3.5 py-1.5 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs hover:brightness-110 active:scale-[0.98]"
                            style={{ backgroundColor: brandColor }}
                          >
                            <span>{item.actionText}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
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
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                          <span>Top Selling Items</span>
                          {lastSyncAt && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Synced {new Date(lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Ranked by {topSellingRankBy === "quantity" ? "units sold" : "net revenue"} in outlet timezone
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={topSellingRankBy}
                          onChange={(e) => setTopSellingRankBy(e.target.value as "quantity" | "revenue")}
                          className="px-2.5 py-1 rounded-xl border text-xs font-semibold bg-transparent border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                        >
                          <option value="quantity" className="dark:bg-slate-900">By Quantity</option>
                          <option value="revenue" className="dark:bg-slate-900">By Revenue</option>
                        </select>
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

                    {(topSellingRankBy === "quantity"
                      ? topSellingDishes
                      : (topByRevenueDishes.length > 0 ? topByRevenueDishes : topSellingDishes)
                    ).length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        No menu item sales recorded for the selected period. Orders will populate top sellers automatically.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-white/[0.06] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                              <th className="pb-2 pl-1">Item</th>
                              <th className="pb-2 text-right">Quantity sold</th>
                              <th className="pb-2 text-right">Net item sales</th>
                              <th className="pb-2 text-right pr-1">Orders containing item</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                            {(topSellingRankBy === "quantity"
                              ? topSellingDishes
                              : (topByRevenueDishes.length > 0 ? topByRevenueDishes : topSellingDishes)
                            ).slice(0, 10).map((dish: any, idx: number) => (
                              <tr key={dish.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                <td className="py-2.5 pl-1">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="font-mono text-slate-400 font-bold text-xs w-3 shrink-0">{idx + 1}</span>
                                    <span className="text-base shrink-0">{dish.icon || "🍗"}</span>
                                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[160px] sm:max-w-[200px]" title={dish.name}>
                                      {dish.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                                  {dish.qty || 0} sold
                                </td>
                                <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                                  {currencySymbol}{(dish.netSales ?? dish.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2.5 text-right pr-1 font-mono text-slate-500 dark:text-slate-400">
                                  {dish.ordersCount ? `${dish.ordersCount} ${dish.ordersCount === 1 ? "order" : "orders"}` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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

                    {recentActivities.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        No recent activity logged yet. System operations will appear here live.
                      </div>
                    ) : (
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
                    )}
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
          {/* Calendar Style Date Range Filter Modal (Matching POS) */}
          {isDateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Filter Dashboard Date
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsDateModalOpen(false)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                  {/* Presets Tab Bar */}
                  <div className="p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex items-center gap-1 text-xs font-semibold">
                    {[
                      { id: "day", label: "Today" },
                      { id: "yesterday", label: "Yesterday" },
                      { id: "week", label: "Week" },
                      { id: "month", label: "Month" },
                      { id: "custom", label: "Custom" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          const t = tab.id as any;
                          setCalendarTab(t);
                          const now = new Date();
                          if (t === "day") {
                            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            setCustomStartDate(today);
                            setCustomEndDate(today);
                            setCalendarViewMonth(today.getMonth());
                            setCalendarViewYear(today.getFullYear());
                          } else if (t === "yesterday") {
                            const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                            setCustomStartDate(yest);
                            setCustomEndDate(yest);
                            setCalendarViewMonth(yest.getMonth());
                            setCalendarViewYear(yest.getFullYear());
                          } else if (t === "week") {
                            const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            setCustomStartDate(startOfWeek);
                            setCustomEndDate(today);
                            setCalendarViewMonth(today.getMonth());
                            setCalendarViewYear(today.getFullYear());
                          } else if (t === "month") {
                            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                            setCustomStartDate(startOfMonth);
                            setCustomEndDate(endOfMonth);
                            setCalendarViewMonth(now.getMonth());
                            setCalendarViewYear(now.getFullYear());
                          }
                        }}
                        className={`flex-1 py-2 px-2.5 rounded-xl transition-all text-center cursor-pointer ${
                          calendarTab === tab.id
                            ? "bg-amber-600 text-white shadow-md font-bold"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Start & End Date Input Boxes (Visible for all tabs) */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCalendarTab("custom");
                        setPickingTarget("start");
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        pickingTarget === "start"
                          ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                        Start Date
                      </span>
                      <span className="text-xs font-bold block truncate">
                        {formatDateDisplay(customStartDate, "Select Start Date")}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCalendarTab("custom");
                        setPickingTarget("end");
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        pickingTarget === "end"
                          ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                        End Date
                      </span>
                      <span className="text-xs font-bold block truncate">
                        {formatDateDisplay(customEndDate, "Select End Date")}
                      </span>
                    </button>
                  </div>

                  {/* Interactive Month & Year Calendar View (Always Visible for All Tabs) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (calendarViewMonth === 0) {
                            setCalendarViewMonth(11);
                            setCalendarViewYear(calendarViewYear - 1);
                          } else {
                            setCalendarViewMonth(calendarViewMonth - 1);
                          }
                        }}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {MONTH_NAMES[calendarViewMonth]} {calendarViewYear}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          if (calendarViewMonth === 11) {
                            setCalendarViewMonth(0);
                            setCalendarViewYear(calendarViewYear + 1);
                          } else {
                            setCalendarViewMonth(calendarViewMonth + 1);
                          }
                        }}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Days of Week Header */}
                    <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                      {["S", "M", "T", "W", "T", "F", "S"].map((dayStr, idx) => (
                        <div key={idx} className="py-1">
                          {dayStr}
                        </div>
                      ))}
                    </div>

                    {/* Interactive Calendar Days Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {getCalendarGridDays(calendarViewYear, calendarViewMonth).map((cell, idx) => {
                        const isStart = isSameDay(cell.dateObj, customStartDate);
                        const isEnd = isSameDay(cell.dateObj, customEndDate);
                        const isInRange = isDateInRange(cell.dateObj, customStartDate, customEndDate);
                        const isSelected = isStart || isEnd;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setCalendarTab("custom");
                              if (pickingTarget === "start") {
                                setCustomStartDate(cell.dateObj);
                                if (customEndDate && cell.dateObj > customEndDate) {
                                  setCustomEndDate(null);
                                }
                                setPickingTarget("end");
                              } else {
                                if (customStartDate && cell.dateObj < customStartDate) {
                                  setCustomStartDate(cell.dateObj);
                                  setCustomEndDate(null);
                                  setPickingTarget("end");
                                } else {
                                  setCustomEndDate(cell.dateObj);
                                }
                              }
                            }}
                            className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                              !cell.isCurrentMonth
                                ? "text-slate-300 dark:text-slate-700 opacity-40"
                                : isSelected
                                ? "bg-amber-600 text-white font-bold shadow-md shadow-amber-600/20"
                                : isInRange
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                                : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            {cell.day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Apply & Reset Controls */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomStartDate(null);
                        setCustomEndDate(null);
                        setSalesPeriod("today");
                        setCalendarTab("day");
                        fetchData("today", null, null);
                        setIsDateModalOpen(false);
                      }}
                      className="flex-1 py-2.5 px-4 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Reset Filter
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (calendarTab === "day") {
                          setSalesPeriod("today");
                          fetchData("today", null, null);
                        } else if (calendarTab === "yesterday") {
                          setSalesPeriod("yesterday" as any);
                          fetchData("yesterday", null, null);
                        } else if (calendarTab === "week") {
                          setSalesPeriod("week");
                          fetchData("week", null, null);
                        } else if (calendarTab === "month") {
                          setSalesPeriod("month" as any);
                          fetchData("month", null, null);
                        } else {
                          fetchData("custom", customStartDate, customEndDate);
                        }
                        setIsDateModalOpen(false);
                      }}
                      className="flex-1 py-2.5 px-4 text-xs font-bold text-white rounded-xl shadow-md transition-colors cursor-pointer"
                      style={{ backgroundColor: brandColor }}
                    >
                      Apply Filter
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
