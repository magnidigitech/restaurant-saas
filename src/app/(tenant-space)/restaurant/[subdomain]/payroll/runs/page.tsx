"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface Outlet {
  id: string;
  name: string;
}

interface PayrollRun {
  id: string;
  title?: string;
  name?: string;
  periodStart?: string;
  startDate?: string;
  periodEnd?: string;
  endDate?: string;
  paymentDate: string;
  status: string;
  totalGross: string;
  totalAllowances: string;
  totalDeductions: string;
  totalNet: string;
  outlet?: { name: string };
  _count?: { payslips: number };
}

export default function ApplePayrollRunsPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Form
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [outletId, setOutletId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [resRuns, resOutlets] = await Promise.all([
        fetch("/api/restaurant/payroll/runs"),
        fetch("/api/restaurant/outlets"),
      ]);

      const runsData = resRuns.ok ? (await resRuns.json()).runs || [] : [];
      const outletsData = resOutlets.ok ? (await resOutlets.json()).outlets || [] : [];

      setRuns(runsData);
      setOutlets(outletsData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    setTitle(`Payroll ${today.toLocaleString("en-US", { month: "long", year: "numeric" })}`);
    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(lastDay.toISOString().split("T")[0]);
    setPaymentDate(today.toISOString().split("T")[0]);
    setOutletId(outlets.length > 0 ? outlets[0].id : "");
    setNotes("");
    setError(null);
    setModalOpen(true);
  };

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/restaurant/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          outletId: outletId || undefined,
          periodStart: startDate,
          periodEnd: endDate,
          paymentDate,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create pay run");

      setModalOpen(false);
      router.push(`/restaurant/${subdomain}/payroll/runs/${data.run.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModuleAccessGuard moduleKey="payroll" moduleName="Payroll & Compensation" activeSection="Payroll">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Payroll" />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/payroll`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← Payroll Hub
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Pay Cycle History
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Monthly Payroll Runs
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Initiate pay cycles, calculate earnings from logged shifts, approve disbursements, and generate official payslips.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/restaurant/${subdomain}/payroll/tip-pool`}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition ${
                isDark ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]" : "bg-white text-slate-700 border-slate-200 shadow-xs"
              }`}
            >
              Tip Pooling Studio ↗
            </Link>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
            >
              + Initiate Pay Run
            </button>
          </div>
        </div>

        {/* Runs List Table */}
        <div
          className={`rounded-3xl border overflow-hidden transition shadow-sm ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80"
          }`}
        >
          {loading ? (
            <div className={`text-center py-16 text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Loading payroll records...
            </div>
          ) : runs.length === 0 ? (
            <div className={`p-12 text-center space-y-2`}>
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                No payroll runs created yet
              </h3>
              <p className={`text-xs max-w-sm mx-auto ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Click &quot;+ Initiate Pay Run&quot; to calculate earnings and disburse staff salaries.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b ${isDark ? "bg-[#0A0C12]/50 border-white/[0.06] text-[#8F95A3]" : "bg-slate-50/70 border-slate-100 text-slate-500"}`}>
                    <th className="p-4 font-medium uppercase tracking-wider">Pay Run Title</th>
                    <th className="p-4 font-medium uppercase tracking-wider">Period</th>
                    <th className="p-4 font-medium uppercase tracking-wider">Gross Pay</th>
                    <th className="p-4 font-medium uppercase tracking-wider">Net Disbursed</th>
                    <th className="p-4 font-medium uppercase tracking-wider">Payslips</th>
                    <th className="p-4 font-medium uppercase tracking-wider">Status</th>
                    <th className="p-4 font-medium text-right uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? "divide-white/[0.04]" : "divide-slate-100"}`}>
                  {runs.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/restaurant/${subdomain}/payroll/runs/${r.id}`)}
                      className={`cursor-pointer transition ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"}`}
                    >
                      <td className={`p-4 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {r.title || r.name || "Payroll Cycle"}
                      </td>
                      <td className={`p-4 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        {r.periodStart
                          ? new Date(r.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : r.startDate
                          ? new Date(r.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : "—"}{" "}
                        —{" "}
                        {r.periodEnd
                          ? new Date(r.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : r.endDate
                          ? new Date(r.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                      <td className={`p-4 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        ${Number(r.totalGross).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 font-bold text-emerald-500">
                        ${Number(r.totalNet).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`p-4 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        {r._count?.payslips || 0} Slips
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${
                            r.status === "PAID"
                              ? isDark
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : r.status === "APPROVED"
                              ? isDark
                                ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                              : isDark
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-xs font-medium text-[#0071E3]">
                          Manage →
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex justify-between items-center">
              <h2 className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                Initiate New Payroll Cycle
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateRun} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Pay Cycle Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-white"
                      : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Outlet Scope (Optional)
                </label>
                <select
                  value={outletId}
                  onChange={(e) => setOutletId(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-white"
                      : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="">All Active Branches</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Payment Target Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-white"
                      : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Proceed to Calculator →"}
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
