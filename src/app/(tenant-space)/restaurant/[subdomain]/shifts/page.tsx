"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface ShiftDashboardStats {
  totalTemplates: number;
  activeRosters: number;
  scheduledShiftsThisWeek: number;
  pendingSwaps: number;
}

export default function ShiftsDashboard() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [stats, setStats] = useState<ShiftDashboardStats>({
    totalTemplates: 0,
    activeRosters: 0,
    scheduledShiftsThisWeek: 0,
    pendingSwaps: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentAssignments, setRecentAssignments] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      const [resTemplates, resRosters, resAssignments, resSwaps] = await Promise.all([
        fetch("/api/restaurant/shifts/templates"),
        fetch("/api/restaurant/shifts/rosters"),
        fetch("/api/restaurant/shifts/assignments"),
        fetch("/api/restaurant/shifts/swaps?status=PENDING"),
      ]);

      const templates = resTemplates.ok ? (await resTemplates.json()).templates || [] : [];
      const rosters = resRosters.ok ? (await resRosters.json()).rosters || [] : [];
      const assignments = resAssignments.ok ? (await resAssignments.json()).assignments || [] : [];
      const swaps = resSwaps.ok ? (await resSwaps.json()).swaps || [] : [];

      setStats({
        totalTemplates: templates.length,
        activeRosters: rosters.filter((r: any) => r.status === "PUBLISHED").length,
        scheduledShiftsThisWeek: assignments.length,
        pendingSwaps: swaps.length,
      });
      setRecentAssignments(assignments.slice(0, 6));
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
      title: "Roster Scheduler",
      desc: "Build, publish, and manage weekly shift calendars by outlet",
      path: "shifts/rosters",
      badge: `${stats.activeRosters} Published`,
    },
    {
      title: "Shift Templates",
      desc: "Configure reusable shift slots, timing, break rules, and color codes",
      path: "shifts/templates",
      badge: `${stats.totalTemplates} Templates`,
    },
    {
      title: "Shift Swaps",
      desc: "Review and approve employee shift trade and cover requests",
      path: "shifts/swaps",
      badge: stats.pendingSwaps > 0 ? `${stats.pendingSwaps} Pending` : undefined,
      badgeColor: isDark ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-amber-50 text-amber-800 border-amber-200",
    },
  ];

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Shifts & Scheduling" />

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
              <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              <h1 className={`text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Shift Scheduling & Rosters
              </h1>
            </div>
            <p className={`text-xs mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Organize workforce rosters, shift templates, and employee swap requests across outlets.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/shifts/rosters`)}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-xl transition shadow-sm cursor-pointer"
            >
              Open Weekly Scheduler →
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
              Active Templates
            </p>
            <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
              {loading ? "..." : stats.totalTemplates}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Reusable timeframes
            </p>
          </div>

          <div
            className={`p-5 rounded-2xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
            }`}
          >
            <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Published Rosters
            </p>
            <p className="text-2xl font-bold tracking-tight mt-1.5 text-emerald-500">
              {loading ? "..." : stats.activeRosters}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Live staff schedules
            </p>
          </div>

          <div
            className={`p-5 rounded-2xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
            }`}
          >
            <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Scheduled Shifts
            </p>
            <p className="text-2xl font-bold tracking-tight mt-1.5 text-[#0071E3]">
              {loading ? "..." : stats.scheduledShiftsThisWeek}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Assignments on record
            </p>
          </div>

          <div
            className={`p-5 rounded-2xl border transition ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
            }`}
          >
            <p className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Swap Requests
            </p>
            <p className={`text-2xl font-bold tracking-tight mt-1.5 ${stats.pendingSwaps > 0 ? "text-amber-500" : isDark ? "text-white" : "text-slate-900"}`}>
              {loading ? "..." : stats.pendingSwaps}
            </p>
            <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Awaiting manager review
            </p>
          </div>
        </div>

        {/* Nav Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
                        card.badgeColor || (isDark ? "bg-blue-500/10 text-blue-300 border-blue-500/20" : "bg-blue-50 text-blue-800 border-blue-200")
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
                  Open Section
                </span>
                <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  →
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Shifts Table */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-sm"
          }`}
        >
          <div className="flex justify-between items-center">
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
              Recent Scheduled Assignments
            </h3>
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/shifts/rosters`)}
              className="text-xs text-[#0071E3] hover:underline"
            >
              View Full Schedule →
            </button>
          </div>

          {recentAssignments.length === 0 ? (
            <div className={`py-8 text-center text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              No shift assignments recorded yet. Use the Weekly Scheduler to assign staff shifts.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className={`border-b ${isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-100 text-slate-400"}`}>
                    <th className="py-2.5 font-medium">Employee</th>
                    <th className="py-2.5 font-medium">Date</th>
                    <th className="py-2.5 font-medium">Roster</th>
                    <th className="py-2.5 font-medium">Time Window</th>
                    <th className="py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {recentAssignments.map((a: any) => (
                    <tr key={a.id} className={isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"}>
                      <td className={`py-2.5 font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                        {a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : "Staff Member"}
                      </td>
                      <td className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>
                        {a.shiftDate ? new Date(a.shiftDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—"}
                      </td>
                      <td className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>
                        {a.roster?.name ? (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                            isDark ? "bg-white/[0.06] text-[#C2C7D0] border-white/[0.06]" : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>
                            {a.roster.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>
                        <span className="font-semibold">{a.startTime} - {a.endTime}</span>
                        {a.template && <span className="ml-1.5 opacity-70">({a.template.name})</span>}
                      </td>
                      <td>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            a.status === "COMPLETED" || a.status === "SCHEDULED"
                              ? isDark
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : isDark
                              ? "bg-slate-500/10 text-slate-300 border-slate-500/20"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {a.status}
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
