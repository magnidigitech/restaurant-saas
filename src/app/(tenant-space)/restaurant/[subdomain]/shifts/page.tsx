"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import {
  Calendar,
  Clock,
  Users,
  ArrowLeftRight,
  Layers,
  ChevronRight,
  MapPin,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Plus,
} from "lucide-react";

interface Outlet {
  id: string;
  name: string;
  timezone: string;
}

interface Roster {
  id: string;
  name: string;
  outletId: string;
  startDate: string;
  endDate: string;
  status: string;
  version: number;
  availabilityDeadline?: string | null;
  publishedAt?: string | null;
  outlet?: Outlet;
  _count?: { assignments: number };
}

const ROSTER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20" },
  AVAILABILITY_OPEN: { label: "Collecting Availability", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  AVAILABILITY_LOCKED: { label: "Availability Locked", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  ASSIGNMENT_IN_PROGRESS: { label: "Scheduling in Progress", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  PUBLISHED: { label: "Published", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  COMPLETED: { label: "Completed", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  ARCHIVED: { label: "Archived", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
};

function getTodayKeyInTz(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default function ShiftsDashboard() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [templatesCount, setTemplatesCount] = useState(0);
  const [swaps, setSwaps] = useState<any[]>([]);
  const [canManageRoster, setCanManageRoster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [resOutlets, resRosters, resTemplates, resSwaps] = await Promise.all([
          fetch("/api/restaurant/outlets"),
          fetch("/api/restaurant/shifts/rosters"),
          fetch("/api/restaurant/shifts/templates"),
          fetch("/api/restaurant/shifts/swaps?status=PENDING"),
        ]);

        if (resOutlets.ok) {
          const d = await resOutlets.json();
          const list: Outlet[] = d.outlets || [];
          setOutlets(list);
          if (list.length > 0 && !selectedOutletId) {
            setSelectedOutletId(list[0].id);
          }
        }
        if (resRosters.ok) {
          const d = await resRosters.json();
          setRosters(d.rosters || []);
          if (d.permissions) {
            setCanManageRoster(Boolean(d.permissions.canManageRoster));
          }
        }
        if (resTemplates.ok) {
          const d = await resTemplates.json();
          setTemplatesCount((d.templates || []).length);
        }
        if (resSwaps.ok) {
          const d = await resSwaps.json();
          setSwaps(d.swaps || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedOutlet = useMemo(
    () => outlets.find((o) => o.id === selectedOutletId) || outlets[0] || null,
    [outlets, selectedOutletId]
  );

  const outletTimezone = selectedOutlet?.timezone || "UTC";
  const todayKey = useMemo(() => getTodayKeyInTz(outletTimezone), [outletTimezone]);

  useEffect(() => {
    if (!selectedOutletId) return;
    fetch(`/api/restaurant/shifts/assignments?outletId=${selectedOutletId}&startDate=${todayKey}&endDate=${todayKey}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.assignments) setAssignments(d.assignments);
      })
      .catch(() => {});
  }, [selectedOutletId, todayKey]);

  const outletRosters = useMemo(
    () => rosters.filter((r) => !selectedOutletId || r.outletId === selectedOutletId),
    [rosters, selectedOutletId]
  );

  const currentPublishedRoster = useMemo(
    () =>
      outletRosters.find(
        (r) =>
          r.status === "PUBLISHED" &&
          r.startDate.slice(0, 10) <= todayKey &&
          r.endDate.slice(0, 10) >= todayKey
      ) || outletRosters.find((r) => r.status === "PUBLISHED") || null,
    [outletRosters, todayKey]
  );

  const nextActionRoster = useMemo(
    () =>
      outletRosters.find((r) =>
        ["DRAFT", "AVAILABILITY_OPEN", "AVAILABILITY_LOCKED", "ASSIGNMENT_IN_PROGRESS"].includes(
          r.status
        )
      ) || null,
    [outletRosters]
  );

  const outletPendingSwaps = useMemo(
    () =>
      swaps.filter(
        (s) => !selectedOutletId || s.requesterAssignment?.outlet?.id === selectedOutletId
      ),
    [swaps, selectedOutletId]
  );

  const primaryAction = useMemo(() => {
    if (!canManageRoster) {
      return {
        label: "View My Shifts",
        href: `/restaurant/${subdomain}/shifts/my-shifts`,
      };
    }
    if (!nextActionRoster) {
      return {
        label: "Create roster",
        href: `/restaurant/${subdomain}/shifts/rosters?outletId=${selectedOutletId}&create=1`,
      };
    }
    switch (nextActionRoster.status) {
      case "DRAFT":
        return {
          label: "Continue scheduling",
          href: `/restaurant/${subdomain}/shifts/rosters?outletId=${selectedOutletId}&rosterId=${nextActionRoster.id}`,
        };
      case "AVAILABILITY_OPEN":
        return {
          label: "Review availability",
          href: `/restaurant/${subdomain}/shifts/rosters?outletId=${selectedOutletId}&rosterId=${nextActionRoster.id}&tab=availability`,
        };
      case "AVAILABILITY_LOCKED":
        return {
          label: "Continue scheduling",
          href: `/restaurant/${subdomain}/shifts/rosters?outletId=${selectedOutletId}&rosterId=${nextActionRoster.id}`,
        };
      case "ASSIGNMENT_IN_PROGRESS":
        return {
          label: "Review & publish",
          href: `/restaurant/${subdomain}/shifts/rosters?outletId=${selectedOutletId}&rosterId=${nextActionRoster.id}&review=1`,
        };
      default:
        return {
          label: "Open scheduler",
          href: `/restaurant/${subdomain}/shifts/rosters?outletId=${selectedOutletId}`,
        };
    }
  }, [canManageRoster, nextActionRoster, selectedOutletId, subdomain]);

  return (
    <ModuleAccessGuard moduleKey="shifts" moduleName="Shifts & Scheduling">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Shifts & Scheduling" />

        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Header & Primary Action */}
          <div
            className={`p-5 sm:p-7 rounded-3xl border flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Shift Operations</h1>
                {selectedOutlet && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
                    <MapPin className="w-3 h-3" />
                    <span>{selectedOutlet.name}</span>
                    <span className="opacity-70">({outletTimezone})</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Today ({todayKey}): {assignments.length} scheduled shift(s) · {outletPendingSwaps.length} pending swap(s)
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
              {outlets.length > 0 && (
                <select
                  value={selectedOutletId}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                  aria-label="Select outlet"
                  className={`px-3 py-2 text-xs font-medium rounded-xl border focus:outline-none focus:ring-1 focus:ring-[#0071E3] ${
                    isDark ? "bg-[#0F131D] border-white/[0.1] text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.timezone})
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => router.push(`/restaurant/${subdomain}/shifts/my-shifts`)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                  isDark
                    ? "bg-white/[0.04] border-white/[0.08] text-white hover:bg-white/[0.08]"
                    : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-[#0071E3]" />
                <span>My Shifts</span>
              </button>

              <button
                type="button"
                onClick={() => router.push(primaryAction.href)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{primaryAction.label}</span>
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Today's Shifts */}
            <button
              type="button"
              onClick={() =>
                router.push(`/restaurant/${subdomain}/shifts/rosters?outletId=${selectedOutletId}`)
              }
              className={`p-5 rounded-2xl border text-left transition hover:border-[#0071E3] cursor-pointer ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Today’s shifts</span>
                <Clock className="w-4 h-4 text-[#0071E3]" />
              </div>
              <div className="text-2xl font-bold font-mono">{loading ? "—" : assignments.length}</div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>{selectedOutlet?.name || "All outlets"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Current Published Roster */}
            <button
              type="button"
              onClick={() =>
                router.push(
                  currentPublishedRoster
                    ? `/restaurant/${subdomain}/shifts/rosters?outletId=${selectedOutletId}&rosterId=${currentPublishedRoster.id}`
                    : `/restaurant/${subdomain}/shifts/rosters?outletId=${selectedOutletId}`
                )
              }
              className={`p-5 rounded-2xl border text-left transition hover:border-[#0071E3] cursor-pointer ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Published roster</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-sm font-bold truncate">
                {currentPublishedRoster ? currentPublishedRoster.name : "No published roster"}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>
                  {currentPublishedRoster
                    ? `${currentPublishedRoster.startDate.slice(0, 10)} → ${currentPublishedRoster.endDate.slice(0, 10)}`
                    : "Publish a roster to notify staff"}
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Next Roster Awaiting Action */}
            <button
              type="button"
              onClick={() => router.push(primaryAction.href)}
              className={`p-5 rounded-2xl border text-left transition hover:border-[#0071E3] cursor-pointer ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Next awaiting action</span>
                <Calendar className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-sm font-bold truncate">
                {nextActionRoster ? nextActionRoster.name : "All caught up"}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                {nextActionRoster ? (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      ROSTER_STATUS_LABELS[nextActionRoster.status]?.color || ""
                    }`}
                  >
                    {ROSTER_STATUS_LABELS[nextActionRoster.status]?.label || nextActionRoster.status}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Create next cycle</span>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </button>

            {/* Pending Swaps */}
            <button
              type="button"
              onClick={() => router.push(`/restaurant/${subdomain}/shifts/swaps`)}
              className={`p-5 rounded-2xl border text-left transition hover:border-[#0071E3] cursor-pointer ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Pending swaps</span>
                <ArrowLeftRight className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold font-mono">{outletPendingSwaps.length}</div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Peer & manager reviews</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>

          {/* Main Actionable Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Today's Shifts */}
            <div
              className={`lg:col-span-7 p-5 sm:p-6 rounded-3xl border space-y-4 ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold">Today’s coverage ({todayKey})</h2>
                  <p className="text-xs text-slate-500">
                    Scheduled shifts at {selectedOutlet?.name || "selected outlet"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/restaurant/${subdomain}/shifts/rosters?outletId=${selectedOutletId}`)
                  }
                  className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer"
                >
                  Open roster grid
                </button>
              </div>

              {assignments.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-black/10 dark:border-white/10 rounded-2xl">
                  No shifts scheduled for today at this outlet.
                </div>
              ) : (
                <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                  {assignments.map((a) => (
                    <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {a.employee?.firstName} {a.employee?.lastName}
                          <span className="ml-2 text-[11px] font-normal text-slate-400">
                            {a.roleName || a.employee?.employmentRecords?.[0]?.designation?.name || "Staff"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                            {a.startTime} – {a.endTime}
                          </span>
                          {a.template?.name && (
                            <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[10px]">
                              {a.template.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                          a.roster?.status === "PUBLISHED"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {a.roster?.status === "PUBLISHED" ? "Published" : "Draft"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Navigation & Pending Swaps */}
            <div className="lg:col-span-5 space-y-4">
              {/* Pending Swaps List */}
              <div
                className={`p-5 rounded-3xl border space-y-3 ${
                  isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Pending swap requests</h2>
                  <button
                    type="button"
                    onClick={() => router.push(`/restaurant/${subdomain}/shifts/swaps`)}
                    className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer"
                  >
                    Manage swaps
                  </button>
                </div>

                {outletPendingSwaps.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No pending swap requests for this outlet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {outletPendingSwaps.slice(0, 4).map((sw) => (
                      <div
                        key={sw.id}
                        className="p-3 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {sw.requesterEmployee?.firstName} → {sw.targetEmployee?.firstName || "Open"}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {sw.requesterAssignment?.shiftDate?.slice(0, 10)} · {sw.requesterAssignment?.startTime}–{sw.requesterAssignment?.endTime}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                          {sw.peerStatus === "PENDING_PEER" ? "Awaiting coworker" : "Awaiting manager"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Tools */}
              <div
                className={`p-5 rounded-3xl border space-y-2.5 ${
                  isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                }`}
              >
                <h2 className="text-sm font-bold mb-1">Scheduling tools</h2>
                <button
                  type="button"
                  onClick={() => router.push(`/restaurant/${subdomain}/shifts/rosters?outletId=${selectedOutletId}`)}
                  className="w-full p-3 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] hover:border-[#0071E3] flex items-center justify-between text-xs transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 font-semibold">
                    <Users className="w-4 h-4 text-[#0071E3]" />
                    <span>Roster Scheduler & Revisions</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push(`/restaurant/${subdomain}/shifts/templates`)}
                  className="w-full p-3 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] hover:border-[#0071E3] flex items-center justify-between text-xs transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 font-semibold">
                    <Layers className="w-4 h-4 text-purple-500" />
                    <span>Shift Templates ({templatesCount})</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push(`/restaurant/${subdomain}/shifts/my-shifts`)}
                  className="w-full p-3 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] hover:border-[#0071E3] flex items-center justify-between text-xs transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 font-semibold">
                    <AlertCircle className="w-4 h-4 text-emerald-500" />
                    <span>My Shifts & Availability</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ModuleAccessGuard>
  );
}
