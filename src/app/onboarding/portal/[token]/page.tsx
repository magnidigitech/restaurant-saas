"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";

type TaskStatus = "PENDING" | "COMPLETED" | "WAIVED" | "REJECTED";
type TaskType = "CHECKBOX" | "DOCUMENT" | "FORM_INPUT" | "SIGNATURE" | "DATE";

interface TaskProgress {
  id: string;
  taskId: string;
  status: TaskStatus;
  notes?: string;
  responseValue?: string;
  fileUploadId?: string | null;
  completedAt?: string;
  fileUpload?: { id: string; fileUrl: string; fileName: string } | null;
  task: {
    id: string;
    title: string;
    description?: string;
    isRequired: boolean;
    requiresDoc: boolean;
    taskType: TaskType;
    fieldConfig?: string;
    sortOrder: number;
  };
}

interface OnboardingPortalData {
  id: string;
  accessToken: string;
  status: string;
  startedAt?: string;
  submittedAt?: string;
  reviewNotes?: string;
  employee: { firstName: string; lastName: string; employeeCode: string; personalEmail?: string };
  restaurant: { name: string; branding?: { logoUrl?: string; primaryColor?: string } | null };
  template: { name: string; description?: string };
  progresses: TaskProgress[];
}

export default function EmployeeOnboardingPortal() {
  const params = useParams();
  const token = params?.token as string;

  const [session, setSession] = useState<OnboardingPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Form Field Local State
  const [formResponses, setFormResponses] = useState<{ [taskId: string]: string }>({});
  const [checkboxResponses, setCheckboxResponses] = useState<{ [taskId: string]: string[] }>({});
  const [fileUploads, setFileUploads] = useState<{ [taskId: string]: { id: string; fileName: string; fileUrl: string } }>({});
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

  // Signature canvas refs
  const canvasRefs = useRef<{ [taskId: string]: HTMLCanvasElement | null }>({});
  const fileInputRefs = useRef<{ [taskId: string]: HTMLInputElement | null }>({});
  const drawingTaskIds = useRef<{ [taskId: string]: boolean }>({});

  const fetchPortalData = async () => {
    try {
      const res = await fetch(`/api/restaurant/onboarding/portal/${token}`);
      const data = await res.json();
      if (res.ok) {
        setSession(data.session);
        // Initialize existing responses into local state
        const initialForm: { [taskId: string]: string } = {};
        const initialCheckboxes: { [taskId: string]: string[] } = {};
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
          if (p.fileUpload) {
            initialFiles[p.taskId] = { id: p.fileUpload.id, fileName: p.fileUpload.fileName, fileUrl: p.fileUpload.fileUrl };
          }
        });

        setFormResponses(initialForm);
        setCheckboxResponses(initialCheckboxes);
        setFileUploads(initialFiles);

        if (["PENDING_APPROVAL", "APPROVED"].includes(data.session?.status)) {
          setSubmittedSuccess(true);
        }
      } else {
        setError(data.error || "Link invalid or expired");
      }
    } catch {
      setError("Network error loading onboarding portal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchPortalData();
  }, [token]);

  // Canvas Signature Drawing
  const startDrawing = (taskId: string, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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

  const draw = (taskId: string, e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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
    drawingTaskIds.current[taskId] = false;
    const canvas = canvasRefs.current[taskId];
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      setFormResponses((prev) => ({ ...prev, [taskId]: dataUrl }));
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

  // File Upload handler
  const handleFileUpload = async (taskId: string, file: File) => {
    setUploadingTaskId(taskId);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("portalToken", token);
      if (session?.id) fd.append("onboardingId", session.id);
      const res = await fetch("/api/restaurant/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFileUploads((prev) => ({
        ...prev,
        [taskId]: { id: data.upload.id, fileName: data.upload.fileName, fileUrl: data.upload.fileUrl },
      }));
    } catch (e: any) {
      setError(e.message || "File upload failed");
    } finally {
      setUploadingTaskId(null);
    }
  };

  // Checkbox group toggle handler
  const handleToggleCheckboxOption = (taskId: string, option: string) => {
    setCheckboxResponses((prev) => {
      const current = prev[taskId] || [];
      const updated = current.includes(option) ? current.filter((o) => o !== option) : [...current, option];
      return { ...prev, [taskId]: updated };
    });
  };

  // Submit entire Google Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setError("");

    // Validate required fields
    for (const p of session.progresses) {
      if (p.task.isRequired) {
        const responseText = formResponses[p.taskId];
        const cbList = checkboxResponses[p.taskId];
        const fileObj = fileUploads[p.taskId];

        const hasText = responseText && responseText.trim().length > 0;
        const hasCb = cbList && cbList.length > 0;
        const hasFile = !!fileObj;

        if (!hasText && !hasCb && !hasFile) {
          setError(`Please complete required field: "${p.task.title}"`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      // Batch save progress for all questions
      for (const p of session.progresses) {
        let val: string | undefined = formResponses[p.taskId];
        if (checkboxResponses[p.taskId] && checkboxResponses[p.taskId].length > 0) {
          val = JSON.stringify(checkboxResponses[p.taskId]);
        }

        const fileObj = fileUploads[p.taskId];

        if (val || fileObj) {
          await fetch(`/api/restaurant/onboarding/portal/${token}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskId: p.taskId,
              status: "COMPLETED",
              responseValue: val || undefined,
              fileUploadId: fileObj?.id || undefined,
            }),
          });
        }
      }

      setSubmittedSuccess(true);
      fetchPortalData();
    } catch (e: any) {
      setError(e.message || "Failed to submit onboarding form");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">
        Loading form...
      </main>
    );
  }

  if (error && !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-center text-gray-900">
        <div className="max-w-md bg-white border border-gray-200 p-8 rounded-2xl space-y-4 shadow-lg">
          <h2 className="text-xl font-bold text-red-600">Portal Access Error</h2>
          <p className="text-gray-600 text-sm">{error || "Invalid onboarding link"}</p>
        </div>
      </main>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-16">
      {/* Top Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          {session.restaurant.branding?.logoUrl ? (
            <img src={session.restaurant.branding.logoUrl} alt="Logo" className="h-8 w-auto" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow">
              {session.restaurant.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-base font-bold text-gray-900">{session.restaurant.name}</h1>
            <p className="text-xs text-gray-500">Employee Onboarding Portal</p>
          </div>
        </div>
        <span className="text-xs px-3 py-1 rounded-full font-mono font-bold bg-gray-100 border border-gray-200 text-gray-700">
          {session.employee.employeeCode}
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Form Main Title Card */}
        <div className="bg-white border-t-8 border-t-indigo-600 border-x border-b border-gray-200 rounded-2xl p-8 shadow-sm space-y-3">
          <h2 className="text-3xl font-extrabold text-gray-900">{session.template.name}</h2>
          <p className="text-sm text-gray-600">{session.template.description || "Please review and complete all requested form fields below."}</p>
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Employee: <strong className="text-gray-900">{session.employee.firstName} {session.employee.lastName}</strong></span>
            <span className="text-red-500 font-semibold">* Indicates required question</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl font-semibold">
            {error}
          </div>
        )}

        {/* Completion Card */}
        {submittedSuccess ? (
          <div className="bg-white border border-emerald-200 rounded-2xl p-10 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto border border-emerald-200">
              ✓
            </div>
            <h3 className="text-2xl font-bold text-gray-900">Onboarding Form Submitted!</h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Thank you, <span className="font-bold text-gray-900">{session.employee.firstName}</span>. Your onboarding information has been recorded and submitted for manager review.
            </p>
            <span className="inline-block text-xs px-3 py-1 rounded-full font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase tracking-widest mt-2">
              Status: Pending Manager Approval
            </span>
          </div>
        ) : (
          /* Single Google Form Form */
          <form onSubmit={handleSubmitForm} className="space-y-6">
            {[...session.progresses]
              .sort((a, b) => a.task.sortOrder - b.task.sortOrder)
              .map((progress, idx) => {
                let parsedConfig = { subtype: "short_answer", options: ["Option 1", "Option 2"] };
                try {
                  if (progress.task.fieldConfig) parsedConfig = JSON.parse(progress.task.fieldConfig);
                } catch {}

                const taskId = progress.taskId;

                return (
                  <div key={progress.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                    {/* Question Label & Required Badge */}
                    <div className="space-y-1">
                      <label className="block text-base font-bold text-gray-900">
                        {idx + 1}. {progress.task.title} {progress.task.isRequired && <span className="text-red-500">*</span>}
                      </label>
                      {progress.task.description && <p className="text-xs text-gray-500">{progress.task.description}</p>}
                    </div>

                    {/* Form Field Inputs */}
                    <div className="pt-2">
                      {/* Short Answer */}
                      {parsedConfig.subtype === "short_answer" && (
                        <input
                          type="text"
                          required={progress.task.isRequired}
                          placeholder="Your answer..."
                          value={formResponses[taskId] || ""}
                          onChange={(e) => setFormResponses((prev) => ({ ...prev, [taskId]: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                        />
                      )}

                      {/* Paragraph */}
                      {parsedConfig.subtype === "paragraph" && (
                        <textarea
                          required={progress.task.isRequired}
                          placeholder="Your answer..."
                          rows={3}
                          value={formResponses[taskId] || ""}
                          onChange={(e) => setFormResponses((prev) => ({ ...prev, [taskId]: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all resize-none"
                        />
                      )}

                      {/* Multiple Choice (Radio) */}
                      {parsedConfig.subtype === "multiple_choice" && (
                        <div className="space-y-2.5">
                          {(parsedConfig.options || []).map((opt: string, oIdx: number) => (
                            <label key={oIdx} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-indigo-50/50 border border-gray-200 rounded-xl cursor-pointer transition-all">
                              <input
                                type="radio"
                                name={`q_${taskId}`}
                                value={opt}
                                checked={formResponses[taskId] === opt}
                                onChange={(e) => setFormResponses((prev) => ({ ...prev, [taskId]: e.target.value }))}
                                className="accent-indigo-600 w-4 h-4"
                              />
                              <span className="text-sm font-semibold text-gray-800">{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Checkboxes (Multi-Select) */}
                      {parsedConfig.subtype === "checkboxes" && (
                        <div className="space-y-2.5">
                          {(parsedConfig.options || []).map((opt: string, oIdx: number) => {
                            const isChecked = (checkboxResponses[taskId] || []).includes(opt);
                            return (
                              <label key={oIdx} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-indigo-50/50 border border-gray-200 rounded-xl cursor-pointer transition-all">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleCheckboxOption(taskId, opt)}
                                  className="accent-indigo-600 w-4 h-4"
                                />
                                <span className="text-sm font-semibold text-gray-800">{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* Dropdown */}
                      {parsedConfig.subtype === "dropdown" && (
                        <select
                          required={progress.task.isRequired}
                          value={formResponses[taskId] || ""}
                          onChange={(e) => setFormResponses((prev) => ({ ...prev, [taskId]: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 cursor-pointer"
                        >
                          <option value="">Select an option...</option>
                          {(parsedConfig.options || []).map((opt: string, oIdx: number) => (
                            <option key={oIdx} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {/* Date */}
                      {progress.task.taskType === "DATE" && (
                        <input
                          type="date"
                          required={progress.task.isRequired}
                          value={formResponses[taskId] || ""}
                          onChange={(e) => setFormResponses((prev) => ({ ...prev, [taskId]: e.target.value }))}
                          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 cursor-pointer"
                        />
                      )}

                      {/* Time */}
                      {parsedConfig.subtype === "time" && (
                        <input
                          type="time"
                          required={progress.task.isRequired}
                          value={formResponses[taskId] || ""}
                          onChange={(e) => setFormResponses((prev) => ({ ...prev, [taskId]: e.target.value }))}
                          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 cursor-pointer"
                        />
                      )}

                      {/* Digital Signature Pad */}
                      {progress.task.taskType === "SIGNATURE" && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Sign with Mouse / Touch Screen</span>
                            <button
                              type="button"
                              onClick={() => clearCanvas(taskId)}
                              className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
                            >
                              Clear Signature
                            </button>
                          </div>
                          <div className="border border-gray-300 bg-white rounded-xl p-1 shadow-inner">
                            <canvas
                              ref={(el) => { canvasRefs.current[taskId] = el; }}
                              width={500}
                              height={160}
                              onMouseDown={(e) => startDrawing(taskId, e)}
                              onMouseMove={(e) => draw(taskId, e)}
                              onMouseUp={() => stopDrawing(taskId)}
                              onMouseLeave={() => stopDrawing(taskId)}
                              onTouchStart={(e) => startDrawing(taskId, e)}
                              onTouchMove={(e) => draw(taskId, e)}
                              onTouchEnd={() => stopDrawing(taskId)}
                              className="w-full h-36 cursor-crosshair rounded-lg"
                            />
                          </div>
                          {formResponses[taskId] && <p className="text-xs text-emerald-600 font-bold">Signature captured</p>}
                        </div>
                      )}

                      {/* File Upload Attachment */}
                      {progress.task.taskType === "DOCUMENT" && (
                        <div className="space-y-2">
                          <input
                            ref={(el) => { fileInputRefs.current[taskId] = el; }}
                            type="file"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleFileUpload(taskId, e.target.files[0])}
                          />
                          <div
                            onClick={() => fileInputRefs.current[taskId]?.click()}
                            className="p-6 border border-dashed border-gray-300 bg-gray-50 hover:bg-indigo-50/50 hover:border-indigo-400 rounded-xl text-center cursor-pointer transition-all"
                          >
                            {uploadingTaskId === taskId ? (
                              <span className="text-xs font-bold text-indigo-600">Uploading attachment...</span>
                            ) : fileUploads[taskId] ? (
                              <div className="space-y-1">
                                <span className="text-xs font-bold text-emerald-600 block">✓ File Uploaded: {fileUploads[taskId].fileName}</span>
                                <span className="text-[10px] text-gray-500 underline">Click to replace file</span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="text-xs font-bold text-gray-700 block">Click to upload file attachment</span>
                                <span className="text-[10px] text-gray-400">PDF, Photo, ID, or Image (Max 10MB)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Checklist Agreement */}
                      {parsedConfig.subtype === "agreement" && (
                        <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formResponses[taskId] === "AGREED"}
                            onChange={(e) => setFormResponses((prev) => ({ ...prev, [taskId]: e.target.checked ? "AGREED" : "" }))}
                            className="accent-indigo-600 w-4 h-4"
                          />
                          <span className="text-sm font-semibold text-gray-800">I confirm and agree to all above details</span>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* Submit Form Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base rounded-2xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Submitting Form..." : "Submit Onboarding Form"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
