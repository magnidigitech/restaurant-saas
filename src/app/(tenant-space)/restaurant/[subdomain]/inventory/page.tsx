"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { Boxes, PackageCheck, ArrowLeft } from "lucide-react";

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
      desc: "Manage catalog ingredients, standard units, par levels, and SKU codes.",
      path: `/restaurant/${subdomain}/inventory/items`,
      badge: `${stats.totalItems} Items`,
      badgeType: "default",
    },
    {
      title: "Purchase Orders",
      desc: "Draft procurement orders, track supplier deliveries, and receive stock.",
      path: `/restaurant/${subdomain}/inventory/purchase-orders`,
      badge: "Procurement",
      badgeType: "default",
    },
    {
      title: "Vendor Management",
      desc: "Supplier directories, payment terms, contracts, and preferred vendor links.",
      path: `/restaurant/${subdomain}/inventory/vendors`,
      badge: `${stats.totalVendors} Vendors`,
      badgeType: "default",
    },
    {
      title: "Categories Hierarchy",
      desc: "Organize ingredients and menu supplies into structured tree categories.",
      path: `/restaurant/${subdomain}/inventory/categories`,
      badge: `${stats.totalCategories} Categories`,
      badgeType: "default",
    },
    {
      title: "Recipes & Costing Engine",
      desc: "Formula composition, sub-recipe nesting, unit conversions, and gross margin analysis.",
      path: `/restaurant/${subdomain}/inventory/recipes`,
      badge: "Food Costing",
      badgeType: "default",
    },
    {
      title: "Stock Management Ledger",
      desc: "Real-time stock on hand per outlet, batch movement audits, and wastage logging.",
      path: `/restaurant/${subdomain}/inventory/stock`,
      badge: "Live Ledger",
      badgeType: "default",
    },
    {
      title: "Low-Stock Alerts",
      desc: "Critical alerts for items that have dropped below minimum reorder thresholds.",
      path: `/restaurant/${subdomain}/inventory/alerts`,
      badge: stats.lowStockCount > 0 ? `${stats.lowStockCount} Critical Deficits` : "All Healthy",
      badgeType: stats.lowStockCount > 0 ? "warning" : "success",
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
            className={`p-5 rounded-3xl border transition cursor-pointer ${
              isDark
                ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
                : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Catalog Items
            </span>
            <p className={`text-2xl font-bold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              {stats.totalItems}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Across {stats.totalCategories} categories
            </p>
          </div>

          <div
            onClick={() => router.push(`/restaurant/${subdomain}/inventory/alerts`)}
            className={`p-5 rounded-3xl border transition cursor-pointer ${
              stats.lowStockCount > 0
                ? isDark
                  ? "bg-amber-500/[0.05] border-amber-500/30"
                  : "bg-amber-50/50 border-amber-200 shadow-xs"
                : isDark
                ? "bg-[#121622]/60 border-white/[0.06]"
                : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              stats.lowStockCount > 0 ? "text-amber-500" : isDark ? "text-[#8F95A3]" : "text-slate-500"
            }`}>
              Low Stock Alerts
            </span>
            <p className={`text-2xl font-bold tracking-tight mt-1 ${
              stats.lowStockCount > 0 ? "text-amber-500" : isDark ? "text-white" : "text-slate-900"
            }`}>
              {stats.lowStockCount}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              {stats.lowStockCount > 0 ? "Requires reordering" : "Levels optimal"}
            </p>
          </div>

          <div
            onClick={() => router.push(`/restaurant/${subdomain}/inventory/vendors`)}
            className={`p-5 rounded-3xl border transition cursor-pointer ${
              isDark
                ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
                : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Active Suppliers
            </span>
            <p className={`text-2xl font-bold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              {stats.totalVendors}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Registered vendor profiles
            </p>
          </div>

          <div
            onClick={() => router.push(`/restaurant/${subdomain}/inventory/stock`)}
            className={`p-5 rounded-3xl border transition cursor-pointer ${
              isDark
                ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
                : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
            }`}
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Wastage (MTD)
            </span>
            <p className={`text-2xl font-bold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              {stats.wastageThisMonth}
            </p>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Incidents logged this month
            </p>
          </div>
        </div>

        {/* Submodules Grid Navigation */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navCards.map((card) => (
            <div
              key={card.path}
              onClick={() => router.push(card.path)}
              className={`p-6 rounded-3xl border transition cursor-pointer flex flex-col justify-between space-y-4 group ${
                isDark
                  ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.15] hover:bg-[#121622]/90"
                  : "bg-white border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300"
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    {card.title}
                  </h3>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    card.badgeType === "warning"
                      ? isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/25" : "bg-amber-100 text-amber-800 border-amber-200"
                      : card.badgeType === "success"
                      ? isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : isDark ? "bg-white/[0.04] text-[#BAC0CD] border-white/[0.08]" : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}>
                    {card.badge}
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {card.desc}
                </p>
              </div>

              <div className={`pt-3 border-t flex justify-between items-center text-xs ${
                isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-100 text-slate-400"
              }`}>
                <span className="text-[#0071E3] font-medium group-hover:underline">Access Module</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
    </ModuleAccessGuard>
  );
}
