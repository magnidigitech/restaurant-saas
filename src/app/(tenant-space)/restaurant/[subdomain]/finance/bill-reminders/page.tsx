"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface EvaluatedBill {
  id: string;
  title: string;
  category: string;
  vendorOrInstitution: string;
  accountLast4?: string | null;
  amount: number;
  adjustedAmount?: number | null;
  effectiveAmount: number;
  dueDate: string;
  reminderDaysBefore: number;
  status: "UPCOMING" | "DUE_SOON" | "OVERDUE" | "PAID" | "DEFERRED";
  daysUntilDue: number;
  isUrgentReminder: boolean;
  notes?: string | null;
  receiptOrInvoiceUrl?: string | null;
  autoConvertToExpense: boolean;
  isRecurring: boolean;
  recurringFrequency?: string | null;
  paidAt?: string | null;
  paidAmount?: number | null;
  paymentMethod?: string | null;
  financialTxId?: string | null;
  outletName?: string | null;
  outletId?: string | null;
}

interface BillsSummary {
  totalPendingLiabilities: number;
  totalDueNext7Days: number;
  totalDueNext30Days: number;
  totalOverdue: number;
  totalPaidThisMonth: number;
  urgentAlertCount: number;
  bills: EvaluatedBill[];
}

const CATEGORY_MAP: Record<string, { label: string; badgeColor: string }> = {
  ALL: { label: "All Categories", badgeColor: "bg-slate-500/10 text-slate-400" },
  FOOD_BEVERAGE_SUPPLIERS: { label: "Vendor / F&B Supplies", badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  VENDOR_INVOICE: { label: "Vendor Invoice", badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  MAINTENANCE_REPAIRS: { label: "Services & AMC", badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  UTILITIES: { label: "Utilities & Electricity", badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  UTILITY: { label: "Utilities", badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  RENT_PROPERTY_LEASE: { label: "Rent & Lease", badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  RENT_OCCUPANCY: { label: "Rent & Occupancy", badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  CREDIT_CARD: { label: "Credit Card / EMI", badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  BANKING_PAYMENT_PROCESSING: { label: "Banking & Processing", badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  SAAS_TECHNOLOGY: { label: "Software & SaaS", badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  SUBSCRIPTION: { label: "Subscriptions", badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  TAXES_LICENSES: { label: "Taxes & Licenses", badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  TAX_GOVERNMENT: { label: "Government Taxes", badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  INSURANCE: { label: "Insurance", badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  OTHER_OPERATIONAL_EXPENSES: { label: "Other OpEx", badgeColor: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  OTHER: { label: "Other", badgeColor: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

export default function AppleBillRemindersPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);
  const router = useRouter();
  const { isDark } = useTheme();

  const [summary, setSummary] = useState<BillsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [outlets, setOutlets] = useState<Array<{ id: string; name: string }>>([]);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<EvaluatedBill | null>(null);
  const [showEditModal, setShowEditModal] = useState<EvaluatedBill | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // New Bill Form State
  const [formData, setFormData] = useState({
    title: "",
    category: "FOOD_BEVERAGE_SUPPLIERS",
    billType: "PO_INVOICE",
    vendorOrInstitution: "",
    accountLast4: "",
    amount: "",
    taxAmount: "",
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    reminderDaysBefore: 5,
    paymentTerms: "Net 30",
    paymentMethod: "Bank Transfer",
    paymentAccount: "Primary Business Current A/C",
    outletId: "",
    poNumber: "",
    notes: "",
    receiptOrInvoiceUrl: "",
    autoConvertToExpense: true,
    isRecurring: false,
    recurringFrequency: "MONTHLY",
  });

  // Pay Modal Form State
  const [payFormData, setPayFormData] = useState({
    paidAmount: "",
    paymentMethod: "Bank Transfer",
    paymentReference: "",
    paidAt: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchBillsData = async () => {
    setLoading(true);
    try {
      const [resBills, resOutlets] = await Promise.all([
        fetch("/api/restaurant/finance/bills"),
        fetch("/api/restaurant/outlets"),
      ]);

      const dataBills = await resBills.json();
      const dataOutlets = await resOutlets.json();

      if (resBills.ok && dataBills.success) {
        setSummary(dataBills.summary);
      } else {
        setError(dataBills.error || "Failed to load bill reminders");
      }

      if (resOutlets.ok && dataOutlets.outlets) {
        setOutlets(dataOutlets.outlets);
      }
    } catch {
      setError("Network error fetching bill reminders data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillsData();
  }, [subdomain]);

  // Filtered bills
  const filteredBills = useMemo(() => {
    if (!summary?.bills) return [];
    return summary.bills.filter((bill) => {
      const matchesSearch =
        bill.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.vendorOrInstitution.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (bill.accountLast4 && bill.accountLast4.includes(searchQuery)) ||
        (bill.notes && bill.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === "ALL" ||
        bill.category === selectedCategory ||
        (selectedCategory === "VENDOR_INVOICE" && (bill.category === "FOOD_BEVERAGE_SUPPLIERS" || bill.category === "VENDOR_INVOICE")) ||
        (selectedCategory === "UTILITIES" && (bill.category === "UTILITIES" || bill.category === "UTILITY")) ||
        (selectedCategory === "RENT_PROPERTY_LEASE" && (bill.category === "RENT_PROPERTY_LEASE" || bill.category === "RENT_OCCUPANCY")) ||
        (selectedCategory === "CREDIT_CARD" && (bill.category === "CREDIT_CARD" || bill.category === "BANKING_PAYMENT_PROCESSING"));

      const matchesStatus =
        selectedStatus === "ALL" ||
        (selectedStatus === "PENDING" && bill.status !== "PAID") ||
        bill.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [summary, searchQuery, selectedCategory, selectedStatus]);

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const baseAmt = parseFloat(formData.amount) || 0;
      const taxAmt = parseFloat(formData.taxAmount) || 0;
      const totalAmount = baseAmt + taxAmt;

      const formattedNotes = [
        formData.poNumber ? `PO Ref: ${formData.poNumber}` : null,
        formData.paymentTerms ? `Terms: ${formData.paymentTerms}` : null,
        formData.paymentAccount ? `Account: ${formData.paymentAccount}` : null,
        formData.notes ? formData.notes : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const res = await fetch("/api/restaurant/finance/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          category: formData.category,
          vendorOrInstitution: formData.vendorOrInstitution,
          accountLast4: formData.accountLast4 || undefined,
          amount: totalAmount,
          dueDate: formData.dueDate,
          reminderDaysBefore: Number(formData.reminderDaysBefore) || 5,
          notes: formattedNotes || undefined,
          receiptOrInvoiceUrl: formData.receiptOrInvoiceUrl || undefined,
          autoConvertToExpense: formData.autoConvertToExpense,
          isRecurring: formData.isRecurring,
          recurringFrequency: formData.isRecurring ? formData.recurringFrequency : undefined,
          outletId: formData.outletId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule bill reminder");

      showToast("Bill reminder successfully scheduled & tracked!");
      setShowCreateModal(false);
      setFormData({
        title: "",
        category: "FOOD_BEVERAGE_SUPPLIERS",
        billType: "PO_INVOICE",
        vendorOrInstitution: "",
        accountLast4: "",
        amount: "",
        taxAmount: "",
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        reminderDaysBefore: 5,
        paymentTerms: "Net 30",
        paymentMethod: "Bank Transfer",
        paymentAccount: "Primary Business Current A/C",
        outletId: "",
        poNumber: "",
        notes: "",
        receiptOrInvoiceUrl: "",
        autoConvertToExpense: true,
        isRecurring: false,
        recurringFrequency: "MONTHLY",
      });
      await fetchBillsData();
    } catch (err: any) {
      alert(err.message || "Failed to create bill");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayModal) return;
    setActionLoading(true);

    try {
      const res = await fetch("/api/restaurant/finance/bills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: showPayModal.id,
          action: "MARK_PAID",
          paidAmount: parseFloat(payFormData.paidAmount) || showPayModal.effectiveAmount,
          paymentMethod: payFormData.paymentMethod,
          paidAt: payFormData.paidAt,
          notes: payFormData.paymentReference
            ? `${showPayModal.notes || ""} | Ref: ${payFormData.paymentReference}`.trim()
            : showPayModal.notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to settle bill");

      showToast("Bill marked as paid and reconciled into the General Ledger!");
      setShowPayModal(null);
      await fetchBillsData();
    } catch (err: any) {
      alert(err.message || "Error settling bill");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBill = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bill reminder?")) return;
    try {
      const res = await fetch(`/api/restaurant/finance/bills?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete bill");
      showToast("Bill reminder removed");
      await fetchBillsData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSyncAuto = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/restaurant/finance/sync-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: new Date(Date.now() - 90 * 86400000).toISOString(),
          endDate: new Date(Date.now() + 60 * 86400000).toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Synchronized PO invoices & payroll liabilities!");
        await fetchBillsData();
      } else {
        showToast(data.error || "Sync failed", "error");
      }
    } catch {
      showToast("Error syncing procurement & payroll", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ModuleAccessGuard moduleKey="finance" moduleName="Finance & P&L Tracker" activeSection="Finance">
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-[#07090E] text-white" : "bg-[#F5F5F7] text-slate-900"}`}>
        <RestaurantNavbar activeSection="Finance" />

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className={`px-4 py-3 rounded-2xl border shadow-xl flex items-center gap-3 text-xs font-semibold ${
              toastMessage.type === "error"
                ? isDark ? "bg-[#121622] border-rose-500/30 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-800"
                : isDark ? "bg-[#121622] border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}>
              <span>{toastMessage.type === "error" ? "⚠️" : "✓"}</span>
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Header & Sub-Module Switcher */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                  isDark ? "bg-[#0071E3]/15 text-[#64B5FF] border-[#0071E3]/30" : "bg-blue-50 text-[#0071E3] border-blue-200"
                }`}>
                  Accounts Payable & Reminders
                </span>
                <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>•</span>
                <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Vendor Invoices, Utilities & Subscriptions
                </span>
              </div>
              <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Bill Reminders & Payables
              </h1>
              <p className={`text-xs mt-1 max-w-2xl ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Automated obligation tracking for vendor bills, service AMCs, utilities, and corporate credit cards with proactive due alerts and ledger sync.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleSyncAuto}
                disabled={actionLoading}
                className={`px-3.5 py-2 text-xs font-medium rounded-xl border transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  isDark
                    ? "bg-[#121622] border-white/[0.08] text-white hover:bg-white/[0.04]"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
                }`}
              >
                <span>🔄</span>
                <span>Sync PO Bills</span>
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>+</span>
                <span>Schedule Bill Reminder</span>
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
              onClick={() => router.push(`/restaurant/${subdomain}/finance`)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex-shrink-0 flex items-center gap-2 ${
                isDark ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Financial Performance (P&L & Ledger)</span>
            </button>

            <button
              className="px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex-shrink-0 bg-[#0071E3] text-white shadow-xs flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Bill Reminders & Payables</span>
              {summary && summary.bills.filter((b) => b.status !== "PAID").length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-white/20 rounded-full font-bold">
                  {summary.bills.filter((b) => b.status !== "PAID").length}
                </span>
              )}
            </button>
          </div>

          {/* Top 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={`p-5 rounded-2xl border transition ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Total Pending Payables
              </span>
              <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                ${summary?.totalPendingLiabilities.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
              </p>
              <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Active unsettled business obligations
              </p>
            </div>

            <div
              className={`p-5 rounded-2xl border transition ${
                (summary?.totalOverdue || 0) > 0
                  ? isDark
                    ? "bg-rose-500/[0.08] border-rose-500/30"
                    : "bg-rose-50 border-rose-200"
                  : isDark
                  ? "bg-[#121622]/60 border-white/[0.06]"
                  : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className={`text-[11px] font-medium uppercase tracking-wider ${
                  (summary?.totalOverdue || 0) > 0 ? "text-rose-500" : isDark ? "text-[#8F95A3]" : "text-slate-500"
                }`}>
                  Overdue Obligations
                </span>
                {(summary?.totalOverdue || 0) > 0 && (
                  <span className="text-xs text-rose-500 font-bold animate-pulse">⚠️ Action Required</span>
                )}
              </div>
              <p className={`text-2xl font-bold tracking-tight mt-1.5 ${(summary?.totalOverdue || 0) > 0 ? "text-rose-500" : isDark ? "text-white" : "text-slate-900"}`}>
                ${summary?.totalOverdue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
              </p>
              <p className={`text-[11px] mt-1 ${(summary?.totalOverdue || 0) > 0 ? "text-rose-500/80" : isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Past due payment deadline
              </p>
            </div>

            <div
              className={`p-5 rounded-2xl border transition ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Due in Next 7 Days
              </span>
              <p className="text-2xl font-bold tracking-tight mt-1.5 text-amber-500">
                ${summary?.totalDueNext7Days.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
              </p>
              <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Immediate cash runway required
              </p>
            </div>

            <div
              className={`p-5 rounded-2xl border transition ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Settled This Month
              </span>
              <p className="text-2xl font-bold tracking-tight mt-1.5 text-emerald-500">
                ${summary?.totalPaidThisMonth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
              </p>
              <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Reconciled with General Ledger
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            className={`p-4 rounded-3xl border transition space-y-3 ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search by Payee, Invoice #, PO #, Card last 4, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full rounded-xl px-3.5 py-2 text-xs transition border focus:outline-none focus:border-[#0071E3] ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-white placeholder-[#5E6573]"
                      : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className={`border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-[#C5C9D3]" : "bg-[#F5F5F7] border-slate-200 text-slate-700"
                  }`}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">All Pending / Unpaid</option>
                  <option value="DUE_SOON">Due Soon (7 Days)</option>
                  <option value="OVERDUE">Overdue Only</option>
                  <option value="UPCOMING">Upcoming</option>
                  <option value="PAID">Paid / Settled</option>
                </select>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {[
                { key: "ALL", label: "All Bills" },
                { key: "FOOD_BEVERAGE_SUPPLIERS", label: "Vendor & PO Invoices" },
                { key: "MAINTENANCE_REPAIRS", label: "Services & AMC" },
                { key: "UTILITIES", label: "Utilities" },
                { key: "CREDIT_CARD", label: "Credit Cards & EMIs" },
                { key: "RENT_PROPERTY_LEASE", label: "Rent & Lease" },
                { key: "SAAS_TECHNOLOGY", label: "Software & SaaS" },
                { key: "TAXES_LICENSES", label: "Taxes & Govt" },
              ].map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSelectedCategory(c.key)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition cursor-pointer flex-shrink-0 ${
                    selectedCategory === c.key
                      ? "bg-[#0071E3] text-white shadow-xs"
                      : isDark
                      ? "bg-[#0A0C12] text-[#8F95A3] border border-white/[0.06] hover:text-white"
                      : "bg-[#F5F5F7] text-slate-600 border border-slate-200 hover:text-slate-900"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bills List Table */}
          <div
            className={`rounded-3xl border overflow-hidden transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                  Payables Schedule & Active Reminders
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Showing {filteredBills.length} registered business obligations.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[#8F95A3]">
                Loading bill reminders...
              </div>
            ) : filteredBills.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#0071E3] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                  No Bill Reminders Matching Filter
                </h4>
                <p className={`text-xs max-w-sm mx-auto ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  No upcoming or overdue payables found. Click "Schedule Bill Reminder" to track a vendor invoice, service AMC, or utility obligation.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                      isDark ? "bg-white/[0.02] border-white/[0.06] text-[#8F95A3]" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}>
                      <th className="py-3.5 px-6">Reminder & Category</th>
                      <th className="py-3.5 px-4">Payee / Vendor</th>
                      <th className="py-3.5 px-4">Payment Account</th>
                      <th className="py-3.5 px-4 text-right">Payable Amount</th>
                      <th className="py-3.5 px-4">Due Date & Timeline</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredBills.map((bill) => {
                      const catInfo = CATEGORY_MAP[bill.category] || CATEGORY_MAP.OTHER;
                      const dueDateFormatted = new Date(bill.dueDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      const isOverdue = bill.status === "OVERDUE" || (bill.status !== "PAID" && bill.daysUntilDue < 0);
                      const isDueSoon = bill.status === "DUE_SOON" || (bill.status !== "PAID" && bill.daysUntilDue >= 0 && bill.daysUntilDue <= 7);

                      return (
                        <tr
                          key={bill.id}
                          className={`transition ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50/80"}`}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${catInfo.badgeColor}`}>
                                {catInfo.label}
                              </span>
                              {bill.isRecurring && (
                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                  isDark ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-purple-50 text-purple-700 border-purple-200"
                                }`}>
                                  🔁 {bill.recurringFrequency || "Monthly"}
                                </span>
                              )}
                            </div>
                            <h4 className={`text-sm font-semibold mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                              {bill.title}
                            </h4>
                            {bill.notes && (
                              <p className={`text-[11px] mt-0.5 truncate max-w-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                {bill.notes}
                              </p>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                              {bill.vendorOrInstitution}
                            </span>
                            {bill.outletName && (
                              <span className={`block text-[11px] mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                Branch: {bill.outletName}
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <span className={`text-xs ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                              {bill.accountLast4 ? `Card ending in •••• ${bill.accountLast4}` : "Current A/C Transfer"}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-right">
                            <span className={`text-sm font-bold ${
                              bill.status === "PAID"
                                ? isDark ? "text-[#8F95A3]" : "text-slate-400"
                                : isOverdue
                                ? "text-rose-500"
                                : isDark
                                ? "text-white"
                                : "text-slate-900"
                            }`}>
                              ${bill.effectiveAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {bill.status === "PAID" && bill.paidAmount && (
                              <span className="block text-[10px] text-emerald-500 font-medium">
                                Paid: ${bill.paidAmount.toLocaleString()}
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <span className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                              {dueDateFormatted}
                            </span>
                            {bill.status !== "PAID" && (
                              <span className={`block text-[10px] font-semibold mt-0.5 ${
                                isOverdue
                                  ? "text-rose-500"
                                  : isDueSoon
                                  ? "text-amber-500"
                                  : isDark
                                  ? "text-[#8F95A3]"
                                  : "text-slate-500"
                              }`}>
                                {isOverdue
                                  ? `Overdue by ${Math.abs(bill.daysUntilDue)} days`
                                  : bill.daysUntilDue === 0
                                  ? "Due Today"
                                  : `Due in ${bill.daysUntilDue} days`}
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-center">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                bill.status === "PAID"
                                  ? isDark
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : isOverdue
                                  ? isDark
                                    ? "bg-rose-500/15 text-rose-400 border-rose-500/25 animate-pulse"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                  : isDueSoon
                                  ? isDark
                                    ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                  : isDark
                                  ? "bg-[#0071E3]/15 text-[#64B5FF] border-[#0071E3]/25"
                                  : "bg-blue-50 text-[#0071E3] border-blue-200"
                              }`}
                            >
                              {bill.status === "PAID"
                                ? "PAID"
                                : isOverdue
                                ? "OVERDUE"
                                : isDueSoon
                                ? "DUE SOON"
                                : "UPCOMING"}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {bill.status !== "PAID" ? (
                                <button
                                  onClick={() => {
                                    setShowPayModal(bill);
                                    setPayFormData({
                                      paidAmount: String(bill.effectiveAmount),
                                      paymentMethod: "Bank Transfer",
                                      paymentReference: "",
                                      paidAt: new Date().toISOString().split("T")[0],
                                      notes: "",
                                    });
                                  }}
                                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
                                >
                                  Pay & Settle
                                </button>
                              ) : (
                                <span className={`text-xs font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                                  ✓ Settled
                                </span>
                              )}

                              <button
                                onClick={() => handleDeleteBill(bill.id)}
                                title="Delete reminder"
                                className={`p-1.5 rounded-xl border transition cursor-pointer ${
                                  isDark
                                    ? "border-white/[0.08] text-[#8F95A3] hover:text-rose-400 hover:bg-white/[0.04]"
                                    : "border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-slate-100"
                                }`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {/* CREATE BILL MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-2xl p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar ${
                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold">Schedule Business Bill Reminder</h2>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Register a vendor invoice, service AMC, utility, or credit card obligation for automated tracking.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={`p-1.5 rounded-xl border transition cursor-pointer ${
                    isDark ? "border-white/[0.08] text-[#8F95A3] hover:text-white" : "border-slate-200 text-slate-500 hover:text-slate-900"
                  }`}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateBill} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="sm:col-span-2">
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      Reminder Name / Bill Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kitchen Equipment AMC, Fresh Meat PO-10452, HDFC Corporate Card"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      Bill Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="FOOD_BEVERAGE_SUPPLIERS">Vendor / F&B Supplies</option>
                      <option value="MAINTENANCE_REPAIRS">Services & Equipment AMC</option>
                      <option value="UTILITIES">Utilities (Electricity, Water, Gas)</option>
                      <option value="CREDIT_CARD">Credit Card / Loan EMI</option>
                      <option value="RENT_PROPERTY_LEASE">Rent & Property Lease</option>
                      <option value="SAAS_TECHNOLOGY">Software & SaaS Subscriptions</option>
                      <option value="TAXES_LICENSES">Taxes, GST & Govt Licenses</option>
                      <option value="INSURANCE">Insurance Premiums</option>
                      <option value="CLEANING_HYGIENE">Cleaning & Hygiene Supplies</option>
                      <option value="OTHER_OPERATIONAL_EXPENSES">Other Operational Expenses</option>
                    </select>
                  </div>

                  {/* Vendor / Payee */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      Vendor / Payee Institution *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ABC Pest Control, Fresh Farms Ltd, HDFC Bank"
                      value={formData.vendorOrInstitution}
                      onChange={(e) => setFormData({ ...formData, vendorOrInstitution: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  {/* PO Number */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      PO Number / Invoice Reference (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PO-10452 / INV-2026-88"
                      value={formData.poNumber}
                      onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  {/* Branch / Outlet */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      Location / Branch (Optional)
                    </label>
                    <select
                      value={formData.outletId}
                      onChange={(e) => setFormData({ ...formData, outletId: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="">All Branches / Main Headquarters</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount Due */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      Base Amount Due * ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="2500.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  {/* Tax / GST */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      Tax / GST Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="450.00"
                      value={formData.taxAmount}
                      onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      Payment Due Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  {/* Reminder Days Before */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      Reminder Alert
                    </label>
                    <select
                      value={formData.reminderDaysBefore}
                      onChange={(e) => setFormData({ ...formData, reminderDaysBefore: Number(e.target.value) })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value={1}>1 Day Before Due Date</option>
                      <option value={3}>3 Days Before Due Date</option>
                      <option value={5}>5 Days Before Due Date</option>
                      <option value={7}>7 Days Before (1 Week)</option>
                      <option value={14}>14 Days Before (2 Weeks)</option>
                    </select>
                  </div>

                  {/* Payment Account */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      Payment Account / Card Last 4
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Current A/C, or 4242"
                      value={formData.accountLast4}
                      onChange={(e) => setFormData({ ...formData, accountLast4: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  {/* Payment Terms */}
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                      Payment Terms
                    </label>
                    <select
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="Due on Receipt">Due on Receipt (Immediate)</option>
                      <option value="Net 15">Net 15 Days</option>
                      <option value="Net 30">Net 30 Days</option>
                      <option value="Net 45">Net 45 Days</option>
                      <option value="Net 60">Net 60 Days</option>
                    </select>
                  </div>
                </div>

                {/* Recurring Options */}
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? "bg-[#0A0C12]/50 border-white/[0.06]" : "bg-slate-50 border-slate-200"
                }`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRecurring}
                      onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                      className="rounded text-[#0071E3] focus:ring-0"
                    />
                    <span className="text-xs font-semibold">
                      This is a Recurring Bill / Subscription / AMC
                    </span>
                  </label>

                  {formData.isRecurring && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className={`block text-[11px] font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                          Frequency
                        </label>
                        <select
                          value={formData.recurringFrequency}
                          onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value })}
                          className={`w-full px-3 py-1.5 text-xs rounded-xl border ${
                            isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200"
                          }`}
                        >
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="ANNUAL">Annual / Yearly</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Auto Convert Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formData.autoConvertToExpense}
                    onChange={(e) => setFormData({ ...formData, autoConvertToExpense: e.target.checked })}
                    className="rounded text-[#0071E3] focus:ring-0"
                  />
                  <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Automatically record as an Expense in General Ledger upon payment
                  </span>
                </label>

                {/* Submit button */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium ${
                      isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? "Scheduling..." : "Schedule Reminder"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PAY & SETTLE MODAL */}
        {showPayModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h2 className="text-base font-bold">Mark Bill as Paid & Settle</h2>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {showPayModal.title} • {showPayModal.vendorOrInstitution}
                  </p>
                </div>
                <button onClick={() => setShowPayModal(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  ✕
                </button>
              </div>

              <form onSubmit={handleMarkPaid} className="space-y-3.5">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                    Paid Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payFormData.paidAmount}
                    onChange={(e) => setPayFormData({ ...payFormData, paidAmount: e.target.value })}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition font-bold ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                    Payment Method
                  </label>
                  <select
                    value={payFormData.paymentMethod}
                    onChange={(e) => setPayFormData({ ...payFormData, paymentMethod: e.target.value })}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="Bank Transfer">Bank Transfer / NEFT / ACH</option>
                    <option value="Corporate Credit Card">Corporate Credit Card</option>
                    <option value="UPI / Instant Pay">UPI / Instant Pay</option>
                    <option value="Company Cheque">Company Cheque</option>
                    <option value="Auto-Debit">Auto-Debit</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                    Payment Reference / UTR Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-9821849182 / Chq #00412"
                    value={payFormData.paymentReference}
                    onChange={(e) => setPayFormData({ ...payFormData, paymentReference: e.target.value })}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                    Payment Settlement Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payFormData.paidAt}
                    onChange={(e) => setPayFormData({ ...payFormData, paidAt: e.target.value })}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl">
                  This transaction will automatically be recorded in your P&L Executive Statement and General Ledger.
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowPayModal(null)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium ${
                      isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "Confirm & Settle"}
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
