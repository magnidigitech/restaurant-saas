"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface PnLData {
  restaurantId: string;
  startDate: string;
  endDate: string;
  metrics: {
    grossRevenue: number;
    totalCogs: number;
    grossProfit: number;
    grossMarginPercent: number;
    totalLabor: number;
    laborPercent: number;
    primeCost: number;
    primeCostPercent: number;
    primeCostStatus: "OPTIMAL" | "ACCEPTABLE" | "HIGH";
    totalOpex: number;
    opexPercent: number;
    totalExpenses: number;
    netOperatingIncome: number;
    netProfitMarginPercent: number;
  };
  revenueStreams: Array<{
    category: string;
    displayName: string;
    amount: number;
    percentageOfRevenue: number;
    percentageOfCategory?: number;
    transactionCount: number;
  }>;
  cogsBreakdown: Array<{
    category: string;
    displayName: string;
    amount: number;
    percentageOfRevenue: number;
    percentageOfCategory?: number;
    transactionCount: number;
  }>;
  laborBreakdown: Array<{
    category: string;
    displayName: string;
    amount: number;
    percentageOfRevenue: number;
    percentageOfCategory?: number;
    transactionCount: number;
  }>;
  opexBreakdown: Array<{
    category: string;
    displayName: string;
    amount: number;
    percentageOfRevenue: number;
    percentageOfCategory?: number;
    transactionCount: number;
  }>;
}

interface FinancialTx {
  id: string;
  type: "EXPENSE" | "REVENUE";
  category: string;
  source: string;
  title: string;
  description?: string;
  amount: number;
  taxAmount: number;
  netAmount: number;
  transactionDate: string;
  vendorOrPayer?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  outlet?: { name: string };
  costCenter?: { name: string; code: string };
}

export default function FinancePerformanceDashboardPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Tab State (Financial Performance & General Ledger)
  const [activeTab, setActiveTab] = useState<"PNL_OVERVIEW" | "LEDGER">("PNL_OVERVIEW");

  // Date Filter Preset State
  const [timePreset, setTimePreset] = useState<"TODAY" | "7D" | "THIS_MONTH" | "LAST_MONTH" | "YTD">("THIS_MONTH");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Data State
  const [pnl, setPnl] = useState<PnLData | null>(null);
  const [transactions, setTransactions] = useState<FinancialTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Ledger Filter State
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Add Transaction Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [txType, setTxType] = useState<"EXPENSE" | "REVENUE">("EXPENSE");
  const [txCategory, setTxCategory] = useState("RENT_PROPERTY_LEASE");
  const [txTitle, setTxTitle] = useState("");
  const [txAmount, setTxAmount] = useState<number | "">("");
  const [txTaxAmount, setTxTaxAmount] = useState<number | "">(0);
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [txVendor, setTxVendor] = useState("");
  const [txPaymentMethod, setTxPaymentMethod] = useState("BANK_TRANSFER");
  const [txDescription, setTxDescription] = useState("");
  const [submittingTx, setSubmittingTx] = useState(false);

  // Apply Time Preset
  const applyPreset = (preset: "TODAY" | "7D" | "THIS_MONTH" | "LAST_MONTH" | "YTD") => {
    setTimePreset(preset);
    const now = new Date();
    let s = new Date();
    let e = new Date();

    if (preset === "TODAY") {
      // today
    } else if (preset === "7D") {
      s.setDate(now.getDate() - 7);
    } else if (preset === "THIS_MONTH") {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
      e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === "LAST_MONTH") {
      s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      e = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === "YTD") {
      s = new Date(now.getFullYear(), 0, 1);
    }

    setStartDate(s.toISOString().split("T")[0]);
    setEndDate(e.toISOString().split("T")[0]);
  };

  useEffect(() => {
    applyPreset("THIS_MONTH");
  }, []);

  // Fetch P&L and Transactions
  const fetchData = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const [pnlRes, txRes] = await Promise.all([
        fetch(`/api/restaurant/finance/pnl?startDate=${startDate}&endDate=${endDate}`),
        fetch(`/api/restaurant/finance/transactions?startDate=${startDate}&endDate=${endDate}`),
      ]);

      if (pnlRes.ok) {
        const pnlData = await pnlRes.json();
        setPnl(pnlData.pnl || null);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);
      }
    } catch {
      setStatusMessage("Error loading financial records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  // Trigger Automatic PO & Payroll Sync
  const handleAutoSync = async () => {
    if (!startDate || !endDate) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/restaurant/finance/sync-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(data.message || "Ledger synchronized with procurement and payroll.");
        fetchData();
      } else {
        setStatusMessage(`Sync failed: ${data.error}`);
      }
    } catch {
      setStatusMessage("Failed to synchronize automated transactions.");
    } finally {
      setSyncing(false);
    }
  };

  // Submit Manual Transaction
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || Number(txAmount) <= 0) return;
    setSubmittingTx(true);

    try {
      const res = await fetch("/api/restaurant/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: txType,
          category: txCategory,
          title: txTitle,
          amount: Number(txAmount),
          taxAmount: Number(txTaxAmount || 0),
          transactionDate: txDate,
          vendorOrPayer: txVendor || undefined,
          paymentMethod: txPaymentMethod,
          description: txDescription || undefined,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setTxTitle("");
        setTxAmount("");
        setTxDescription("");
        setTxVendor("");
        setStatusMessage("Financial transaction logged successfully.");
        fetchData();
      } else {
        const data = await res.json();
        setStatusMessage(`Error: ${data.error}`);
      }
    } catch {
      setStatusMessage("Failed to record transaction");
    } finally {
      setSubmittingTx(false);
    }
  };

  // CSV Export of Ledger
  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ["Date", "Type", "Category", "Title", "Vendor/Payer", "Payment Method", "Amount", "Tax", "Source"];
    const rows = filteredTransactions.map((tx) => [
      new Date(tx.transactionDate).toLocaleDateString(),
      tx.type,
      tx.category,
      `"${tx.title.replace(/"/g, '""')}"`,
      `"${(tx.vendorOrPayer || "").replace(/"/g, '""')}"`,
      tx.paymentMethod || "",
      tx.amount,
      tx.taxAmount,
      tx.source,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `General_Ledger_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Ledger Transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (ledgerTypeFilter !== "ALL" && tx.type !== ledgerTypeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        tx.title.toLowerCase().includes(q) ||
        (tx.vendorOrPayer && tx.vendorOrPayer.toLowerCase().includes(q)) ||
        tx.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <ModuleAccessGuard moduleKey="finance" moduleName="Finance & P&L Tracker" activeSection="Finance">
      <div className={`min-h-screen transition-colors duration-200 ${isDark ? "bg-[#0A0C12] text-white" : "bg-[#F5F5F7] text-slate-900"}`}>
        <RestaurantNavbar activeSection="Finance" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header & Sub-Module Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border ${
                isDark ? "bg-[#0071E3]/15 text-[#64B5FF] border-[#0071E3]/30" : "bg-blue-50 text-[#0071E3] border-blue-200"
              }`}>
                Financial Performance Hub
              </span>
              <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>•</span>
              <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Executive P&L Statement & Audited General Ledger
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1.5">
              Financial Performance &amp; P&amp;L
            </h1>
            <p className={`text-xs mt-1 max-w-2xl ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Real-time P&L intelligence, cost of goods, payroll actuals, and automated ledger reconciliation for operational profitability.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAutoSync}
              disabled={syncing}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                isDark
                  ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{syncing ? "Reconciling..." : "Sync POs & Payroll"}</span>
            </button>

            <button
              onClick={() => {
                setTxType("EXPENSE");
                setTxCategory("RENT_OCCUPANCY");
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span>Record Transaction</span>
            </button>
          </div>
        </div>

        {/* Sub-Module Navigation Segmented Pills */}
        <div
          className={`p-1.5 rounded-2xl border transition flex items-center gap-1 overflow-x-auto no-scrollbar ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <button
            className="px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex-shrink-0 bg-[#0071E3] text-white shadow-xs flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Financial Performance (P&L & Ledger)</span>
          </button>

          <button
            onClick={() => router.push(`/restaurant/${subdomain}/finance/bill-reminders`)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex-shrink-0 flex items-center gap-2 ${
              isDark ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Bill Reminders & Payables</span>
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`p-3.5 rounded-2xl border text-xs font-medium transition-all ${
            statusMessage.includes("Error") || statusMessage.includes("Failed")
              ? isDark ? "bg-rose-500/10 border-rose-500/20 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-700"
              : isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}>
            {statusMessage}
          </div>
        )}

        {/* TIME PRESETS & DATE FILTER BAR */}
        <div className={`p-4 rounded-3xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
          isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"
        }`}>
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {(["TODAY", "7D", "THIS_MONTH", "LAST_MONTH", "YTD"] as const).map((preset) => {
              const labelMap = {
                TODAY: "Today",
                "7D": "7 Days",
                THIS_MONTH: "This Month",
                LAST_MONTH: "Last Month",
                YTD: "Year to Date",
              };
              const active = timePreset === preset;
              return (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? isDark
                        ? "bg-white text-black shadow-xs font-bold"
                        : "bg-slate-900 text-white shadow-xs font-bold"
                      : isDark
                      ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                      : "text-slate-600 hover:text-slate-900 hover:bg-black/[0.04]"
                  }`}
                >
                  {labelMap[preset]}
                </button>
              );
            })}
          </div>

          {/* Custom Date Range Pickers */}
          <div className="flex items-center gap-2 text-xs w-full md:w-auto justify-end">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setTimePreset("" as any);
                setStartDate(e.target.value);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs ${
                isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setTimePreset("" as any);
                setEndDate(e.target.value);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs ${
                isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
          </div>
        </div>

        {/* 5 EXECUTIVE SUMMARY STAT CARDS */}
        {pnl && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Gross Revenue */}
            <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
              <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Gross Revenue
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                  ${pnl.metrics.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">POS &amp; direct revenue</span>
            </div>

            {/* COGS */}
            <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
              <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Cost of Goods (COGS)
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                  ${pnl.metrics.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {pnl.metrics.grossRevenue > 0 ? `${((pnl.metrics.totalCogs / pnl.metrics.grossRevenue) * 100).toFixed(1)}% of sales` : "Procurement actuals"}
              </span>
            </div>

            {/* Labor Costs */}
            <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
              <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Labor &amp; Wages
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                  ${pnl.metrics.totalLabor.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">{pnl.metrics.laborPercent}% of sales</span>
            </div>

            {/* Prime Cost % */}
            <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
              <div className="flex justify-between items-center">
                <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  Prime Cost Ratio
                </span>
                {pnl.metrics.grossRevenue > 0 && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    pnl.metrics.primeCostStatus === "OPTIMAL"
                      ? "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
                      : pnl.metrics.primeCostStatus === "ACCEPTABLE"
                      ? "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
                      : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-white/20"
                  }`}>
                    {pnl.metrics.primeCostStatus}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white">
                  {pnl.metrics.primeCostPercent}%
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Target: 55-60%</span>
            </div>

            {/* Net Operating Income (EBITDA) */}
            <div className={`p-4 rounded-2xl border col-span-2 sm:col-span-1 ${
              pnl.metrics.netOperatingIncome >= 0
                ? isDark ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                : isDark ? "bg-rose-950/20 border-rose-500/30 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-700"
            }`}>
              <span className={`text-[10px] font-semibold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Operating Income
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white">
                  ${pnl.metrics.netOperatingIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">{pnl.metrics.netProfitMarginPercent}% net margin</span>
            </div>
          </div>
        )}

        {/* Navigation Tabs (Executive P&L Statement & General Ledger) */}
        <div className="flex border-b border-black/[0.06] dark:border-white/[0.06] gap-2 pb-px overflow-x-auto">
          {[
            { key: "PNL_OVERVIEW", label: "Executive Statement" },
            { key: "LEDGER", label: `General Ledger (${filteredTransactions.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-slate-900 dark:border-white text-slate-900 dark:text-white"
                  : isDark
                  ? "border-transparent text-[#8F95A3] hover:text-white hover:bg-white/[0.02]"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-black/[0.02]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: EXECUTIVE P&L STATEMENT */}
        {activeTab === "PNL_OVERVIEW" && pnl && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Revenue & Cost of Goods */}
            <div className="space-y-6">
              {/* Revenue Streams */}
              <div className={`p-6 rounded-3xl border shadow-xs space-y-4 ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200"}`}>
                <div className="flex justify-between items-center pb-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">01. Revenue Streams</h3>
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                    ${pnl.metrics.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  {pnl.revenueStreams.map((r) => {
                    return (
                      <div key={r.category} className="space-y-1">
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                          <span>{r.displayName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono">{r.percentageOfRevenue}%</span>
                            <span className="font-mono font-medium">${r.amount.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, r.percentageOfRevenue))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COGS Breakdown */}
              <div className={`p-6 rounded-3xl border shadow-xs space-y-4 ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200"}`}>
                <div className="flex justify-between items-center pb-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">02. Cost of Goods Sold (COGS)</h3>
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                    ${pnl.metrics.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  {pnl.cogsBreakdown.map((c) => (
                    <div key={c.category} className="space-y-1">
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                        <span>{c.displayName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">{c.percentageOfRevenue}%</span>
                          <span className="font-mono font-medium">${c.amount.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, c.percentageOfRevenue))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: Labor & Overhead */}
            <div className="space-y-6">
              {/* Labor Costs */}
              <div className={`p-6 rounded-3xl border shadow-xs space-y-4 ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200"}`}>
                <div className="flex justify-between items-center pb-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">03. Labor &amp; Payroll Costs</h3>
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                    ${pnl.metrics.totalLabor.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  {pnl.laborBreakdown.map((l) => (
                    <div key={l.category} className="space-y-1">
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                        <span>{l.displayName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">{l.percentageOfCategory || 100}%</span>
                          <span className="font-mono font-medium">${l.amount.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#0071E3] transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, l.percentageOfCategory || 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operating Overhead (OpEx) */}
              <div className={`p-6 rounded-3xl border shadow-xs space-y-4 ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200"}`}>
                <div className="flex justify-between items-center pb-2 border-b border-black/[0.04] dark:border-white/[0.04]">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">04. Operating Overhead (OpEx)</h3>
                  <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                    ${pnl.metrics.totalOpex.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  {pnl.opexBreakdown.map((o) => (
                    <div key={o.category} className="space-y-1">
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                        <span>{o.displayName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">{o.percentageOfRevenue}%</span>
                          <span className="font-mono font-medium">${o.amount.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, o.percentageOfRevenue))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DETAILED FINANCIAL LEDGER */}
        {activeTab === "LEDGER" && (
          <div className={`rounded-3xl border overflow-hidden ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            {/* Filter Bar */}
            <div className="p-4 border-b border-black/[0.04] dark:border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-1 border border-black/[0.04] dark:border-white/[0.04] text-xs font-semibold">
                  {["ALL", "EXPENSE", "REVENUE"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setLedgerTypeFilter(type)}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        ledgerTypeFilter === type
                          ? isDark ? "bg-white/15 text-white shadow-xs" : "bg-white text-slate-900 shadow-xs"
                          : isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {type === "ALL" ? "All Entries" : type === "EXPENSE" ? "Expenses" : "Revenue"}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`px-3 py-1.5 rounded-xl border text-xs w-full sm:w-48 ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={handleExportCSV}
                  disabled={transactions.length === 0}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                    isDark ? "bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300" : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Table */}
            {filteredTransactions.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-400">
                No financial transactions recorded for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-slate-200 bg-slate-50"}`}>
                      <th className="p-3.5 font-semibold uppercase tracking-wider text-[10px]">Date &amp; Source</th>
                      <th className="p-3.5 font-semibold uppercase tracking-wider text-[10px]">Type</th>
                      <th className="p-3.5 font-semibold uppercase tracking-wider text-[10px]">Category</th>
                      <th className="p-3.5 font-semibold uppercase tracking-wider text-[10px]">Title &amp; Description</th>
                      <th className="p-3.5 font-semibold uppercase tracking-wider text-[10px]">Vendor / Payer</th>
                      <th className="p-3.5 font-semibold uppercase tracking-wider text-[10px] text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="font-mono font-medium">{new Date(tx.transactionDate).toLocaleDateString()}</div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{tx.source.replace(/_/g, " ")}</span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            tx.type === "REVENUE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] text-[10px] font-mono tracking-tight text-slate-400">
                            {tx.category.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-slate-900 dark:text-white">{tx.title}</div>
                          {tx.description && <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{tx.description}</div>}
                        </td>
                        <td className="p-3.5 text-slate-400 whitespace-nowrap">
                          {tx.vendorOrPayer || "—"}
                        </td>
                        <td className="p-3.5 text-right font-mono font-semibold whitespace-nowrap">
                          <span className={tx.type === "REVENUE" ? "text-emerald-400" : "text-slate-900 dark:text-white"}>
                            {tx.type === "REVENUE" ? "+" : "-"}${tx.amount.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* RECORD TRANSACTION MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
            isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
          }`}>
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold tracking-tight">Record Financial Transaction</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-900"}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-3.5 text-xs">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-1 border border-black/[0.04] dark:border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setTxType("EXPENSE")}
                  className={`py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    txType === "EXPENSE" ? "bg-rose-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Expense / Payout
                </button>
                <button
                  type="button"
                  onClick={() => setTxType("REVENUE")}
                  className={`py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    txType === "REVENUE" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Direct Revenue
                </button>
              </div>

              {/* Title & Amount */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium mb-1">Title / Ref</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electricity Bill or Catering"
                    value={txTitle}
                    onChange={(e) => setTxTitle(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={txAmount}
                    onChange={(e) => setTxAmount(parseFloat(e.target.value) || "")}
                    className={`w-full px-3 py-2 font-mono rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block font-medium mb-1">Financial Category</label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"}`}
                >
                  {txType === "EXPENSE" ? (
                    <>
                      <option value="FOOD_BEVERAGE_SUPPLIERS">Food &amp; Beverage Procurement (COGS)</option>
                      <option value="PACKAGING_CONSUMABLES">Packaging &amp; Consumables</option>
                      <option value="RENT_PROPERTY_LEASE">Rent &amp; Property Lease</option>
                      <option value="UTILITIES">Utilities (Electricity, Water, Gas)</option>
                      <option value="EQUIPMENT_FINANCING_LEASE">Equipment Financing / Lease</option>
                      <option value="MAINTENANCE_REPAIRS">Maintenance &amp; Repairs</option>
                      <option value="CLEANING_HYGIENE">Cleaning &amp; Hygiene Supplies</option>
                      <option value="TAXES_LICENSES">Taxes &amp; Municipal Licenses</option>
                      <option value="SAAS_TECHNOLOGY">SaaS &amp; Restaurant Tech</option>
                      <option value="MARKETING_ADVERTISING">Marketing &amp; Advertising</option>
                      <option value="INSURANCE">Commercial Insurance</option>
                      <option value="OTHER_OPERATIONAL_EXPENSES">Other Operational Overhead</option>
                    </>
                  ) : (
                    <>
                      <option value="POS_DINE_IN_SALES">Dine-In Direct Sales</option>
                      <option value="POS_TAKEAWAY_SALES">Takeaway &amp; Pickup</option>
                      <option value="POS_DELIVERY_SALES">Direct Delivery</option>
                      <option value="CATERING_EVENTS">Catering &amp; Private Events</option>
                      <option value="THIRD_PARTY_DELIVERY">Third-Party Delivery Payout</option>
                      <option value="MERCHANDISE_REBATES_OTHER">Vendor Rebates &amp; Other</option>
                    </>
                  )}
                </select>
              </div>

              {/* Date & Vendor */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Vendor / Payer</label>
                  <input
                    type="text"
                    placeholder="e.g. City Power Corp"
                    value={txVendor}
                    onChange={(e) => setTxVendor(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-medium mb-1">Notes / Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional context or invoice memo..."
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border resize-none ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTx}
                  className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold rounded-xl text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingTx ? "Saving..." : "Record Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ModuleAccessGuard>
  );
}
