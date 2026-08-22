"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface Payslip {
  id: string;
  employeeId: string;
  hoursWorked: string;
  overtimeHours: string;
  basePay: string;
  totalAllowances: string;
  totalDeductions: string;
  netPay: string;
  status: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    workerType: string;
  };
  earnings?: any[];
  deductions?: any[];
}

interface PayrollRunDetail {
  id: string;
  title?: string;
  name?: string;
  periodStart?: string;
  startDate?: string;
  periodEnd?: string;
  endDate?: string;
  paymentDate: string;
  status: "DRAFT" | "CALCULATING" | "APPROVED" | "PAID" | "CANCELLED";
  totalGross: string;
  totalAllowances: string;
  totalDeductions: string;
  totalNet: string;
  processedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  outlet?: { name: string };
  payslips: Payslip[];
}

export default function ApplePayrollRunDetailPage(props: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const routeParams = useParams();
  const subdomain = (routeParams?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [runId, setRunId] = useState<string>("");
  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    props.params.then((p) => setRunId(p.id));
  }, [props.params]);

  const fetchRun = async () => {
    if (!runId) return;
    try {
      const res = await fetch(`/api/restaurant/payroll/runs/${runId}`);
      if (res.ok) {
        const data = await res.json();
        setRun(data.run || null);
      } else {
        setError("Failed to load payroll run");
      }
    } catch {
      setError("Network connection error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRun();
  }, [runId]);

  const handleCalculate = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/restaurant/payroll/runs/${runId}/calculate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to calculate payroll");
      fetchRun();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm("Approve this payroll run and lock calculation amounts?")) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/restaurant/payroll/runs/${runId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve payroll");
      fetchRun();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!confirm("Mark all payslips in this run as PAID and disburse funds?")) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/restaurant/payroll/runs/${runId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "BANK_TRANSFER" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record payment");
      }
      fetchRun();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<any | null>(null);

  const handleSyncAttendanceAndTips = async () => {
    setActionLoading(true);
    setError(null);
    setSyncSuccess(null);
    setSyncResult(null);
    try {
      const res = await fetch("/api/restaurant/payroll/attendance-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrollRunId: runId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync attendance");
      setSyncResult(data.result || data);
      setSyncSuccess(data.message || "Attendance & Tips Synced Successfully!");
      fetchRun();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xs text-slate-400">Loading payroll calculations...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-sm font-semibold text-rose-500">{error || "Payroll run record not found"}</p>
        <button
          onClick={() => router.push(`/restaurant/${subdomain}/payroll/runs`)}
          className="text-xs font-medium text-[#0071E3] hover:underline cursor-pointer"
        >
          ← Return to Payroll Cycles
        </button>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Pay Run Calculator" />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header Banner */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/payroll/runs`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← All Pay Runs
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span
                className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${
                  run.status === "PAID"
                    ? isDark
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : run.status === "APPROVED"
                    ? isDark
                      ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                      : "bg-blue-50 text-blue-800 border-blue-200"
                    : isDark
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {run.status}
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {run.title || run.name || "Payroll Run"}
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Period: {run.periodStart ? new Date(run.periodStart).toLocaleDateString() : (run.startDate ? new Date(run.startDate).toLocaleDateString() : "—")} — {run.periodEnd ? new Date(run.periodEnd).toLocaleDateString() : (run.endDate ? new Date(run.endDate).toLocaleDateString() : "—")} • Target Payout: {run.paymentDate ? new Date(run.paymentDate).toLocaleDateString() : "—"}
              {run.outlet && ` • Outlet: ${run.outlet.name}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(run.status === "DRAFT" || run.status === "CALCULATING") && (
              <>
                <button
                  onClick={handleCalculate}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{actionLoading ? "Calculating Wages..." : "Recalculate Run"}</span>
                </button>

                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Lock & Approve</span>
                </button>
              </>
            )}

            {run.status === "APPROVED" && (
              <button
                onClick={handleMarkPaid}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Disburse & Mark Paid</span>
              </button>
            )}
          </div>
        </div>

        {/* Sync Success / Result Banner */}
        {(syncResult || syncSuccess) && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between text-xs transition animate-in fade-in ${
              isDark
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {syncResult && syncResult.totalSyncedEmployees !== undefined ? (
                <span>
                  Synced {syncResult.totalSyncedEmployees} employees with{" "}
                  <strong>{Number(syncResult.totalRegularHours || 0).toFixed(2)} regular hours</strong> &{" "}
                  <strong>{Number(syncResult.totalOvertimeHours || 0).toFixed(2)} overtime hours</strong>.
                  {Number(syncResult.totalTipsDistributed || 0) > 0 && (
                    <span> Allocated ${Number(syncResult.totalTipsDistributed).toFixed(2)} POS tips.</span>
                  )}
                </span>
              ) : (
                <span>{syncSuccess || "Attendance & Tips synced successfully."}</span>
              )}
            </div>
            <button
              onClick={() => {
                setSyncResult(null);
                setSyncSuccess(null);
              }}
              className="text-xs opacity-60 hover:opacity-100 cursor-pointer p-1 rounded-lg"
              aria-label="Dismiss banner"
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className={`p-5 rounded-3xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
            }`}
          >
            <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Gross Wages
            </span>
            <p className={`text-xl font-bold tracking-tight mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              ${Number(run.totalGross).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div
            className={`p-5 rounded-3xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
            }`}
          >
            <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Allowances
            </span>
            <p className="text-xl font-bold text-blue-500 tracking-tight mt-1">
              +${Number(run.totalAllowances).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div
            className={`p-5 rounded-3xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
            }`}
          >
            <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Deductions & Taxes
            </span>
            <p className="text-xl font-bold text-rose-500 tracking-tight mt-1">
              -${Number(run.totalDeductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div
            className={`p-5 rounded-3xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
            }`}
          >
            <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Net Disbursed
            </span>
            <p className="text-xl font-bold text-emerald-500 tracking-tight mt-1">
              ${Number(run.totalNet).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Payslips Roster Table */}
        <div
          className={`rounded-3xl border overflow-hidden transition shadow-sm ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80"
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${isDark ? "bg-[#0A0C12]/50 border-white/[0.06] text-[#8F95A3]" : "bg-slate-50/70 border-slate-100 text-slate-500"}`}>
                  <th className="p-4 font-medium uppercase tracking-wider">Employee</th>
                  <th className="p-4 font-medium uppercase tracking-wider">Hours Worked</th>
                  <th className="p-4 font-medium uppercase tracking-wider">Base Pay Earned</th>
                  <th className="p-4 font-medium uppercase tracking-wider">House Tips</th>
                  <th className="p-4 font-medium uppercase tracking-wider">Allowances</th>
                  <th className="p-4 font-medium uppercase tracking-wider">Deductions</th>
                  <th className="p-4 font-medium uppercase tracking-wider">Net Amount</th>
                  <th className="p-4 font-medium text-right uppercase tracking-wider">Payslip</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-white/[0.04]" : "divide-slate-100"}`}>
                {run.payslips?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={`p-16 text-center text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      No payslips calculated yet. Click &quot;⚡ Sync Approved Timesheets & Tips&quot; to aggregate hours and compute pay.
                    </td>
                  </tr>
                ) : (
                  run.payslips?.map((p) => (
                    <tr
                      key={p.id}
                      className={`transition ${isDark ? "hover:bg-white/[0.01]" : "hover:bg-slate-50/50"}`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-xs">
                            {p.employee?.firstName.charAt(0)}
                          </div>
                          <div>
                            <p className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                              {p.employee?.firstName} {p.employee?.lastName}
                            </p>
                            <p className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                              {p.employee?.employeeCode} • {p.employee?.workerType}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className={`p-4 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        <span className="font-bold text-[#0071E3]">{Number(p.hoursWorked).toFixed(2)}h</span>
                        {Number(p.overtimeHours) > 0 && (
                          <span className="text-[10px] text-purple-400 font-semibold block">
                            +{Number(p.overtimeHours).toFixed(2)} OT
                          </span>
                        )}
                      </td>

                      <td className={`p-4 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        ${Number(p.basePay).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 font-bold text-emerald-400">
                        {Number((p as any).pooledTipsAmount || 0) > 0 ? (
                          <span>+${Number((p as any).pooledTipsAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="opacity-40 font-normal">—</span>
                        )}
                      </td>

                      <td className="p-4 text-blue-500">
                        +${Number(p.totalAllowances).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-rose-500">
                        -${Number(p.totalDeductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 font-bold text-emerald-500 text-sm">
                        ${Number(p.netPay).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => router.push(`/restaurant/${subdomain}/payroll/payslips/${p.id}`)}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#0071E3] hover:bg-[#0071E3]/10 transition cursor-pointer"
                        >
                          View Payslip →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
