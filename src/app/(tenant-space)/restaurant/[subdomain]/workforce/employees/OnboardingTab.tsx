"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import { Search, Plus, Send, CheckCircle2, Copy, Check } from "lucide-react";
import SearchableCombobox from "@/components/SearchableCombobox";

type OnboardingStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

interface Session {
  id: string;
  accessToken: string;
  status: OnboardingStatus;
  statusLabel?: string;
  nextAction?: string;
  isExpired?: boolean;
  isRevoked?: boolean;
  startedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  intendedOutlet?: { id: string; name: string } | null;
  intendedDepartment?: { id: string; name: string } | null;
  intendedDesignation?: { id: string; name: string } | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    personalEmail?: string | null;
  };
  template: { id: string; name: string; roleName?: string | null };
  progressSummary?: { totalCount: number; completedCount: number; percent: number };
  progresses: { status: string }[];
}

interface Template {
  id: string;
  name: string;
  roleName?: string | null;
  _count: { onboardings: number };
}

interface OnboardingTabProps {
  subdomain: string;
  onCountChange?: (count: number) => void;
}

const STATUS_LABELS: Record<OnboardingStatus, string> = {
  PENDING: "Invited",
  IN_PROGRESS: "In Progress",
  PENDING_APPROVAL: "Submitted",
  REJECTED: "Changes Requested",
  APPROVED: "Approved",
};

export default function OnboardingTab({ subdomain, onCountChange }: OnboardingTabProps) {
  const router = useRouter();
  const { isDark } = useTheme();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [outlets, setOutlets] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [designations, setDesignations] = useState<Array<{ id: string; name: string }>>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [outletFilter, setOutletFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const [showStartModal, setShowStartModal] = useState(false);
  const [candidateMode, setCandidateMode] = useState<"new" | "existing">("new");
  const [openComboId, setOpenComboId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const inviteModalRef = useRef<HTMLFormElement | null>(null);
  const [startForm, setStartForm] = useState({
    employeeId: "",
    firstName: "",
    lastName: "",
    personalEmail: "",
    phone: "",
    templateId: "",
    intendedOutletId: "",
    intendedDepartmentId: "",
    intendedDesignationId: "",
    intendedStartDate: new Date().toISOString().split("T")[0],
    intendedEmploymentStatus: "",
    intendedWorkerType: "",
    provisionAppAccess: false,
    appRoleId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [createdSessionData, setCreatedSessionData] = useState<{
    id: string;
    accessToken: string;
    employeeName: string;
    emailSent: boolean;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter !== "ALL") q.set("status", statusFilter);
      if (outletFilter) q.set("outletId", outletFilter);
      if (search.trim()) q.set("search", search.trim());

      const [resSessions, resTemplates, resEmployees, resOutlets, resDepts, resDesigs, resRoles] =
        await Promise.all([
          fetch(`/api/restaurant/onboarding/sessions?${q.toString()}`),
          fetch("/api/restaurant/onboarding/templates"),
          fetch("/api/restaurant/employees"),
          fetch("/api/restaurant/outlets"),
          fetch("/api/restaurant/departments"),
          fetch("/api/restaurant/designations"),
          fetch("/api/restaurant/roles"),
        ]);

      if (resSessions.ok) {
        const sessData = await resSessions.json();
        const sList = sessData.sessions || [];
        setSessions(sList);
        onCountChange?.(sList.length);
      }
      if (resTemplates.ok) {
        const tList = (await resTemplates.json()).templates || [];
        setTemplates(tList);
      }
      if (resEmployees.ok) setEmployees((await resEmployees.json()).employees || []);
      if (resOutlets.ok) {
        const oList = (await resOutlets.json()).outlets || [];
        setOutlets(oList);
      }
      if (resDepts.ok) setDepartments((await resDepts.json()).departments || []);
      if (resDesigs.ok) setDesignations((await resDesigs.json()).designations || []);
      if (resRoles.ok) setRoles((await resRoles.json()).roles || []);
    } catch {
      setError("Failed to load onboarding data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, outletFilter, search]);

  const employeeOptions = useMemo(
    () =>
      employees.map((e) => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName} (${e.employeeCode})`,
        searchText: `${e.firstName} ${e.lastName} ${e.employeeCode}`,
      })),
    [employees]
  );

  const templateOptions = useMemo(
    () =>
      templates.map((t) => ({
        value: t.id,
        label: `${t.name}${t.roleName ? ` (${t.roleName})` : ""}`,
      })),
    [templates]
  );

  const outletOptions = useMemo(
    () => outlets.map((o) => ({ value: o.id, label: o.name })),
    [outlets]
  );

  const departmentOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments]
  );

  const designationOptions = useMemo(
    () => designations.map((d) => ({ value: d.id, label: d.name })),
    [designations]
  );

  const statusOptions = useMemo(
    () => [
      { value: "PROBATION", label: "On probation" },
      { value: "ACTIVE", label: "Active" },
    ],
    []
  );

  const workerTypeOptions = useMemo(
    () => [
      { value: "FULL_TIME", label: "Full-Time" },
      { value: "PART_TIME", label: "Part-Time" },
      { value: "CONTRACT", label: "Contract" },
      { value: "TEMPORARY", label: "Temporary" },
    ],
    []
  );

  const appRoleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id, label: r.name })),
    [roles]
  );

  const handleStartOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (candidateMode === "existing" && !startForm.employeeId) {
      errs.employeeId = "Please select an employee profile.";
    }
    if (!startForm.templateId) {
      errs.templateId = "Please select a checklist template.";
    }
    if (!startForm.intendedOutletId) {
      errs.intendedOutletId = "Please select a primary outlet.";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        templateId: startForm.templateId,
        intendedOutletId: startForm.intendedOutletId || null,
        intendedDepartmentId: startForm.intendedDepartmentId || null,
        intendedDesignationId: startForm.intendedDesignationId || null,
        intendedStartDate: startForm.intendedStartDate || null,
        intendedEmploymentStatus: startForm.intendedEmploymentStatus || "PROBATION",
        intendedWorkerType: startForm.intendedWorkerType || "FULL_TIME",
        provisionAppAccess: startForm.provisionAppAccess,
        appRoleId: startForm.provisionAppAccess ? startForm.appRoleId || null : null,
      };

      if (candidateMode === "existing") {
        payload.employeeId = startForm.employeeId;
      } else {
        payload.candidate = {
          firstName: startForm.firstName,
          lastName: startForm.lastName,
          personalEmail: startForm.personalEmail,
          phone: startForm.phone,
        };
      }

      const res = await fetch("/api/restaurant/onboarding/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send onboarding invite");

      const empName =
        candidateMode === "existing"
          ? (() => {
              const e = employees.find((x) => x.id === startForm.employeeId);
              return e ? `${e.firstName} ${e.lastName}` : "Candidate";
            })()
          : `${startForm.firstName} ${startForm.lastName}`.trim();

      setShowStartModal(false);
      setCreatedSessionData({
        id: data.onboarding.id,
        accessToken: data.onboarding.accessToken,
        employeeName: empName,
        emailSent: Boolean(data.emailSent),
      });
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Error creating onboarding invite");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: OnboardingStatus) => {
    switch (status) {
      case "APPROVED":
        return isDark
          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
          : "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "PENDING_APPROVAL":
        return isDark
          ? "bg-amber-500/15 text-amber-300 border-amber-500/25"
          : "bg-amber-100 text-amber-800 border-amber-200";
      case "REJECTED":
        return isDark
          ? "bg-rose-500/15 text-rose-300 border-rose-500/25"
          : "bg-rose-100 text-rose-800 border-rose-200";
      case "IN_PROGRESS":
        return isDark
          ? "bg-[#0071E3]/15 text-[#58A6FF] border-[#0071E3]/25"
          : "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return isDark
          ? "bg-white/[0.06] text-[#A0A6B5] border-white/[0.08]"
          : "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getPrimaryActionLabel = (s: Session) => {
    if (s.status === "PENDING_APPROVAL") return "Review & Approve";
    if (s.status === "REJECTED") return "View Corrections";
    if (s.status === "PENDING") return "Manage Invite";
    return "View Session";
  };

  return (
    <div className="space-y-5">
      {/* Toolbar: Search, Outlet Filter, Templates, Invite */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate name, code, or template..."
              className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0071E3] ${
                isDark
                  ? "bg-[#121622]/80 border-white/[0.08] text-white"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            />
          </div>

          <select
            value={outletFilter}
            onChange={(e) => setOutletFilter(e.target.value)}
            className={`px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-[#0071E3] ${
              isDark
                ? "bg-[#121622]/80 border-white/[0.08] text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <option value="">All Outlets</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => router.push(`/restaurant/${subdomain}/workforce/onboarding/templates`)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
              isDark
                ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Templates ({templates.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setError("");
              setFieldErrors({});
              setOpenComboId(null);
              setStartForm({
                employeeId: "",
                firstName: "",
                lastName: "",
                personalEmail: "",
                phone: "",
                templateId: "",
                intendedOutletId: "",
                intendedDepartmentId: "",
                intendedDesignationId: "",
                intendedStartDate: new Date().toISOString().split("T")[0],
                intendedEmploymentStatus: "",
                intendedWorkerType: "",
                provisionAppAccess: false,
                appRoleId: "",
              });
              setShowStartModal(true);
            }}
            className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Invite Candidate</span>
          </button>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {(["ALL", "PENDING", "IN_PROGRESS", "PENDING_APPROVAL", "REJECTED", "APPROVED"] as const).map(
          (st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border shrink-0 ${
                statusFilter === st
                  ? "bg-[#0071E3] border-[#0071E3] text-white"
                  : isDark
                  ? "bg-[#0A0C12] border-white/[0.06] text-[#8F95A3] hover:text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              {st === "ALL" ? "All Candidates" : STATUS_LABELS[st]}
            </button>
          )
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-xs opacity-60">Loading onboarding pipeline...</div>
      ) : sessions.length === 0 ? (
        <div
          className={`p-10 text-center rounded-3xl border text-xs space-y-1.5 ${
            isDark
              ? "bg-[#121622]/40 border-white/[0.06] text-[#8F95A3]"
              : "bg-white border-slate-200 text-slate-500"
          }`}
        >
          <p className="font-semibold text-sm">No onboarding sessions match these filters</p>
          <p>Click &quot;+ Invite Candidate&quot; to send a role-based checklist.</p>
        </div>
      ) : (
        <>
          {/* Mobile Rows */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {sessions.map((s) => {
              const label = s.statusLabel || STATUS_LABELS[s.status] || s.status;
              const done = s.progressSummary?.completedCount ?? s.progresses.filter((p) => ["COMPLETED", "WAIVED"].includes(p.status)).length;
              const total = s.progressSummary?.totalCount ?? s.progresses.length;
              const pct = s.progressSummary?.percent ?? (total > 0 ? Math.round((done / total) * 100) : 0);

              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isDark
                      ? "bg-[#121622]/80 border-white/[0.08]"
                      : "bg-white border-slate-200/80 shadow-xs"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                        {s.employee.firstName} {s.employee.lastName}
                      </p>
                      <p className={`text-[11px] truncate ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        {s.intendedDesignation?.name || s.template.roleName || s.template.name} •{" "}
                        {s.intendedOutlet?.name || "Unassigned Outlet"}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadge(s.status)}`}>
                      {label}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={isDark ? "text-[#8F95A3]" : "text-slate-500"}>
                        Checklist Progress
                      </span>
                      <span className="font-semibold">
                        {done}/{total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#0071E3] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/restaurant/${subdomain}/workforce/onboarding/${s.id}`)}
                    className="w-full py-2 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white transition cursor-pointer"
                  >
                    {getPrimaryActionLabel(s)} →
                  </button>
                </div>
              );
            })}
          </div>

          {/* Desktop Compact Table */}
          <div
            className={`hidden md:block rounded-3xl border overflow-hidden ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr
                    className={`border-b text-[11px] font-medium uppercase tracking-wider ${
                      isDark
                        ? "bg-[#0A0C12]/50 border-white/[0.06] text-[#8F95A3]"
                        : "bg-slate-50/70 border-slate-100 text-slate-500"
                    }`}
                  >
                    <th className="p-4">Candidate</th>
                    <th className="p-4">Intended Role</th>
                    <th className="p-4">Outlet</th>
                    <th className="p-4">Progress</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Next Action</th>
                  </tr>
                </thead>
                <tbody className={`divide-y text-xs ${isDark ? "divide-white/[0.04]" : "divide-slate-100"}`}>
                  {sessions.map((s) => {
                    const label = s.statusLabel || STATUS_LABELS[s.status] || s.status;
                    const done = s.progressSummary?.completedCount ?? s.progresses.filter((p) => ["COMPLETED", "WAIVED"].includes(p.status)).length;
                    const total = s.progressSummary?.totalCount ?? s.progresses.length;
                    const pct = s.progressSummary?.percent ?? (total > 0 ? Math.round((done / total) * 100) : 0);

                    return (
                      <tr
                        key={s.id}
                        className={`transition ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50/60"}`}
                      >
                        <td className="p-4">
                          <p className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                            {s.employee.firstName} {s.employee.lastName}
                          </p>
                          <p className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                            {s.employee.employeeCode}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">
                            {s.intendedDesignation?.name || s.template.roleName || s.template.name}
                          </p>
                          <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            {s.template.name}
                          </p>
                        </td>
                        <td className="p-4 font-medium">
                          {s.intendedOutlet?.name || "Unassigned"}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                              <div className="h-full bg-[#0071E3] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[11px] font-semibold">
                              {done}/{total}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${getStatusBadge(s.status)}`}>
                              {label}
                            </span>
                            {s.isRevoked && (
                              <span className="text-[10px] font-semibold text-rose-500">Revoked</span>
                            )}
                            {!s.isRevoked && s.isExpired && (
                              <span className="text-[10px] font-semibold text-amber-500">Expired</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => router.push(`/restaurant/${subdomain}/workforce/onboarding/${s.id}`)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                              s.status === "PENDING_APPROVAL"
                                ? "bg-[#0071E3] hover:bg-[#0077ED] text-white"
                                : isDark
                                ? "bg-white/[0.06] hover:bg-white/[0.1] text-white"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                            }`}
                          >
                            {getPrimaryActionLabel(s)} →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL: Invite Candidate */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <form
            ref={inviteModalRef}
            onSubmit={handleStartOnboarding}
            className={`w-full max-w-lg rounded-3xl border p-4 sm:p-6 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto overflow-x-hidden ${
              isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Invite Candidate to Onboarding</h3>
              <button
                type="button"
                onClick={() => {
                  setOpenComboId(null);
                  setShowStartModal(false);
                }}
                className="text-xs text-slate-400 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setOpenComboId(null);
                  setCandidateMode("new");
                }}
                className={`py-1.5 rounded-lg font-semibold cursor-pointer ${
                  candidateMode === "new" ? "bg-white dark:bg-[#0A0C12] shadow-2xs" : "opacity-70"
                }`}
              >
                New Candidate
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenComboId(null);
                  setCandidateMode("existing");
                }}
                className={`py-1.5 rounded-lg font-semibold cursor-pointer ${
                  candidateMode === "existing" ? "bg-white dark:bg-[#0A0C12] shadow-2xs" : "opacity-70"
                }`}
              >
                Existing Profile
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {candidateMode === "existing" ? (
                <div className="sm:col-span-2">
                  <SearchableCombobox
                    id="invite-employee-profile"
                    label="Employee Profile"
                    required
                    value={startForm.employeeId}
                    onChange={(val) => {
                      setStartForm((prev) => ({ ...prev, employeeId: val }));
                      setFieldErrors((prev) => ({ ...prev, employeeId: "" }));
                    }}
                    options={employeeOptions}
                    placeholder="Search by name or employee code..."
                    isOpen={openComboId === "employee"}
                    onOpenChange={(open) => setOpenComboId(open ? "employee" : null)}
                    isDark={isDark}
                    error={fieldErrors.employeeId}
                    modalContainerRef={inviteModalRef}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-medium mb-1 opacity-70">First Name *</label>
                    <input
                      required
                      value={startForm.firstName}
                      onChange={(e) => setStartForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl border ${
                        isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1 opacity-70">Last Name *</label>
                    <input
                      required
                      value={startForm.lastName}
                      onChange={(e) => setStartForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl border ${
                        isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1 opacity-70">Email</label>
                    <input
                      type="email"
                      value={startForm.personalEmail}
                      onChange={(e) => setStartForm((prev) => ({ ...prev, personalEmail: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl border ${
                        isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1 opacity-70">Phone</label>
                    <input
                      value={startForm.phone}
                      onChange={(e) => setStartForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-xl border ${
                        isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                      }`}
                    />
                  </div>
                </>
              )}

              <div className="sm:col-span-2">
                <SearchableCombobox
                  id="invite-checklist-template"
                  label="Role-Based Checklist Template"
                  required
                  value={startForm.templateId}
                  onChange={(val) => {
                    setStartForm((prev) => ({ ...prev, templateId: val }));
                    setFieldErrors((prev) => ({ ...prev, templateId: "" }));
                  }}
                  options={templateOptions}
                  placeholder="Select template..."
                  isOpen={openComboId === "template"}
                  onOpenChange={(open) => setOpenComboId(open ? "template" : null)}
                  isDark={isDark}
                  error={fieldErrors.templateId}
                  modalContainerRef={inviteModalRef}
                />
              </div>

              <div>
                <SearchableCombobox
                  id="invite-primary-outlet"
                  label="Primary Outlet"
                  required
                  value={startForm.intendedOutletId}
                  onChange={(val) => {
                    setStartForm((prev) => ({ ...prev, intendedOutletId: val }));
                    setFieldErrors((prev) => ({ ...prev, intendedOutletId: "" }));
                  }}
                  options={outletOptions}
                  placeholder="Select outlet..."
                  isOpen={openComboId === "outlet"}
                  onOpenChange={(open) => setOpenComboId(open ? "outlet" : null)}
                  isDark={isDark}
                  error={fieldErrors.intendedOutletId}
                  modalContainerRef={inviteModalRef}
                />
              </div>

              <div>
                <label className="block font-medium mb-1 opacity-70">Intended Start Date</label>
                <input
                  type="date"
                  value={startForm.intendedStartDate}
                  onChange={(e) => setStartForm((prev) => ({ ...prev, intendedStartDate: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-xl border ${
                    isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              <div>
                <SearchableCombobox
                  id="invite-department"
                  label="Department"
                  value={startForm.intendedDepartmentId}
                  onChange={(val) =>
                    setStartForm((prev) => ({ ...prev, intendedDepartmentId: val }))
                  }
                  options={departmentOptions}
                  placeholder="Search department..."
                  isOpen={openComboId === "department"}
                  onOpenChange={(open) => setOpenComboId(open ? "department" : null)}
                  isDark={isDark}
                  modalContainerRef={inviteModalRef}
                />
              </div>

              <div>
                <SearchableCombobox
                  id="invite-designation"
                  label="Role / Designation"
                  value={startForm.intendedDesignationId}
                  onChange={(val) =>
                    setStartForm((prev) => ({ ...prev, intendedDesignationId: val }))
                  }
                  options={designationOptions}
                  placeholder="Search role / designation..."
                  isOpen={openComboId === "designation"}
                  onOpenChange={(open) => setOpenComboId(open ? "designation" : null)}
                  isDark={isDark}
                  modalContainerRef={inviteModalRef}
                />
              </div>

              <div>
                <SearchableCombobox
                  id="invite-activation-status"
                  label="Activation Status"
                  value={startForm.intendedEmploymentStatus}
                  onChange={(val) =>
                    setStartForm((prev) => ({ ...prev, intendedEmploymentStatus: val }))
                  }
                  options={statusOptions}
                  placeholder="Search status..."
                  isOpen={openComboId === "status"}
                  onOpenChange={(open) => setOpenComboId(open ? "status" : null)}
                  isDark={isDark}
                  modalContainerRef={inviteModalRef}
                />
              </div>

              <div>
                <SearchableCombobox
                  id="invite-worker-type"
                  label="Worker Type"
                  value={startForm.intendedWorkerType}
                  onChange={(val) =>
                    setStartForm((prev) => ({ ...prev, intendedWorkerType: val }))
                  }
                  options={workerTypeOptions}
                  placeholder="Search worker type..."
                  isOpen={openComboId === "workerType"}
                  onOpenChange={(open) => setOpenComboId(open ? "workerType" : null)}
                  isDark={isDark}
                  modalContainerRef={inviteModalRef}
                />
              </div>

              <div className="sm:col-span-2 pt-1 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={startForm.provisionAppAccess}
                    onChange={(e) =>
                      setStartForm((prev) => ({ ...prev, provisionAppAccess: e.target.checked }))
                    }
                  />
                  <span className="font-medium">Provision app login on approval</span>
                </label>

                {startForm.provisionAppAccess && (
                  <SearchableCombobox
                    id="invite-app-role"
                    label="App Role"
                    value={startForm.appRoleId}
                    onChange={(val) =>
                      setStartForm((prev) => ({ ...prev, appRoleId: val }))
                    }
                    options={appRoleOptions}
                    placeholder="Select app role..."
                    isOpen={openComboId === "appRole"}
                    onOpenChange={(open) => setOpenComboId(open ? "appRole" : null)}
                    isDark={isDark}
                    modalContainerRef={inviteModalRef}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowStartModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0071E3] hover:bg-[#0077ED] text-white cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? "Sending..." : "Create & Send Invite"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Invitation Created */}
      {createdSessionData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-3xl border p-6 space-y-4 shadow-2xl ${
              isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Invitation Ready</h3>
                <p className="text-xs opacity-70">
                  {createdSessionData.employeeName}
                  {createdSessionData.emailSent ? " • Email dispatched" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/onboarding/portal/${createdSessionData.accessToken}`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "Copied Link" : "Copy Candidate Link"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const sid = createdSessionData.id;
                  setCreatedSessionData(null);
                  router.push(`/restaurant/${subdomain}/workforce/onboarding/${sid}`);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#0071E3] text-white cursor-pointer"
              >
                Open Review Screen →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
