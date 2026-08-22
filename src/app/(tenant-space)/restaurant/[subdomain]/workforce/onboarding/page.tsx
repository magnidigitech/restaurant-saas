"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

type OnboardingStatus = "PENDING" | "IN_PROGRESS" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

interface Session {
  id: string;
  status: OnboardingStatus;
  startedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string };
  template: { id: string; name: string };
  progresses: { status: string }[];
}

interface Template {
  id: string;
  name: string;
  _count: { onboardings: number };
}

export default function AppleOnboardingDashboard() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showStartModal, setShowStartModal] = useState(false);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [employees, setEmployees] = useState<any[]>([]);
  const [startForm, setStartForm] = useState({ employeeId: "", templateId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [resSessions, resTemplates, resEmployees] = await Promise.all([
        fetch("/api/restaurant/onboarding/sessions"),
        fetch("/api/restaurant/onboarding/templates"),
        fetch("/api/restaurant/employees"),
      ]);
      if (resSessions.ok) setSessions((await resSessions.json()).sessions || []);
      if (resTemplates.ok) setTemplates((await resTemplates.json()).templates || []);
      if (resEmployees.ok) setEmployees((await resEmployees.json()).employees || []);
    } catch {
      setError("Failed to load onboarding data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startForm.employeeId || !startForm.templateId) {
      setError("Please select both an employee and a template");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/onboarding/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(startForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate onboarding");
      setShowStartModal(false);
      setStartForm({ employeeId: "", templateId: "" });
      await fetchData();
      if (data.session?.id) {
        router.push(`/restaurant/${subdomain}/workforce/onboarding/${data.session.id}`);
      }
    } catch (e: any) {
      setError(e.message || "Failed to start onboarding session");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!confirmDeleteSession) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${confirmDeleteSession.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete session");
      setConfirmDeleteSession(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Error deleting onboarding session");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = statusFilter === "ALL" ? sessions : sessions.filter((s) => s.status === statusFilter);

  const stats = {
    total: sessions.length,
    inProgress: sessions.filter((s) => s.status === "IN_PROGRESS").length,
    pendingApproval: sessions.filter((s) => s.status === "PENDING_APPROVAL").length,
    approved: sessions.filter((s) => s.status === "APPROVED").length,
  };

  const getStatusBadge = (status: OnboardingStatus) => {
    switch (status) {
      case "APPROVED":
        return isDark
          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
          : "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "IN_PROGRESS":
        return isDark
          ? "bg-[#0071E3]/15 text-[#58A6FF] border-[#0071E3]/25"
          : "bg-blue-100 text-blue-800 border-blue-200";
      case "PENDING_APPROVAL":
        return isDark
          ? "bg-amber-500/15 text-amber-300 border-amber-500/25"
          : "bg-amber-100 text-amber-800 border-amber-200";
      case "REJECTED":
        return isDark
          ? "bg-rose-500/15 text-rose-300 border-rose-500/25"
          : "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return isDark
          ? "bg-white/[0.06] text-[#A0A6B5] border-white/[0.08]"
          : "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium tracking-wide">Loading Onboarding Hub...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Employees" />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Executive Header Banner */}
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
                onClick={() => router.push(`/restaurant/${subdomain}/workforce/employees`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← Workforce Directory
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Onboarding & Verification
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Staff Onboarding Sessions
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Coordinate employee document verification, compliance checklists, and digital portal intake.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => router.push(`/restaurant/${subdomain}/workforce/employees`)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                isDark
                  ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                  : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-xs"
              }`}
            >
              + Add Employee
            </button>

            <button
              onClick={() => router.push(`/restaurant/${subdomain}/workforce/onboarding/templates`)}
              className={`px-4 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                  : "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200"
              }`}
            >
              Templates ({templates.length})
            </button>

            <button
              onClick={() => {
                setError("");
                setShowStartModal(true);
              }}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              + Start Onboarding
            </button>
          </div>
        </div>

        {/* Executive Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Sessions",
              value: stats.total,
              color: isDark ? "text-white" : "text-slate-900",
              sub: "All recorded workflows",
            },
            {
              label: "In Progress",
              value: stats.inProgress,
              color: isDark ? "text-[#58A6FF]" : "text-blue-600",
              sub: "Candidates filling portal",
            },
            {
              label: "Pending Approval",
              value: stats.pendingApproval,
              color: isDark ? "text-amber-300" : "text-amber-600",
              sub: "Submitted for HR audit",
            },
            {
              label: "Approved & Active",
              value: stats.approved,
              color: isDark ? "text-emerald-400" : "text-emerald-600",
              sub: "Completed onboarding",
            },
          ].map((stat, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border transition space-y-1 ${
                isDark
                  ? "bg-[#121622]/60 border-white/[0.06]"
                  : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                {stat.label}
              </span>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className={`text-[11px] ${isDark ? "text-[#6C7280]" : "text-slate-400"}`}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(["ALL", "IN_PROGRESS", "PENDING_APPROVAL", "APPROVED", "REJECTED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border flex-shrink-0 ${
                statusFilter === s
                  ? "bg-[#0071E3] border-[#0071E3] text-white shadow-xs"
                  : isDark
                  ? "bg-[#0A0C12] border-white/[0.06] text-[#8F95A3] hover:text-white"
                  : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              {s === "ALL" ? "All Sessions" : s.replace(/_/g, " ")}
              {s !== "ALL" && (
                <span className="ml-1.5 opacity-70">
                  ({sessions.filter((ss) => ss.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sessions List */}
        {filtered.length === 0 ? (
          <div
            className={`p-12 text-center rounded-3xl border text-xs space-y-2 ${
              isDark ? "bg-[#121622]/40 border-white/[0.06] text-[#8F95A3]" : "bg-white border-slate-200 text-slate-500 shadow-xs"
            }`}
          >
            <p className="font-semibold text-sm">No onboarding sessions found</p>
            <p className="opacity-75">
              {statusFilter !== "ALL" ? "Try switching the filter, or " : ""}click &quot;+ Start Onboarding&quot; to assign a checklist to a staff member.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((session) => {
              const completed = session.progresses.filter((p) => ["COMPLETED", "WAIVED"].includes(p.status)).length;
              const total = session.progresses.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <div
                  key={session.id}
                  onClick={() => router.push(`/restaurant/${subdomain}/workforce/onboarding/${session.id}`)}
                  className={`p-5 rounded-2xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                    isDark
                      ? "bg-[#121622]/60 border-white/[0.06] hover:bg-[#121622]/90 hover:border-white/[0.12]"
                      : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#0071E3]/15 text-[#0071E3] flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {session.employee.firstName.charAt(0)}
                      {session.employee.lastName.charAt(0)}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                            session.status
                          )}`}
                        >
                          {session.status.replace(/_/g, " ")}
                        </span>
                        <h3 className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                          {session.employee.firstName} {session.employee.lastName}
                        </h3>
                        <span className={`text-[11px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          {session.employee.employeeCode}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        <span className={`font-medium ${isDark ? "text-[#BAC0CD]" : "text-slate-600"}`}>
                          Template: <span className="font-semibold">{session.template.name}</span>
                        </span>
                        <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
                        <span className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          Started {session.startedAt ? new Date(session.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          {session.submittedAt && ` • Submitted ${new Date(session.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-4 w-full md:w-64">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                          Checklist
                        </span>
                        <span className={`font-semibold text-xs ${isDark ? "text-white" : "text-slate-900"}`}>
                          {completed}/{total} tasks ({pct}%)
                        </span>
                      </div>
                      <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-white/[0.08]" : "bg-slate-100"}`}>
                        <div
                          className="h-full bg-[#0071E3] rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <span className={`text-sm transition group-hover:translate-x-1 ${isDark ? "text-[#8F95A3] group-hover:text-white" : "text-slate-400 group-hover:text-slate-900"}`}>
                      →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Start Onboarding Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Initiate Onboarding</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Assign a compliance checklist template to an employee.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowStartModal(false);
                  setError("");
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs px-3.5 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleStartOnboarding} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Staff Member *
                </label>
                <select
                  required
                  value={startForm.employeeId}
                  onChange={(e) => setStartForm((f) => ({ ...f, employeeId: e.target.value }))}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="">Select an employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Onboarding Checklist Template *
                </label>
                <select
                  required
                  value={startForm.templateId}
                  onChange={(e) => setStartForm((f) => ({ ...f, templateId: e.target.value }))}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="">Select a template...</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setShowStartModal(false);
                    setError("");
                    setStartForm({ employeeId: "", templateId: "" });
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Initiating..." : "Start Onboarding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
