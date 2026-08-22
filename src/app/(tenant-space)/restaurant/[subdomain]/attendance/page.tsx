"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface LiveBoardStats {
  clockedInCount: number;
  onBreakCount: number;
  lateCount: number;
  completedShiftsCount: number;
  totalScheduledToday: number;
}

interface AttendanceRecordItem {
  id: string;
  workDate: string;
  status: "PRESENT" | "LATE" | "ON_BREAK" | "EARLY_DEPARTURE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";
  clockInTime: string | null;
  clockOutTime: string | null;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  isApproved: boolean;
  managerNotes?: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    workerType: string;
    profilePhotoUrl?: string;
    employmentRecords?: { department?: { name: string }; designation?: { title: string } }[];
  };
  outlet: { id: string; name: string };
  shiftAssignment?: { startTime: string; endTime: string };
  timePunches?: { id: string; punchType: string; punchTime: string }[];
}

interface LeaveRequestItem {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  managerNotes?: string;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string };
}

export default function AttendanceHubPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Navigation View
  const [activeTab, setActiveTab] = useState<"LIVE_FLOOR" | "TIMESHEETS" | "LEAVES" | "PIN_MANAGEMENT">("LIVE_FLOOR");

  // Live Floor State
  const [stats, setStats] = useState<LiveBoardStats>({
    clockedInCount: 0,
    onBreakCount: 0,
    lateCount: 0,
    completedShiftsCount: 0,
    totalScheduledToday: 0,
  });
  const [liveRecords, setLiveRecords] = useState<AttendanceRecordItem[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Timesheets State
  const [timesheets, setTimesheets] = useState<AttendanceRecordItem[]>([]);
  const [loadingTimesheets, setLoadingTimesheets] = useState(false);
  const [filterApproved, setFilterApproved] = useState<string>("ALL");

  // Leaves State
  const [leaves, setLeaves] = useState<LeaveRequestItem[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveEmployeeId, setLeaveEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState<string>("CASUAL");
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveDays, setLeaveDays] = useState(1);
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Employees for PIN config & leave
  const [employees, setEmployees] = useState<{ id: string; firstName: string; lastName: string; employeeCode: string; kioskPin?: string }[]>([]);
  const [selectedPinEmp, setSelectedPinEmp] = useState<string>("");
  const [pinInput, setPinInput] = useState<string>("");
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  // Outlets
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");

  // Live Timer Ticker: re-renders every 5 seconds so live time advances continuously
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Calculate live dynamic worked minutes for active employees
  const getLiveWorkedMinutes = (rec: AttendanceRecordItem): number => {
    if (rec.clockOutTime) {
      return rec.totalWorkMinutes || 0;
    }
    if (rec.clockInTime) {
      const clockInMs = new Date(rec.clockInTime).getTime();
      const breakMinutes = rec.totalBreakMinutes || 0;
      const elapsedMs = Math.max(0, currentTime - clockInMs);
      const elapsedMins = Math.floor(elapsedMs / (1000 * 60));
      return Math.max(0, elapsedMins - breakMinutes);
    }
    return rec.totalWorkMinutes || 0;
  };

  // Calculate live dynamic break minutes for employees currently on break
  const getLiveBreakMinutes = (rec: AttendanceRecordItem): number => {
    if (rec.status === "ON_BREAK" && rec.timePunches && rec.timePunches.length > 0) {
      const lastBreak = rec.timePunches.find((p) => p.punchType === "BREAK_START");
      if (lastBreak) {
        const breakStartMs = new Date(lastBreak.punchTime).getTime();
        const currentBreakMins = Math.floor(Math.max(0, currentTime - breakStartMs) / (1000 * 60));
        return (rec.totalBreakMinutes || 0) + currentBreakMins;
      }
    }
    return rec.totalBreakMinutes || 0;
  };

  // Fetch Live Board (with optional silent mode for seamless AJAX updates)
  const fetchLiveBoard = async (silent = false) => {
    try {
      if (!silent) setLoadingLive(true);
      setIsRefreshing(true);
      const url = selectedOutletId
        ? `/api/restaurant/attendance/live-board?outletId=${selectedOutletId}`
        : "/api/restaurant/attendance/live-board";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setLiveRecords(data.records || []);
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setLoadingLive(false);
      setIsRefreshing(false);
    }
  };

  // Fetch Timesheets
  const fetchTimesheets = async (silent = false) => {
    try {
      if (!silent) setLoadingTimesheets(true);
      let url = "/api/restaurant/attendance/records?";
      if (selectedOutletId) url += `outletId=${selectedOutletId}&`;
      if (filterApproved !== "ALL") url += `isApproved=${filterApproved === "APPROVED"}&`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTimesheets(data.records || []);
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setLoadingTimesheets(false);
    }
  };

  // Fetch Leaves
  const fetchLeaves = async (silent = false) => {
    try {
      if (!silent) setLoadingLeaves(true);
      const res = await fetch("/api/restaurant/attendance/leaves");
      if (res.ok) {
        const data = await res.json();
        setLeaves(data.leaves || []);
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setLoadingLeaves(false);
    }
  };

  // Real-Time Punch Event Listener & Background AJAX Polling
  useEffect(() => {
    // 1. BroadcastChannel for instant punch notifications from Kiosk or other windows
    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        channel = new BroadcastChannel("bahubali_attendance_channel");
        channel.onmessage = (event) => {
          if (event.data?.type === "PUNCH_RECORDED") {
            fetchLiveBoard(true);
            if (activeTab === "TIMESHEETS") fetchTimesheets(true);
          }
        };
      } catch {
        // ignore
      }
    }

    // 2. LocalStorage StorageEvent fallback
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "bahubali_attendance_last_punch") {
        fetchLiveBoard(true);
        if (activeTab === "TIMESHEETS") fetchTimesheets(true);
      }
    };
    window.addEventListener("storage", handleStorageEvent);

    // 3. Periodic 10-second AJAX background poll for active tabs
    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        if (activeTab === "LIVE_FLOOR") fetchLiveBoard(true);
        if (activeTab === "TIMESHEETS") fetchTimesheets(true);
      }
    }, 10000);

    return () => {
      if (channel) channel.close();
      window.removeEventListener("storage", handleStorageEvent);
      clearInterval(pollInterval);
    };
  }, [selectedOutletId, activeTab]);

  // Fetch Outlets & Employees
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [resOutlets, resEmployees] = await Promise.all([
          fetch("/api/restaurant/outlets"),
          fetch("/api/restaurant/employees"),
        ]);
        if (resOutlets.ok) {
          const oData = (await resOutlets.json()).outlets || [];
          setOutlets(oData);
        }
        if (resEmployees.ok) {
          const eData = (await resEmployees.json()).employees || [];
          setEmployees(eData);
          if (eData.length > 0) {
            setSelectedPinEmp(eData[0].id);
            setLeaveEmployeeId(eData[0].id);
          }
        }
      } catch {
        // ignore
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (activeTab === "LIVE_FLOOR") fetchLiveBoard();
    if (activeTab === "TIMESHEETS") fetchTimesheets();
    if (activeTab === "LEAVES") fetchLeaves();
  }, [activeTab, selectedOutletId, filterApproved]);

  // Handle Approve Timesheet Record
  const handleApproveRecord = async (recordId: string, isApproved: boolean) => {
    try {
      const res = await fetch("/api/restaurant/attendance/records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, isApproved }),
      });
      if (res.ok) {
        fetchTimesheets();
        fetchLiveBoard();
      }
    } catch {
      // ignore
    }
  };

  // Handle Leave Review
  const handleReviewLeave = async (leaveId: string, status: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch(`/api/restaurant/attendance/leaves/${leaveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) fetchLeaves();
    } catch {
      // ignore
    }
  };

  // Handle Leave Submission
  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLeave(true);
    try {
      const res = await fetch("/api/restaurant/attendance/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: leaveEmployeeId,
          leaveType,
          startDate: leaveStartDate,
          endDate: leaveEndDate,
          totalDays: Number(leaveDays),
          reason: leaveReason,
        }),
      });
      if (res.ok) {
        setShowLeaveModal(false);
        setLeaveReason("");
        fetchLeaves();
      }
    } catch {
      // ignore
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Handle PIN Update
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPinEmp || pinInput.length !== 4) {
      setPinMessage("Please enter a 4-digit numeric PIN.");
      return;
    }

    try {
      const res = await fetch("/api/restaurant/attendance/kiosk-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedPinEmp, kioskPin: pinInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setPinMessage(`Success: 4-digit PIN configured!`);
        setPinInput("");
      } else {
        setPinMessage(`Error: ${data.error}`);
      }
    } catch {
      setPinMessage("Failed to set PIN");
    }
  };

  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  return (
    <ModuleAccessGuard moduleKey="attendance" moduleName="Time & Attendance" activeSection="Attendance">
      <div className={`min-h-screen transition-colors duration-200 ${isDark ? "bg-[#0A0C12] text-white" : "bg-[#F5F5F7] text-slate-900"}`}>
        <RestaurantNavbar activeSection="Attendance" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                isDark ? "bg-[#0071E3]/20 text-[#64B5FF] border-[#0071E3]/30" : "bg-blue-100 text-[#0071E3] border-blue-200"
              }`}>
                Time & Attendance Hub
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              Staff Attendance & Timesheets
            </h1>
            <p className={`text-xs mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Real-time floor presence, PIN-based tablet terminal clocking, and timesheet approvals.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Launch Kiosk Terminal Button */}
            <Link
              href={`/restaurant/${subdomain}/attendance/kiosk`}
              target="_blank"
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <span>Launch Tablet Kiosk</span>
              <span>↗</span>
            </Link>

            {/* Outlet Filter */}
            {outlets.length > 1 && (
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className={`px-3 py-2 text-xs rounded-xl border font-medium ${
                  isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200"
                }`}
              >
                <option value="">All Outlets</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Live Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Clocked In Now
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-emerald-500 font-mono">{stats.clockedInCount}</span>
              <span className="text-[10px] text-emerald-500/80 font-medium">On Shift</span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              On Break
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-amber-500 font-mono">{stats.onBreakCount}</span>
              <span className="text-[10px] text-amber-500/80 font-medium">Resting</span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Late Arrivals
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-rose-500 font-mono">{stats.lateCount}</span>
              <span className="text-[10px] text-rose-500/80 font-medium">&gt;15 min delay</span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Completed Shifts
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-[#0071E3] font-mono">{stats.completedShiftsCount}</span>
              <span className="text-[10px] text-slate-400 font-medium">Clocked Out</span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border col-span-2 sm:col-span-1 ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Scheduled Today
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold font-mono">{stats.totalScheduledToday}</span>
              <span className="text-[10px] text-slate-400 font-medium">Rostered</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-black/[0.06] dark:border-white/[0.06] gap-2 pb-px overflow-x-auto">
          {[
            { key: "LIVE_FLOOR", label: "Live Floor Presence" },
            { key: "TIMESHEETS", label: "Timesheets & Approvals" },
            { key: "LEAVES", label: "Leave Requests" },
            { key: "PIN_MANAGEMENT", label: "Kiosk PIN Settings" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 cursor-pointer ${
                activeTab === tab.key
                  ? "border-[#0071E3] text-[#0071E3]"
                  : isDark
                  ? "border-transparent text-[#8F95A3] hover:text-white hover:bg-white/[0.02]"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-black/[0.02]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: LIVE FLOOR PRESENCE */}
        {activeTab === "LIVE_FLOOR" && (
          <div className={`rounded-3xl border overflow-hidden ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-sm"}`}>
            <div className="p-4 border-b border-black/[0.04] dark:border-white/[0.04] flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold">Today&apos;s Active Staff ({liveRecords.length})</h2>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Auto-Sync
                  </span>
                </div>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Real-time status of employees clocked in or on break today. Live worked time updates continuously.
                </p>
              </div>
              <button
                onClick={() => fetchLiveBoard(false)}
                className="px-3 py-1 text-xs font-semibold rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] cursor-pointer flex items-center gap-1.5 transition"
              >
                <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
                <span>Refresh</span>
              </button>
            </div>

            {loadingLive ? (
              <div className="py-16 text-center text-xs space-y-2">
                <div className="w-5 h-5 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading active floor records...</p>
              </div>
            ) : liveRecords.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <p className="text-sm font-semibold">No punches recorded yet today</p>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Staff can punch in using the tablet kiosk or mobile portal.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {liveRecords.map((rec) => {
                  const liveWorked = getLiveWorkedMinutes(rec);
                  const liveBreak = getLiveBreakMinutes(rec);
                  return (
                    <div key={rec.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#0071E3]/20 border border-[#0071E3]/30 flex items-center justify-center font-bold text-xs text-[#64B5FF]">
                          {rec.employee.firstName[0]}{rec.employee.lastName[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-sm font-bold">{rec.employee.firstName} {rec.employee.lastName}</strong>
                            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${isDark ? "bg-white/[0.04] text-[#8F95A3]" : "bg-slate-100 text-slate-600"}`}>
                              {rec.employee.employeeCode}
                            </span>
                          </div>
                          <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            {rec.employee.employmentRecords?.[0]?.department?.name || "General"} • {rec.outlet.name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className={`block text-[10px] font-bold uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>Clock In</span>
                          <span className="font-mono font-semibold">
                            {rec.clockInTime ? new Date(rec.clockInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </span>
                        </div>

                        <div>
                          <span className={`block text-[10px] font-bold uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>Worked</span>
                          <span className="font-mono font-semibold text-[#0071E3]">{formatMins(liveWorked)}</span>
                        </div>

                        <div>
                          <span className={`block text-[10px] font-bold uppercase ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>Break</span>
                          <span className="font-mono font-semibold text-amber-400">{formatMins(liveBreak)}</span>
                        </div>

                        <div>
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                            rec.status === "PRESENT"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : rec.status === "ON_BREAK"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse"
                              : rec.status === "LATE"
                              ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                          }`}>
                            {rec.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TIMESHEETS & APPROVALS */}
        {activeTab === "TIMESHEETS" && (
          <div className={`rounded-3xl border overflow-hidden ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-sm"}`}>
            <div className="p-4 border-b border-black/[0.04] dark:border-white/[0.04] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h2 className="text-sm font-bold">Timesheet Records & Approvals</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Verify worked hours, overtime, and punctuality before submitting to payroll runs.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filterApproved}
                  onChange={(e) => setFilterApproved(e.target.value)}
                  className={`px-3 py-1.5 text-xs rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                </select>
              </div>
            </div>

            {loadingTimesheets ? (
              <div className="py-16 text-center text-xs space-y-2">
                <div className="w-5 h-5 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading timesheets...</p>
              </div>
            ) : timesheets.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No timesheet records found for the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-slate-200 bg-slate-50"}`}>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Date</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Employee</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Clock In / Out</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Net Hours</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Overtime</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Punctuality</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Approval</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {timesheets.map((ts) => {
                      const liveWorked = getLiveWorkedMinutes(ts);
                      const isShiftActive = !ts.clockOutTime;

                      return (
                        <tr key={ts.id} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition">
                          <td className="p-3.5 font-mono">
                            {new Date(ts.workDate).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="p-3.5">
                            <strong className="block font-bold">{ts.employee.firstName} {ts.employee.lastName}</strong>
                            <span className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>{ts.employee.employeeCode}</span>
                          </td>
                          <td className="p-3.5 font-mono">
                            <div>
                              {ts.clockInTime ? new Date(ts.clockInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                              {" → "}
                              {ts.clockOutTime ? (
                                new Date(ts.clockOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              ) : (
                                <span className="text-amber-500 font-semibold">Active</span>
                              )}
                            </div>
                            {ts.totalBreakMinutes > 0 && (
                              <span className="text-[10px] text-amber-500">Break: {ts.totalBreakMinutes}m</span>
                            )}
                          </td>
                          <td className="p-3.5 font-bold font-mono text-[#0071E3]">
                            {formatMins(liveWorked)}
                          </td>
                          <td className="p-3.5 font-mono">
                            {ts.overtimeMinutes > 0 ? (
                              <span className="text-purple-400 font-bold">+{formatMins(ts.overtimeMinutes)}</span>
                            ) : (
                              <span className="opacity-40">—</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            {ts.lateMinutes > 0 ? (
                              <span className="text-rose-400 font-medium">Late ({ts.lateMinutes}m)</span>
                            ) : (
                              <span className="text-emerald-400 font-medium">On-Time</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            {ts.isApproved ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Approved
                              </span>
                            ) : isShiftActive ? (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                                isDark
                                  ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Active Session
                              </span>
                            ) : (
                              <button
                                onClick={() => handleApproveRecord(ts.id, true)}
                                className="px-3 py-1 bg-[#0071E3] hover:bg-[#0077ED] active:scale-95 text-white font-bold rounded-lg text-[11px] cursor-pointer shadow-xs transition"
                              >
                                Approve
                              </button>
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
        )}

        {/* TAB 3: LEAVE REQUESTS */}
        {activeTab === "LEAVES" && (
          <div className={`rounded-3xl border overflow-hidden ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-sm"}`}>
            <div className="p-4 border-b border-black/[0.04] dark:border-white/[0.04] flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold">Leave & PTO Requests</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Staff time-off applications and manager approvals.
                </p>
              </div>

              <button
                onClick={() => setShowLeaveModal(true)}
                className="px-3.5 py-1.5 bg-[#0071E3] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                + New Leave Request
              </button>
            </div>

            {loadingLeaves ? (
              <div className="py-16 text-center text-xs space-y-2">
                <div className="w-5 h-5 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Loading leave requests...</p>
              </div>
            ) : leaves.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No leave requests filed yet.
              </div>
            ) : (
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {leaves.map((l) => (
                  <div key={l.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold">{l.employee.firstName} {l.employee.lastName}</strong>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                          l.leaveType === "SICK"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                        }`}>
                          {l.leaveType}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        <strong>Dates:</strong> {new Date(l.startDate).toLocaleDateString()} to {new Date(l.endDate).toLocaleDateString()} ({l.totalDays} days)
                      </p>
                      <p className={`text-xs italic mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        &quot;{l.reason}&quot;
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {l.status === "PENDING" ? (
                        <>
                          <button
                            onClick={() => handleReviewLeave(l.id, "APPROVED")}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewLeave(l.id, "REJECTED")}
                            className="px-3 py-1 bg-rose-600/30 text-rose-300 hover:bg-rose-600/50 rounded-xl text-xs cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${
                          l.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                        }`}>
                          {l.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: KIOSK PIN MANAGEMENT */}
        {activeTab === "PIN_MANAGEMENT" && (
          <div className={`p-6 rounded-3xl border max-w-lg space-y-4 ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-sm"}`}>
            <div>
              <h2 className="text-base font-bold">Configure Tablet Kiosk 4-Digit PIN</h2>
              <p className={`text-xs mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Staff enter this 4-digit PIN at the kitchen or POS tablet terminal to clock in, take breaks, and clock out.
              </p>
            </div>

            <form onSubmit={handleSavePin} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Select Employee</label>
                <select
                  value={selectedPinEmp}
                  onChange={(e) => setSelectedPinEmp(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">New 4-Digit PIN</label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="e.g. 1234"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                  className={`w-full px-3.5 py-2 text-xs font-mono text-center tracking-widest text-lg rounded-xl border ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                  }`}
                />
              </div>

              {pinMessage && (
                <p className={`text-xs ${pinMessage.startsWith("Success") ? "text-emerald-400" : "text-rose-400"}`}>
                  {pinMessage}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Save Kiosk PIN
              </button>
            </form>
          </div>
        )}
      </main>

      {/* CREATE LEAVE MODAL */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white"}`}>
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold">New Leave Application</h2>
              <button
                onClick={() => setShowLeaveModal(false)}
                className={`cursor-pointer transition ${isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-900"}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLeave} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1">Employee</label>
                <select
                  value={leaveEmployeeId}
                  onChange={(e) => setLeaveEmployeeId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium mb-1">Leave Type</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                  >
                    <option value="CASUAL">Casual</option>
                    <option value="SICK">Sick</option>
                    <option value="ANNUAL">Annual / PTO</option>
                    <option value="UNPAID">Unpaid</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Total Days</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={leaveDays}
                    onChange={(e) => setLeaveDays(parseFloat(e.target.value) || 1)}
                    className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Reason</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Medical, personal emergency, etc."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50"}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowLeaveModal(false)} className="px-3 py-1.5">Cancel</button>
                <button type="submit" disabled={submittingLeave} className="px-4 py-1.5 bg-[#0071E3] text-white font-semibold rounded-xl">
                  {submittingLeave ? "Submitting..." : "Submit Leave"}
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
