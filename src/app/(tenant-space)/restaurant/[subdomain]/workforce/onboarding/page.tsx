"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

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

const STATUS_COLORS: Record<OnboardingStatus, string> = {
  PENDING: "bg-slate-800 text-slate-300",
  IN_PROGRESS: "bg-blue-900/50 text-blue-300",
  PENDING_APPROVAL: "bg-amber-900/50 text-amber-300",
  APPROVED: "bg-emerald-900/50 text-emerald-300",
  REJECTED: "bg-red-900/50 text-red-300",
};

export default function OnboardingDashboard() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showStartModal, setShowStartModal] = useState(false);
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
    } catch (e) {
      setError("Failed to load onboarding data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleStartOnboarding = async () => {
    if (!startForm.employeeId || !startForm.templateId) {
      setError("Please select an employee and a template");
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
      if (!res.ok) throw new Error(data.error);
      setShowStartModal(false);
      setStartForm({ employeeId: "", templateId: "" });
      fetchData();
    } catch (e: any) {
      setError(e.message || "Failed to start onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = statusFilter === "ALL" ? sessions : sessions.filter((s) => s.status === statusFilter);

  const stats = {
    total: sessions.length,
    inProgress: sessions.filter((s) => s.status === "IN_PROGRESS").length,
    pendingApproval: sessions.filter((s) => s.status === "PENDING_APPROVAL").length,
    approved: sessions.filter((s) => s.status === "APPROVED").length,
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 font-semibold">
        Loading HR Onboarding...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            ← Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">HR Onboarding</h1>
            <p className="text-xs text-slate-500">Manage employee onboarding sessions</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/workforce/onboarding/templates`)}
            className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 text-sm font-semibold rounded-lg hover:border-slate-700 hover:text-white transition-all cursor-pointer"
          >
            Templates
          </button>
          <button
            onClick={() => setShowStartModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-all cursor-pointer"
          >
            + Start Onboarding
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Sessions", value: stats.total, color: "text-slate-300", bg: "bg-slate-900/40 border-slate-800" },
            { label: "In Progress", value: stats.inProgress, color: "text-blue-400", bg: "bg-blue-950/20 border-blue-900/50" },
            { label: "Pending Approval", value: stats.pendingApproval, color: "text-amber-400", bg: "bg-amber-950/20 border-amber-900/50" },
            { label: "Approved", value: stats.approved, color: "text-emerald-400", bg: "bg-emerald-950/20 border-emerald-900/50" },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} border rounded-2xl p-5 space-y-1`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{stat.label}</p>
              <p className={`text-3xl font-extrabold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {["ALL", "IN_PROGRESS", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PENDING"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                statusFilter === s
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {s === "ALL" ? "All" : s.replace("_", " ")}
              {s !== "ALL" && (
                <span className="ml-1.5 opacity-60">
                  {sessions.filter((ss) => ss.status === s).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sessions List */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl">
            <p className="text-slate-400 font-semibold">No onboarding sessions found</p>
            <p className="text-slate-600 text-sm mt-1">
              {statusFilter !== "ALL" ? "Try changing the filter, or " : ""}Start an onboarding session for an employee.
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
                  onClick={() => router.push(`/workforce/onboarding/${session.id}`)}
                  className="bg-slate-900/30 border border-slate-900 hover:border-slate-800 rounded-2xl p-5 cursor-pointer transition-all flex flex-col md:flex-row md:items-center gap-4"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLORS[session.status]}`}>
                        {session.status.replace("_", " ")}
                      </span>
                      <h3 className="font-bold text-white text-base">
                        {session.employee.firstName} {session.employee.lastName}
                      </h3>
                      <span className="text-xs text-slate-500 font-mono">{session.employee.employeeCode}</span>
                    </div>
                    <p className="text-sm text-slate-400">Template: <span className="text-slate-300">{session.template.name}</span></p>
                    <p className="text-xs text-slate-600">
                      Started {session.startedAt ? new Date(session.startedAt).toLocaleDateString() : "—"} ·
                      {session.submittedAt ? ` Submitted ${new Date(session.submittedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div className="md:w-48 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Progress</span>
                      <span className="font-semibold text-slate-300">{completed}/{total} tasks</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-right text-slate-500">{pct}%</p>
                  </div>
                  <span className="text-slate-600 text-lg hidden md:block">→</span>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Start Onboarding Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Start Onboarding</h2>
              <p className="text-sm text-slate-400 mt-1">Select an employee and an onboarding template</p>
            </div>

            {error && <div className="bg-red-950/50 border border-red-800 text-red-200 text-xs px-3 py-2 rounded-lg">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Employee</label>
                <select
                  value={startForm.employeeId}
                  onChange={(e) => setStartForm((f) => ({ ...f, employeeId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Template</label>
                <select
                  value={startForm.templateId}
                  onChange={(e) => setStartForm((f) => ({ ...f, templateId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select template...</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowStartModal(false); setError(""); setStartForm({ employeeId: "", templateId: "" }); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-400 text-sm font-semibold hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleStartOnboarding}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Starting..." : "Start Onboarding"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
