"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

type TaskStatus = "PENDING" | "COMPLETED" | "WAIVED" | "REJECTED";
type TaskType = "CHECKBOX" | "DOCUMENT" | "FORM_INPUT" | "SIGNATURE" | "DATE";

interface TaskProgress {
  id: string;
  taskId: string;
  status: TaskStatus;
  notes?: string | null;
  reviewNote?: string | null;
  responseValue?: string | null;
  fileUploadId?: string | null;
  completedAt?: string | null;
  submissionHistory?: Array<{ at: string; status: string }> | null;
  fileUpload?: { id: string; fileUrl: string; fileName: string } | null;
  task: {
    id: string;
    title: string;
    description?: string | null;
    isRequired: boolean;
    requiresDoc: boolean;
    taskType: TaskType;
    fieldConfig?: string | null;
    sortOrder: number;
  };
}

interface OnboardingPortalData {
  id: string;
  accessToken: string;
  status: string;
  statusLabel?: string;
  startedAt?: string | null;
  submittedAt?: string | null;
  reviewNotes?: string | null;
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    personalEmail?: string | null;
  };
  restaurant: {
    name: string;
    branding?: { logoUrl?: string | null; primaryColor?: string | null } | null;
  };
  template: { name: string; description?: string | null; roleName?: string | null };
  progresses: TaskProgress[];
}

export default function EmployeeOnboardingPortal() {
  const params = useParams();
  const token = params?.token as string;

  const [session, setSession] = useState<OnboardingPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const [formResponses, setFormResponses] = useState<{ [taskId: string]: string }>({});
  const [checkboxResponses, setCheckboxResponses] = useState<{ [taskId: string]: string[] }>({});
  const [ackChecked, setAckChecked] = useState<{ [taskId: string]: boolean }>({});
  const [fileUploads, setFileUploads] = useState<{
    [taskId: string]: { id: string; fileName: string; fileUrl: string };
  }>({});
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [taskId: string]: string }>({});

  const canvasRefs = useRef<{ [taskId: string]: HTMLCanvasElement | null }>({});
  const fileInputRefs = useRef<{ [taskId: string]: HTMLInputElement | null }>({});
  const drawingTaskIds = useRef<{ [taskId: string]: boolean }>({});

  const fetchPortalData = async () => {
    try {
      const res = await fetch(`/api/restaurant/onboarding/portal/${token}`);
      const data = await res.json();
      if (res.ok) {
        setSession(data.session);
        const initialForm: { [taskId: string]: string } = {};
        const initialCheckboxes: { [taskId: string]: string[] } = {};
        const initialAck: { [taskId: string]: boolean } = {};
        const initialFiles: { [taskId: string]: { id: string; fileName: string; fileUrl: string } } = {};

        data.session?.progresses?.forEach((p: TaskProgress) => {
          if (p.responseValue) {
            try {
              const parsed = JSON.parse(p.responseValue);
              if (Array.isArray(parsed)) {
                initialCheckboxes[p.taskId] = parsed;
              } else {
                initialForm[p.taskId] = p.responseValue;
              }
            } catch {
              initialForm[p.taskId] = p.responseValue;
            }
          }
          if (p.task.taskType === "CHECKBOX" && p.status === "COMPLETED") {
            initialAck[p.taskId] = true;
          }
          if (p.fileUpload) {
            initialFiles[p.taskId] = {
              id: p.fileUpload.id,
              fileName: p.fileUpload.fileName,
              fileUrl: p.fileUpload.fileUrl,
            };
          }
        });

        setFormResponses(initialForm);
        setCheckboxResponses(initialCheckboxes);
        setAckChecked(initialAck);
        setFileUploads(initialFiles);

        setSubmittedSuccess(["PENDING_APPROVAL", "APPROVED"].includes(data.session?.status));
      } else {
        setFatalError(data.error || "Invalid or expired onboarding link");
      }
    } catch {
      setFatalError("Network error loading onboarding portal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPortalData();
  }, [token]);

  const startDrawing = (
    taskId: string,
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    drawingTaskIds.current[taskId] = true;
    const canvas = canvasRefs.current[taskId];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (
    taskId: string,
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!drawingTaskIds.current[taskId]) return;
    const canvas = canvasRefs.current[taskId];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = (taskId: string) => {
    if (!drawingTaskIds.current[taskId]) return;
    drawingTaskIds.current[taskId] = false;
    const canvas = canvasRefs.current[taskId];
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      setFormResponses((prev) => ({ ...prev, [taskId]: dataUrl }));
      setFieldErrors((prev) => ({ ...prev, [taskId]: "" }));
    }
  };

  const clearCanvas = (taskId: string) => {
    const canvas = canvasRefs.current[taskId];
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      setFormResponses((prev) => {
        const cpy = { ...prev };
        delete cpy[taskId];
        return cpy;
      });
    }
  };

  const getTaskValuePayload = (p: TaskProgress) => {
    const tType = p.task.taskType;
    if (tType === "DOCUMENT" || p.task.requiresDoc) {
      const f = fileUploads[p.taskId];
      return { hasValue: Boolean(f), fileUploadId: f?.id, responseValue: undefined };
    }
    if (tType === "CHECKBOX") {
      let options: string[] = [];
      try {
        if (p.task.fieldConfig) {
          const parsed = JSON.parse(p.task.fieldConfig);
          if (Array.isArray(parsed.options)) options = parsed.options;
        }
      } catch {
        // ignore
      }
      if (options.length > 0) {
        const selected = checkboxResponses[p.taskId] || [];
        return {
          hasValue: selected.length > 0,
          responseValue: selected.length > 0 ? JSON.stringify(selected) : undefined,
          fileUploadId: undefined,
        };
      }
      const checked = Boolean(ackChecked[p.taskId]);
      return {
        hasValue: checked,
        responseValue: checked ? "Acknowledged" : undefined,
        fileUploadId: undefined,
      };
    }
    const text = (formResponses[p.taskId] || "").trim();
    return {
      hasValue: text.length > 0,
      responseValue: text || undefined,
      fileUploadId: undefined,
    };
  };

  const saveTask = async (p: TaskProgress, markCompleted: boolean) => {
    const payload = getTaskValuePayload(p);
    if (markCompleted && !payload.hasValue) {
      setFieldErrors((prev) => ({
        ...prev,
        [p.taskId]: `Please complete "${p.task.title}" before saving`,
      }));
      return false;
    }

    setSavingTaskId(p.taskId);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/onboarding/portal/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: p.taskId,
          status: markCompleted ? "COMPLETED" : "PENDING",
          responseValue: payload.responseValue,
          fileUploadId: payload.fileUploadId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFieldErrors((prev) => ({ ...prev, [p.taskId]: data.error || "Save failed" }));
        return false;
      }
      setFieldErrors((prev) => ({ ...prev, [p.taskId]: "" }));
      setSaveNotice(`Saved "${p.task.title}"`);
      setTimeout(() => setSaveNotice(""), 2500);
      await fetchPortalData();
      return true;
    } catch {
      setFieldErrors((prev) => ({ ...prev, [p.taskId]: "Network error saving task" }));
      return false;
    } finally {
      setSavingTaskId(null);
    }
  };

  const handleFileUpload = async (p: TaskProgress, file: File) => {
    setUploadingTaskId(p.taskId);
    setError("");
    setFieldErrors((prev) => ({ ...prev, [p.taskId]: "" }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("portalToken", token);
      if (session?.id) fd.append("onboardingId", session.id);
      const res = await fetch("/api/restaurant/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const uploaded = {
        id: data.upload.id,
        fileName: data.upload.fileName,
        fileUrl: data.upload.fileUrl,
      };
      setFileUploads((prev) => ({ ...prev, [p.taskId]: uploaded }));

      // Persist immediately so candidate can resume anytime
      await fetch(`/api/restaurant/onboarding/portal/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: p.taskId,
          status: "COMPLETED",
          fileUploadId: uploaded.id,
        }),
      });
      await fetchPortalData();
    } catch (e: any) {
      setFieldErrors((prev) => ({ ...prev, [p.taskId]: e.message || "File upload failed" }));
    } finally {
      setUploadingTaskId(null);
    }
  };

  const handleToggleCheckboxOption = (taskId: string, option: string) => {
    setCheckboxResponses((prev) => {
      const current = prev[taskId] || [];
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [taskId]: updated };
    });
    setFieldErrors((prev) => ({ ...prev, [taskId]: "" }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError("");
    const nextFieldErrors: { [taskId: string]: string } = {};

    setSubmitting(true);
    try {
      // Save any filled tasks first
      for (const p of session.progresses) {
        if (p.status === "WAIVED") continue;
        const payload = getTaskValuePayload(p);
        if (payload.hasValue) {
          const patchRes = await fetch(`/api/restaurant/onboarding/portal/${token}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: p.taskId,
              status: "COMPLETED",
              responseValue: payload.responseValue,
              fileUploadId: payload.fileUploadId,
            }),
          });
          if (!patchRes.ok) {
            const pd = await patchRes.json();
            nextFieldErrors[p.taskId] = pd.error || "Invalid response";
          }
        } else if (p.task.isRequired) {
          nextFieldErrors[p.taskId] = "Required before submission";
        }
      }

      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors);
        setError("Please complete all required fields highlighted below before submitting.");
        setSubmitting(false);
        return;
      }

      const submitRes = await fetch(`/api/restaurant/onboarding/portal/${token}`, {
        method: "POST",
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        if (submitData.details?.missingTasks) {
          for (const mt of submitData.details.missingTasks) {
            nextFieldErrors[mt.taskId] = "Required before submission";
          }
          setFieldErrors(nextFieldErrors);
        }
        throw new Error(submitData.error || "Failed to submit onboarding");
      }

      setSubmittedSuccess(true);
      await fetchPortalData();
    } catch (e: any) {
      setError(e.message || "Failed to submit onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-slate-600 text-sm font-medium">
        Loading onboarding checklist...
      </main>
    );
  }

  if (fatalError && !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-4 text-center text-slate-900">
        <div className="max-w-md w-full bg-white border border-slate-200 p-7 rounded-3xl space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-slate-900">Onboarding Link Unavailable</h2>
          <p className="text-slate-600 text-sm">{fatalError}</p>
        </div>
      </main>
    );
  }

  if (!session) return null;

  const brandColor = session.restaurant?.branding?.primaryColor || "#0071E3";
  const requiredTasks = session.progresses.filter((p) => p.task.isRequired);
  const completedRequired = requiredTasks.filter(
    (p) => ["COMPLETED", "WAIVED"].includes(p.status) || getTaskValuePayload(p).hasValue
  );
  const attentionTasks = session.progresses.filter(
    (p) => p.status === "REJECTED" || (p.task.isRequired && !["COMPLETED", "WAIVED"].includes(p.status) && !getTaskValuePayload(p).hasValue)
  );
  const pct =
    requiredTasks.length > 0
      ? Math.round((completedRequired.length / requiredTasks.length) * 100)
      : 100;

  if (submittedSuccess) {
    return (
      <main className="min-h-screen bg-[#F5F5F7] text-slate-900 py-10 px-4 flex items-center justify-center">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 p-7 shadow-sm space-y-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-bold">
            ✓
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            {session.status === "APPROVED"
              ? "Onboarding Approved!"
              : "Onboarding Submitted for Review"}
          </h1>
          <p className="text-sm text-slate-600">
            {session.status === "APPROVED"
              ? `Welcome to ${session.restaurant.name}, ${session.employee.firstName}. Your employment profile is now active.`
              : `Thank you, ${session.employee.firstName}. Your manager at ${session.restaurant.name} will review your submission shortly.`}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F5F7] text-slate-900 py-5 px-3 sm:px-6 overflow-x-hidden">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {session.restaurant.name}
              </p>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">
                {session.template.name}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Welcome, {session.employee.firstName} {session.employee.lastName} ({session.employee.employeeCode})
              </p>
            </div>
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${
                session.status === "REJECTED"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {session.status === "REJECTED" ? "Changes Requested" : "In Progress"}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>
                {completedRequired.length} of {requiredTasks.length} required items ready
              </span>
              <span className="font-bold">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: brandColor }}
              />
            </div>
          </div>

          {session.status === "REJECTED" && session.reviewNotes && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
              <p className="font-bold">Manager requested corrections:</p>
              <p>{session.reviewNotes}</p>
            </div>
          )}

          {attentionTasks.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <span className="font-semibold">Still needs attention ({attentionTasks.length}): </span>
              {attentionTasks.map((t) => t.task.title).join(", ")}
            </div>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}
        {saveNotice && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            {saveNotice}
          </div>
        )}

        {/* Checklist Form */}
        <form onSubmit={handleSubmitForm} className="space-y-3.5">
          {session.progresses.map((p, idx) => {
            const t = p.task;
            const isCompleted = p.status === "COMPLETED";
            const isNeedsCorrection = p.status === "REJECTED";
            const uploaded = fileUploads[p.taskId];
            let options: string[] = [];
            try {
              if (t.fieldConfig) {
                const parsed = JSON.parse(t.fieldConfig);
                if (Array.isArray(parsed.options)) options = parsed.options;
              }
            } catch {
              // ignore
            }

            return (
              <div
                key={p.id}
                className={`bg-white rounded-3xl border p-4 sm:p-5 space-y-3 shadow-xs ${
                  fieldErrors[p.taskId]
                    ? "border-rose-300 ring-1 ring-rose-200"
                    : isNeedsCorrection
                    ? "border-amber-300"
                    : isCompleted
                    ? "border-emerald-200"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-400">
                        {idx + 1}.
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        {t.title}
                      </h3>
                      {t.isRequired && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          Required
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-slate-500">{t.description}</p>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      isCompleted
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isNeedsCorrection
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {isCompleted ? "Saved" : isNeedsCorrection ? "Needs Fix" : "Pending"}
                  </span>
                </div>

                {isNeedsCorrection && p.reviewNote && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    <strong>Correction note:</strong> {p.reviewNote}
                  </div>
                )}

                {/* Input by taskType */}
                {t.taskType === "FORM_INPUT" && (
                  <input
                    type="text"
                    value={formResponses[p.taskId] || ""}
                    onChange={(e) => {
                      setFormResponses((prev) => ({ ...prev, [p.taskId]: e.target.value }));
                      setFieldErrors((prev) => ({ ...prev, [p.taskId]: "" }));
                    }}
                    placeholder="Enter your response..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#0071E3]"
                  />
                )}

                {t.taskType === "DATE" && (
                  <input
                    type="date"
                    value={formResponses[p.taskId] || ""}
                    onChange={(e) => {
                      setFormResponses((prev) => ({ ...prev, [p.taskId]: e.target.value }));
                      setFieldErrors((prev) => ({ ...prev, [p.taskId]: "" }));
                    }}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#0071E3]"
                  />
                )}

                {t.taskType === "CHECKBOX" && (
                  <div className="space-y-2">
                    {options.length > 0 ? (
                      options.map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={(checkboxResponses[p.taskId] || []).includes(opt)}
                            onChange={() => handleToggleCheckboxOption(p.taskId, opt)}
                            className="w-4 h-4 rounded"
                          />
                          <span>{opt}</span>
                        </label>
                      ))
                    ) : (
                      <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(ackChecked[p.taskId])}
                          onChange={(e) => {
                            setAckChecked((prev) => ({
                              ...prev,
                              [p.taskId]: e.target.checked,
                            }));
                            setFieldErrors((prev) => ({ ...prev, [p.taskId]: "" }));
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <span>I acknowledge and confirm this requirement</span>
                      </label>
                    )}
                  </div>
                )}

                {(t.taskType === "DOCUMENT" || t.requiresDoc) && (
                  <div className="space-y-2">
                    <input
                      ref={(el) => {
                        fileInputRefs.current[p.taskId] = el;
                      }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(p, file);
                      }}
                      className="hidden"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={uploadingTaskId === p.taskId}
                        onClick={() => fileInputRefs.current[p.taskId]?.click()}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 cursor-pointer"
                      >
                        {uploadingTaskId === p.taskId
                          ? "Uploading..."
                          : uploaded
                          ? "Replace File"
                          : "Upload Document"}
                      </button>
                      {uploaded && (
                        <a
                          href={`${uploaded.fileUrl}?portalToken=${encodeURIComponent(token)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-[#0071E3] hover:underline truncate max-w-[220px]"
                        >
                          {uploaded.fileName}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {t.taskType === "SIGNATURE" && (
                  <div className="space-y-2">
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[p.taskId] = el;
                      }}
                      width={320}
                      height={110}
                      onMouseDown={(e) => startDrawing(p.taskId, e)}
                      onMouseMove={(e) => draw(p.taskId, e)}
                      onMouseUp={() => stopDrawing(p.taskId)}
                      onMouseLeave={() => stopDrawing(p.taskId)}
                      onTouchStart={(e) => startDrawing(p.taskId, e)}
                      onTouchMove={(e) => draw(p.taskId, e)}
                      onTouchEnd={() => stopDrawing(p.taskId)}
                      className="w-full max-w-[320px] h-[110px] border border-slate-300 rounded-xl bg-slate-50 touch-none"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => clearCanvas(p.taskId)}
                        className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        Clear signature
                      </button>
                      {formResponses[p.taskId] && (
                        <span className="text-[11px] text-emerald-600 font-medium">
                          Signature captured
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {fieldErrors[p.taskId] && (
                  <p className="text-xs font-medium text-rose-600">
                    {fieldErrors[p.taskId]}
                  </p>
                )}

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    disabled={savingTaskId === p.taskId}
                    onClick={() => saveTask(p, true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                  >
                    {savingTaskId === p.taskId ? "Saving..." : "Save Progress"}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="pt-2 pb-8">
            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: brandColor }}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-white shadow-sm hover:opacity-95 transition cursor-pointer"
            >
              {submitting ? "Submitting..." : "Submit Onboarding for Review"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
