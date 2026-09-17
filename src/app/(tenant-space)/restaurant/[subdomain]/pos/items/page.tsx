"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Download,
  UtensilsCrossed,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  ChevronDown,
  Calendar,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { useTheme } from "@/core/theme/ThemeContext";

interface ItemData {
  id: number;
  posMenuItemId: string | null;
  name: string;
  quantity: number;
  netSales: number;
  ordersCount: number;
  avgPrice: number;
  sharePct: number;
}

interface SummaryData {
  totalUniqueItems: number;
  totalQuantitySold: number;
  totalRevenue: number;
  topItem: string;
}

export default function PosAllItemsPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ItemData[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalUniqueItems: 0,
    totalQuantitySold: 0,
    totalRevenue: 0,
    topItem: "N/A",
  });
  const [currency, setCurrency] = useState("USD");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [formattedPeriod, setFormattedPeriod] = useState("All Time");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [period, setPeriod] = useState<"all" | "today" | "yesterday" | "week" | "month">("all");
  const [sortBy, setSortBy] = useState<"quantity" | "revenue" | "orders" | "name">("quantity");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const isSubdomain =
    typeof window !== "undefined" &&
    (window.location.host.startsWith(`${subdomain}.`) ||
      (window.location.host.includes(".localhost") && !window.location.host.startsWith("admin.")));

  const p = (path: string) => (isSubdomain ? path : `/restaurant/${subdomain}${path}`);

  const currencySymbol = useMemo(() => {
    const code = (currency || "").toUpperCase();
    if (code === "INR") return "₹";
    if (code === "EUR") return "€";
    if (code === "GBP") return "£";
    if (code === "AED") return "د.إ";
    return "$";
  }, [currency]);

  const fetchItems = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const q = new URLSearchParams();
      if (period !== "all") q.set("period", period);
      if (searchQuery) q.set("search", searchQuery);
      if (sortBy) q.set("sortBy", sortBy);
      if (sortOrder) q.set("sortOrder", sortOrder);

      const res = await fetch(`/api/restaurant/${subdomain}/pos/items?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        if (data.summary) setSummary(data.summary);
        if (data.outletCurrency) setCurrency(data.outletCurrency);
        if (data.lastSyncAt) setLastSyncAt(data.lastSyncAt);
        if (data.formattedPeriod) setFormattedPeriod(data.formattedPeriod);
      }
    } catch (err) {
      console.error("Failed to load POS items:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (subdomain) {
      fetchItems();
    }
  }, [subdomain, period, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const handleSortToggle = (field: "quantity" | "revenue" | "orders" | "name") => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const exportCSV = () => {
    if (!items.length) return;
    const headers = ["Rank", "Dish Name", "Units Sold", "Net Item Sales", "Avg Price", "Orders Containing Item", "Share %"];
    const rows = items.map((item, idx) => [
      idx + 1,
      `"${item.name.replace(/"/g, '""')}"`,
      item.quantity,
      item.netSales.toFixed(2),
      item.avgPrice.toFixed(2),
      item.ordersCount,
      `${item.sharePct}%`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pos-items-report-${subdomain}-${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#07090E] text-slate-100" : "bg-[#F8FAFC] text-slate-900"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Navigation Breadcrumbs & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(p("/dashboard"))}
              className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-300"
                  : "bg-white border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs"
              }`}
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Link href={p("/dashboard")} className="hover:underline">
                  Dashboard
                </Link>
                <span>/</span>
                <span className="text-slate-900 dark:text-white">Item Sales & Performance</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5 flex items-center gap-2.5">
                All Menu Items
                {lastSyncAt && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Synced {new Date(lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchItems(true)}
              disabled={refreshing}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-300"
                  : "bg-white border-slate-200 hover:bg-slate-100 text-slate-700 shadow-2xs"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={exportCSV}
              disabled={items.length === 0}
              className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div
            className={`p-4 sm:p-5 rounded-2xl border transition flex flex-col justify-between ${
              isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div className="mt-3">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Unique Dishes Sold
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                {summary.totalUniqueItems}
              </div>
              <span className="text-[10px] font-semibold text-slate-400 mt-0.5 block truncate">
                {formattedPeriod}
              </span>
            </div>
          </div>

          <div
            className={`p-4 sm:p-5 rounded-2xl border transition flex flex-col justify-between ${
              isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="mt-3">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Total Units Sold
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                {summary.totalQuantitySold.toLocaleString()}
              </div>
              <span className="text-[10px] font-semibold text-emerald-500 mt-0.5 block">
                Live POS line items
              </span>
            </div>
          </div>

          <div
            className={`p-4 sm:p-5 rounded-2xl border transition flex flex-col justify-between ${
              isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="mt-3">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Net Item Sales
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                {currencySymbol}
                {summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] font-semibold text-slate-400 mt-0.5 block">
                Across all synced orders
              </span>
            </div>
          </div>

          <div
            className={`p-4 sm:p-5 rounded-2xl border transition flex flex-col justify-between ${
              isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="mt-3">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                #1 Top Performing Dish
              </span>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight mt-0.5 truncate" title={summary.topItem}>
                {summary.topItem}
              </div>
              <span className="text-[10px] font-semibold text-purple-500 mt-0.5 block">
                Highest ranked item
              </span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div
          className={`p-4 rounded-2xl border transition space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4 ${
            isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
          }`}
        >
          {/* Period Selection Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "week", label: "This Week" },
              { id: "month", label: "This Month" },
            ].map((pTab) => (
              <button
                key={pTab.id}
                type="button"
                onClick={() => setPeriod(pTab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  period === pTab.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                }`}
              >
                {pTab.label}
              </button>
            ))}
          </div>

          {/* Search Input & Sort Dropdown */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dish or item..."
                className={`w-full pl-9 pr-3 py-1.5 rounded-xl border text-xs transition focus:outline-none ${
                  isDark
                    ? "bg-white/[0.04] border-white/[0.08] text-white focus:border-white/20"
                    : "bg-slate-50 border-slate-200 text-slate-900 focus:border-slate-400"
                }`}
              />
            </form>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.08] text-slate-300"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              <option value="quantity" className="dark:bg-slate-900">Sort by Quantity</option>
              <option value="revenue" className="dark:bg-slate-900">Sort by Net Sales</option>
              <option value="orders" className="dark:bg-slate-900">Sort by Orders</option>
              <option value="name" className="dark:bg-slate-900">Sort by Name</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div
          className={`rounded-3xl border overflow-hidden transition ${
            isDark ? "bg-[#0E121D] border-white/[0.08]" : "bg-white border-slate-200/90 shadow-2xs"
          }`}
        >
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
              Loading items...
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <UtensilsCrossed className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">No items found</div>
              <p className="text-xs text-slate-400">
                {searchQuery ? `No dishes match "${searchQuery}" in this period.` : "No completed orders found for this timeframe."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr
                    className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                      isDark
                        ? "border-white/[0.06] text-slate-400 bg-white/[0.02]"
                        : "border-slate-100 text-slate-500 bg-slate-50/50"
                    }`}
                  >
                    <th className="py-3 pl-5 w-12 text-center">#</th>
                    <th
                      className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                      onClick={() => handleSortToggle("name")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Item Name</span>
                        {sortBy === "name" && <span className="text-[10px]">{sortOrder === "asc" ? "▲" : "▼"}</span>}
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                      onClick={() => handleSortToggle("quantity")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Quantity Sold</span>
                        {sortBy === "quantity" && <span className="text-[10px]">{sortOrder === "asc" ? "▲" : "▼"}</span>}
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                      onClick={() => handleSortToggle("revenue")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Net Item Sales</span>
                        {sortBy === "revenue" && <span className="text-[10px]">{sortOrder === "asc" ? "▲" : "▼"}</span>}
                      </div>
                    </th>
                    <th className="py-3 px-3 text-right">Avg. Price</th>
                    <th
                      className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                      onClick={() => handleSortToggle("orders")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Orders</span>
                        {sortBy === "orders" && <span className="text-[10px]">{sortOrder === "asc" ? "▲" : "▼"}</span>}
                      </div>
                    </th>
                    <th className="py-3 pr-5 text-right w-28">Share %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {items.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 pl-5 text-center font-mono font-bold text-slate-400 text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">
                          {item.name}
                        </div>
                        {item.posMenuItemId && (
                          <span className="text-[10px] font-mono text-slate-400 block">
                            ID: {item.posMenuItemId}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.quantity.toLocaleString()}
                        </span>{" "}
                        <span className="text-slate-400 text-[11px]">sold</span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-sm text-slate-900 dark:text-white">
                        {currencySymbol}
                        {item.netSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400 text-xs">
                        {currencySymbol}
                        {item.avgPrice.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400 text-xs">
                        {item.ordersCount} {item.ordersCount === 1 ? "order" : "orders"}
                      </td>
                      <td className="py-3.5 pr-5 text-right font-mono text-xs">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 bg-slate-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, item.sharePct * 5)}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {item.sharePct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer showing item count summary */}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Showing all {items.length} items for <strong className="text-slate-600 dark:text-slate-300">{formattedPeriod}</strong>
            </span>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="hover:underline text-slate-600 dark:text-slate-400"
            >
              Back to top ↑
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
