"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { ArrowLeft, CheckCircle2, XCircle, Clock, UserCheck } from "lucide-react";

interface ShiftSwap {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  peerStatus: "PENDING_PEER" | "ACCEPTED" | "DECLINED" | "NOT_REQUIRED";
  reason?: string;
  reviewNotes?: string;
  createdAt: string;
  requesterEmployee: { id: string; firstName: string; lastName: string; employeeCode: string };
  targetEmployee?: { id: string; firstName: string; lastName: string; employeeCode: string };
  requesterAssignment: {
    shiftDate: string;
    startTime: string;
    endTime: string;
    outlet?: { name: string; timezone?: string };
    template?: { name: string; color: string };
  };
  targetAssignment?: {
    shiftDate: string;
    startTime: string;
    endTime: string;
    outlet?: { name: string; timezone?: string };
    template?: { name: string; color: string };
  };
}

export default function ShiftSwapsPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  const [canApproveSwap, setCanApproveSwap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [actionError, setActionError] = useState<string | null>(null);

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
        setCurrentEmployeeId(data.currentEmployeeId || null);
        setCanApproveSwap(Boolean(data.canApproveSwap));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSwaps();
  }, []);

  const handlePeerResponse = async (swapId: string, accept: boolean) => {
    setActionError(null);
    const res = await fetch(`/api/restaurant/shifts/swaps/${swapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: accept ? "ACCEPT_PEER" : "DECLINE_PEER" }),
    });
    const d = await res.json();
    if (!res.ok) {
      setActionError(d.error || "Failed to record coworker response");
      return;
    }
    fetchSwaps();
  };

  const openReviewModal = (swap: ShiftSwap, status: "APPROVED" | "REJECTED") => {
    setSelectedSwap(swap);
    setActionStatus(status);
    setReviewNotes("");
    setActionError(null);
    setReviewModalOpen(true);
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSwap) return;
    setSaving(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/restaurant/shifts/swaps/${selectedSwap.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: actionStatus, reviewNotes }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to review swap");
      setReviewModalOpen(false);
      fetchSwaps();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getNextResponsibleLabel = (sw: ShiftSwap) => {
    if (sw.status !== "PENDING") return `Closed (${sw.status})`;
    if (sw.peerStatus === "PENDING_PEER") {
      return `Next: ${sw.targetEmployee?.firstName || "Coworker"} (Peer acceptance)`;
    }
    return "Next: Manager approval";
  };

  const filteredSwaps = swaps.filter((s) => filter === "ALL" || s.status === filter);

  return (
    <ModuleAccessGuard moduleKey="shifts" moduleName="Shift Swaps">
      <div
        className={`min-h-screen font-sans antialiased flex flex-col overflow-x-hidden ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Shifts & Scheduling" />

        <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-5 sm:py-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-12 lg:pl-0">
            <div>
              <button
                type="button"
                onClick={() => router.push(`/restaurant/${subdomain}/shifts`)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0071E3] mb-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Shift Operations</span>
              </button>
              <h1 className="text-xl font-bold tracking-tight">Shift Swaps & Approvals</h1>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] overflow-x-auto max-w-full">
              {["ALL", "PENDING", "APPROVED", "REJECTED"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    filter === tab ? "bg-[#0071E3] text-white" : "text-slate-500"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {actionError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
              {actionError}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading swap requests...</div>
          ) : filteredSwaps.length === 0 ? (
            <div
              className={`p-10 rounded-3xl border text-center text-xs text-slate-400 ${
                isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
              }`}
            >
              No swap requests found.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSwaps.map((sw) => {
                const isTargetPeer =
                  currentEmployeeId && sw.targetEmployee?.id === currentEmployeeId;
                const canPeerRespond =
                  sw.status === "PENDING" && sw.peerStatus === "PENDING_PEER" && isTargetPeer;
                const canManagerAct =
                  sw.status === "PENDING" &&
                  canApproveSwap &&
                  (sw.peerStatus === "ACCEPTED" || sw.peerStatus === "NOT_REQUIRED");

                return (
                  <div
                    key={sw.id}
                    className={`p-5 rounded-3xl border space-y-3 ${
                      isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">
                          {sw.requesterEmployee.firstName} {sw.requesterEmployee.lastName}
                        </span>
                        <span className="text-xs text-slate-400">↔</span>
                        <span className="text-sm font-bold">
                          {sw.targetEmployee
                            ? `${sw.targetEmployee.firstName} ${sw.targetEmployee.lastName}`
                            : "Open Cover"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-[#0071E3]" />
                          <span>{getNextResponsibleLabel(sw)}</span>
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                            sw.status === "APPROVED"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : sw.status === "REJECTED"
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          }`}
                        >
                          {sw.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05]">
                        <div className="text-[10px] uppercase font-bold text-slate-400">
                          Requester Shift
                        </div>
                        <div className="font-mono font-semibold mt-1">
                          {sw.requesterAssignment.shiftDate.slice(0, 10)} ·{" "}
                          {sw.requesterAssignment.startTime}–{sw.requesterAssignment.endTime}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {sw.requesterAssignment.outlet?.name || "Outlet"}
                        </div>
                      </div>

                      {sw.targetAssignment && (
                        <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05]">
                          <div className="text-[10px] uppercase font-bold text-slate-400">
                            Target Shift
                          </div>
                          <div className="font-mono font-semibold mt-1">
                            {sw.targetAssignment.shiftDate.slice(0, 10)} ·{" "}
                            {sw.targetAssignment.startTime}–{sw.targetAssignment.endTime}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {sw.targetAssignment.outlet?.name || "Outlet"}
                          </div>
                        </div>
                      )}
                    </div>

                    {sw.reason && (
                      <p className="text-xs text-slate-500">
                        <strong>Reason:</strong> {sw.reason}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {canPeerRespond && (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePeerResponse(sw.id, false)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-500/30 text-rose-500 cursor-pointer"
                          >
                            Decline Swap
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePeerResponse(sw.id, true)}
                            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white cursor-pointer"
                          >
                            Accept Swap
                          </button>
                        </>
                      )}

                      {canManagerAct && (
                        <>
                          <button
                            type="button"
                            onClick={() => openReviewModal(sw, "REJECTED")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-500/30 text-rose-500 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openReviewModal(sw, "APPROVED")}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#0071E3] text-white cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve & Reassign</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {reviewModalOpen && selectedSwap && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <form
              onSubmit={handleReview}
              className={`w-full max-w-md rounded-3xl border p-6 space-y-4 ${
                isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <h3 className="text-sm font-bold">
                {actionStatus === "APPROVED" ? "Approve & Reassign Shift" : "Reject Swap Request"}
              </h3>
              {actionError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 text-xs">{actionError}</div>
              )}
              <p className="text-xs text-slate-500">
                Approving revalidates both employees against the latest published schedule, approved leaves, outlet eligibility, and weekly hour limits.
              </p>
              <textarea
                rows={3}
                placeholder="Manager review notes (optional)..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border bg-transparent"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-4 py-2 text-white text-xs font-semibold rounded-xl cursor-pointer ${
                    actionStatus === "APPROVED" ? "bg-[#0071E3]" : "bg-rose-600"
                  }`}
                >
                  {saving ? "Processing..." : actionStatus === "APPROVED" ? "Confirm Approval" : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
