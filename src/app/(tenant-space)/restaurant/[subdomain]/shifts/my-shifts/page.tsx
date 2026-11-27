"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import {
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  Moon,
  Send,
} from "lucide-react";

interface ShiftItem {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  roleName?: string | null;
  outlet: { id: string; name: string; timezone: string };
  template?: { name: string; color: string } | null;
  roster?: { id: string; name: string; status: string } | null;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employmentRecords?: Array<{ designation?: { name: string } | null }>;
  };
}

interface RosterItem {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  availabilityDeadline?: string | null;
  outlet?: { id: string; name: string; timezone: string };
}

function calcPaidHours(start: string, end: string, breakMins: number): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let gross = eh * 60 + em - (sh * 60 + sm);
  if (gross <= 0) gross += 24 * 60;
  return Math.max(0, Math.round(((gross - breakMins) / 60) * 100) / 100);
}

export default function MyShiftsPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [openRosters, setOpenRosters] = useState<RosterItem[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState<string>("");
  const [availData, setAvailData] = useState<any>(null);
  const [availDraft, setAvailDraft] = useState<Record<string, { type: string; from: string; until: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingAvail, setSavingAvail] = useState(false);
  const [availMsg, setAvailMsg] = useState("");
  const [swapTargetShift, setSwapTargetShift] = useState<ShiftItem | null>(null);
  const [swapReason, setSwapReason] = useState("");
  const [swapMsg, setSwapMsg] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [resRosters, resAssign] = await Promise.all([
          fetch("/api/restaurant/shifts/rosters"),
          fetch("/api/restaurant/shifts/assignments"),
        ]);

        if (resRosters.ok) {
          const d = await resRosters.json();
          const allRosters: RosterItem[] = d.rosters || [];
          const open = allRosters.filter((r) => r.status === "AVAILABILITY_OPEN");
          setOpenRosters(open);
          if (open.length > 0) setSelectedRosterId(open[0].id);

          // If user is manager and assignments returned all employees, filter to own employeeId if linked
          const empId = d.permissions?.employeeId;
          if (resAssign.ok) {
            const ad = await resAssign.json();
            const list: ShiftItem[] = (ad.assignments || []).filter((a: any) =>
              empId ? a.employee?.id === empId || a.employeeId === empId : true
            );
            // Keep only published/completed shifts on My Shifts
            setShifts(
              list.filter(
                (a) => !a.roster || a.roster.status === "PUBLISHED" || a.roster.status === "COMPLETED"
              )
            );
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedRosterId) return;
    fetch(`/api/restaurant/shifts/rosters/${selectedRosterId}/my-availability`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d) {
          setAvailData(d);
          const days = d.myAvailability?.days || {};
          const nextDraft: Record<string, { type: string; from: string; until: string }> = {};
          for (const dateKey of d.dates || []) {
            const existing = days[dateKey];
            nextDraft[dateKey] = {
              type: existing?.type || "NOT_UPDATED",
              from: existing?.availableFrom || "09:00",
              until: existing?.availableUntil || "17:00",
            };
          }
          setAvailDraft(nextDraft);
        }
      })
      .catch(() => {});
  }, [selectedRosterId]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingShifts = useMemo(
    () =>
      shifts
        .filter((s) => s.shiftDate.slice(0, 10) >= todayStr)
        .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate) || a.startTime.localeCompare(b.startTime)),
    [shifts, todayStr]
  );

  const nextShift = upcomingShifts[0] || null;
  const laterShifts = upcomingShifts.slice(1);

  const handleSaveAndSubmitAvailability = async (submitFinal: boolean) => {
    if (!selectedRosterId) return;
    setSavingAvail(true);
    setAvailMsg("");
    try {
      const dateAvailabilities = Object.entries(availDraft)
        .filter(([, val]) => val.type !== "NOT_UPDATED" && val.type !== "LEAVE")
        .map(([date, val]) => ({
          date,
          type: val.type,
          availableFrom: val.type === "SPECIFIC_TIME" ? val.from : undefined,
          availableUntil: val.type === "SPECIFIC_TIME" ? val.until : undefined,
        }));

      const saveRes = await fetch(`/api/restaurant/shifts/rosters/${selectedRosterId}/my-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_dates", dateAvailabilities }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error || "Failed to save availability");
      }

      if (submitFinal) {
        const subRes = await fetch(`/api/restaurant/shifts/rosters/${selectedRosterId}/my-availability`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit" }),
        });
        if (!subRes.ok) {
          const err = await subRes.json();
          throw new Error(err.error || "Failed to submit availability");
        }
      }

      setAvailMsg(submitFinal ? "Availability submitted to manager." : "Draft availability saved.");
    } catch (e: any) {
      setAvailMsg(e.message || "Error saving availability");
    } finally {
      setSavingAvail(false);
    }
  };

  const handleRequestSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swapTargetShift) return;
    setSwapMsg("");
    try {
      const res = await fetch("/api/restaurant/shifts/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: swapTargetShift.id,
          reason: swapReason || "Requesting coverage",
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to request swap");
      setSwapTargetShift(null);
      setSwapReason("");
      setSwapMsg("Swap request submitted.");
    } catch (err: any) {
      setSwapMsg(err.message);
    }
  };

  return (
    <ModuleAccessGuard moduleKey="shifts" moduleName="My Shifts">
      <div
        className={`min-h-screen font-sans antialiased flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Shifts & Scheduling" />

        <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-6 py-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pl-12 lg:pl-0">
            <button
              type="button"
              onClick={() => router.push(`/restaurant/${subdomain}/shifts`)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0071E3] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Shift Operations</span>
            </button>
            <button
              type="button"
              onClick={() => router.push(`/restaurant/${subdomain}/shifts/swaps`)}
              className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer"
            >
              View Swaps
            </button>
          </div>

          <h1 className="text-xl font-bold tracking-tight">My Shifts</h1>

          {swapMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
              {swapMsg}
            </div>
          )}

          {/* Next Shift Hero Card */}
          <section
            className={`p-5 rounded-3xl border ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0071E3]">
                Next shift
              </span>
              {nextShift && nextShift.endTime <= nextShift.startTime && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  <Moon className="w-3 h-3" />
                  Overnight
                </span>
              )}
            </div>

            {loading ? (
              <p className="text-xs text-slate-400">Loading your schedule...</p>
            ) : !nextShift ? (
              <p className="text-xs text-slate-400">No upcoming published shifts scheduled.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-lg font-bold">{nextShift.shiftDate.slice(0, 10)}</div>
                  <div className="text-2xl font-bold font-mono text-[#0071E3] mt-0.5">
                    {nextShift.startTime} – {nextShift.endTime}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {calcPaidHours(nextShift.startTime, nextShift.endTime, nextShift.breakMinutes)} paid hrs ·{" "}
                    {nextShift.breakMinutes}m unpaid break
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-[#0071E3]" />
                    {nextShift.outlet.name} ({nextShift.outlet.timezone})
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5 font-medium">
                    {nextShift.roleName ||
                      nextShift.employee?.employmentRecords?.[0]?.designation?.name ||
                      "Staff"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSwapTargetShift(nextShift)}
                    className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0071E3]/10 text-[#0071E3] font-semibold cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Request Swap</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Submit Availability Panel (Visible when availability window is open) */}
          {openRosters.length > 0 && (
            <section
              className={`p-5 rounded-3xl border space-y-4 ${
                isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#0071E3]" />
                    <span>Submit Availability</span>
                  </h2>
                  {availData?.roster && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {availData.roster.name} ·{" "}
                      {availData.roster.availabilityDeadline
                        ? `Deadline: ${new Date(availData.roster.availabilityDeadline).toLocaleString()} (${availData.roster.outlet?.timezone || "UTC"})`
                        : `Outlet TZ: ${availData.roster.outlet?.timezone || "UTC"}`}
                    </p>
                  )}
                </div>

                {openRosters.length > 1 && (
                  <select
                    value={selectedRosterId}
                    onChange={(e) => setSelectedRosterId(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-xl border bg-transparent"
                  >
                    {openRosters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {availMsg && (
                <div className="p-2.5 rounded-xl bg-[#0071E3]/10 text-[#0071E3] text-xs font-medium">
                  {availMsg}
                </div>
              )}

              <div className="space-y-2">
                {(availData?.dates || []).map((dateKey: string) => {
                  const val = availDraft[dateKey] || { type: "NOT_UPDATED", from: "09:00", until: "17:00" };
                  const isLeave = availData?.myAvailability?.days?.[dateKey]?.type === "LEAVE";

                  return (
                    <div
                      key={dateKey}
                      className="p-3 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold font-mono">{dateKey}</span>
                        {isLeave ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20">
                            Approved leave
                          </span>
                        ) : (
                          <select
                            value={val.type}
                            onChange={(e) =>
                              setAvailDraft((prev) => ({
                                ...prev,
                                [dateKey]: { ...val, type: e.target.value },
                              }))
                            }
                            className={`px-2.5 py-1 text-xs rounded-xl border ${
                              isDark ? "bg-[#090B10] border-white/[0.1]" : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <option value="NOT_UPDATED">Not submitted</option>
                            <option value="AVAILABLE">Available</option>
                            <option value="SPECIFIC_TIME">Available at specific times</option>
                            <option value="NOT_AVAILABLE">Unavailable</option>
                          </select>
                        )}
                      </div>

                      {val.type === "SPECIFIC_TIME" && !isLeave && (
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="time"
                            value={val.from}
                            onChange={(e) =>
                              setAvailDraft((prev) => ({
                                ...prev,
                                [dateKey]: { ...val, from: e.target.value },
                              }))
                            }
                            className="px-2 py-1 rounded-lg border bg-transparent"
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={val.until}
                            onChange={(e) =>
                              setAvailDraft((prev) => ({
                                ...prev,
                                [dateKey]: { ...val, until: e.target.value },
                              }))
                            }
                            className="px-2 py-1 rounded-lg border bg-transparent"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={savingAvail}
                  onClick={() => handleSaveAndSubmitAvailability(false)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-black/10 dark:border-white/10 cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={savingAvail}
                  onClick={() => handleSaveAndSubmitAvailability(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{savingAvail ? "Submitting..." : "Submit Availability"}</span>
                </button>
              </div>
            </section>
          )}

          {/* Upcoming Shifts List */}
          <section
            className={`p-5 rounded-3xl border space-y-3 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <h2 className="text-sm font-bold">Upcoming published shifts</h2>
            {laterShifts.length === 0 ? (
              <p className="text-xs text-slate-400">No additional upcoming shifts.</p>
            ) : (
              <div className="space-y-2">
                {laterShifts.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-bold flex items-center gap-2">
                        <span>{s.shiftDate.slice(0, 10)}</span>
                        <span className="font-mono text-[#0071E3]">
                          {s.startTime} – {s.endTime}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {s.outlet.name} ({s.outlet.timezone}) ·{" "}
                        {s.roleName || s.employee?.employmentRecords?.[0]?.designation?.name || "Staff"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSwapTargetShift(s)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold rounded-xl bg-black/5 dark:bg-white/5 hover:text-[#0071E3] shrink-0 cursor-pointer"
                    >
                      Swap
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        {/* Swap Request Modal */}
        {swapTargetShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <form
              onSubmit={handleRequestSwap}
              className={`w-full max-w-md rounded-3xl border p-5 space-y-4 ${
                isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <h3 className="text-sm font-bold">Request Shift Swap</h3>
              <p className="text-xs text-slate-500">
                {swapTargetShift.shiftDate.slice(0, 10)} · {swapTargetShift.startTime}–{swapTargetShift.endTime} at{" "}
                {swapTargetShift.outlet.name}
              </p>
              <textarea
                rows={3}
                placeholder="Reason for swap request..."
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border bg-transparent"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSwapTargetShift(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0071E3] text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
