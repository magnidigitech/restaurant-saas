"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import {
  Boxes,
  PackageCheck,
  ArrowLeft,
  Package,
  ShoppingCart,
  Building2,
  FolderTree,
  UtensilsCrossed,
  History,
  AlertTriangle,
  Scale,
  ArrowRight,
  Info,
} from "lucide-react";

// Interactive frosted-glass tooltip for feature descriptions
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
        className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus:outline-none cursor-pointer"
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

interface DashboardStats {
  totalItems: number;
  lowStockCount: number;
  wastageThisMonth: number;
  totalCategories: number;
  totalVendors: number;
}

export default function InventoryDashboard({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    lowStockCount: 0,
    wastageThisMonth: 0,
    totalCategories: 0,
    totalVendors: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const [resItems, resAlerts, resWastage, resCategories, resVendors] = await Promise.all([
        fetch("/api/restaurant/inventory/items"),
        fetch("/api/restaurant/inventory/alerts"),
        fetch("/api/restaurant/inventory/wastage"),
        fetch("/api/restaurant/inventory/categories"),
        fetch("/api/restaurant/inventory/vendors"),
      ]);

      const items = resItems.ok ? (await resItems.json()).items || [] : [];
      const alerts = resAlerts.ok ? (await resAlerts.json()).alerts || [] : [];
      const wastageLogs = resWastage.ok ? (await resWastage.json()).wastageLogs || [] : [];
      const categories = resCategories.ok ? (await resCategories.json()).categories || [] : [];
      const vendors = resVendors.ok ? (await resVendors.json()).vendors || [] : [];

      const thisMonth = new Date();
      thisMonth.setDate(1);
      const wastageThisMonth = wastageLogs.filter((w: any) => new Date(w.occurredAt) >= thisMonth).length;

      setStats({
        totalItems: items.length,
        lowStockCount: alerts.length,
        wastageThisMonth,
        totalCategories: categories.length,
        totalVendors: vendors.length,
      });
    } catch {
      // stats fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const navCards = [
    {
      title: "Item Master & SKUs",
      category: "Catalog & SKUs",
      desc: "Manage catalog ingredients, standard units, par levels, barcode mappings, and SKU codes.",
      path: `/restaurant/${subdomain}/inventory/items`,
      badge: `${stats.totalItems} Items`,
      badgeType: "default",
      featureTag: "Ingredients & Par Levels",
      icon: Package,
      bgLight: "bg-blue-500/10 text-blue-600 border-blue-500/25",
      bgDark: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    },
    {
      title: "Purchase Orders",
      category: "Procurement",
      desc: "Draft procurement orders, track supplier deliveries, receive batch stocks, and update invoice records.",
      path: `/restaurant/${subdomain}/inventory/purchase-orders`,
      badge: "Procurement",
      badgeType: "default",
      featureTag: "Supplier Orders & Receiving",
      icon: ShoppingCart,
      bgLight: "bg-sky-500/10 text-sky-600 border-sky-500/25",
      bgDark: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    },
    {
      title: "Vendor Management",
      category: "Suppliers & B2B",
      desc: "Supplier directories, payment terms, contracts, contacts, and preferred vendor links.",
      path: `/restaurant/${subdomain}/inventory/vendors`,
      badge: `${stats.totalVendors} Vendors`,
      badgeType: "default",
      featureTag: "Directories & Payment Terms",
      icon: Building2,
      bgLight: "bg-purple-500/10 text-purple-600 border-purple-500/25",
      bgDark: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    },
    {
      title: "Categories Hierarchy",
      category: "Taxonomy",
      desc: "Organize raw ingredients and menu preparation supplies into structured tree categories.",
      path: `/restaurant/${subdomain}/inventory/categories`,
      badge: `${stats.totalCategories} Categories`,
      badgeType: "default",
      featureTag: "Structured Ingredient Trees",
      icon: FolderTree,
      bgLight: "bg-indigo-500/10 text-indigo-600 border-indigo-500/25",
      bgDark: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    },
    {
      title: "Recipes & Costing Engine",
      category: "Food Costing",
      desc: "Formula composition, sub-recipe nesting, unit conversions, yield percentages, and gross margin analysis.",
      path: `/restaurant/${subdomain}/inventory/recipes`,
      badge: "Food Costing",
      badgeType: "default",
      featureTag: "Sub-Recipes & Gross Margins",
      icon: UtensilsCrossed,
      bgLight: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25",
      bgDark: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      title: "Stock Management Ledger",
      category: "Live Inventory",
      desc: "Real-time stock on hand per outlet, batch movement audits, depletion tracking, and wastage logging.",
      path: `/restaurant/${subdomain}/inventory/stock`,
      badge: "Live Ledger",
      badgeType: "default",
      featureTag: "Batch Audits & Wastage Logs",
      icon: History,
      bgLight: "bg-cyan-500/10 text-cyan-600 border-cyan-500/25",
      bgDark: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    },
    {
      title: "Low-Stock Alerts",
      category: "Deficit Control",
      desc: "Critical alerts for ingredients and supplies that have dropped below minimum reorder thresholds.",
      path: `/restaurant/${subdomain}/inventory/alerts`,
      badge: stats.lowStockCount > 0 ? `${stats.lowStockCount} Critical Deficits` : "All Healthy",
      badgeType: stats.lowStockCount > 0 ? "warning" : "success",
      featureTag: "Critical Reorder Thresholds",
      icon: AlertTriangle,
      bgLight: stats.lowStockCount > 0 ? "bg-amber-500/10 text-amber-600 border-amber-500/25" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/25",
      bgDark: stats.lowStockCount > 0 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
  ];

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Inventory Module...</p>
      </div>
    );
  }

  return (
    <ModuleAccessGuard moduleKey="inventory" moduleName="Inventory & Stock Control" activeSection="Inventory">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Inventory" />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Executive Header Banner */}
        <div
          className={`p-4 sm:p-6 lg:p-7 rounded-2xl sm:rounded-3xl border transition relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 ${
            isDark
              ? "bg-gradient-to-br from-[#121829] via-[#0E1320] to-[#0A0D14] border-white/[0.08] shadow-xl shadow-black/20"
              : "bg-gradient-to-br from-blue-50/80 via-indigo-50/25 to-white border-blue-100/80 shadow-sm shadow-blue-500/5"
          }`}
        >
          {/* Ambient Glow Orbs */}
          <div className="absolute -right-16 -top-16 w-72 h-72 bg-blue-500/10 dark:bg-[#0071E3]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute right-1/3 -bottom-16 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Left: Nav & Title */}
          <div className="relative z-10 space-y-2.5 sm:space-y-3 w-full md:w-auto min-w-0">
            {/* Nav & Category Pills */}
            <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/dashboard`)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                  isDark
                    ? "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                    : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs"
                }`}
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Dashboard</span>
              </button>
              <span className="hidden sm:inline text-slate-300 dark:text-white/20">•</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-[#0071E3] dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] animate-pulse" />
                <span className="hidden sm:inline">Supply Chain & Stock</span>
                <span className="sm:hidden">Stock & Supply</span>
              </span>
            </div>

            {/* Title with Squircle Icon */}
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#0071E3] via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 border border-white/20">
                <Boxes className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h1 className={`text-base sm:text-2xl font-extrabold tracking-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                  Inventory & Supply Chain
                </h1>
                <span className={`text-[10px] sm:text-xs block sm:hidden font-medium mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {stats.totalItems} catalog items • {stats.lowStockCount} low stock
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions & Status Capsule */}
          <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
            <div className={`hidden lg:flex p-3 rounded-2xl border items-center gap-3 ${
              isDark
                ? "bg-[#141A29]/80 border-white/[0.08] shadow-sm"
                : "bg-white/90 backdrop-blur-xs border-slate-200/80 shadow-xs"
            }`}>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <PackageCheck className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Stock Ledger Active
                  </span>
                </div>
                <span className={`text-[10px] font-medium block mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {stats.totalItems} Items • {stats.totalVendors} Vendors
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/inventory/items`)}
                className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
              >
                + New Item
              </button>
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/inventory/purchase-orders`)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  isDark
                    ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                    : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-xs"
                }`}
              >
                + New PO
              </button>
            </div>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => router.push(`/restaurant/${subdomain}/inventory/items`)}
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
                Catalog Items
              </span>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                  isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className={`text-2xl font-bold tracking-tight mt-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              {stats.totalItems}{" "}
              <span className={`text-xs font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>SKUs</span>
            </p>
            <div className="flex justify-between items-center mt-2 text-[11px]">
              <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>
                Across {stats.totalCategories} {stats.totalCategories === 1 ? "category" : "categories"}
              </span>
              <span className="text-[#0071E3] font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                Manage <ArrowRight className="w-3 h-3 inline" />
              </span>
            </div>
          </div>

          <div
            onClick={() => router.push(`/restaurant/${subdomain}/inventory/alerts`)}
            className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer group ${
              stats.lowStockCount > 0
                ? isDark
                  ? "bg-amber-500/[0.05] border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/[0.08]"
                  : "bg-amber-50/50 border-amber-200 shadow-sm hover:border-amber-300 hover:shadow-md"
                : isDark
                ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.14] hover:bg-[#121622]/80"
                : "bg-white border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md"
            }`}
          >
            <div className="flex justify-between items-start">
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  stats.lowStockCount > 0 ? "text-amber-500" : isDark ? "text-[#8F95A3]" : "text-slate-500"
                }`}
              >
                Low Stock Alerts
              </span>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                  stats.lowStockCount > 0
                    ? isDark
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-amber-50 text-amber-600"
                    : isDark
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <p
              className={`text-2xl font-bold tracking-tight mt-2 ${
                stats.lowStockCount > 0
                  ? "text-amber-500"
                  : isDark
                  ? "text-emerald-400"
                  : "text-emerald-600"
              }`}
            >
              {stats.lowStockCount > 0 ? `${stats.lowStockCount} Deficits` : "Optimal"}
            </p>
            <div className="flex justify-between items-center mt-2 text-[11px]">
              <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>
                {stats.lowStockCount > 0 ? "Requires reordering" : "All levels healthy"}
              </span>
              <span className="text-[#0071E3] font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                Alerts <ArrowRight className="w-3 h-3 inline" />
              </span>
            </div>
          </div>

          <div
            onClick={() => router.push(`/restaurant/${subdomain}/inventory/vendors`)}
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
                Active Suppliers
              </span>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                  isDark ? "bg-purple-500/10 text-purple-400" : "bg-purple-50 text-purple-600"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className={`text-2xl font-bold tracking-tight mt-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              {stats.totalVendors}{" "}
              <span className={`text-xs font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>Vendors</span>
            </p>
            <div className="flex justify-between items-center mt-2 text-[11px]">
              <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>
                Registered vendor profiles
              </span>
              <span className="text-[#0071E3] font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                Directory <ArrowRight className="w-3 h-3 inline" />
              </span>
            </div>
          </div>

          <div
            onClick={() => router.push(`/restaurant/${subdomain}/inventory/stock`)}
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
                Wastage (MTD)
              </span>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                  isDark ? "bg-rose-500/10 text-rose-400" : "bg-rose-50 text-rose-600"
                }`}
              >
                <History className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className={`text-2xl font-bold tracking-tight mt-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              {stats.wastageThisMonth}{" "}
              <span className={`text-xs font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>Logs</span>
            </p>
            <div className="flex justify-between items-center mt-2 text-[11px]">
              <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>
                Incidents logged this month
              </span>
              <span className="text-[#0071E3] font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                Ledger <ArrowRight className="w-3 h-3 inline" />
              </span>
            </div>
          </div>
        </div>

        {/* Operational Business Modules Grid */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                isDark ? "text-[#8F95A3]" : "text-slate-500"
              }`}
            >
              Inventory Submodules & Control
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                isDark
                  ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.06]"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {navCards.length} Submodules Available
            </span>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {navCards.map((card) => {
              const IconComponent = card.icon;

              return (
                <div
                  key={card.path}
                  onClick={() => router.push(card.path)}
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
                          isDark ? card.bgDark : card.bgLight
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
                          {card.category}
                        </span>
                        <h4
                          className={`text-sm font-semibold tracking-tight truncate group-hover:text-[#0071E3] dark:group-hover:text-blue-400 transition-colors ${
                            isDark ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {card.title}
                        </h4>
                      </div>
                    </div>

                    {/* Right Controls: Badge + Tooltip */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {card.badge && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                            card.badgeType === "warning"
                              ? isDark
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                              : card.badgeType === "success"
                              ? isDark
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : isDark
                              ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          {card.badge}
                        </span>
                      )}

                      {/* Interactive Tooltip Trigger for Description */}
                      <InfoTooltip
                        title={card.title}
                        description={card.desc}
                        category={card.category}
                      />
                    </div>
                  </div>

                  {/* Footer Row: Feature tag & sleek launch CTA */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.04] text-xs">
                    <span className={`text-[11px] font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      {card.featureTag}
                    </span>
                    <span className="font-semibold text-[#0071E3] dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform text-[11px]">
                      Launch <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
    </ModuleAccessGuard>
  );
}
