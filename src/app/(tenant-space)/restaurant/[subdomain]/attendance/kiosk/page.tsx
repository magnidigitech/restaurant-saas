"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useTheme } from "@/core/theme/ThemeContext";

export default function AttendanceKioskPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Live Clock State
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  // Kiosk Input State
  const [pin, setPin] = useState("");
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState("");

  // Punch Processing & Feedback State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    employeeName: string;
    punchType: string;
    punchTime: string;
    totalHours?: number;
    status?: string;
  } | null>(null);

  // Update Clock every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
      );
      setDateStr(
        now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Outlets for Kiosk
  useEffect(() => {
    const fetchOutlets = async () => {
      try {
        const res = await fetch("/api/restaurant/outlets");
        if (res.ok) {
          const data = await res.json();
          const list = data.outlets || [];
          setOutlets(list);
          if (list.length > 0) setSelectedOutletId(list[0].id);
        }
      } catch {
        // ignore
      }
    };
    fetchOutlets();
  }, []);

  // Auto-reset success message after 4.5 seconds
  useEffect(() => {
    if (successData) {
      const timer = setTimeout(() => {
        setSuccessData(null);
        setPin("");
        setError(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [successData]);

  // Handle PIN button click
  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin("");
    setError(null);
  };

  // Perform Punch
  const executePunch = async (punchType: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END") => {
    if (pin.length !== 4) {
      setError("Please enter your 4-digit PIN first.");
      return;
    }
    if (!selectedOutletId) {
      setError("Please select a restaurant outlet.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/restaurant/attendance/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outletId: selectedOutletId,
          kioskPin: pin,
          punchType,
          deviceInfo: "Tablet Punch Kiosk",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Punch failed");
      }

      setSuccessData({
        employeeName: `${data.employee.firstName} ${data.employee.lastName}`,
        punchType: punchType.replace("_", " "),
        punchTime: new Date(data.punch.punchTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        totalHours: data.metrics?.netHours,
        status: data.metrics?.status,
      });

      // Broadcast punch event to attendance hubs for instant AJAX refresh
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "bahubali_attendance_last_punch",
            JSON.stringify({ timestamp: Date.now(), punchType, employee: data.employee })
          );
          if ("BroadcastChannel" in window) {
            const channel = new BroadcastChannel("bahubali_attendance_channel");
            channel.postMessage({
              type: "PUNCH_RECORDED",
              timestamp: Date.now(),
              punchType,
              employee: data.employee,
            });
            channel.close();
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to record punch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between p-6 sm:p-10 select-none transition-colors ${
      isDark ? "bg-[#0A0C12] text-white" : "bg-[#F5F5F7] text-slate-900"
    }`}>
      {/* Kiosk Top Bar */}
      <header className="flex justify-between items-center max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0071E3] flex items-center justify-center font-black text-white text-lg shadow-sm">
            ✦
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Staff Attendance Terminal</h1>
            <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Kiosk Station • Instant PIN Punch
            </p>
          </div>
        </div>

        {/* Outlet Switcher */}
        <div className="flex items-center gap-2">
          {outlets.length > 0 && (
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border ${
                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 shadow-xs"
              }`}
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}

          <Link
            href={`/restaurant/${subdomain}/attendance`}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
              isDark ? "bg-white/[0.04] text-slate-300 border-white/[0.08] hover:bg-white/[0.08]" : "bg-white text-slate-700 border-slate-200 shadow-xs hover:bg-slate-50"
            }`}
          >
            Manager Hub ↗
          </Link>
        </div>
      </header>

      {/* Main Terminal Center */}
      <main className="max-w-md mx-auto w-full space-y-6 my-auto text-center">
        {/* Live Digital Clock */}
        <div className="space-y-1">
          <div className="text-4xl sm:text-5xl font-extrabold tracking-tight font-mono text-[#0071E3]">
            {timeStr || "00:00:00 AM"}
          </div>
          <div className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
            {dateStr || "Today"}
          </div>
        </div>

        {/* SUCCESS CONFIRMATION MODAL OVERLAY */}
        {successData ? (
          <div className={`p-8 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 ${
            isDark ? "bg-[#121622] border-emerald-500/30" : "bg-white border-emerald-200 shadow-xl"
          }`}>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-3xl mx-auto">
              ✓
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                Punch Recorded Successfully
              </span>
              <h2 className="text-2xl font-black mt-1">{successData.employeeName}</h2>
              <p className={`text-xs mt-1 font-mono ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                <strong>{successData.punchType}</strong> at {successData.punchTime}
              </p>
            </div>

            {successData.totalHours !== undefined && (
              <div className={`p-3 rounded-2xl border text-xs font-mono ${
                isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"
              }`}>
                Net Worked Today: <strong>{successData.totalHours} hrs</strong>
              </div>
            )}

            <p className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              Screen will reset automatically in 4s...
            </p>
          </div>
        ) : (
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
            isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200"
          }`}>
            {/* 4-Digit PIN Display Dots */}
            <div className="space-y-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Enter Your 4-Digit Kiosk PIN
              </span>
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border transition-all duration-150 ${
                      pin.length > idx
                        ? "bg-[#0071E3] border-[#0071E3] scale-110 shadow-xs"
                        : isDark
                        ? "border-white/20 bg-white/5"
                        : "border-slate-300 bg-slate-100"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Error Message Banner */}
            {error && (
              <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-medium animate-in fade-in">
                {error}
              </div>
            )}

            {/* PIN Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit.toString())}
                  disabled={submitting}
                  className={`h-14 rounded-2xl text-xl font-mono font-bold transition active:scale-95 cursor-pointer border ${
                    isDark
                      ? "bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border-white/[0.08] text-white"
                      : "bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-slate-200 text-slate-900"
                  }`}
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                disabled={submitting}
                className={`h-14 rounded-2xl text-xs font-bold transition active:scale-95 cursor-pointer border ${
                  isDark
                    ? "bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20"
                    : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                }`}
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => handleDigit("0")}
                disabled={submitting}
                className={`h-14 rounded-2xl text-xl font-mono font-bold transition active:scale-95 cursor-pointer border ${
                  isDark
                    ? "bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border-white/[0.08] text-white"
                    : "bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border-slate-200 text-slate-900"
                }`}
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                disabled={submitting}
                className={`h-14 rounded-2xl text-base font-bold transition active:scale-95 cursor-pointer border ${
                  isDark
                    ? "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-slate-300"
                    : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                }`}
              >
                ⌫
              </button>
            </div>

            {/* Quick Punch Action Buttons */}
            <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Select Punch Action
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => executePunch("CLOCK_IN")}
                  disabled={submitting || pin.length !== 4}
                  className="py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  🟢 Clock In
                </button>

                <button
                  type="button"
                  onClick={() => executePunch("CLOCK_OUT")}
                  disabled={submitting || pin.length !== 4}
                  className="py-3 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  🔴 Clock Out
                </button>

                <button
                  type="button"
                  onClick={() => executePunch("BREAK_START")}
                  disabled={submitting || pin.length !== 4}
                  className="py-2.5 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  ☕ Start Break
                </button>

                <button
                  type="button"
                  onClick={() => executePunch("BREAK_END")}
                  disabled={submitting || pin.length !== 4}
                  className="py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-40 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                >
                  ⚡ End Break
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Terminal Footer */}
      <footer className="text-center text-[10px] text-slate-400">
        Restaurant SaaS Workforce Platform • Zero-Latency PIN Punch Terminal
      </footer>
    </div>
  );
}
