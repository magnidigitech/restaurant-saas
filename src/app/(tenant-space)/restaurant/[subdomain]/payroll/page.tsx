"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface PayrollStats {
  totalEmployeesConfigured: number;
  totalRuns: number;
  latestRunNet: number;
  pendingApprovals: number;
}

export default function PayrollDashboard() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [stats, setStats] = useState<PayrollStats>({
    totalEmployeesConfigured: 0,
    totalRuns: 0,
    latestRunNet: 0,
    pendingApprovals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      const [resStructures, resRuns] = await Promise.all([
        fetch("/api/restaurant/payroll/salary-structures"),
        fetch("/api/restaurant/payroll/runs"),
      ]);

      const structures = resStructures.ok ? (await resStructures.json()).structures || [] : [];
      const runs = resRuns.ok ? (await resRuns.json()).runs || [] : [];

      const pending = runs.filter((r: any) => r.status === "CALCULATING" || r.status === "DRAFT").length;
      const latestRun = runs[0];

      setStats({
        totalEmployeesConfigured: structures.length,
        totalRuns: runs.length,
        latestRunNet: latestRun ? Number(latestRun.totalNet) : 0,
        pendingApprovals: pending,
      });
      setRecentRuns(runs.slice(0, 5));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const navCards = [
    {
      title: "Payroll Runs",
      desc: "Execute monthly payroll calculations, review earnings, and issue payouts",
      path: "payroll/runs",
      badge: `${stats.totalRuns} Runs`,
    },
    {
      title: "Salary Structures",
      desc: "Configure employee compensation, base salaries, allowances, and tax deductions",
      path: "payroll/salary-structures",
      badge: `${stats.totalEmployeesConfigured} Configured`,
    },
  ];

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Payroll & Compensation" />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Payroll & Compensation
              </h1>
            </div>
            <p className={`text-xs mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Automated salary calculations, attendance/shift integration, and itemized payslips.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/payroll/runs`)}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-xl transition shadow-sm cursor-pointer"
            >
              + Process Payroll Run
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className={`p-5 rounded-2xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
            }`}
          >
            <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Salary Structures
            </p>
            <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
              {loading ? "..." : stats.totalEmployeesConfigured}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Configured employees
            </p>
          </div>

          <div
            className={`p-5 rounded-2xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
            }`}
          >
            <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Total Payroll Runs
            </p>
            <p className="text-2xl font-bold tracking-tight mt-1.5 text-[#0071E3]">
              {loading ? "..." : stats.totalRuns}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Processed pay periods
            </p>
          </div>

          <div
            className={`p-5 rounded-2xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
            }`}
          >
            <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Latest Net Payout
            </p>
            <p className="text-2xl font-bold tracking-tight mt-1.5 text-emerald-500">
              {loading ? "..." : `$${stats.latestRunNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Recent pay cycle total
            </p>
          </div>

          <div
            className={`p-5 rounded-2xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
            }`}
          >
            <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Pending Runs
            </p>
            <p className={`text-2xl font-bold tracking-tight mt-1.5 ${stats.pendingApprovals > 0 ? "text-amber-500" : isDark ? "text-white" : "text-slate-900"}`}>
              {loading ? "..." : stats.pendingApprovals}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Draft or calculating
            </p>
          </div>
        </div>

        {/* Nav Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {navCards.map((card, idx) => (
            <div
              key={idx}
              onClick={() => router.push(`/restaurant/${subdomain}/${card.path}`)}
              className={`p-6 rounded-3xl border transition flex flex-col justify-between space-y-4 cursor-pointer group ${
                isDark
                  ? "bg-[#121622]/60 border-white/[0.06] hover:bg-[#121622]/90 hover:border-white/[0.15]"
                  : "bg-white border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300"
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className={`text-sm font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                    {card.title}
                  </h3>
                  {card.badge && (
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        isDark
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {card.badge}
                    </span>
                  )}
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {card.desc}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.04]">
                <span className="text-xs font-medium text-[#0071E3] group-hover:underline">
                  Launch Manager
                </span>
                <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  →
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Runs Table */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
          }`}
        >
          <div className="flex justify-between items-center">
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
              Recent Pay Cycles
            </h3>
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/payroll/runs`)}
              className="text-xs text-[#0071E3] hover:underline"
            >
              View All Runs →
            </button>
          </div>

          {recentRuns.length === 0 ? (
            <div className={`py-8 text-center text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              No payroll runs created yet. Click &quot;+ Process Payroll Run&quot; to initiate a pay cycle.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className={`border-b ${isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-100 text-slate-400"}`}>
                    <th className="py-2.5 font-medium">Run Name</th>
                    <th className="py-2.5 font-medium">Period</th>
                    <th className="py-2.5 font-medium">Gross</th>
                    <th className="py-2.5 font-medium">Net Disbursed</th>
                    <th className="py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {recentRuns.map((r: any) => (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/restaurant/${subdomain}/payroll/runs/${r.id}`)}
                      className={`cursor-pointer ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"}`}
                    >
                      <td className={`py-2.5 font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                        {r.name}
                      </td>
                      <td className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>
                        {new Date(r.startDate).toLocaleDateString()} - {new Date(r.endDate).toLocaleDateString()}
                      </td>
                      <td className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>
                        ${Number(r.totalGross).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="font-semibold text-emerald-500">
                        ${Number(r.totalNet).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
