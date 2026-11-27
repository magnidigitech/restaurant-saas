"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useTheme } from "@/core/theme/ThemeContext";

type PunchAction = "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT";

interface IdentifiedState {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
  outlet: { id: string; name: string; timezone?: string };
  currentState: "NOT_CLOCKED_IN" | "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT";
  validActions: PunchAction[];
  scheduledShift: {
    id: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
  } | null;
}

const ACTION_META: Record<
  PunchAction,
  { label: string; bg: string; desc: string }
> = {
  CLOCK_IN: {
    label: "Clock In",
    bg: "bg-emerald-600 hover:bg-emerald-500 text-white",
    desc: "Start your shift",
  },
  BREAK_START: {
    label: "Start Break",
    bg: "bg-amber-500 hover:bg-amber-400 text-white",
    desc: "Pause work for break",
  },
  BREAK_END: {
    label: "End Break",
    bg: "bg-[#0071E3] hover:bg-[#0077ED] text-white",
    desc: "Resume work from break",
  },
  CLOCK_OUT: {
    label: "Clock Out",
    bg: "bg-rose-600 hover:bg-rose-500 text-white",
    desc: "End your shift",
  },
};

export default function AttendanceKioskPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  const [outlets, setOutlets] = useState<
    { id: string; name: string; timezone?: string }[]
  >([]);
  const [selectedOutletId, setSelectedOutletId] = useState("");

  const [pin, setPin] = useState("");
  const [identifying, setIdentifying] = useState(false);
  const [identified, setIdentified] = useState<IdentifiedState | null>(null);

  const [submittingAction, setSubmittingAction] = useState<PunchAction | null>(
    null
  );
  const [pendingRetry, setPendingRetry] = useState<{
    action: PunchAction;
    idempotencyKey: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    employeeName: string;
    punchType: string;
    punchTime: string;
    duplicate?: boolean;
    totalHours?: number;
  } | null>(null);

  const selectedOutlet = outlets.find((o) => o.id === selectedOutletId) || null;
  const outletTz = selectedOutlet?.timezone || undefined;

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      try {
        setTimeStr(
          now.toLocaleTimeString([], {
            timeZone: outletTz,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
        );
        setDateStr(
          now.toLocaleDateString([], {
            timeZone: outletTz,
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        );
      } catch {
        setTimeStr(now.toLocaleTimeString());
        setDateStr(now.toLocaleDateString());
      }
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [outletTz]);

  useEffect(() => {
    fetch("/api/restaurant/outlets")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = data?.outlets || [];
        setOutlets(list);
        if (list.length > 0) setSelectedOutletId(list[0].id);
      })
      .catch(() => {});
  }, []);

  const resetKiosk = () => {
    setPin("");
    setIdentified(null);
    setSuccessData(null);
    setError(null);
    setPendingRetry(null);
    setSubmittingAction(null);
  };

  // Auto-reset after confirmation so next employee never sees previous details
  useEffect(() => {
    if (successData) {
      const timer = setTimeout(() => {
        resetKiosk();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successData]);

  const verifyPin = async (pinCode: string) => {
    if (!selectedOutletId || pinCode.length !== 4) return;
    setIdentifying(true);
    setError(null);
    try {
      const res = await fetch("/api/restaurant/attendance/kiosk/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: selectedOutletId,
          kioskPin: pinCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPin("");
        throw new Error(data.error || "Invalid PIN");
      }
      setIdentified(data);
    } catch (e: any) {
      setError(e.message || "Unable to verify PIN");
    } finally {
      setIdentifying(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (identifying || submittingAction || successData) return;
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      setError(null);
      if (next.length === 4) {
        verifyPin(next);
      }
    }
  };

  const handlePunch = async (
    action: PunchAction,
    existingKey?: string
  ) => {
    if (!identified || !selectedOutletId) return;
    const idempotencyKey =
      existingKey ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

    setSubmittingAction(action);
    setError(null);

    try {
      const res = await fetch("/api/restaurant/attendance/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: selectedOutletId,
          employeeId: identified.employee.id,
          punchType: action,
          idempotencyKey,
          deviceInfo: "Tablet Kiosk",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPendingRetry(null);
        throw new Error(data.error || "Failed to record punch");
      }

      setPendingRetry(null);
      setSuccessData({
        employeeName: `${identified.employee.firstName} ${identified.employee.lastName}`,
        punchType: ACTION_META[action].label,
        punchTime: new Date(data.punch?.punchTime || Date.now()).toLocaleTimeString(
          [],
          {
            timeZone: outletTz,
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }
        ),
        duplicate: Boolean(data.duplicate),
        totalHours: data.metrics?.netHours,
      });
    } catch (e: any) {
      // Network drop or server error -> offer safe idempotent retry
      if (e instanceof TypeError || !navigator.onLine) {
        setPendingRetry({ action, idempotencyKey });
        setError(
          "Network connection dropped. Tap Retry Punch safely to confirm whether your punch was recorded."
        );
      } else {
        setError(e.message || "Punch failed");
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 sm:p-8 select-none ${
        isDark ? "bg-[#090B10] text-white" : "bg-[#F5F5F7] text-slate-900"
      }`}
    >
      {/* Top Bar: Outlet & Local Time */}
      <header className="max-w-3xl w-full mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/restaurant/${subdomain}/attendance`}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              isDark
                ? "bg-white/[0.04] border-white/10 text-slate-300"
                : "bg-white border-slate-200 text-slate-700"
            }`}
          >
            ← Manager View
          </Link>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-60">
              Timeclock Kiosk {outletTz ? `• ${outletTz}` : ""}
            </p>
            <select
              value={selectedOutletId}
              onChange={(e) => {
                setSelectedOutletId(e.target.value);
                resetKiosk();
              }}
              aria-label="Select Kiosk Outlet"
              className={`text-sm font-bold bg-transparent focus:outline-none cursor-pointer ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {outlets.map((o) => (
                <option
                  key={o.id}
                  value={o.id}
                  className={isDark ? "bg-[#121622]" : "bg-white"}
                >
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sm:text-right">
          <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">
            {timeStr || "--:--:--"}
          </p>
          <p className="text-xs opacity-70">{dateStr}</p>
        </div>
      </header>

      {/* Main Kiosk Card */}
      <main className="max-w-md w-full mx-auto my-6">
        <div
          className={`rounded-3xl border p-6 sm:p-8 shadow-xl space-y-6 ${
            isDark
              ? "bg-[#121622] border-white/[0.08]"
              : "bg-white border-slate-200"
          }`}
        >
          {successData ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto text-3xl font-bold">
                ✓
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                  {successData.duplicate ? "Already Recorded" : "Punch Confirmed"}
                </p>
                <h2 className="text-2xl font-bold">{successData.employeeName}</h2>
                <p className="text-sm opacity-80">
                  {successData.punchType} at <strong>{successData.punchTime}</strong>
                </p>
                {typeof successData.totalHours === "number" && (
                  <p className="text-xs opacity-60">
                    Recorded worked time today: {successData.totalHours.toFixed(2)}h
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={resetKiosk}
                className="w-full py-3 rounded-2xl text-sm font-bold bg-[#0071E3] text-white cursor-pointer"
              >
                Done / Next Employee
              </button>
            </div>
          ) : identified ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-mono opacity-60">
                    {identified.employee.employeeCode}
                  </p>
                  <h2 className="text-xl font-bold">
                    {identified.employee.firstName} {identified.employee.lastName}
                  </h2>
                  <p className="text-xs opacity-75 mt-0.5">
                    Status:{" "}
                    <strong>{identified.currentState.replace(/_/g, " ")}</strong>
                    {identified.scheduledShift &&
                      ` • Shift ${identified.scheduledShift.startTime}–${identified.scheduledShift.endTime}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetKiosk}
                  className="text-xs font-semibold opacity-60 hover:opacity-100 cursor-pointer"
                >
                  Switch User
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs font-medium space-y-2">
                  <p>{error}</p>
                  {pendingRetry && (
                    <button
                      type="button"
                      onClick={() =>
                        handlePunch(
                          pendingRetry.action,
                          pendingRetry.idempotencyKey
                        )
                      }
                      className="w-full py-2 rounded-xl bg-amber-500 text-white font-bold cursor-pointer"
                    >
                      Retry {ACTION_META[pendingRetry.action].label} Safely
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {identified.validActions.map((action) => {
                  const meta = ACTION_META[action];
                  const isBusy = submittingAction === action;
                  return (
                    <button
                      key={action}
                      type="button"
                      disabled={Boolean(submittingAction)}
                      onClick={() => handlePunch(action)}
                      className={`w-full py-4 px-5 rounded-2xl text-left transition shadow-sm cursor-pointer flex items-center justify-between ${meta.bg} disabled:opacity-60`}
                    >
                      <div>
                        <p className="text-base font-bold">
                          {isBusy ? "Recording..." : meta.label}
                        </p>
                        <p className="text-xs opacity-85">{meta.desc}</p>
                      </div>
                      <span className="text-lg font-bold">→</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold">Enter 4-Digit Kiosk PIN</h2>
                <p className="text-xs opacity-65">
                  {selectedOutlet?.name || "Select an outlet"}
                </p>
              </div>

              {/* 4-dot PIN indicator */}
              <div className="flex items-center justify-center gap-4 py-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition ${
                      i < pin.length
                        ? "bg-[#0071E3] border-[#0071E3]"
                        : isDark
                        ? "border-white/25"
                        : "border-slate-300"
                    }`}
                  />
                ))}
              </div>

              {error && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs text-center font-medium">
                  {error}
                </div>
              )}

              {identifying && (
                <p className="text-center text-xs text-[#0071E3] font-semibold">
                  Verifying PIN & outlet eligibility...
                </p>
              )}

              {/* Touch-first PIN Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={identifying}
                    onClick={() => handleDigit(d)}
                    className={`h-16 rounded-2xl text-2xl font-bold transition active:scale-95 cursor-pointer border ${
                      isDark
                        ? "bg-white/[0.04] border-white/10 hover:bg-white/[0.08]"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetKiosk}
                  className={`h-16 rounded-2xl text-xs font-bold uppercase tracking-wider cursor-pointer border ${
                    isDark
                      ? "bg-white/[0.02] border-white/10 text-slate-400"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={identifying}
                  onClick={() => handleDigit("0")}
                  className={`h-16 rounded-2xl text-2xl font-bold transition active:scale-95 cursor-pointer border ${
                    isDark
                      ? "bg-white/[0.04] border-white/10 hover:bg-white/[0.08]"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPin((p) => p.slice(0, -1));
                    setError(null);
                  }}
                  className={`h-16 rounded-2xl text-sm font-bold cursor-pointer border ${
                    isDark
                      ? "bg-white/[0.02] border-white/10 text-slate-400"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  }`}
                >
                  ⌫
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center text-[11px] opacity-50">
        RestoBird Workforce Kiosk • PINs are verified server-side per outlet
      </footer>
    </div>
  );
}
