"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  workerType?: string;
  employmentRecords?: { department?: { name: string }; designation?: { title: string } }[];
}

interface LeaveRequestItem {
  id: string;
  leaveType: "CASUAL" | "SICK" | "ANNUAL" | "UNPAID" | "MATERNITY_PATERNITY";
  startDate: string;
  endDate: string;
  totalDays: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string;
  managerNotes?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    employmentRecords?: { department?: { name: string }; designation?: { title: string } }[];
  };
}

const LEAVE_TYPE_CONFIG: Record<
  string,
  { label: string; bgLight: string; textLight: string; bgDark: string; textDark: string; borderLight: string; borderDark: string }
> = {
  CASUAL: {
    label: "Casual Leave",
    bgLight: "bg-amber-50",
    textLight: "text-amber-800",
    bgDark: "bg-amber-500/15",
    textDark: "text-amber-300",
    borderLight: "border-amber-200",
    borderDark: "border-amber-500/25",
  },
  SICK: {
    label: "Sick Leave",
    bgLight: "bg-rose-50",
    textLight: "text-rose-800",
    bgDark: "bg-rose-500/15",
    textDark: "text-rose-300",
    borderLight: "border-rose-200",
    borderDark: "border-rose-500/25",
  },
  ANNUAL: {
    label: "Annual / Vacation",
    bgLight: "bg-purple-50",
    textLight: "text-purple-800",
    bgDark: "bg-purple-500/15",
    textDark: "text-purple-300",
    borderLight: "border-purple-200",
    borderDark: "border-purple-500/25",
  },
  UNPAID: {
    label: "Unpaid Leave",
    bgLight: "bg-slate-100",
    textLight: "text-slate-800",
    bgDark: "bg-white/[0.06]",
    textDark: "text-slate-300",
    borderLight: "border-slate-200",
    borderDark: "border-white/[0.1]",
  },
  MATERNITY_PATERNITY: {
    label: "Maternity / Paternity",
    bgLight: "bg-blue-50",
    textLight: "text-blue-800",
    bgDark: "bg-blue-500/15",
    textDark: "text-blue-300",
    borderLight: "border-blue-200",
    borderDark: "border-blue-500/25",
  },
};

export default function LeaveManagementPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [leaves, setLeaves] = useState<LeaveRequestItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [error, setError] = useState("");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    employeeId: "",
    leaveType: "CASUAL",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    totalDays: 1,
    reason: "",
  });
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Review Modal State
  const [reviewModal, setReviewModal] = useState<{
    show: boolean;
    leave: LeaveRequestItem | null;
    status: "APPROVED" | "REJECTED" | null;
    managerNotes: string;
  }>({
    show: false,
    leave: null,
    status: null,
    managerNotes: "",
  });
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchData = async () => {
    try {
      const [resLeaves, resEmployees] = await Promise.all([
        fetch("/api/restaurant/attendance/leaves"),
        fetch("/api/restaurant/employees"),
      ]);

      if (resLeaves.ok) {
        const data = await resLeaves.json();
        setLeaves(data.leaves || []);
      }
      if (resEmployees.ok) {
        const data = await resEmployees.json();
        const emps = data.employees || [];
        setEmployees(emps);
        if (emps.length > 0 && !createForm.employeeId) {
          setCreateForm((prev) => ({ ...prev, employeeId: emps[0].id }));
        }
      }
    } catch {
      setError("Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.employeeId || !createForm.reason) {
      setError("Please select an employee and state a reason.");
      return;
    }
    setSubmittingCreate(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/attendance/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          totalDays: Number(createForm.totalDays),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowCreateModal(false);
      setCreateForm({
        employeeId: employees[0]?.id || "",
        leaveType: "CASUAL",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
        totalDays: 1,
        reason: "",
      });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to submit leave request");
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleExecuteReview = async () => {
    if (!reviewModal.leave || !reviewModal.status) return;
    setSubmittingReview(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/attendance/leaves/${reviewModal.leave.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: reviewModal.status,
          managerNotes: reviewModal.managerNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setReviewModal({ show: false, leave: null, status: null, managerNotes: "" });
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to update leave request status");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Stats Calculations
  const pendingCount = leaves.filter((l) => l.status === "PENDING").length;
  const approvedCount = leaves.filter((l) => l.status === "APPROVED").length;
  const todayIso = new Date().toISOString().split("T")[0];
  const onLeaveTodayCount = leaves.filter((l) => {
    if (l.status !== "APPROVED") return false;
    const start = new Date(l.startDate).toISOString().split("T")[0];
    const end = new Date(l.endDate).toISOString().split("T")[0];
    return start <= todayIso && end >= todayIso;
  }).length;
  const rejectedCount = leaves.filter((l) => l.status === "REJECTED").length;

  // Filtered List
  const filteredLeaves = leaves.filter((l) => {
    const matchesSearch =
      search === "" ||
      `${l.employee.firstName} ${l.employee.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      l.employee.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
      l.reason.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || l.status === statusFilter;
    const matchesType = typeFilter === "ALL" || l.leaveType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Leave Management Hub...</p>
      </div>
    );
  }

  return (
    <ModuleAccessGuard moduleKey="attendance" moduleName="Time & Attendance" activeSection="Leaves">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Leaves" />

        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
                  onClick={() => router.push(`/restaurant/${subdomain}/attendance`)}
                  className={`text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  ← Attendance Hub
                </button>
                <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Time-Off & Absence Control
                </span>
              </div>

              <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Leave Management & Requests
              </h1>
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Review employee vacation quotas, sick leaves, manager approvals, and absence schedules.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/attendance`)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                  isDark
                    ? "bg-white/[0.04] border-white/[0.08] text-[#8F95A3] hover:text-white"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Floor Presence
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
              >
                + Request Leave
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
              {error}
            </div>
          )}

          {/* Executive Metrics Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              onClick={() => setStatusFilter("PENDING")}
              className={`p-5 rounded-3xl border transition cursor-pointer group ${
                statusFilter === "PENDING"
                  ? isDark
                    ? "bg-amber-500/[0.08] border-amber-500/40"
                    : "bg-amber-50 border-amber-300"
                  : isDark
                  ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.15]"
                  : "bg-white border-slate-200 shadow-xs hover:border-slate-300"
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Pending Approval
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-amber-500">{pendingCount}</span>
                <span className="text-[11px] text-amber-500/80 font-medium">Action Required</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter("APPROVED")}
              className={`p-5 rounded-3xl border transition cursor-pointer group ${
                statusFilter === "APPROVED"
                  ? isDark
                    ? "bg-emerald-500/[0.08] border-emerald-500/40"
                    : "bg-emerald-50 border-emerald-300"
                  : isDark
                  ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.15]"
                  : "bg-white border-slate-200 shadow-xs hover:border-slate-300"
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Approved Total
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-emerald-500">{approvedCount}</span>
                <span className="text-[11px] text-slate-400 font-medium">Records</span>
              </div>
            </div>

            <div className={`p-5 rounded-3xl border ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                On Leave Today
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-[#0071E3]">{onLeaveTodayCount}</span>
                <span className="text-[11px] text-blue-400 font-medium">Active Absence</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter("REJECTED")}
              className={`p-5 rounded-3xl border transition cursor-pointer group ${
                statusFilter === "REJECTED"
                  ? isDark
                    ? "bg-rose-500/[0.08] border-rose-500/40"
                    : "bg-rose-50 border-rose-300"
                  : isDark
                  ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.15]"
                  : "bg-white border-slate-200 shadow-xs hover:border-slate-300"
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Rejected / Cancelled
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-rose-500">{rejectedCount}</span>
                <span className="text-[11px] text-slate-400 font-medium">Archived</span>
              </div>
            </div>
          </div>

          {/* Filter Controls & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex gap-2 flex-wrap items-center w-full sm:w-auto">
              <input
                placeholder="Search by employee name, code, or reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full sm:w-80 px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                  isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                  isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={`px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                  isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
              >
                <option value="ALL">All Leave Types</option>
                <option value="CASUAL">Casual Leave</option>
                <option value="SICK">Sick Leave</option>
                <option value="ANNUAL">Annual / Vacation</option>
                <option value="UNPAID">Unpaid Leave</option>
                <option value="MATERNITY_PATERNITY">Maternity / Paternity</option>
              </select>
            </div>

            <span className={`text-xs font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Showing {filteredLeaves.length} of {leaves.length} requests
            </span>
          </div>

          {/* Leaves Table */}
          <div
            className={`p-6 rounded-3xl border transition space-y-4 ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            {filteredLeaves.length === 0 ? (
              <div className={`p-12 text-center text-xs space-y-2 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto text-[#8F95A3]">
                  🏖️
                </div>
                <p className="font-semibold text-sm">No leave requests found</p>
                <p className="opacity-75">Click &quot;+ Request Leave&quot; to file a new time-off application.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                      isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                    }`}>
                      <th className="pb-3 px-3">Employee</th>
                      <th className="pb-3 px-3">Leave Type</th>
                      <th className="pb-3 px-3">Duration & Dates</th>
                      <th className="pb-3 px-3">Reason</th>
                      <th className="pb-3 px-3">Status</th>
                      <th className="pb-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {filteredLeaves.map((leave) => {
                      const typeConfig = LEAVE_TYPE_CONFIG[leave.leaveType] || LEAVE_TYPE_CONFIG.CASUAL;
                      const formattedStart = new Date(leave.startDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                      const formattedEnd = new Date(leave.endDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });

                      return (
                        <tr key={leave.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[#0071E3]/15 border border-[#0071E3]/25 flex items-center justify-center font-bold text-xs text-[#64B5FF]">
                                {leave.employee.firstName[0]}{leave.employee.lastName[0]}
                              </div>
                              <div>
                                <span className={`font-semibold block ${isDark ? "text-white" : "text-slate-900"}`}>
                                  {leave.employee.firstName} {leave.employee.lastName}
                                </span>
                                <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                  {leave.employee.employeeCode}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isDark
                                  ? `${typeConfig.bgDark} ${typeConfig.textDark} ${typeConfig.borderDark}`
                                  : `${typeConfig.bgLight} ${typeConfig.textLight} ${typeConfig.borderLight}`
                              }`}
                            >
                              {typeConfig.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="space-y-0.5">
                              <span className={`font-mono font-bold block ${isDark ? "text-white" : "text-slate-900"}`}>
                                {leave.totalDays} {leave.totalDays === 1 ? "Day" : "Days"}
                              </span>
                              <span className={`text-[11px] block ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                {formattedStart} {leave.startDate !== leave.endDate ? `→ ${formattedEnd}` : ""}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 max-w-xs">
                            <p className={`truncate text-xs ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                              {leave.reason}
                            </p>
                            {leave.managerNotes && (
                              <p className={`text-[10px] italic mt-0.5 truncate ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                Note: {leave.managerNotes}
                              </p>
                            )}
                          </td>

                          <td className="py-3.5 px-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              leave.status === "APPROVED"
                                ? isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : leave.status === "PENDING"
                                ? isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/25 animate-pulse" : "bg-amber-100 text-amber-800 border-amber-200"
                                : leave.status === "REJECTED"
                                ? isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/25" : "bg-rose-100 text-rose-800 border-rose-200"
                                : isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}>
                              {leave.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-right">
                            {leave.status === "PENDING" ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReviewModal({
                                      show: true,
                                      leave,
                                      status: "APPROVED",
                                      managerNotes: "",
                                    })
                                  }
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-semibold rounded-lg transition cursor-pointer shadow-xs"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReviewModal({
                                      show: true,
                                      leave,
                                      status: "REJECTED",
                                      managerNotes: "",
                                    })
                                  }
                                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition cursor-pointer ${
                                    isDark
                                      ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                                      : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                                  }`}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className={`text-[11px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                {leave.reviewedAt ? new Date(leave.reviewedAt).toLocaleDateString() : "—"}
                              </span>
                            )}
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

        {/* Request Leave Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold tracking-tight">File Leave Request</h2>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Submit absence dates and request supervisor review.
                  </p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateLeave} className="space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Employee *
                  </label>
                  <select
                    required
                    value={createForm.employeeId}
                    onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition cursor-pointer ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Leave Category *
                    </label>
                    <select
                      value={createForm.leaveType}
                      onChange={(e) => setCreateForm({ ...createForm, leaveType: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition cursor-pointer ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="CASUAL">Casual Leave</option>
                      <option value="SICK">Sick Leave</option>
                      <option value="ANNUAL">Annual / Vacation</option>
                      <option value="UNPAID">Unpaid Leave</option>
                      <option value="MATERNITY_PATERNITY">Maternity / Paternity</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Total Days *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      value={createForm.totalDays}
                      onChange={(e) => setCreateForm({ ...createForm, totalDays: parseFloat(e.target.value) || 1 })}
                      className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={createForm.startDate}
                      onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
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
                      value={createForm.endDate}
                      onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Reason / Explanation *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide details regarding the time-off request..."
                    value={createForm.reason}
                    onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCreate}
                    className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {submittingCreate ? "Submitting..." : "Submit Leave Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Manager Decision Modal */}
        {reviewModal.show && reviewModal.leave && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div
              className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-base font-bold tracking-tight">
                  {reviewModal.status === "APPROVED" ? "Approve Leave Request" : "Reject Leave Request"}
                </h2>
                <button
                  onClick={() => setReviewModal({ show: false, leave: null, status: null, managerNotes: "" })}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className={`p-4 rounded-2xl border ${
                reviewModal.status === "APPROVED"
                  ? isDark ? "bg-emerald-500/[0.08] border-emerald-500/20" : "bg-emerald-50/60 border-emerald-200"
                  : isDark ? "bg-rose-500/[0.08] border-rose-500/20" : "bg-rose-50/60 border-rose-200"
              }`}>
                <p className="text-sm font-bold">
                  {reviewModal.leave.employee.firstName} {reviewModal.leave.employee.lastName}
                </p>
                <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {reviewModal.leave.totalDays} Day(s) • {new Date(reviewModal.leave.startDate).toLocaleDateString()} to {new Date(reviewModal.leave.endDate).toLocaleDateString()}
                </p>
                <p className="text-xs mt-2 italic opacity-90">&quot;{reviewModal.leave.reason}&quot;</p>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Manager Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Add feedback or schedule adjustment remarks..."
                  value={reviewModal.managerNotes}
                  onChange={(e) => setReviewModal({ ...reviewModal, managerNotes: e.target.value })}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setReviewModal({ show: false, leave: null, status: null, managerNotes: "" })}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReview}
                  disabled={submittingReview}
                  className={`px-5 py-2 text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 ${
                    reviewModal.status === "APPROVED"
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20"
                      : "bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-600/20"
                  }`}
                >
                  {submittingReview
                    ? "Updating..."
                    : reviewModal.status === "APPROVED"
                    ? "Confirm Approval"
                    : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
