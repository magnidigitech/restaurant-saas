"use client";

import React, { useState, useEffect, use } from "react";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { CalendarOff, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";

interface LeaveRequestItem {
  id: string;
  employeeId: string;
  leaveType: "CASUAL" | "SICK" | "ANNUAL" | "UNPAID" | "MATERNITY_PATERNITY";
  startDate: string;
  endDate: string;
  totalDays: number;
  isPartialDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  hoursRequested?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string;
  managerNotes?: string | null;
  createdAt: string;
  outlet?: { id: string; name: string; timezone?: string } | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
}

interface ShiftConflict {
  assignmentId: string;
  outletId: string;
  outletName: string;
  outletTimezone: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleName: string;
  rosterName: string;
  canResolveInOutlet: boolean;
}

const LEAVE_LABELS: Record<string, string> = {
  ANNUAL: "Annual / Vacation",
  CASUAL: "Casual Leave",
  SICK: "Sick Leave",
  UNPAID: "Unpaid Leave",
  MATERNITY_PATERNITY: "Parental Leave",
};

export default function LeavesWorkspacePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [leaves, setLeaves] = useState<LeaveRequestItem[]>([]);
  const [balances, setBalances] = useState<Record<
    string,
    { allowance: number; used: number; pending: number; remaining: number }
  > | null>(null);
  const [permissions, setPermissions] = useState({
    canApproveLeaves: false,
    canRequestLeave: true,
    employeeId: null as string | null,
  });

  const [outlets, setOutlets] = useState<Array<{ id: string; name: string }>>([]);
  const [employees, setEmployees] = useState<
    Array<{ id: string; firstName: string; lastName: string; employeeCode: string }>
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Filters
  const [viewMode, setViewMode] = useState<"MANAGER" | "MY_LEAVE">("MANAGER");
  const [filterOutletId, setFilterOutletId] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [filterDate, setFilterDate] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");

  // Request Leave Modal
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqForm, setReqForm] = useState({
    employeeId: "",
    leaveType: "CASUAL",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    isPartialDay: false,
    startTime: "14:00",
    endTime: "18:00",
    reason: "",
    attachmentUrl: "",
    attachmentName: "",
  });
  const [submittingReq, setSubmittingReq] = useState(false);

  // Manager Review & Coverage Modal
  const [reviewLeave, setReviewLeave] = useState<LeaveRequestItem | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [conflicts, setConflicts] = useState<ShiftConflict[]>([]);
  const [crossOutletBlocker, setCrossOutletBlocker] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<
    Record<string, { action: "UNASSIGN" | "REASSIGN"; replacementEmployeeId?: string }>
  >({});
  const [managerNotes, setManagerNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filterOutletId) q.set("outletId", filterOutletId);
      if (filterStatus !== "ALL") q.set("status", filterStatus);
      if (filterType !== "ALL") q.set("leaveType", filterType);
      if (filterDate) {
        q.set("startDate", `${filterDate}T00:00:00.000Z`);
        q.set("endDate", `${filterDate}T23:59:59.999Z`);
      }
      if (viewMode === "MY_LEAVE" && permissions.employeeId) {
        q.set("employeeId", permissions.employeeId);
      } else if (filterEmployeeId) {
        q.set("employeeId", filterEmployeeId);
      }

      const res = await fetch(`/api/restaurant/attendance/leaves?${q.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLeaves(data.leaves || []);
        setBalances(data.balances || null);
        if (data.permissions) {
          setPermissions(data.permissions);
          if (!data.permissions.canApproveLeaves) {
            setViewMode("MY_LEAVE");
          }
        }
      } else {
        setError(data.error || "Failed to load leave requests");
      }
    } catch {
      setError("Network error loading leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/restaurant/outlets").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/restaurant/employees/roster-eligible").then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([oData, eData]) => {
        if (oData?.outlets) setOutlets(oData.outlets);
        if (eData?.employees) setEmployees(eData.employees);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [filterOutletId, filterStatus, filterType, filterDate, filterEmployeeId, viewMode]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReq(true);
    setError("");
    setNotice("");
    try {
      const s = new Date(reqForm.startDate);
      const en = new Date(reqForm.endDate);
      const diffDays = Math.max(
        1,
        Math.round((en.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
      );

      const res = await fetch("/api/restaurant/attendance/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(reqForm.employeeId ? { employeeId: reqForm.employeeId } : {}),
          leaveType: reqForm.leaveType,
          startDate: `${reqForm.startDate}T00:00:00.000Z`,
          endDate: `${reqForm.endDate}T00:00:00.000Z`,
          totalDays: reqForm.isPartialDay ? 0.5 : diffDays,
          isPartialDay: reqForm.isPartialDay,
          startTime: reqForm.isPartialDay ? reqForm.startTime : null,
          endTime: reqForm.isPartialDay ? reqForm.endTime : null,
          reason: reqForm.reason,
          attachmentUrl: reqForm.attachmentUrl || null,
          attachmentName: reqForm.attachmentName || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit leave");

      setRequestOpen(false);
      setReqForm({
        ...reqForm,
        reason: "",
        attachmentUrl: "",
        attachmentName: "",
      });
      setNotice("Leave request submitted.");
      await fetchLeaves();
    } catch (err: any) {
      setError(err.message || "Error submitting leave");
    } finally {
      setSubmittingReq(false);
    }
  };

  const openManagerReview = async (leave: LeaveRequestItem) => {
    setReviewLeave(leave);
    setImpactLoading(true);
    setConflicts([]);
    setCrossOutletBlocker(null);
    setResolutions({});
    setManagerNotes("");
    setReviewError("");

    try {
      const res = await fetch(`/api/restaurant/attendance/leaves/${leave.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load shift impact");

      const list: ShiftConflict[] = data.conflicts || [];
      setConflicts(list);
      setCrossOutletBlocker(data.unresolvedMessage || null);

      const defaults: Record<
        string,
        { action: "UNASSIGN" | "REASSIGN"; replacementEmployeeId?: string }
      > = {};
      for (const c of list) {
        if (c.canResolveInOutlet) {
          defaults[c.assignmentId] = { action: "UNASSIGN" };
        }
      }
      setResolutions(defaults);
    } catch (err: any) {
      setReviewError(err.message || "Failed to inspect shift conflicts");
    } finally {
      setImpactLoading(false);
    }
  };

  const handleDecision = async (status: "APPROVED" | "REJECTED" | "CANCELLED", leaveId?: string) => {
    const targetId = leaveId || reviewLeave?.id;
    if (!targetId) return;

    setReviewing(true);
    setReviewError("");
    try {
      const payload: Record<string, unknown> = { status };
      if (status !== "CANCELLED") {
        payload.managerNotes = managerNotes || undefined;
      }
      if (status === "APPROVED" && conflicts.length > 0) {
        payload.resolutions = conflicts.map((c) => ({
          assignmentId: c.assignmentId,
          action: resolutions[c.assignmentId]?.action || "UNASSIGN",
          replacementEmployeeId: resolutions[c.assignmentId]?.replacementEmployeeId,
        }));
      }

      const res = await fetch(`/api/restaurant/attendance/leaves/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process leave decision");

      setReviewLeave(null);
      setNotice(
        status === "APPROVED"
          ? `Leave approved${data.resolvedShiftsCount ? ` and ${data.resolvedShiftsCount} shift(s) updated` : ""}.`
          : `Leave ${status.toLowerCase()}.`
      );
      await fetchLeaves();
    } catch (err: any) {
      setReviewError(err.message || "Error processing decision");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <ModuleAccessGuard moduleKey="leave_management">
      <div
        className={`min-h-screen flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Leave" />

        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarOff className="w-5 h-5 text-[#0071E3]" />
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Leave, Time-Off &amp; Shift Coverage
                </h1>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Formal leave requests, balances, and published shift coverage resolution.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {permissions.canApproveLeaves && (
                <div className="p-1 rounded-xl bg-slate-200/70 dark:bg-white/[0.06] flex items-center text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("MANAGER")}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      viewMode === "MANAGER"
                        ? "bg-white dark:bg-[#121622] shadow-2xs"
                        : "opacity-70"
                    }`}
                  >
                    Approval Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("MY_LEAVE")}
                    className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      viewMode === "MY_LEAVE"
                        ? "bg-white dark:bg-[#121622] shadow-2xs"
                        : "opacity-70"
                    }`}
                  >
                    My Leave
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setRequestOpen(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0071E3] hover:bg-[#0077ED] text-white cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Request Leave</span>
              </button>
            </div>
          </div>

          {/* Leave Balances Strip (My Leave) */}
          {balances && (
            <div className="grid grid-cols-3 gap-3">
              {(["ANNUAL", "CASUAL", "SICK"] as const).map((lt) => {
                const b = balances[lt];
                if (!b) return null;
                return (
                  <div
                    key={lt}
                    className={`p-3.5 rounded-2xl border ${
                      isDark ? "bg-[#121622]/70 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                      {LEAVE_LABELS[lt]}
                    </p>
                    <p className="text-lg font-bold mt-0.5">
                      {b.remaining}d <span className="text-xs font-normal opacity-60">left</span>
                    </p>
                    <p className="text-[11px] opacity-60">
                      Used {b.used}d • Pending {b.pending}d
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
              {error}
            </div>
          )}
          {notice && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
            {viewMode === "MANAGER" && (
              <>
                <select
                  value={filterOutletId}
                  onChange={(e) => setFilterOutletId(e.target.value)}
                  className={`px-3 py-2 rounded-xl border ${
                    isDark ? "bg-[#121622] border-white/10" : "bg-white border-slate-200"
                  }`}
                >
                  <option value="">All Outlets</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterEmployeeId}
                  onChange={(e) => setFilterEmployeeId(e.target.value)}
                  className={`px-3 py-2 rounded-xl border ${
                    isDark ? "bg-[#121622] border-white/10" : "bg-white border-slate-200"
                  }`}
                >
                  <option value="">All Employees</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                    </option>
                  ))}
                </select>
              </>
            )}

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`px-3 py-2 rounded-xl border ${
                isDark ? "bg-[#121622] border-white/10" : "bg-white border-slate-200"
              }`}
            >
              <option value="ALL">All Types</option>
              <option value="ANNUAL">Annual / Vacation</option>
              <option value="CASUAL">Casual</option>
              <option value="SICK">Sick</option>
              <option value="UNPAID">Unpaid</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`px-3 py-2 rounded-xl border ${
                isDark ? "bg-[#121622] border-white/10" : "bg-white border-slate-200"
              }`}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Declined</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className={`px-3 py-2 rounded-xl border ${
                isDark ? "bg-[#121622] border-white/10" : "bg-white border-slate-200"
              }`}
            />
          </div>

          {/* Leave List: Mobile Cards + Desktop Table */}
          {loading ? (
            <div className="p-10 text-center text-xs opacity-60">Loading leave requests...</div>
          ) : leaves.length === 0 ? (
            <div
              className={`p-10 text-center rounded-3xl border text-xs ${
                isDark ? "bg-[#121622]/40 border-white/[0.06]" : "bg-white border-slate-200"
              }`}
            >
              No leave requests found for the current filters.
            </div>
          ) : (
            <>
              {/* Mobile Actionable Rows */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {leaves.map((l) => (
                  <div
                    key={l.id}
                    className={`p-4 rounded-2xl border space-y-2.5 ${
                      isDark ? "bg-[#121622]/80 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">
                          {l.employee.firstName} {l.employee.lastName}
                        </p>
                        <p className="text-[11px] opacity-65">
                          {LEAVE_LABELS[l.leaveType] || l.leaveType}
                          {l.outlet ? ` • ${l.outlet.name}` : ""}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          l.status === "APPROVED"
                            ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
                            : l.status === "PENDING"
                            ? "bg-amber-500/15 text-amber-500 border-amber-500/25"
                            : "bg-rose-500/15 text-rose-500 border-rose-500/25"
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>

                    <p className="text-xs opacity-80">
                      {new Date(l.startDate).toLocaleDateString()} →{" "}
                      {new Date(l.endDate).toLocaleDateString()}{" "}
                      {l.isPartialDay && l.startTime && l.endTime
                        ? `(${l.startTime}–${l.endTime})`
                        : `(${l.totalDays}d)`}
                    </p>

                    {l.status === "PENDING" && viewMode === "MANAGER" && permissions.canApproveLeaves && (
                      <button
                        type="button"
                        onClick={() => openManagerReview(l)}
                        className="w-full py-2 rounded-xl text-xs font-semibold bg-[#0071E3] text-white cursor-pointer"
                      >
                        Review &amp; Check Shifts →
                      </button>
                    )}

                    {l.status === "PENDING" &&
                      (viewMode === "MY_LEAVE" || !permissions.canApproveLeaves) &&
                      l.employeeId === permissions.employeeId && (
                        <button
                          type="button"
                          onClick={() => handleDecision("CANCELLED", l.id)}
                          className="w-full py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20 cursor-pointer"
                        >
                          Cancel Request
                        </button>
                      )}
                  </div>
                ))}
              </div>

              {/* Desktop Compact Table */}
              <div
                className={`hidden md:block rounded-3xl border overflow-hidden ${
                  isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"
                }`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr
                        className={`border-b text-[11px] uppercase tracking-wider ${
                          isDark
                            ? "bg-[#0A0C12]/50 border-white/[0.06] text-[#8F95A3]"
                            : "bg-slate-50 border-slate-100 text-slate-500"
                        }`}
                      >
                        <th className="p-4">Employee</th>
                        <th className="p-4">Outlet</th>
                        <th className="p-4">Leave Type</th>
                        <th className="p-4">Dates / Hours</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {leaves.map((l) => (
                        <tr key={l.id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.02]">
                          <td className="p-4">
                            <p className="font-semibold">
                              {l.employee.firstName} {l.employee.lastName}
                            </p>
                            <p className="text-[10px] font-mono opacity-60">
                              {l.employee.employeeCode}
                            </p>
                          </td>
                          <td className="p-4">{l.outlet?.name || "—"}</td>
                          <td className="p-4 font-medium">
                            {LEAVE_LABELS[l.leaveType] || l.leaveType}
                          </td>
                          <td className="p-4 font-mono">
                            {new Date(l.startDate).toLocaleDateString()} →{" "}
                            {new Date(l.endDate).toLocaleDateString()}
                            <span className="block text-[10px] opacity-65">
                              {l.isPartialDay && l.startTime && l.endTime
                                ? `Partial: ${l.startTime}–${l.endTime}`
                                : `${l.totalDays} day(s)`}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                l.status === "APPROVED"
                                  ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
                                  : l.status === "PENDING"
                                  ? "bg-amber-500/15 text-amber-500 border-amber-500/25"
                                  : "bg-rose-500/15 text-rose-500 border-rose-500/25"
                              }`}
                            >
                              {l.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {l.status === "PENDING" && permissions.canApproveLeaves ? (
                              <button
                                type="button"
                                onClick={() => openManagerReview(l)}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0071E3] text-white cursor-pointer"
                              >
                                Review &amp; Coverage
                              </button>
                            ) : l.status === "PENDING" && l.employeeId === permissions.employeeId ? (
                              <button
                                type="button"
                                onClick={() => handleDecision("CANCELLED", l.id)}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-500 cursor-pointer"
                              >
                                Cancel
                              </button>
                            ) : (
                              <span className="text-[11px] opacity-50">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>

        {/* MODAL: Request Leave */}
        {requestOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <form
              onSubmit={handleSubmitLeave}
              className={`w-full max-w-md rounded-3xl border p-6 space-y-4 shadow-2xl ${
                isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Request Time Off</h3>
                <button
                  type="button"
                  onClick={() => setRequestOpen(false)}
                  className="text-xs text-slate-400 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <p className="text-[11px] opacity-65">
                Formal leave requests block scheduling once approved and are separate from shift availability preferences.
              </p>

              <div className="space-y-3 text-xs">
                {permissions.canApproveLeaves && (
                  <div>
                    <label className="block font-medium mb-1 opacity-70">Employee</label>
                    <select
                      value={reqForm.employeeId}
                      onChange={(e) => setReqForm({ ...reqForm, employeeId: e.target.value })}
                      className={`w-full px-3 py-2 rounded-xl border ${
                        isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <option value="">My Profile</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.firstName} {e.lastName} ({e.employeeCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-medium mb-1 opacity-70">Leave Type</label>
                  <select
                    value={reqForm.leaveType}
                    onChange={(e) => setReqForm({ ...reqForm, leaveType: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <option value="CASUAL">Casual Leave</option>
                    <option value="SICK">Sick Leave</option>
                    <option value="ANNUAL">Annual / Vacation</option>
                    <option value="UNPAID">Unpaid Leave</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium mb-1 opacity-70">Start Date</label>
                    <input
                      type="date"
                      required
                      value={reqForm.startDate}
                      onChange={(e) => setReqForm({ ...reqForm, startDate: e.target.value })}
                      className={`w-full px-3 py-2 rounded-xl border ${
                        isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1 opacity-70">End Date</label>
                    <input
                      type="date"
                      required
                      value={reqForm.endDate}
                      onChange={(e) => setReqForm({ ...reqForm, endDate: e.target.value })}
                      className={`w-full px-3 py-2 rounded-xl border ${
                        isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                      }`}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqForm.isPartialDay}
                    onChange={(e) => setReqForm({ ...reqForm, isPartialDay: e.target.checked })}
                  />
                  <span>Partial-day leave (specific hours)</span>
                </label>

                {reqForm.isPartialDay && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium mb-1 opacity-70">Start Time</label>
                      <input
                        type="time"
                        value={reqForm.startTime}
                        onChange={(e) => setReqForm({ ...reqForm, startTime: e.target.value })}
                        className={`w-full px-3 py-2 rounded-xl border ${
                          isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1 opacity-70">End Time</label>
                      <input
                        type="time"
                        value={reqForm.endTime}
                        onChange={(e) => setReqForm({ ...reqForm, endTime: e.target.value })}
                        className={`w-full px-3 py-2 rounded-xl border ${
                          isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                        }`}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-medium mb-1 opacity-70">Reason *</label>
                  <textarea
                    required
                    rows={2}
                    value={reqForm.reason}
                    onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })}
                    placeholder="Reason for time off..."
                    className={`w-full px-3 py-2 rounded-xl border ${
                      isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setRequestOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReq}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0071E3] text-white cursor-pointer"
                >
                  {submittingReq ? "Submitting..." : "Submit Leave"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL: Manager Review & Shift Impact Preview */}
        {reviewLeave && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <div
              className={`w-full h-full sm:h-auto sm:max-w-xl sm:rounded-3xl border p-6 space-y-4 shadow-2xl overflow-y-auto ${
                isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">
                    Review Leave: {reviewLeave.employee.firstName} {reviewLeave.employee.lastName}
                  </h3>
                  <p className="text-xs opacity-70">
                    {LEAVE_LABELS[reviewLeave.leaveType]} •{" "}
                    {new Date(reviewLeave.startDate).toLocaleDateString()} →{" "}
                    {new Date(reviewLeave.endDate).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewLeave(null)}
                  className="text-xs text-slate-400 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div
                className={`p-3 rounded-2xl border text-xs ${
                  isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                }`}
              >
                <span className="font-semibold">Reason: </span>
                <span>{reviewLeave.reason}</span>
              </div>

              {reviewError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                  {reviewError}
                </div>
              )}

              {impactLoading ? (
                <p className="text-xs opacity-60">Checking published shifts for conflicts...</p>
              ) : conflicts.length === 0 ? (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                  No published shifts overlap this leave window.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Overlapping Published Shifts ({conflicts.length})</span>
                  </div>

                  {crossOutletBlocker && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs">
                      {crossOutletBlocker}
                    </div>
                  )}

                  {conflicts.map((c) => {
                    const resState = resolutions[c.assignmentId] || { action: "UNASSIGN" };
                    return (
                      <div
                        key={c.assignmentId}
                        className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
                          isDark ? "bg-[#0A0C12] border-white/10" : "bg-amber-50/50 border-amber-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-bold">
                              {c.outletName} • {c.roleName}
                            </p>
                            <p className="text-[11px] opacity-75">
                              {new Date(c.shiftDate).toLocaleDateString()} • {c.startTime}–{c.endTime} ({c.outletTimezone})
                            </p>
                          </div>
                        </div>

                        {c.canResolveInOutlet ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <select
                              value={resState.action}
                              onChange={(e) =>
                                setResolutions((prev) => ({
                                  ...prev,
                                  [c.assignmentId]: {
                                    action: e.target.value as "UNASSIGN" | "REASSIGN",
                                    replacementEmployeeId: prev[c.assignmentId]?.replacementEmployeeId,
                                  },
                                }))
                              }
                              className={`px-2.5 py-1.5 rounded-xl border ${
                                isDark ? "bg-[#121622] border-white/10" : "bg-white border-slate-200"
                              }`}
                            >
                              <option value="UNASSIGN">Unassign Shift (Leave Open)</option>
                              <option value="REASSIGN">Reassign to Replacement</option>
                            </select>

                            {resState.action === "REASSIGN" && (
                              <select
                                value={resState.replacementEmployeeId || ""}
                                onChange={(e) =>
                                  setResolutions((prev) => ({
                                    ...prev,
                                    [c.assignmentId]: {
                                      action: "REASSIGN",
                                      replacementEmployeeId: e.target.value,
                                    },
                                  }))
                                }
                                className={`px-2.5 py-1.5 rounded-xl border ${
                                  isDark ? "bg-[#121622] border-white/10" : "bg-white border-slate-200"
                                }`}
                              >
                                <option value="">Select replacement...</option>
                                {employees
                                  .filter((e) => e.id !== reviewLeave.employeeId)
                                  .map((e) => (
                                    <option key={e.id} value={e.id}>
                                      {e.firstName} {e.lastName}
                                    </option>
                                  ))}
                              </select>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-rose-500 font-medium">
                            Requires action by a manager authorized for {c.outletName}.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1 opacity-70">
                  Manager Notes (Optional)
                </label>
                <input
                  type="text"
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Optional note..."
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${
                    isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => handleDecision("REJECTED")}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20 cursor-pointer"
                >
                  Decline
                </button>
                <button
                  type="button"
                  disabled={reviewing || Boolean(crossOutletBlocker)}
                  onClick={() => handleDecision("APPROVED")}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-50"
                >
                  {reviewing
                    ? "Processing..."
                    : conflicts.length > 0
                    ? `Confirm Coverage & Approve`
                    : "Approve Leave"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
