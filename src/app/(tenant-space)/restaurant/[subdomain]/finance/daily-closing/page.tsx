"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import {
  DollarSign,
  Plus,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  Building2,
  FileText,
  ShieldCheck,
  History,
  Receipt,
  ArrowLeft,
} from "lucide-react";

interface Outlet {
  id: string;
  name: string;
}

interface CashAdjustment {
  id: string;
  adjustmentType: "CASH_IN" | "CASH_OUT";
  category: string;
  amount: number;
  reason: string;
  receiptUrl?: string;
  enteredBy: string;
  approvedBy?: string;
  approvalStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
  adjustmentDate: string;
  outlet?: { name: string };
}

interface DailyCashClosingRecord {
  id: string;
  closingDate: string;
  openingTillCash: number;
  cashSales: number;
  cashInTotal: number;
  cashOutTotal: number;
  expectedCash: number;
  actualCashCount: number;
  cashDifference: number;
  tomorrowOpeningCash: number;
  safeDeposit: number;
  notes?: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  closedBy: string;
  createdAt: string;
  outlet?: { name: string };
}

export default function DailyCashClosingPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Tab State
  const [activeTab, setActiveTab] = useState<"CLOSING_FORM" | "HISTORY">("CLOSING_FORM");

  // Selection & Date states
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>("");
  const [closingDate, setClosingDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Daily Closing Form state
  const [openingTillCash, setOpeningTillCash] = useState<number>(0);
  const [cashSales, setCashSales] = useState<number | "">("");
  const [actualCashCount, setActualCashCount] = useState<number | "">("");
  const [tomorrowOpeningCash, setTomorrowOpeningCash] = useState<number | "">(100);
  const [closingNotes, setClosingNotes] = useState<string>("");
  const [receiptUrl, setReceiptUrl] = useState<string>("");

  // Data states
  const [todayAdjustments, setTodayAdjustments] = useState<CashAdjustment[]>([]);
  const [historicalClosings, setHistoricalClosings] = useState<DailyCashClosingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Cash Adjustment Modal state
  const [showAdjModal, setShowAdjModal] = useState<boolean>(false);
  const [adjType, setAdjType] = useState<"CASH_IN" | "CASH_OUT">("CASH_OUT");
  const [adjCategory, setAdjCategory] = useState<string>("Personal Use");
  const [adjAmount, setAdjAmount] = useState<number | "">("");
  const [adjReason, setAdjReason] = useState<string>("");
  const [adjReceiptUrl, setAdjReceiptUrl] = useState<string>("");
  const [submittingAdj, setSubmittingAdj] = useState<boolean>(false);

  // Fetch Outlets
  useEffect(() => {
    async function loadOutlets() {
      try {
        const res = await fetch("/api/restaurant/outlets");
        if (res.ok) {
          const data = await res.json();
          const list = data.outlets || [];
          setOutlets(list);
          if (list.length > 0) setSelectedOutlet(list[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch outlets:", err);
      }
    }
    loadOutlets();
  }, []);

  // Fetch carried forward opening till cash for selected outlet
  useEffect(() => {
    if (!selectedOutlet) return;
    async function loadCarriedOpening() {
      try {
        const res = await fetch(
          `/api/restaurant/${subdomain}/daily-closing/latest-opening?outletId=${selectedOutlet}`
        );
        if (res.ok) {
          const data = await res.json();
          setOpeningTillCash(data.openingTillCash || 0);
        }
      } catch (err) {
        console.error("Error loading latest opening cash:", err);
      }
    }
    loadCarriedOpening();
  }, [selectedOutlet, subdomain]);

  // Fetch Today's Adjustments and Historical Closings
  const loadData = async () => {
    if (!selectedOutlet) return;
    setLoading(true);
    try {
      const adjRes = await fetch(
        `/api/restaurant/${subdomain}/cash-adjustments?outletId=${selectedOutlet}&startDate=${closingDate}&endDate=${closingDate}`
      );
      if (adjRes.ok) {
        const adjData = await adjRes.json();
        setTodayAdjustments(adjData.adjustments || []);
      }

      const closingRes = await fetch(
        `/api/restaurant/${subdomain}/daily-closing?outletId=${selectedOutlet}`
      );
      if (closingRes.ok) {
        const cData = await closingRes.json();
        setHistoricalClosings(cData.closings || []);
      }
    } catch (err) {
      console.error("Error loading daily closing data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedOutlet, closingDate, subdomain]);

  // Calculations for Closing Form
  const totalCashIn = todayAdjustments
    .filter((a) => a.adjustmentType === "CASH_IN" && a.approvalStatus !== "REJECTED")
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const totalCashOut = todayAdjustments
    .filter((a) => a.adjustmentType === "CASH_OUT" && a.approvalStatus !== "REJECTED")
    .reduce((sum, a) => sum + Number(a.amount), 0);

  const numericSales = typeof cashSales === "number" ? cashSales : 0;
  const numericActualCount = typeof actualCashCount === "number" ? actualCashCount : 0;
  const numericTomorrowTill = typeof tomorrowOpeningCash === "number" ? tomorrowOpeningCash : 0;

  // Expected Cash = Opening Till + Cash Sales + Cash In - Cash Out
  const expectedCash = openingTillCash + numericSales + totalCashIn - totalCashOut;
  // Cash Difference = Actual Cash Count - Expected Cash
  const cashDifference = numericActualCount - expectedCash;
  // Safe Deposit = Actual Cash Count - Tomorrow Opening Cash
  const safeDeposit = numericActualCount - numericTomorrowTill;

  // Handle Adding Cash Adjustment
  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjAmount || !adjReason || !selectedOutlet) return;

    setSubmittingAdj(true);
    try {
      const res = await fetch(`/api/restaurant/${subdomain}/cash-adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: selectedOutlet,
          adjustmentType: adjType,
          category: adjCategory,
          amount: Number(adjAmount),
          reason: adjReason,
          receiptUrl: adjReceiptUrl || undefined,
          adjustmentDate: closingDate,
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: "success", text: "Cash adjustment logged successfully." });
        setShowAdjModal(false);
        setAdjAmount("");
        setAdjReason("");
        setAdjReceiptUrl("");
        loadData();
      } else {
        const data = await res.json();
        setStatusMessage({ type: "error", text: data.error || "Failed to record adjustment." });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Error submitting adjustment." });
    } finally {
      setSubmittingAdj(false);
    }
  };

  // Handle Approving/Rejecting Adjustment
  const handleApproveAdjustment = async (adjId: string, status: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch(`/api/restaurant/${subdomain}/cash-adjustments/${adjId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setStatusMessage({ type: "success", text: `Adjustment ${status.toLowerCase()}.` });
        loadData();
      } else {
        const data = await res.json();
        setStatusMessage({ type: "error", text: data.error || "Failed to update approval." });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Error updating approval status." });
    }
  };

  // Handle Submitting Daily Closing Report
  const handleSubmitClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof actualCashCount !== "number") {
      setStatusMessage({ type: "error", text: "Please enter physical cash count." });
      return;
    }

    if (Math.abs(cashDifference) > 0.01 && !closingNotes.trim()) {
      setStatusMessage({
        type: "error",
        text: `Notes required for cash variance of $${cashDifference.toFixed(2)}.`,
      });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/restaurant/${subdomain}/daily-closing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: selectedOutlet,
          closingDate,
          openingTillCash,
          cashSales: numericSales,
          actualCashCount: numericActualCount,
          tomorrowOpeningCash: numericTomorrowTill,
          notes: closingNotes || undefined,
          receiptUrls: receiptUrl ? [receiptUrl] : undefined,
        }),
      });

      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `Daily register closed. Safe deposit: $${safeDeposit.toFixed(2)}`,
        });
        loadData();
      } else {
        const data = await res.json();
        setStatusMessage({ type: "error", text: data.error || "Failed to submit closing report." });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Error submitting report." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModuleAccessGuard requiredModule="finance" moduleName="Daily Cash Register Closing" activeSection="Finance">
      <div className={`min-h-screen transition-colors duration-200 ${isDark ? "bg-[#0A0C12] text-white" : "bg-[#F8F9FA] text-slate-900"}`}>
        <RestaurantNavbar activeSection="Finance" />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 border-slate-200 dark:border-white/[0.08]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => router.push(`/restaurant/${subdomain}/finance`)}
                  className={`text-xs font-semibold flex items-center gap-1 hover:underline ${
                    isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Finance
                </button>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Cash Management & Register Audit
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Daily Register Closing</h1>
              <p className={`text-xs mt-1 max-w-2xl ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Reconcile physical till counts, track non-sales cash adjustments, verify variances, and record safe deposits.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAdjModal(true)}
                className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Paid Out / Cash Addition
              </button>
            </div>
          </div>

          {/* Alert Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl flex items-center gap-3 text-xs font-medium border ${
                statusMessage.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="flex-1">{statusMessage.text}</span>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-[11px] underline opacity-75 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Filter & View Switcher Bar */}
          <div
            className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
            }`}
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Outlet:</span>
                <select
                  value={selectedOutlet}
                  onChange={(e) => setSelectedOutlet(e.target.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs border font-medium outline-none ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-slate-200"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date:</span>
                <input
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs border font-medium outline-none ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-slate-200"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                />
              </div>
            </div>

            {/* Segmented Control */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.04]">
              <button
                onClick={() => setActiveTab("CLOSING_FORM")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "CLOSING_FORM"
                    ? isDark ? "bg-white/15 text-white shadow-xs" : "bg-white text-slate-900 shadow-xs"
                    : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Register Closing Form
              </button>
              <button
                onClick={() => setActiveTab("HISTORY")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "HISTORY"
                    ? isDark ? "bg-white/15 text-white shadow-xs" : "bg-white text-slate-900 shadow-xs"
                    : isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Audit History ({historicalClosings.length})
              </button>
            </div>
          </div>

          {activeTab === "CLOSING_FORM" ? (
            <div className="space-y-6">
              {/* Executive Metrics Overview Bar */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"}`}>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Opening Till Float</span>
                  <div className="text-2xl font-bold font-mono mt-1 text-slate-900 dark:text-white">
                    ${openingTillCash.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Float carried from yesterday</span>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"}`}>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Till Cash Additions</span>
                  <div className="text-2xl font-bold font-mono mt-1 text-emerald-500">
                    +${totalCashIn.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Float top-ups &amp; returned change</span>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"}`}>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Paid Outs (Petty Cash)</span>
                  <div className="text-2xl font-bold font-mono mt-1 text-rose-500">
                    -${totalCashOut.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Emergency buys &amp; supplier payouts</span>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"}`}>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Expected Till Cash</span>
                  <div className="text-2xl font-bold font-mono mt-1 text-[#0071E3] dark:text-[#64B5FF]">
                    ${expectedCash.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Opening + Sales + In - Out</span>
                </div>
              </div>

              {/* Main Content Grid: Form (8 cols) & Adjustments Panel (4 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form Column */}
                <div className="lg:col-span-8">
                  <form onSubmit={handleSubmitClosing} className={`p-6 rounded-3xl border space-y-6 ${
                    isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
                  }`}>
                    <div className="border-b pb-4 border-slate-200 dark:border-white/[0.08]">
                      <h2 className="text-base font-semibold">Daily Till Reconciliation Form</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Enter today's cash sales and physical till count to compute safe deposit and variance.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Cash Sales */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5">
                          Today's POS Cash Sales ($)
                        </label>
                        <div className="relative">
                          <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={cashSales}
                            onChange={(e) =>
                              setCashSales(e.target.value === "" ? "" : parseFloat(e.target.value))
                            }
                            className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm font-semibold font-mono outline-none ${
                              isDark ? "bg-[#0A0C12] border-white/[0.08] text-white focus:border-[#0071E3]" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#0071E3]"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Actual Cash Count */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5">
                          Actual Physical Till Count ($) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Count cash in till..."
                            value={actualCashCount}
                            onChange={(e) =>
                              setActualCashCount(
                                e.target.value === "" ? "" : parseFloat(e.target.value)
                              )
                            }
                            required
                            className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm font-semibold font-mono outline-none ${
                              isDark ? "bg-[#0A0C12] border-white/[0.08] text-white focus:border-[#0071E3]" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#0071E3]"
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Tomorrow Opening Cash */}
                      <div>
                        <label className="block text-xs font-medium mb-1.5">
                          Tomorrow's Till Float ($)
                        </label>
                        <div className="relative">
                          <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="100.00"
                            value={tomorrowOpeningCash}
                            onChange={(e) =>
                              setTomorrowOpeningCash(
                                e.target.value === "" ? "" : parseFloat(e.target.value)
                              )
                            }
                            className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm font-semibold font-mono outline-none ${
                              isDark ? "bg-[#0A0C12] border-white/[0.08] text-white focus:border-[#0071E3]" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-[#0071E3]"
                            }`}
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1 block">Retained in drawer for tomorrow's opening</span>
                      </div>

                      {/* Computed Summary Badges */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2.5 rounded-xl border bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.04] dark:border-white/[0.04] text-xs">
                          <span className="text-slate-400">Till Variance:</span>
                          <span className={`font-mono font-bold ${
                            cashDifference === 0
                              ? "text-slate-400"
                              : cashDifference < 0
                              ? "text-rose-500"
                              : "text-emerald-500"
                          }`}>
                            {cashDifference < 0
                              ? `-$${Math.abs(cashDifference).toFixed(2)} (Shortage)`
                              : cashDifference > 0
                              ? `+$${cashDifference.toFixed(2)} (Overage)`
                              : "$0.00 (Balanced)"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl border bg-[#0071E3]/10 border-[#0071E3]/20 text-xs">
                          <span className="font-semibold text-[#0071E3] dark:text-[#64B5FF]">Drop Safe Deposit:</span>
                          <span className="font-mono font-bold text-[#0071E3] dark:text-[#64B5FF]">
                            ${safeDeposit > 0 ? safeDeposit.toFixed(2) : "0.00"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Step-by-Step Math Breakdown Helper */}
                    <div className="p-3.5 rounded-2xl border bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.06] dark:border-white/[0.06] text-xs space-y-2">
                      <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between border-b pb-1.5 border-black/[0.04] dark:border-white/[0.04]">
                        <span>Calculation Breakdown (Live Explanation)</span>
                        <span className="text-[10px] text-slate-400 font-normal">Formula Proof</span>
                      </div>

                      <div className="space-y-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        <div className="flex justify-between">
                          <span>1. System Expected Cash:</span>
                          <span>
                            ${openingTillCash.toFixed(0)} (Float) + ${numericSales.toFixed(0)} (Sales) + ${totalCashIn.toFixed(0)} (In) - ${totalCashOut.toFixed(0)} (Out) = <strong className="text-[#0071E3] dark:text-[#64B5FF]">${expectedCash.toFixed(2)}</strong>
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span>2. Till Variance:</span>
                          <span>
                            ${numericActualCount.toFixed(0)} (Count) - ${expectedCash.toFixed(0)} (Expected) = <strong className={cashDifference < 0 ? "text-rose-500" : cashDifference > 0 ? "text-emerald-500" : "text-slate-400"}>{cashDifference >= 0 ? `+$${cashDifference.toFixed(2)} Overage` : `-$${Math.abs(cashDifference).toFixed(2)} Shortage`}</strong>
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span>3. Drop Safe Deposit:</span>
                          <span>
                            ${numericActualCount.toFixed(0)} (Count) - ${numericTomorrowTill.toFixed(0)} (Tomorrow Float) = <strong className="text-slate-800 dark:text-slate-200">${safeDeposit > 0 ? safeDeposit.toFixed(2) : "0.00"} Drop</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Notes Input */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5">
                        Notes / Reason for Variance{" "}
                        {Math.abs(cashDifference) > 0.01 && (
                          <span className="text-rose-500 font-bold">(Required)</span>
                        )}
                      </label>
                      <textarea
                        rows={2}
                        placeholder="State reason for any till variance..."
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                          isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                        }`}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      <span>Lock &amp; Submit Daily Register Closing</span>
                    </button>
                  </form>
                </div>

                {/* Cash Adjustments Side Panel (4 cols) */}
                <div className="lg:col-span-4">
                  <div className={`p-5 rounded-3xl border space-y-4 ${
                    isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
                  }`}>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/[0.08]">
                      <div>
                        <h3 className="text-sm font-semibold">Today's Paid Outs &amp; Additions</h3>
                        <p className="text-[11px] text-slate-400">Petty cash &amp; non-sales transactions</p>
                      </div>
                      <button
                        onClick={() => setShowAdjModal(true)}
                        className="p-1.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {todayAdjustments.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400 border border-dashed rounded-2xl border-slate-200 dark:border-white/[0.08]">
                        No adjustments logged for this date.
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                        {todayAdjustments.map((adj) => (
                          <div
                            key={adj.id}
                            className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                              isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                  adj.adjustmentType === "CASH_IN"
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : "bg-rose-500/10 text-rose-500"
                                }`}
                              >
                                {adj.adjustmentType === "CASH_IN" ? "+ CASH IN" : "- CASH OUT"}
                              </span>
                              <span className="font-mono font-bold text-sm">
                                ${Number(adj.amount).toFixed(2)}
                              </span>
                            </div>

                            <div className="font-medium text-slate-800 dark:text-slate-200">{adj.category}</div>
                            <div className="text-[11px] text-slate-400 italic">"{adj.reason}"</div>

                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                              <span className="text-slate-400">
                                Approval:{" "}
                                <strong className={
                                  adj.approvalStatus === "APPROVED"
                                    ? "text-emerald-500"
                                    : adj.approvalStatus === "PENDING"
                                    ? "text-amber-500"
                                    : "text-slate-400"
                                }>
                                  {adj.approvalStatus}
                                </strong>
                              </span>

                              {adj.approvalStatus === "PENDING" && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleApproveAdjustment(adj.id, "APPROVED")}
                                    className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveAdjustment(adj.id, "REJECTED")}
                                    className="px-2 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Historical Closings Table View */
            <div className={`p-6 rounded-3xl border space-y-4 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-sm"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Historical Register Closing Audits</h2>
                  <p className="text-xs text-slate-400">Audited daily register closing reports and physical till reconciliations.</p>
                </div>
              </div>

              {historicalClosings.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  No historical closing records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className={`border-b ${isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-slate-200 bg-slate-50"}`}>
                        <th className="p-3 font-semibold uppercase tracking-wider text-[10px]">Date</th>
                        <th className="p-3 font-semibold uppercase tracking-wider text-[10px]">Opening Till</th>
                        <th className="p-3 font-semibold uppercase tracking-wider text-[10px]">POS Sales</th>
                        <th className="p-3 font-semibold uppercase tracking-wider text-[10px]">Cash In</th>
                        <th className="p-3 font-semibold uppercase tracking-wider text-[10px]">Cash Out</th>
                        <th className="p-3 font-semibold uppercase tracking-wider text-[10px]">Expected</th>
                        <th className="p-3 font-semibold uppercase tracking-wider text-[10px]">Actual Count</th>
                        <th className="p-3 font-semibold uppercase tracking-wider text-[10px]">Variance</th>
                        <th className="p-3 font-semibold uppercase tracking-wider text-[10px]">Safe Deposit</th>
                        <th className="p-3 font-semibold uppercase tracking-wider text-[10px]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {historicalClosings.map((c) => {
                        const diff = Number(c.cashDifference);
                        return (
                          <tr key={c.id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.02]">
                            <td className="p-3 font-mono font-medium">
                              {new Date(c.closingDate).toLocaleDateString()}
                            </td>
                            <td className="p-3 font-mono">${Number(c.openingTillCash).toFixed(2)}</td>
                            <td className="p-3 font-mono text-emerald-500">${Number(c.cashSales).toFixed(2)}</td>
                            <td className="p-3 font-mono text-emerald-500">+${Number(c.cashInTotal).toFixed(2)}</td>
                            <td className="p-3 font-mono text-rose-500">-${Number(c.cashOutTotal).toFixed(2)}</td>
                            <td className="p-3 font-mono font-bold">${Number(c.expectedCash).toFixed(2)}</td>
                            <td className="p-3 font-mono font-bold">${Number(c.actualCashCount).toFixed(2)}</td>
                            <td className="p-3 font-mono font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                diff === 0
                                  ? "bg-slate-500/10 text-slate-400"
                                  : diff < 0
                                  ? "bg-rose-500/10 text-rose-500"
                                  : "bg-emerald-500/10 text-emerald-500"
                              }`}>
                                {diff < 0
                                  ? `-$${Math.abs(diff).toFixed(2)}`
                                  : diff > 0
                                  ? `+$${diff.toFixed(2)}`
                                  : "$0.00"}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-[#0071E3] dark:text-[#64B5FF] font-bold">
                              ${Number(c.safeDeposit).toFixed(2)}
                            </td>
                            <td className="p-3 font-mono text-[10px]">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold">
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Modal: Add Cash Adjustment */}
        {showAdjModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xl animate-in fade-in duration-150">
            <div
              className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/[0.08]">
                <h3 className="text-sm font-semibold">Record Paid Out or Cash Addition</h3>
                <button
                  onClick={() => setShowAdjModal(false)}
                  className="text-slate-400 hover:text-white text-base font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddAdjustment} className="space-y-3.5 text-xs">
                {/* Type Switcher */}
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] p-1 border border-black/[0.04] dark:border-white/[0.04]">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjType("CASH_OUT");
                      setAdjCategory("Emergency Purchase / Supplies");
                    }}
                    className={`py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      adjType === "CASH_OUT"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Paid Out (Cash Removed)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjType("CASH_IN");
                      setAdjCategory("Till Float Addition");
                    }}
                    className={`py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      adjType === "CASH_IN"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Till Cash Addition
                  </button>
                </div>

                {/* Category */}
                <div>
                  <label className="block font-medium mb-1">Category</label>
                  <select
                    value={adjCategory}
                    onChange={(e) => setAdjCategory(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    {adjType === "CASH_OUT" ? (
                      <>
                        <option value="Emergency Purchase / Supplies">Emergency Produce / Local Store Buy</option>
                        <option value="Vendor / Supplier Bill">Vendor / Supplier COD Bill</option>
                        <option value="Personal Use">Owner / Manager Cash Withdrawal (Requires Approval)</option>
                        <option value="Employee Expense">Employee Expense Reimbursement</option>
                        <option value="Other Paid Out">Other Paid Out</option>
                      </>
                    ) : (
                      <>
                        <option value="Till Float Addition">Till Float Top-Up (Manager Addition)</option>
                        <option value="Unspent Petty Cash Returned">Unspent Petty Cash Returned</option>
                        <option value="Correction">Till Balance Correction</option>
                        <option value="Other Addition">Other Cash Addition</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block font-medium mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={adjAmount}
                    onChange={(e) =>
                      setAdjAmount(e.target.value === "" ? "" : parseFloat(e.target.value))
                    }
                    required
                    className={`w-full px-3 py-2 font-mono font-semibold rounded-xl border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="block font-medium mb-1">Reason / Note</label>
                  <textarea
                    rows={2}
                    placeholder="Reason for cash movement..."
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                {adjCategory.includes("Personal") && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-500">
                    Personal Use withdrawals require manager approval before posting.
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                  <button
                    type="button"
                    onClick={() => setShowAdjModal(false)}
                    className="px-4 py-2 font-semibold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdj}
                    className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {submittingAdj ? "Saving..." : "Save Adjustment"}
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
