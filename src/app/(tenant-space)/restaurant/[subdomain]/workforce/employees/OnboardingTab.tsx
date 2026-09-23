"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import { Trash2 } from "lucide-react";

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

interface OnboardingTabProps {
  subdomain: string;
  onCountChange?: (count: number) => void;
}

export default function OnboardingTab({ subdomain, onCountChange }: OnboardingTabProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  // Modals & search states
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdSessionData, setCreatedSessionData] = useState<{
    id: string;
    accessToken: string;
    employeeName: string;
    employeeCode: string;
    personalEmail?: string;
    phone?: string;
    templateName: string;
  } | null>(null);

  const [sendingEmailInModal, setSendingEmailInModal] = useState(false);
  const [emailSentSuccessInModal, setEmailSentSuccessInModal] = useState(false);
  const [emailErrorInModal, setEmailErrorInModal] = useState("");
  const [copiedModalLink, setCopiedModalLink] = useState(false);

  // Search filter inside start onboarding modal
  const [empSearch, setEmpSearch] = useState("");
  const [tplSearch, setTplSearch] = useState("");

  const fetchData = async () => {
    try {
      const [resSessions, resTemplates, resEmployees] = await Promise.all([
        fetch("/api/restaurant/onboarding/sessions"),
        fetch("/api/restaurant/onboarding/templates"),
        fetch("/api/restaurant/employees"),
      ]);
      if (resSessions.ok) {
        const sessData = await resSessions.json();
        const sList = sessData.sessions || [];
        setSessions(sList);
        onCountChange?.(sList.length);
      }
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
      
      const empObj = employees.find((e) => e.id === startForm.employeeId);
      const tplObj = templates.find((t) => t.id === startForm.templateId);
      const sessObj = data.onboarding || data.session;

      setShowStartModal(false);
      setStartForm({ employeeId: "", templateId: "" });
      await fetchData();

      if (sessObj) {
        setCreatedSessionData({
          id: sessObj.id,
          accessToken: sessObj.accessToken,
          employeeName: empObj ? `${empObj.firstName} ${empObj.lastName}` : "Employee",
          employeeCode: empObj?.employeeCode || "",
          personalEmail: empObj?.personalEmail || undefined,
          phone: empObj?.phone || empObj?.alternatePhone || undefined,
          templateName: tplObj?.name || "Onboarding Form",
        });
        setEmailSentSuccessInModal(data.emailSent || false);
        setEmailErrorInModal("");
        setShowSuccessModal(true);
      }
    } catch (e: any) {
      setError(e.message || "Failed to start onboarding session");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendEmailInModal = async () => {
    if (!createdSessionData) return;
    setSendingEmailInModal(true);
    setEmailErrorInModal("");
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${createdSessionData.id}/send-email`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      setEmailSentSuccessInModal(true);
    } catch (err: any) {
      setEmailErrorInModal(err.message || "Failed to send email");
    } finally {
      setSendingEmailInModal(false);
    }
  };

  const getModalPortalUrl = () => {
    if (typeof window === "undefined" || !createdSessionData) return "";
    return `${window.location.origin}/onboarding/portal/${createdSessionData.accessToken}`;
  };

  const getWhatsAppLink = () => {
    if (!createdSessionData) return "#";
    const rawPhone = createdSessionData.phone || "";
    const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
    const portalUrl = getModalPortalUrl();
    const msg = `Hello ${createdSessionData.employeeName}! 📋 Your employee onboarding form "${createdSessionData.templateName}" is ready.\n\nPlease click the link below to complete your details and submit documents:\n🔗 ${portalUrl}\n\nThank you!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
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
      <div className="p-12 text-center text-xs flex flex-col items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-2" />
        <span className={isDark ? "text-[#8F95A3]" : "text-slate-400"}>Loading onboarding data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(["ALL", "IN_PROGRESS", "PENDING_APPROVAL", "APPROVED", "REJECTED"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border shrink-0 ${
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

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setTemplateSearchQuery("");
              setShowTemplatesModal(true);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
              isDark
                ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                : "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200"
            }`}
          >
            Checklist Templates ({templates.length})
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: "Total Sessions",
            value: stats.total,
            color: isDark ? "text-white" : "text-slate-900",
            sub: "All workflows",
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
            className={`p-4 sm:p-5 rounded-2xl border transition space-y-1 ${
              isDark
                ? "bg-[#121622]/60 border-white/[0.06]"
                : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <span className={`text-[10px] sm:text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              {stat.label}
            </span>
            <p className={`text-xl sm:text-2xl font-bold tracking-tight ${stat.color}`}>{stat.value}</p>
            <p className={`text-[11px] ${isDark ? "text-[#6C7280]" : "text-slate-400"}`}>{stat.sub}</p>
          </div>
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
                className={`p-4 sm:p-5 rounded-2xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06] hover:bg-[#121622]/90 hover:border-white/[0.12]"
                    : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs hover:shadow-sm"
                }`}
              >
                <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#0071E3]/15 text-[#0071E3] flex items-center justify-center font-bold text-sm shrink-0">
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
                      <h3 className={`text-xs sm:text-sm font-bold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
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

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      title="Delete Session"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteSession(session);
                      }}
                      className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                        isDark ? "hover:bg-rose-500/20 text-rose-400" : "hover:bg-rose-50 text-rose-600"
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className={`text-sm transition group-hover:translate-x-1 ${isDark ? "text-[#8F95A3] group-hover:text-white" : "text-slate-400 group-hover:text-slate-900"}`}>
                      →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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

      {/* Checklist Templates Search & Select Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-xl p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Onboarding Form & Checklist Templates</h3>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Search existing forms or open a template to customize fields
                </p>
              </div>
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/workforce/onboarding/templates`)}
                className="px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                + Create New Form
              </button>
            </div>

            {/* Search Input Box on Top */}
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Search existing forms by name or description..."
                value={templateSearchQuery}
                onChange={(e) => setTemplateSearchQuery(e.target.value)}
                className={`w-full px-4 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                  isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                }`}
              />
            </div>

            {/* Templates List */}
            <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
              {templates.filter((t) =>
                t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) ||
                ((t as any).description || "").toLowerCase().includes(templateSearchQuery.toLowerCase())
              ).length === 0 ? (
                <div className={`p-8 text-center text-xs border border-dashed rounded-2xl ${isDark ? "border-white/[0.08] text-[#8F95A3]" : "border-slate-200 text-slate-400"}`}>
                  No onboarding form templates found matching "{templateSearchQuery}"
                </div>
              ) : (
                templates
                  .filter((t) =>
                    t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()) ||
                    ((t as any).description || "").toLowerCase().includes(templateSearchQuery.toLowerCase())
                  )
                  .map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => {
                        setShowTemplatesModal(false);
                        router.push(`/restaurant/${subdomain}/workforce/onboarding/templates?templateId=${tpl.id}`);
                      }}
                      className={`p-4 rounded-2xl border transition flex items-center justify-between cursor-pointer group ${
                        isDark
                          ? "bg-[#0A0C12] border-white/[0.06] hover:border-[#0071E3] hover:bg-white/[0.02]"
                          : "bg-slate-50 border-slate-200 hover:border-[#0071E3] hover:bg-blue-50/50"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold group-hover:text-[#0071E3] transition-colors">
                            {tpl.name}
                          </h4>
                          {(tpl as any).isDefault && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              Default
                            </span>
                          )}
                        </div>
                        {(tpl as any).description && (
                          <p className={`text-[11px] line-clamp-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            {(tpl as any).description}
                          </p>
                        )}
                        <span className={`text-[10px] block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          Used by {tpl._count?.onboardings || 0} candidate onboardings
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-[#0071E3] group-hover:underline shrink-0">
                        Open Form &rarr;
                      </span>
                    </div>
                  ))
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                onClick={() => setShowTemplatesModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Initiate Email / WhatsApp Confirmation Modal */}
      {showSuccessModal && createdSessionData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20 text-xl font-bold">
                ✓
              </div>
              <h3 className="text-lg font-bold">Onboarding Session Created!</h3>
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Form <strong className={isDark ? "text-white" : "text-slate-900"}>{createdSessionData.templateName}</strong> assigned to <strong className={isDark ? "text-white" : "text-slate-900"}>{createdSessionData.employeeName}</strong> ({createdSessionData.employeeCode}).
              </p>
            </div>

            {/* Employee Info Box */}
            <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex justify-between">
                <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Employee:</span>
                <span className="font-semibold">{createdSessionData.employeeName}</span>
              </div>
              {createdSessionData.personalEmail && (
                <div className="flex justify-between">
                  <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Email:</span>
                  <span className="font-semibold">{createdSessionData.personalEmail}</span>
                </div>
              )}
              {createdSessionData.phone && (
                <div className="flex justify-between">
                  <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>Mobile:</span>
                  <span className="font-semibold">{createdSessionData.phone}</span>
                </div>
              )}
            </div>

            {/* Shareable Link Box */}
            <div className="space-y-1.5">
              <label className={`block text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Candidate Onboarding Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={getModalPortalUrl()}
                  className={`flex-1 px-3 py-2 text-xs font-mono rounded-xl border transition ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                  }`}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getModalPortalUrl());
                    setCopiedModalLink(true);
                    setTimeout(() => setCopiedModalLink(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer shrink-0"
                >
                  {copiedModalLink ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Notification Actions: Email & WhatsApp */}
            <div className="space-y-2 pt-1">
              <span className={`block text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Send Form Link to Employee
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Send Email Button */}
                <button
                  type="button"
                  onClick={handleSendEmailInModal}
                  disabled={sendingEmailInModal || emailSentSuccessInModal || !createdSessionData.personalEmail}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                    emailSentSuccessInModal
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 cursor-default"
                      : isDark
                      ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/30"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                  } disabled:opacity-50`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {sendingEmailInModal ? "Sending..." : emailSentSuccessInModal ? "✓ Email Sent" : "Send Email"}
                </button>

                {/* Send WhatsApp Button */}
                <a
                  href={getWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                    isDark
                      ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l.299.476-1.152 4.21 4.299-1.127.397.235z"/>
                  </svg>
                  Send WhatsApp
                </a>
              </div>

              {emailErrorInModal && (
                <p className="text-[11px] text-rose-500 font-semibold">{emailErrorInModal}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                onClick={() => setShowSuccessModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Done
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push(`/restaurant/${subdomain}/workforce/onboarding/${createdSessionData.id}`);
                }}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                View Session &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Session Modal */}
      {confirmDeleteSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="space-y-1">
              <h3 className="text-sm font-bold tracking-tight text-rose-500">Delete Onboarding Session?</h3>
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Are you sure you want to delete the onboarding session for{" "}
                <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {confirmDeleteSession.employee.firstName} {confirmDeleteSession.employee.lastName}
                </span>
                ? All task checklists and submitted document progress for this session will be permanently erased.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteSession(null)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteSession}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
