"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

type TaskStatus = "PENDING" | "COMPLETED" | "WAIVED" | "REJECTED";
type OnboardingStatus = "PENDING" | "IN_PROGRESS" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";

interface TaskProgress {
  id: string;
  taskId: string;
  status: TaskStatus;
  notes?: string;
  responseValue?: string;
  completedAt?: string;
  fileUpload?: { id: string; fileUrl: string; fileName: string } | null;
  task: {
    id: string;
    title: string;
    description?: string;
    isRequired: boolean;
    requiresDoc: boolean;
    taskType?: string;
    sortOrder: number;
  };
}

interface OnboardingDetail {
  id: string;
  accessToken: string;
  status: OnboardingStatus;
  startedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string; personalEmail?: string };
  template: { name: string; tasks: { id: string; title: string }[] };
  progresses: TaskProgress[];
}

export default function OnboardingSessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const sessionId = params?.sessionId as string;
  const { isDark } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const [onboarding, setOnboarding] = useState<OnboardingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionTask, setActionTask] = useState<TaskProgress | null>(null);
  const [taskNote, setTaskNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);

  // Portal link, Email dispatch, & Delete modal states
  const [copiedLink, setCopiedLink] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

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
      setError("Failed to load session");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) fetchSession();
  }, [sessionId]);

  const handleUpdateTask = async (taskId: string, status: TaskStatus) => {
    setUpdating(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status, notes: taskNote, fileUploadId: uploadedFileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionTask(null);
      setTaskNote("");
      setUploadedFileId(null);
      fetchSession();
    } catch (e: any) {
      setError(e.message || "Failed to update task");
    } finally {
      setUpdating(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchSession();
    } catch (e: any) {
      setError(e.message || "Failed to submit");
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes: reviewNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReviewNote("");
      fetchSession();
    } catch (e: any) {
      setError(e.message || "Failed to approve");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!reviewNote) {
      setError("Please provide a rejection reason");
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes: reviewNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReviewNote("");
      fetchSession();
    } catch (e: any) {
      setError(e.message || "Failed to reject");
    } finally {
      setRejecting(false);
    }
  };

  const handleDeleteSession = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete session");
      router.push(`/restaurant/${subdomain}/workforce/onboarding`);
    } catch (err: any) {
      setError(err.message || "Error deleting session");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (sessionId) fd.append("onboardingId", sessionId);
      const res = await fetch("/api/restaurant/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUploadedFileId(data.upload.id);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const getPortalUrl = () => {
    if (typeof window === "undefined") return "";
    const tokenVal = onboarding?.accessToken || onboarding?.id || "";
    if (!tokenVal) return "";
    return `${window.location.origin}/onboarding/portal/${tokenVal}`;
  };

  const handleCopyLink = () => {
    const url = getPortalUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleSendEmailSimulated = async () => {
    setSendingEmail(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSendingEmail(false);
    setEmailSentSuccess(true);
    setTimeout(() => {
      setEmailSentSuccess(false);
      setShowEmailModal(false);
    }, 2500);
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading session details...</p>
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div
        className={`min-h-screen flex flex-col font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Employees" />
        <main className="max-w-4xl mx-auto p-6 space-y-4">
          <button
            onClick={() => router.push(`/restaurant/${subdomain}/workforce/onboarding`)}
            className="text-xs text-[#0071E3] hover:underline cursor-pointer"
          >
            ← Back to Onboarding
          </button>
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
            {error || "Session not found"}
          </div>
        </main>
      </div>
    );
  }

  const completed = onboarding.progresses.filter((p) => ["COMPLETED", "WAIVED"].includes(p.status)).length;
  const total = onboarding.progresses.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const canSubmit = ["IN_PROGRESS", "REJECTED"].includes(onboarding.status);
  const canApprove = onboarding.status === "PENDING_APPROVAL";

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Employees" />

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
                onClick={() => router.push(`/restaurant/${subdomain}/workforce/onboarding`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← All Onboardings
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {onboarding.employee.employeeCode}
              </span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                onboarding.status === "APPROVED"
                  ? isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                  : onboarding.status === "IN_PROGRESS"
                  ? isDark ? "bg-[#0071E3]/15 text-[#58A6FF] border-[#0071E3]/25" : "bg-blue-100 text-blue-800 border-blue-200"
                  : onboarding.status === "PENDING_APPROVAL"
                  ? isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/25" : "bg-amber-100 text-amber-800 border-amber-200"
                  : isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/25" : "bg-rose-100 text-rose-800 border-rose-200"
              }`}>
                {onboarding.status.replace(/_/g, " ")}
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {onboarding.employee.firstName} {onboarding.employee.lastName}
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Checklist Template: <span className="font-semibold">{onboarding.template.name}</span>
            </p>
          </div>

          {/* Header Action Buttons including Delete Session */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleCopyLink}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                  : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-xs"
              }`}
            >
              {copiedLink ? "✓ Copied" : "Copy Portal Link"}
            </button>

            <button
              onClick={() => setShowEmailModal(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                isDark
                  ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                  : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 shadow-xs"
              }`}
            >
              Send Email
            </button>

            {canSubmit && (
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
              >
                Submit for Approval →
              </button>
            )}

            {/* Prominent Apple Delete Session Button */}
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                isDark
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20"
                  : "bg-rose-50/80 border-rose-200/80 text-rose-600 hover:bg-rose-100"
              }`}
            >
              <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Session</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Shareable Portal Link Card */}
        <div
          className={`p-6 rounded-3xl border transition space-y-3 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <div className="flex justify-between items-center">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
              Candidate Portal Access Link
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#0071E3]/15 text-[#58A6FF] border border-[#0071E3]/25">
              Self-Service Token
            </span>
          </div>
          <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
            Share this private link with <span className="font-bold">{onboarding.employee.firstName}</span> to complete document verification and digital signature intake.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={getPortalUrl()}
              className={`flex-1 px-3.5 py-2.5 text-xs font-mono rounded-xl border transition ${
                isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
              }`}
            />
            <button
              onClick={handleCopyLink}
              className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              {copiedLink ? "Copied" : "Copy Link"}
            </button>
          </div>
        </div>

        {/* Overall Progress */}
        <div
          className={`p-6 rounded-3xl border transition space-y-3 ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <div className="flex justify-between items-center">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
              Overall Checklist Progress
            </h3>
            <span className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              {completed} of {total} tasks ({pct}%)
            </span>
          </div>
          <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.08]" : "bg-slate-100"}`}>
            <div
              className="h-full bg-[#0071E3] rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Task Checklist Items */}
        <div className="space-y-3">
          <h3 className={`text-xs font-bold uppercase tracking-wider px-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
            Onboarding Checklist ({total} Items)
          </h3>

          {onboarding.progresses.map((p, idx) => (
            <div
              key={p.id}
              className={`p-5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 ${
                  isDark ? "bg-white/[0.04] text-[#8F95A3] border border-white/[0.08]" : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}>
                  {idx + 1}
                </span>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {p.task.title}
                    </p>
                    {p.task.isRequired && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Required
                      </span>
                    )}
                  </div>
                  {p.task.description && (
                    <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      {p.task.description}
                    </p>
                  )}
                  {p.responseValue && (
                    <p className="text-xs text-[#0071E3] font-medium">
                      Response: {p.responseValue}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                  p.status === "COMPLETED"
                    ? isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : p.status === "PENDING"
                    ? isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/25" : "bg-amber-100 text-amber-800 border-amber-200"
                    : isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/25" : "bg-rose-100 text-rose-800 border-rose-200"
                }`}>
                  {p.status}
                </span>

                <button
                  onClick={() => {
                    setActionTask(p);
                    setTaskNote(p.notes || "");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    isDark
                      ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                      : "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  Review / Update
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* HR Approval Controls if Pending Approval */}
        {canApprove && (
          <div
            className={`p-6 rounded-3xl border transition space-y-4 ${
              isDark ? "bg-[#121622]/60 border-amber-500/30" : "bg-amber-50/50 border-amber-200 shadow-xs"
            }`}
          >
            <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              HR Audit & Approval Actions
            </h3>
            <textarea
              rows={2}
              placeholder="Add audit notes or remarks..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              className={`w-full p-3 text-xs rounded-xl border transition ${
                isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            />
            <div className="flex justify-end gap-2.5">
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                {rejecting ? "Rejecting..." : "Reject Checklist"}
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                {approving ? "Approving..." : "Approve & Complete"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900 shadow-slate-900/10"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <h2 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  Delete Onboarding Session
                </h2>
                <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Are you sure you want to delete this onboarding workflow for{" "}
                  <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    {onboarding.employee.firstName} {onboarding.employee.lastName}
                  </span>
                  ? All checklist progress and documents tied to this session will be removed.
                </p>
                <div className="pt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${
                    isDark ? "bg-white/[0.04] text-[#BAC0CD] border-white/[0.08]" : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}>
                    Template: {onboarding.template.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isDark
                    ? "bg-white/[0.04] text-[#8F95A3] hover:text-white hover:bg-white/[0.08]"
                    : "bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteSession}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Update Modal */}
      {actionTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold">Update Checklist Task</h2>
              <button onClick={() => setActionTask(null)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              {actionTask.task.title}
            </p>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                Notes / Audit Remarks
              </label>
              <textarea
                rows={2}
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
                className={`w-full p-3 text-xs rounded-xl border transition ${
                  isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => handleUpdateTask(actionTask.taskId, "COMPLETED")}
                disabled={updating}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl"
              >
                Mark Completed
              </button>
              <button
                onClick={() => handleUpdateTask(actionTask.taskId, "WAIVED")}
                disabled={updating}
                className="flex-1 py-2 bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
              >
                Waive Task
              </button>
              <button
                onClick={() => handleUpdateTask(actionTask.taskId, "REJECTED")}
                disabled={updating}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl"
              >
                Reject Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold">Email Portal Link</h2>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
              Dispatch access invitation to: <span className="font-bold">{onboarding.employee.personalEmail || "Candidate email"}</span>
            </p>

            {emailSentSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl">
                Invitation email dispatched successfully!
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEmailModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-medium ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Close
              </button>
              <button
                onClick={handleSendEmailSimulated}
                disabled={sendingEmail || emailSentSuccess}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl disabled:opacity-50"
              >
                {sendingEmail ? "Sending..." : "Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
