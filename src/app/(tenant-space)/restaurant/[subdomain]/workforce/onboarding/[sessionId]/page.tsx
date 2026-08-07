"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

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

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "text-amber-700 bg-amber-50 border-amber-200" },
  COMPLETED: { label: "Completed", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  WAIVED: { label: "Waived", color: "text-gray-600 bg-gray-100 border-gray-200" },
  REJECTED: { label: "Rejected", color: "text-red-700 bg-red-50 border-red-200" },
};

const SESSION_BADGE: Record<OnboardingStatus, string> = {
  PENDING: "bg-gray-100 text-gray-700 border-gray-200",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700 border-indigo-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

export default function OnboardingSessionDetail() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.sessionId as string;
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

  // Portal link & Email dispatch states
  const [copiedLink, setCopiedLink] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
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

  useEffect(() => { if (sessionId) fetchSession(); }, [sessionId]);

  const handleUpdateTask = async (taskId: string, status: TaskStatus) => {
    setUpdating(true); setError("");
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status, notes: taskNote, fileUploadId: uploadedFileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionTask(null); setTaskNote(""); setUploadedFileId(null);
      fetchSession();
    } catch (e: any) { setError(e.message || "Failed to update task"); }
    finally { setUpdating(false); }
  };

  const handleSubmit = async () => {
    if (!confirm("Submit this onboarding for approval? Make sure all required tasks are completed.")) return;
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchSession();
    } catch (e: any) { setError(e.message || "Failed to submit"); }
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
      setReviewNote(""); fetchSession();
    } catch (e: any) { setError(e.message || "Failed to approve"); }
    finally { setApproving(false); }
  };

  const handleReject = async () => {
    if (!reviewNote) { setError("Please provide a rejection reason"); return; }
    setRejecting(true);
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions/${sessionId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes: reviewNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReviewNote(""); fetchSession();
    } catch (e: any) { setError(e.message || "Failed to reject"); }
    finally { setRejecting(false); }
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
    } catch (e: any) { setError(e.message || "Upload failed"); }
    finally { setUploading(false); }
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

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">Loading session details...</main>;
  if (!onboarding) return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-red-600 font-semibold">{error || "Session not found"}</main>;

  const completed = onboarding.progresses.filter((p) => ["COMPLETED", "WAIVED"].includes(p.status)).length;
  const total = onboarding.progresses.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const canSubmit = ["IN_PROGRESS", "REJECTED"].includes(onboarding.status);
  const canApprove = onboarding.status === "PENDING_APPROVAL";

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Navbar Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 px-6 py-4 flex justify-between items-center flex-wrap gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 font-semibold transition-colors cursor-pointer text-sm">
            ← Back
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {onboarding.employee.firstName} {onboarding.employee.lastName}
              <span className="text-xs text-gray-500 font-mono font-normal">({onboarding.employee.employeeCode})</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${SESSION_BADGE[onboarding.status]}`}>
                {onboarding.status.replace("_", " ")}
              </span>
              <span className="text-xs text-gray-500 font-medium">• {onboarding.template.name}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-all cursor-pointer"
          >
            {copiedLink ? "Link Copied" : "Copy Employee Portal Link"}
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-all cursor-pointer"
          >
            Send Email Link
          </button>
          {canSubmit && (
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Submit for Approval →
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

        {/* Shareable Link Box */}
        <div className="bg-white border-t-4 border-t-indigo-600 border-x border-b border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-900 text-sm">
              Employee Self-Service Link
            </h3>
            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 font-mono font-bold px-2 py-0.5 rounded">Dynamic Token</span>
          </div>
          <p className="text-xs text-gray-600">
            Share this link with <span className="text-gray-900 font-bold">{onboarding.employee.firstName}</span> to let them fill forms, upload documents, and sign digitally.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={getPortalUrl()}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-800 focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
            >
              {copiedLink ? "Copied" : "Copy Link"}
            </button>
          </div>
        </div>

        {/* Progress Bar Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Overall Progress</span>
            <span className="text-2xl font-bold text-gray-900">{pct}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 font-medium">{completed} of {total} tasks completed or waived</p>
        </div>

        {/* Approval Panel */}
        {canApprove && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-amber-800 text-xs uppercase tracking-widest">Pending Manager Review</h3>
            <textarea
              placeholder="Review notes (optional for approval, required for rejection)..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              className="w-full bg-white border border-amber-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs cursor-pointer disabled:opacity-50 transition-all shadow-sm"
              >
                {approving ? "Approving..." : "Approve Session"}
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs cursor-pointer disabled:opacity-50 transition-all shadow-sm"
              >
                {rejecting ? "Rejecting..." : "Reject Session"}
              </button>
            </div>
          </div>
        )}

        {/* Task Checklist */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Task Checklist</h3>
            <span className="text-xs text-gray-400 font-medium">{total} total items</span>
          </div>

          <div className="space-y-3">
            {[...onboarding.progresses].sort((a, b) => a.task.sortOrder - b.task.sortOrder).map((progress, idx) => {
              const cfg = TASK_STATUS_CONFIG[progress.status];
              const editable = ["IN_PROGRESS", "REJECTED"].includes(onboarding.status);

              return (
                <div key={progress.id} className="bg-white border border-gray-200 hover:border-gray-300 rounded-2xl p-5 transition-all shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold font-mono mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-gray-900 text-sm">{progress.task.title}</h4>
                          {progress.task.isRequired && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">*Required</span>}
                          {progress.task.requiresDoc && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">Document</span>}
                        </div>
                        {progress.task.description && <p className="text-xs text-gray-500">{progress.task.description}</p>}

                        {/* Render saved signature or response values */}
                        {progress.responseValue && progress.task.taskType === "SIGNATURE" && (
                          <div className="pt-2">
                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Digital Signature Signature:</p>
                            <img src={progress.responseValue} alt="Signature" className="h-12 bg-gray-50 border border-gray-200 rounded-lg p-1" />
                          </div>
                        )}
                        {progress.responseValue && progress.task.taskType !== "SIGNATURE" && (
                          <p className="text-xs text-indigo-700 font-semibold pt-1">Response: <span className="text-gray-900 font-normal">{progress.responseValue}</span></p>
                        )}

                        {progress.notes && <p className="text-xs text-gray-500 italic pt-1">Note: "{progress.notes}"</p>}
                        {progress.fileUpload && (
                          <a href={progress.fileUpload.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-600 hover:underline pt-1 inline-block">
                            Attached Document: {progress.fileUpload.fileName}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Status Badge & Clean Action Link */}
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {editable && (
                        <button
                          onClick={() => { setActionTask(progress); setTaskNote(progress.notes || ""); setUploadedFileId(null); }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5 transition-all cursor-pointer"
                        >
                          Review / Update
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Task Update Modal */}
      {actionTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{actionTask.task.title}</h2>
              {actionTask.task.description && <p className="text-xs text-gray-500 mt-1">{actionTask.task.description}</p>}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">{error}</div>}

            <textarea
              placeholder="Notes or comments (optional)..."
              value={taskNote}
              onChange={(e) => setTaskNote(e.target.value)}
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-indigo-600 resize-none"
            />

            {(actionTask.task.requiresDoc || actionTask.task.requiresDoc) && (
              <div>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-2.5 border border-dashed border-gray-300 hover:border-indigo-500 text-gray-600 hover:text-indigo-600 rounded-xl text-xs font-semibold cursor-pointer transition-all bg-gray-50"
                >
                  {uploading ? "Uploading..." : uploadedFileId ? "File attached successfully" : "Upload Document File"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {(["COMPLETED", "WAIVED"] as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => handleUpdateTask(actionTask.taskId, s)}
                  disabled={updating}
                  className={`py-2.5 rounded-xl font-bold text-xs cursor-pointer disabled:opacity-50 transition-all ${
                    s === "COMPLETED" ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm" : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                  }`}
                >
                  {s === "COMPLETED" ? "Mark Complete" : "Waive Task"}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setActionTask(null); setTaskNote(""); setUploadedFileId(null); setError(""); }}
              className="w-full py-2 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Email Dispatch Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Send Onboarding Link</h2>
              <p className="text-xs text-gray-500 mt-1">
                Dispatch an invitation to <span className="text-gray-900 font-bold">{onboarding.employee.firstName} {onboarding.employee.lastName}</span>
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs space-y-1">
              <p><span className="text-gray-500">Recipient:</span> <span className="font-bold text-gray-900">{onboarding.employee.personalEmail || `${onboarding.employee.firstName.toLowerCase()}@restaurant.com`}</span></p>
              <p><span className="text-gray-500">Subject:</span> <span className="font-medium text-gray-800">Complete your onboarding for {onboarding.template.name}</span></p>
            </div>

            {emailSentSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl text-center font-bold">
                Email notification queued and dispatched successfully
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmailSimulated}
                  disabled={sendingEmail}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 transition-all shadow-sm"
                >
                  {sendingEmail ? "Sending..." : "Send Email"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
