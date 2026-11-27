"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

type TaskStatus = "PENDING" | "COMPLETED" | "WAIVED" | "REJECTED";
type OnboardingStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

const STATUS_LABELS: Record<OnboardingStatus, string> = {
  PENDING: "Invited",
  IN_PROGRESS: "In Progress",
  PENDING_APPROVAL: "Submitted",
  REJECTED: "Changes Requested",
  APPROVED: "Approved",
};

const EMP_STATUS_LABELS: Record<string, string> = {
  PROBATION: "On probation",
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  NOTICE: "Serving notice",
};

export default function OnboardingSessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const sessionId = params?.sessionId as string;
  const { isDark } = useTheme();

  const [onboarding, setOnboarding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Per-task correction modal
  const [correctionTask, setCorrectionTask] = useState<any>(null);
  const [correctionNote, setCorrectionNote] = useState("");

  // Duplicate employee match resolution modal
  const [matchConflict, setMatchConflict] = useState<any>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}`);
      const data = await res.json();
      if (res.ok) {
        setOnboarding(data.onboarding);
      } else {
        setError(data.error || "Session not found");
      }
    } catch {
      setError("Failed to load onboarding session");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) fetchSession();
  }, [sessionId]);

  const handleResendInvite = async () => {
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}/send-email`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend invite");
      setNotice(data.message || "Invitation refreshed");
      await fetchSession();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRevokeInvite = async () => {
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Revoked by manager" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke invite");
      setNotice("Invitation link revoked");
      await fetchSession();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleApprove = async (
    existingEmployeeResolution?: "USE_EXISTING" | "KEEP_SEPARATE"
  ) => {
    setApproving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewNotes: reviewNote || undefined,
          ...(existingEmployeeResolution ? { existingEmployeeResolution } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.code === "EXISTING_EMPLOYEE_MATCH") {
        setMatchConflict(data.details?.existingEmployeeMatch);
        setApproving(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      setMatchConflict(null);
      setReviewNote("");
      setNotice(
        data.alreadyApproved
          ? "Onboarding was already approved — employee profile is active."
          : "Onboarding approved and employee activated."
      );
      await fetchSession();
    } catch (e: any) {
      setError(e.message || "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  const handleRequestCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionTask || !correctionNote.trim()) return;
    setRejecting(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewNotes: `Correction requested on "${correctionTask.task.title}": ${correctionNote.trim()}`,
          taskCorrections: [
            { taskId: correctionTask.taskId, note: correctionNote.trim() },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request correction");
      setCorrectionTask(null);
      setCorrectionNote("");
      setNotice("Correction requested. Candidate can update and resubmit.");
      await fetchSession();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-[#090B10] text-white" : "bg-[#F5F5F7] text-slate-900"}`}>
        <RestaurantNavbar activeSection="Employees" />
        <main className="p-12 text-center text-xs opacity-60">Loading onboarding review...</main>
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div className={`min-h-screen ${isDark ? "bg-[#090B10] text-white" : "bg-[#F5F5F7] text-slate-900"}`}>
        <RestaurantNavbar activeSection="Employees" />
        <main className="max-w-3xl mx-auto p-6 space-y-4">
          <button
            onClick={() => router.push(`/restaurant/${subdomain}/workforce/employees?tab=onboarding`)}
            className="text-xs font-medium text-[#0071E3] cursor-pointer"
          >
            ← Back to Onboarding List
          </button>
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
            {error || "Onboarding session not found"}
          </div>
        </main>
      </div>
    );
  }

  const statusLabel = onboarding.statusLabel || STATUS_LABELS[onboarding.status as OnboardingStatus] || onboarding.status;

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"}`}>
      <RestaurantNavbar activeSection="Employees" />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => router.push(`/restaurant/${subdomain}/workforce/employees?tab=onboarding`)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border cursor-pointer ${
              isDark ? "bg-white/[0.04] border-white/[0.08] text-[#BAC0CD]" : "bg-white border-slate-200 text-slate-700"
            }`}
          >
            ← Back to Onboarding
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {onboarding.status !== "APPROVED" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/onboarding/portal/${onboarding.accessToken}`;
                    navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                    isDark ? "bg-white/[0.04] border-white/10" : "bg-white border-slate-200"
                  }`}
                >
                  {copiedLink ? "Copied Link ✓" : "Copy Link"}
                </button>
                <button
                  type="button"
                  onClick={handleResendInvite}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/25 cursor-pointer"
                >
                  Resend Invite
                </button>
                {!onboarding.isRevoked && (
                  <button
                    type="button"
                    onClick={handleRevokeInvite}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/25 cursor-pointer"
                  >
                    Revoke Link
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Header Banner */}
        <div
          className={`p-5 sm:p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">
                {onboarding.employee.employeeCode}
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  onboarding.status === "APPROVED"
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
                    : onboarding.status === "PENDING_APPROVAL"
                    ? "bg-amber-500/15 text-amber-500 border-amber-500/25"
                    : onboarding.status === "REJECTED"
                    ? "bg-rose-500/15 text-rose-500 border-rose-500/25"
                    : "bg-blue-500/15 text-blue-500 border-blue-500/25"
                }`}
              >
                {statusLabel}
              </span>
              {onboarding.isRevoked && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/25">
                  Link Revoked
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              {onboarding.employee.firstName} {onboarding.employee.lastName}
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Checklist: {onboarding.template.name}
            </p>
          </div>

          {onboarding.status === "APPROVED" && (
            <button
              onClick={() =>
                router.push(
                  `/restaurant/${subdomain}/workforce/employees/${
                    onboarding.approvedEmployeeId || onboarding.employee.id
                  }`
                )
              }
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer self-start sm:self-center"
            >
              View Employee Profile →
            </button>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
            {error}
          </div>
        )}
        {notice && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs">
            {notice}
          </div>
        )}

        {/* Intended Employment & Activation Summary */}
        <div
          className={`p-5 rounded-3xl border space-y-3 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <h2 className="text-xs font-bold uppercase tracking-wider opacity-70">
            Intended Employment & Activation Details
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div>
              <p className="text-[11px] opacity-60">Status on Activation</p>
              <p className="font-semibold">
                {EMP_STATUS_LABELS[onboarding.intendedEmploymentStatus || "PROBATION"] ||
                  onboarding.intendedEmploymentStatus}
              </p>
            </div>
            <div>
              <p className="text-[11px] opacity-60">Start Date</p>
              <p className="font-semibold">
                {onboarding.intendedStartDate
                  ? new Date(onboarding.intendedStartDate).toLocaleDateString()
                  : "Immediate"}
              </p>
            </div>
            <div>
              <p className="text-[11px] opacity-60">Primary Outlet</p>
              <p className="font-semibold text-[#0071E3]">
                {onboarding.intendedOutlet?.name || "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-[11px] opacity-60">Department</p>
              <p className="font-semibold">{onboarding.intendedDepartment?.name || "General"}</p>
            </div>
            <div>
              <p className="text-[11px] opacity-60">Role</p>
              <p className="font-semibold">{onboarding.intendedDesignation?.name || "Staff"}</p>
            </div>
            <div>
              <p className="text-[11px] opacity-60">App Access</p>
              <p className="font-semibold">
                {onboarding.provisionAppAccess
                  ? `Provision (${onboarding.appRole?.name || "Role"})`
                  : "Profile Only"}
              </p>
            </div>
          </div>
        </div>

        {/* Submitted Tasks List */}
        <div
          className={`p-5 sm:p-6 rounded-3xl border space-y-4 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <h2 className="text-sm font-bold">Checklist Submissions</h2>
          <div className="space-y-3">
            {onboarding.progresses.map((p: any, idx: number) => (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border space-y-2 ${
                  isDark ? "bg-[#0A0C12]/50 border-white/[0.06]" : "bg-slate-50 border-slate-200/80"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold">
                      {idx + 1}. {p.task.title}
                    </p>
                    {p.task.description && (
                      <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        {p.task.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        p.status === "COMPLETED"
                          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
                          : p.status === "REJECTED"
                          ? "bg-rose-500/15 text-rose-500 border-rose-500/25"
                          : "bg-slate-500/15 text-slate-400 border-slate-500/25"
                      }`}
                    >
                      {p.status === "REJECTED" ? "Needs Correction" : p.status}
                    </span>

                    {onboarding.status === "PENDING_APPROVAL" && (
                      <button
                        type="button"
                        onClick={() => {
                          setCorrectionTask(p);
                          setCorrectionNote("");
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 cursor-pointer"
                      >
                        Request Correction
                      </button>
                    )}
                  </div>
                </div>

                {/* Candidate response */}
                {p.fileUpload && (
                  <div className="text-xs">
                    <span className="opacity-60">Uploaded file: </span>
                    <a
                      href={p.fileUpload.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#0071E3] font-medium hover:underline"
                    >
                      {p.fileUpload.fileName}
                    </a>
                  </div>
                )}

                {p.responseValue && !p.responseValue.startsWith("data:image/") && (
                  <div className="text-xs">
                    <span className="opacity-60">Response: </span>
                    <span className="font-medium">{p.responseValue}</span>
                  </div>
                )}

                {p.responseValue && p.responseValue.startsWith("data:image/") && (
                  <div className="pt-1">
                    <img
                      src={p.responseValue}
                      alt="Candidate signature"
                      className="h-16 rounded-lg border border-slate-200 bg-white p-1"
                    />
                  </div>
                )}

                {p.reviewNote && (
                  <p className="text-[11px] text-rose-500">
                    Correction note: {p.reviewNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Manager Approval Action Bar */}
        {onboarding.status === "PENDING_APPROVAL" && (
          <div
            className={`p-5 sm:p-6 rounded-3xl border space-y-3 ${
              isDark ? "bg-[#121622]/80 border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            <label className="block text-xs font-semibold opacity-80">
              Review Note (Optional)
            </label>
            <input
              type="text"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="e.g. Verified ID and food safety acknowledgement"
              className={`w-full px-3.5 py-2 text-xs rounded-xl border ${
                isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
              }`}
            />
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={approving}
                onClick={() => handleApprove()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                {approving ? "Activating..." : "Approve & Activate Employee"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: Request Correction on Task */}
      {correctionTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleRequestCorrection}
            className={`w-full max-w-md rounded-3xl border p-6 space-y-4 shadow-2xl ${
              isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <h3 className="text-base font-bold">Request Correction</h3>
            <p className="text-xs opacity-75">
              Task: <strong>{correctionTask.task.title}</strong>
            </p>
            <textarea
              required
              rows={3}
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              placeholder="Explain to the candidate what needs to be fixed..."
              className={`w-full px-3 py-2 text-xs rounded-xl border ${
                isDark ? "bg-[#0A0C12] border-white/10" : "bg-slate-50 border-slate-200"
              }`}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCorrectionTask(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rejecting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              >
                {rejecting ? "Sending..." : "Send Correction Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Existing Employee Match Resolution */}
      {matchConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-3xl border p-6 space-y-4 shadow-2xl ${
              isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <h3 className="text-base font-bold text-amber-500">
              Existing Employee Match Found
            </h3>
            <p className="text-xs leading-relaxed opacity-85">
              An existing profile{" "}
              <strong>
                {matchConflict.firstName} {matchConflict.lastName} ({matchConflict.employeeCode})
              </strong>{" "}
              matches this candidate&apos;s email or phone. Choose how to proceed so we never silently duplicate or overwrite a profile:
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleApprove("USE_EXISTING")}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#0071E3] text-white cursor-pointer"
              >
                Link & Activate Existing Profile ({matchConflict.employeeCode})
              </button>
              <button
                type="button"
                onClick={() => handleApprove("KEEP_SEPARATE")}
                className="w-full py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-white/10 cursor-pointer"
              >
                Keep as Separate Employee Profile
              </button>
              <button
                type="button"
                onClick={() => setMatchConflict(null)}
                className="w-full py-2 text-xs opacity-60 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
