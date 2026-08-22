"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface ShiftSwap {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason?: string;
  reviewNotes?: string;
  createdAt: string;
  requesterEmployee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
  targetEmployee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
  requesterAssignment: {
    shiftDate: string;
    startTime: string;
    endTime: string;
    outlet?: { name: string };
    template?: { name: string; color: string };
  };
  targetAssignment?: {
    shiftDate: string;
    startTime: string;
    endTime: string;
    outlet?: { name: string };
    template?: { name: string; color: string };
  };
}

export default function AppleShiftSwapsPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<ShiftSwap | null>(null);
  const [actionStatus, setActionStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSwaps = async () => {
    try {
      const res = await fetch("/api/restaurant/shifts/swaps");
      if (res.ok) {
        const data = await res.json();
        setSwaps(data.swaps || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSwaps();
  }, []);

  const openReviewModal = (swap: ShiftSwap, status: "APPROVED" | "REJECTED") => {
    setSelectedSwap(swap);
    setActionStatus(status);
    setReviewNotes("");
    setReviewModalOpen(true);
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSwap) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/restaurant/shifts/swaps/${selectedSwap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: actionStatus,
          reviewNotes,
        }),
      });

      if (res.ok) {
        setReviewModalOpen(false);
        fetchSwaps();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const filteredSwaps = filter === "ALL" ? swaps : swaps.filter((s) => s.status === filter);

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Shift Swaps" />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/shifts`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← Shifts Overview
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Approvals & Exchanges
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Shift Trade & Swap Requests
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Review, approve, or reject employee shift exchange and trade proposals.
            </p>
          </div>

          {/* Filter Pills */}
          <div
            className={`flex items-center gap-1 p-1 rounded-xl border ${
              isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-100 border-slate-200"
            }`}
          >
            {["ALL", "PENDING", "APPROVED", "REJECTED"].map((st) => (
              <button
                key={st}
                onClick={() => setFilter(st)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition cursor-pointer ${
                  filter === st
                    ? isDark
                      ? "bg-[#1E2436] text-white shadow-xs"
                      : "bg-white text-slate-900 shadow-xs"
                    : isDark
                    ? "text-[#8F95A3] hover:text-white"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className={`text-center py-16 text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
            Loading swap requests...
          </div>
        ) : filteredSwaps.length === 0 ? (
          <div
            className={`p-12 rounded-3xl border text-center space-y-2 ${
              isDark ? "bg-[#121622]/40 border-white/[0.06]" : "bg-white border-slate-200"
            }`}
          >
            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
              No {filter !== "ALL" ? filter.toLowerCase() : ""} shift swap requests
            </h3>
            <p className={`text-xs max-w-sm mx-auto ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              When staff request shift coverage or trades, they will appear here for manager authorization.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSwaps.map((swap) => (
              <div
                key={swap.id}
                className={`p-6 rounded-3xl border transition flex flex-col justify-between space-y-5 ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06]"
                    : "bg-white border-slate-200/80 shadow-sm"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#0071E3]/15 text-[#0071E3] flex items-center justify-center font-bold text-xs">
                        {swap.requesterEmployee.firstName.charAt(0)}
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                          {swap.requesterEmployee.firstName} {swap.requesterEmployee.lastName}
                        </p>
                        <p className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          {swap.requesterEmployee.employeeCode}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${
                        swap.status === "PENDING"
                          ? isDark
                            ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                          : swap.status === "APPROVED"
                          ? isDark
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : isDark
                          ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      {swap.status}
                    </span>
                  </div>

                  {/* Shift Exchange Details */}
                  <div
                    className={`p-4 rounded-2xl border space-y-2 text-xs ${
                      isDark ? "bg-[#0A0C12]/50 border-white/[0.06]" : "bg-slate-50/70 border-slate-100"
                    }`}
                  >
                    <div>
                      <span className={`text-[10px] uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                        Offered Shift:
                      </span>
                      <p className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {new Date(swap.requesterAssignment.shiftDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} •{" "}
                        {swap.requesterAssignment.startTime} - {swap.requesterAssignment.endTime}
                      </p>
                    </div>

                    {swap.targetEmployee && (
                      <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                        <span className={`text-[10px] uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          Trade With:
                        </span>
                        <p className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                          {swap.targetEmployee.firstName} {swap.targetEmployee.lastName}
                        </p>
                      </div>
                    )}

                    {swap.reason && (
                      <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                        <span className={`text-[10px] uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          Reason:
                        </span>
                        <p className={`italic ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                          &quot;{swap.reason}&quot;
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {swap.status === "PENDING" && (
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => openReviewModal(swap, "APPROVED")}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-xs"
                    >
                      Approve Swap
                    </button>
                    <button
                      onClick={() => openReviewModal(swap, "REJECTED")}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        isDark
                          ? "bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20"
                          : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                      }`}
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Review Modal */}
      {reviewModalOpen && selectedSwap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex justify-between items-center">
              <h2 className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                {actionStatus === "APPROVED" ? "Approve Shift Swap" : "Decline Shift Swap"}
              </h2>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
              {actionStatus === "APPROVED"
                ? "Approving this swap will automatically exchange assignments on the live roster."
                : "Declining will notify the employee that this trade was not approved."}
            </p>

            <form onSubmit={handleReview} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Manager Review Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Approved for schedule balance"
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-white placeholder-[#5E6573]"
                      : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-5 py-2 text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50 ${
                    actionStatus === "APPROVED"
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-rose-600 hover:bg-rose-500"
                  }`}
                >
                  {saving ? "Updating..." : `Confirm ${actionStatus === "APPROVED" ? "Approval" : "Decline"}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
