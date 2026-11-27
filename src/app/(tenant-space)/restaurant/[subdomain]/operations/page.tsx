"use client";

import React, { useState, useEffect, useMemo, use } from "react";
import { useTheme } from "@/core/theme/ThemeContext";
import {
  CheckSquare,
  Plus,
  Copy,
  Edit3,
  Trash2,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RotateCcw,
  ChevronRight,
  X,
  Building2,
  UserCheck,
  History,
  Send,
} from "lucide-react";

type ChecklistType =
  | "OPENING"
  | "CLOSING"
  | "MID_DAY"
  | "FOOD_SAFETY"
  | "WEEKLY_MAINTENANCE"
  | "CUSTOM";

type ChecklistStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED";

interface ResponseHistoryEntry {
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  recordedValue?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  isOutOfRange?: boolean;
  reason?: string | null;
  carryForwardOwner?: string | null;
  carryForwardNote?: string | null;
}

interface ChecklistItemExecution {
  id: string;
  title: string;
  description: string | null;
  sectionName: string | null;
  isRequired: boolean;
  requiresValueInput: boolean;
  valueInputLabel: string | null;
  minValue: number | null;
  maxValue: number | null;
  unit: string | null;
  requiresPhoto: boolean;
  status: string;
  isCompleted: boolean;
  inputValue: string | null;
  notes: string | null;
  photoUrl: string | null;
  isOutOfRange: boolean;
  reviewStatus: string;
  returnReason: string | null;
  carryForwardOwner: string | null;
  carryForwardNote: string | null;
  responseHistory: ResponseHistoryEntry[] | null;
  version: number;
  templateItem?: { priority?: string; roleRequired?: string | null } | null;
}

interface ChecklistExecution {
  id: string;
  templateId: string;
  outletId: string;
  assignedEmployeeId: string | null;
  shiftAssignmentId: string | null;
  stationName: string | null;
  dueAt: string | null;
  status: ChecklistStatus;
  allowCarryForwardExceptions: boolean;
  handoverNotes: string | null;
  startedAt: string;
  submittedAt: string | null;
  verifiedAt: string | null;
  version: number;
  template: {
    id: string;
    name: string;
    type: ChecklistType;
    estimatedMinutes: number;
  };
  outlet: { id: string; name: string; timezone: string };
  assignedEmployee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string | null;
    role: string | null;
  } | null;
  verifiedBy: { id: string; firstName: string; lastName: string; employeeCode: string | null } | null;
  shiftAssignment: {
    id: string;
    startTime: string;
    endTime: string;
    roleName: string | null;
    department: { id: string; name: string } | null;
  } | null;
  items: ChecklistItemExecution[];
}

interface ChecklistTemplate {
  id: string;
  name: string;
  type: ChecklistType;
  description: string | null;
  estimatedMinutes: number;
  items: Array<{
    id: string;
    title: string;
    description: string | null;
    sectionName: string | null;
    roleRequired: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    isRequired: boolean;
    requiresValueInput: boolean;
    valueInputLabel: string | null;
    minValue: number | null;
    maxValue: number | null;
    unit: string | null;
    requiresPhoto: boolean;
  }>;
}

interface Outlet {
  id: string;
  name: string;
  timezone?: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  role: string | null;
}

interface ShiftOption {
  id: string;
  startTime: string;
  endTime: string;
  role: string | null;
  employeeId: string;
  outletId: string;
  employee: { id: string; firstName: string; lastName: string };
  outlet: { id: string; name: string; timezone: string };
}

const TYPE_LABELS: Record<ChecklistType, string> = {
  OPENING: "Opening",
  MID_DAY: "Mid-Shift",
  CLOSING: "Closing",
  FOOD_SAFETY: "Food Safety",
  WEEKLY_MAINTENANCE: "Deep Clean",
  CUSTOM: "Custom",
};

const STATUS_BADGE: Record<ChecklistStatus, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  COMPLETED: { label: "Awaiting Sign-Off", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  VERIFIED: { label: "Verified", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

function formatOutletTime(iso: string | null | undefined, tz = "Asia/Kolkata") {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: tz,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export default function OperationsChecklistsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<"LIVE_BOARD" | "TEMPLATES" | "AUDIT_HISTORY">("LIVE_BOARD");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedOutlet, setSelectedOutlet] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [executions, setExecutions] = useState<ChecklistExecution[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [actor, setActor] = useState<{
    canManageOperations: boolean;
    canViewOperations: boolean;
    employeeId: string | null;
  }>({ canManageOperations: false, canViewOperations: false, employeeId: null });

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Active execution drawer (Staff mobile execution)
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [savedItemIds, setSavedItemIds] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [handoverNotesInput, setHandoverNotesInput] = useState("");
  const [draftValues, setDraftValues] = useState<Record<string, { recordedValue: string; notes: string }>>({});

  // Supervisor review & handover modal
  const [reviewExecutionId, setReviewExecutionId] = useState<string | null>(null);
  const [returningItemId, setReturningItemId] = useState<string | null>(null);
  const [returnReasonInput, setReturnReasonInput] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [allowCarryForward, setAllowCarryForward] = useState(false);
  const [carryForwardOwner, setCarryForwardOwner] = useState("");
  const [carryForwardNote, setCarryForwardNote] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Assign checklist modal
  const [showStartModal, setShowStartModal] = useState(false);
  const [startForm, setStartForm] = useState({
    templateId: "",
    outletId: "",
    shiftAssignmentId: "",
    assignedEmployeeId: "",
    stationName: "",
    dueAt: "",
    allowCarryForwardExceptions: false,
  });

  // Create / edit template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<{
    name: string;
    type: ChecklistType;
    estimatedMinutes: number;
    description: string;
    items: Array<{
      title: string;
      sectionName: string;
      roleRequired: string;
      priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      isRequired: boolean;
      requiresValueInput: boolean;
      valueInputLabel: string;
      minValue: string;
      maxValue: string;
      unit: string;
      requiresPhoto: boolean;
    }>;
  }>({
    name: "",
    type: "OPENING",
    estimatedMinutes: 20,
    description: "",
    items: [
      {
        title: "",
        sectionName: "General",
        roleRequired: "Line Cook",
        priority: "MEDIUM",
        isRequired: true,
        requiresValueInput: false,
        valueInputLabel: "",
        minValue: "",
        maxValue: "",
        unit: "",
        requiresPhoto: false,
      },
    ],
  });

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchOutlets = async () => {
    try {
      const res = await fetch("/api/restaurant/outlets");
      const data = await res.json();
      if (res.ok && data.outlets) {
        setOutlets(data.outlets);
      }
    } catch {}
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (selectedDate) q.set("date", selectedDate);
      if (selectedOutlet) q.set("outletId", selectedOutlet);
      if (selectedShift) q.set("shiftAssignmentId", selectedShift);
      if (selectedStatus) q.set("status", selectedStatus);

      const [resExecs, resTpls] = await Promise.all([
        fetch(`/api/restaurant/operations/checklists?${q.toString()}`),
        fetch("/api/restaurant/operations/templates"),
      ]);
      const dataExecs = await resExecs.json();
      const dataTpls = await resTpls.json();

      if (resExecs.ok) {
        setExecutions(dataExecs.executions || []);
        setShiftAssignments(dataExecs.shiftAssignments || []);
        setEmployees(dataExecs.employees || []);
        if (dataExecs.actor) setActor(dataExecs.actor);
      } else {
        showToast(dataExecs.error || "Failed to load checklists", "error");
      }
      if (resTpls.ok) {
        setTemplates(dataTpls.templates || []);
      }
    } catch {
      showToast("Network error loading checklists", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, [subdomain]);

  useEffect(() => {
    fetchAll();
  }, [selectedDate, selectedOutlet, selectedShift, selectedStatus]);

  const activeExecution = useMemo(
    () => executions.find((e) => e.id === activeExecutionId) || null,
    [executions, activeExecutionId]
  );

  const reviewExecution = useMemo(
    () => executions.find((e) => e.id === reviewExecutionId) || null,
    [executions, reviewExecutionId]
  );

  useEffect(() => {
    if (activeExecution) {
      setHandoverNotesInput(activeExecution.handoverNotes || "");
      const drafts: Record<string, { recordedValue: string; notes: string }> = {};
      for (const it of activeExecution.items) {
        drafts[it.id] = {
          recordedValue: it.inputValue || "",
          notes: it.notes || "",
        };
      }
      setDraftValues(drafts);
      setSubmitError(null);
    }
  }, [activeExecution?.id]);

  // Mobile attention-first sorting
  const sortedMobileExecutions = useMemo(() => {
    const score = (e: ChecklistExecution) => {
      const hasReturned = e.items.some((i) => i.reviewStatus === "RETURNED");
      const hasFlag = e.items.some((i) => i.isOutOfRange);
      if (hasReturned) return 0;
      if (e.status === "COMPLETED") return 1;
      if (e.status === "IN_PROGRESS" && hasFlag) return 2;
      if (e.status === "IN_PROGRESS") return 3;
      if (e.status === "PENDING") return 4;
      return 5;
    };
    return [...executions].sort((a, b) => score(a) - score(b));
  }, [executions]);

  const historyExecutions = useMemo(
    () => executions.filter((e) => e.status === "VERIFIED"),
    [executions]
  );

  const saveTask = async (
    item: ChecklistItemExecution,
    patch: {
      isCompleted?: boolean;
      recordedValue?: string | null;
      notes?: string | null;
      photoUrl?: string | null;
    }
  ) => {
    setSavingItemId(item.id);
    try {
      const res = await fetch("/api/restaurant/operations/checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_ITEM",
          itemExecutionId: item.id,
          expectedVersion: item.version,
          ...patch,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to save task", "error");
        if (res.status === 409) await fetchAll();
        return;
      }
      setSavedItemIds((prev) => ({ ...prev, [item.id]: true }));
      await fetchAll();
    } catch {
      showToast("Network error saving task", "error");
    } finally {
      setSavingItemId(null);
    }
  };

  const handlePhotoUpload = async (
    executionId: string,
    item: ChecklistItemExecution,
    file: File
  ) => {
    setSavingItemId(item.id);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("executionId", executionId);
      const res = await fetch("/api/restaurant/operations/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Photo upload failed", "error");
        return;
      }
      await saveTask(item, { photoUrl: data.url });
      showToast("Photo uploaded and saved");
    } catch {
      showToast("Network error uploading photo", "error");
    } finally {
      setSavingItemId(null);
    }
  };

  const handleSubmitChecklist = async () => {
    if (!activeExecution) return;
    setSubmitError(null);
    try {
      const res = await fetch("/api/restaurant/operations/checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_CHECKLIST",
          executionId: activeExecution.id,
          handoverNotes: handoverNotesInput,
          expectedVersion: activeExecution.version,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Cannot submit checklist");
        return;
      }
      showToast("Checklist submitted for supervisor review");
      setActiveExecutionId(null);
      await fetchAll();
    } catch {
      setSubmitError("Network error submitting checklist");
    }
  };

  const handleReturnItem = async (execution: ChecklistExecution, item: ChecklistItemExecution) => {
    if (!returnReasonInput.trim()) {
      setReviewError("Please enter a reason before returning a task.");
      return;
    }
    setReviewError(null);
    try {
      const res = await fetch("/api/restaurant/operations/checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RETURN_ITEM",
          executionId: execution.id,
          itemExecutionId: item.id,
          returnReason: returnReasonInput.trim(),
          expectedVersion: item.version,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.error || "Failed to return task");
        return;
      }
      setReturningItemId(null);
      setReturnReasonInput("");
      showToast(`Returned "${item.title}" for correction`);
      await fetchAll();
    } catch {
      setReviewError("Network error returning task");
    }
  };

  const handleVerifyChecklist = async (execution: ChecklistExecution) => {
    setReviewError(null);
    try {
      const res = await fetch("/api/restaurant/operations/checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VERIFY_CHECKLIST",
          executionId: execution.id,
          handoverNotes: verifyNotes || execution.handoverNotes || undefined,
          allowCarryForwardExceptions: allowCarryForward,
          carryForwardOwner: carryForwardOwner || undefined,
          carryForwardNote: carryForwardNote || undefined,
          expectedVersion: execution.version,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.error || "Sign-off failed");
        return;
      }
      showToast(
        data.alreadyVerified ? "Checklist was already signed off" : "Checklist verified and signed off"
      );
      setReviewExecutionId(null);
      await fetchAll();
    } catch {
      setReviewError("Network error signing off checklist");
    }
  };

  const handleStartChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/restaurant/operations/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: startForm.templateId,
          outletId: startForm.outletId,
          shiftAssignmentId: startForm.shiftAssignmentId || undefined,
          assignedEmployeeId: startForm.assignedEmployeeId || undefined,
          stationName: startForm.stationName || undefined,
          dueAt: startForm.dueAt ? new Date(startForm.dueAt).toISOString() : undefined,
          allowCarryForwardExceptions: startForm.allowCarryForwardExceptions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to assign checklist", "error");
        return;
      }
      showToast("Checklist assigned");
      setShowStartModal(false);
      await fetchAll();
    } catch {
      showToast("Network error assigning checklist", "error");
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        action: editingTemplateId ? "UPDATE" : undefined,
        templateId: editingTemplateId || undefined,
        name: templateForm.name,
        type: templateForm.type,
        estimatedMinutes: templateForm.estimatedMinutes,
        description: templateForm.description || undefined,
        items: templateForm.items.map((it) => ({
          title: it.title,
          sectionName: it.sectionName || "General",
          roleRequired: it.roleRequired || undefined,
          priority: it.priority,
          isRequired: it.isRequired,
          requiresValueInput: it.requiresValueInput,
          valueInputLabel: it.valueInputLabel || undefined,
          minValue: it.minValue !== "" ? Number(it.minValue) : null,
          maxValue: it.maxValue !== "" ? Number(it.maxValue) : null,
          unit: it.unit || undefined,
          requiresPhoto: it.requiresPhoto,
        })),
      };
      const res = await fetch("/api/restaurant/operations/templates", {
        method: editingTemplateId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to save template", "error");
        return;
      }
      showToast(editingTemplateId ? "Template updated" : "Template created");
      setShowTemplateModal(false);
      setEditingTemplateId(null);
      await fetchAll();
    } catch {
      showToast("Network error saving template", "error");
    }
  };

  const groupedActiveItems = useMemo(() => {
    if (!activeExecution) return [];
    const groups = new Map<string, ChecklistItemExecution[]>();
    for (const item of activeExecution.items) {
      const sec = item.sectionName || "General";
      if (!groups.has(sec)) groups.set(sec, []);
      groups.get(sec)!.push(item);
    }
    return Array.from(groups.entries());
  }, [activeExecution]);

  const cardCls = isDark
    ? "bg-zinc-900 border-zinc-800 text-zinc-100"
    : "bg-white border-zinc-200 text-zinc-900";
  const mutedCls = isDark ? "text-zinc-400" : "text-zinc-500";
  const inputCls = isDark
    ? "bg-zinc-800 border-zinc-700 text-zinc-100"
    : "bg-white border-zinc-300 text-zinc-900";

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === "error"
              ? "bg-red-600 text-white"
              : "bg-emerald-600 text-white"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-500" />
            Shift Checklists & Handover
          </h1>
          <p className={`text-sm mt-1 ${mutedCls}`}>
            Outlet-scoped operational checklists, readings, photo proof, and supervisor sign-off.
          </p>
        </div>

        {actor.canManageOperations && (
          <button
            onClick={() => {
              setStartForm({
                templateId: templates[0]?.id || "",
                outletId: selectedOutlet || outlets[0]?.id || "",
                shiftAssignmentId: "",
                assignedEmployeeId: "",
                stationName: "",
                dueAt: "",
                allowCarryForwardExceptions: false,
              });
              setShowStartModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Assign Checklist
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab("LIVE_BOARD")}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium ${
            activeTab === "LIVE_BOARD"
              ? "bg-indigo-600 text-white"
              : `${mutedCls} hover:bg-zinc-100 dark:hover:bg-zinc-800`
          }`}
        >
          Checklist Queue ({executions.length})
        </button>
        {actor.canManageOperations && (
          <button
            onClick={() => setActiveTab("TEMPLATES")}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium ${
              activeTab === "TEMPLATES"
                ? "bg-indigo-600 text-white"
                : `${mutedCls} hover:bg-zinc-100 dark:hover:bg-zinc-800`
            }`}
          >
            Templates ({templates.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab("AUDIT_HISTORY")}
          className={`px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
            activeTab === "AUDIT_HISTORY"
              ? "bg-indigo-600 text-white"
              : `${mutedCls} hover:bg-zinc-100 dark:hover:bg-zinc-800`
          }`}
        >
          <History className="w-4 h-4" />
          Signed-Off History ({historyExecutions.length})
        </button>
      </div>

      {/* Filters */}
      {activeTab !== "TEMPLATES" && (
        <div className={`p-4 rounded-2xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ${cardCls}`}>
          <div>
            <label className={`block text-xs font-medium mb-1 ${mutedCls}`}>Outlet</label>
            <select
              aria-label="Filter by outlet"
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${inputCls}`}
            >
              <option value="">All Authorized Outlets</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${mutedCls}`}>Date</label>
            <input
              aria-label="Filter by date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${inputCls}`}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${mutedCls}`}>Shift</label>
            <select
              aria-label="Filter by shift"
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${inputCls}`}
            >
              <option value="">All Shifts</option>
              {shiftAssignments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.employee.firstName} {s.employee.lastName} ({s.startTime}–{s.endTime})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${mutedCls}`}>Status</label>
            <select
              aria-label="Filter by status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${inputCls}`}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Awaiting Sign-Off</option>
              <option value="VERIFIED">Verified</option>
            </select>
          </div>
        </div>
      )}

      {/* LIVE BOARD */}
      {activeTab === "LIVE_BOARD" && (
        <>
          {loading ? (
            <div className={`p-8 rounded-2xl border text-center ${cardCls}`}>Loading checklists...</div>
          ) : executions.length === 0 ? (
            <div className={`p-8 rounded-2xl border text-center ${cardCls}`}>
              <p className="font-medium">No checklists found for these filters.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div
                tabIndex={0}
                role="region"
                aria-label="Checklist operations queue"
                className={`hidden md:block overflow-auto rounded-2xl border ${cardCls}`}
              >
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Checklist</th>
                      <th className="py-3 px-4 font-semibold">Outlet & Station</th>
                      <th className="py-3 px-4 font-semibold">Assignee / Shift</th>
                      <th className="py-3 px-4 font-semibold">Due (Local)</th>
                      <th className="py-3 px-4 font-semibold">Progress & Flags</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {executions.map((ex) => {
                      const doneCount = ex.items.filter((i) => i.isCompleted).length;
                      const flaggedCount = ex.items.filter((i) => i.isOutOfRange).length;
                      const returnedCount = ex.items.filter((i) => i.reviewStatus === "RETURNED").length;
                      const badge = STATUS_BADGE[ex.status];

                      return (
                        <tr key={ex.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                          <td className="py-3 px-4 font-medium">
                            <div>{ex.template.name}</div>
                            <div className={`text-xs ${mutedCls}`}>{TYPE_LABELS[ex.template.type]}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                              {ex.outlet.name}
                            </div>
                            {ex.stationName && (
                              <div className={`text-xs ${mutedCls}`}>Station: {ex.stationName}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {ex.assignedEmployee ? (
                              <div className="flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                                {ex.assignedEmployee.firstName} {ex.assignedEmployee.lastName}
                              </div>
                            ) : (
                              <span className={mutedCls}>Unassigned</span>
                            )}
                            {ex.shiftAssignment && (
                              <div className={`text-xs ${mutedCls}`}>
                                Shift {ex.shiftAssignment.startTime}–{ex.shiftAssignment.endTime}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {formatOutletTime(ex.dueAt, ex.outlet.timezone)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium">
                              {doneCount}/{ex.items.length} tasks
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {flaggedCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-600 dark:text-red-400">
                                  <AlertTriangle className="w-3 h-3" /> {flaggedCount} out-of-range
                                </span>
                              )}
                              {returnedCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                  <RotateCcw className="w-3 h-3" /> {returnedCount} returned
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => setActiveExecutionId(ex.id)}
                              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              {ex.status === "VERIFIED" ? "View" : "Open Tasks"}
                            </button>
                            {actor.canManageOperations && (
                              <button
                                onClick={() => {
                                  setReviewExecutionId(ex.id);
                                  setVerifyNotes(ex.handoverNotes || "");
                                  setAllowCarryForward(ex.allowCarryForwardExceptions);
                                  setReviewError(null);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium"
                              >
                                Review & Sign Off
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Attention-First Cards */}
              <div className="md:hidden space-y-3">
                {sortedMobileExecutions.map((ex) => {
                  const doneCount = ex.items.filter((i) => i.isCompleted).length;
                  const flaggedCount = ex.items.filter((i) => i.isOutOfRange).length;
                  const returnedCount = ex.items.filter((i) => i.reviewStatus === "RETURNED").length;
                  const badge = STATUS_BADGE[ex.status];

                  return (
                    <div key={ex.id} className={`p-4 rounded-2xl border space-y-3 ${cardCls}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{ex.template.name}</div>
                          <div className={`text-xs mt-0.5 ${mutedCls}`}>
                            {ex.outlet.name}
                            {ex.stationName ? ` • ${ex.stationName}` : ""}
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className={`text-xs flex flex-wrap gap-3 ${mutedCls}`}>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Due: {formatOutletTime(ex.dueAt, ex.outlet.timezone)}
                        </span>
                        <span>
                          Progress: {doneCount}/{ex.items.length}
                        </span>
                      </div>

                      {(flaggedCount > 0 || returnedCount > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                          {returnedCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              {returnedCount} returned for correction
                            </span>
                          )}
                          {flaggedCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-600 dark:text-red-400">
                              {flaggedCount} out-of-range
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setActiveExecutionId(ex.id)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-1"
                        >
                          {ex.status === "VERIFIED" ? "View Checklist" : "Complete Tasks"}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {actor.canManageOperations && (
                          <button
                            onClick={() => {
                              setReviewExecutionId(ex.id);
                              setVerifyNotes(ex.handoverNotes || "");
                              setAllowCarryForward(ex.allowCarryForwardExceptions);
                              setReviewError(null);
                            }}
                            className="py-2.5 px-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-sm font-medium"
                          >
                            Review
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* TEMPLATES TAB */}
      {activeTab === "TEMPLATES" && actor.canManageOperations && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingTemplateId(null);
                setTemplateForm({
                  name: "",
                  type: "OPENING",
                  estimatedMinutes: 20,
                  description: "",
                  items: [
                    {
                      title: "",
                      sectionName: "General",
                      roleRequired: "Line Cook",
                      priority: "MEDIUM",
                      isRequired: true,
                      requiresValueInput: false,
                      valueInputLabel: "",
                      minValue: "",
                      maxValue: "",
                      unit: "",
                      requiresPhoto: false,
                    },
                  ],
                });
                setShowTemplateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 ${cardCls}`}>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base">{tpl.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                      {TYPE_LABELS[tpl.type]}
                    </span>
                  </div>
                  {tpl.description && <p className={`text-xs mt-1 ${mutedCls}`}>{tpl.description}</p>}
                  <div className={`text-xs mt-3 ${mutedCls}`}>
                    {tpl.items.length} tasks • ~{tpl.estimatedMinutes} min
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    onClick={() => {
                      setEditingTemplateId(tpl.id);
                      setTemplateForm({
                        name: tpl.name,
                        type: tpl.type,
                        estimatedMinutes: tpl.estimatedMinutes,
                        description: tpl.description || "",
                        items: tpl.items.map((it) => ({
                          title: it.title,
                          sectionName: it.sectionName || "General",
                          roleRequired: it.roleRequired || "",
                          priority: it.priority,
                          isRequired: it.isRequired,
                          requiresValueInput: it.requiresValueInput,
                          valueInputLabel: it.valueInputLabel || "",
                          minValue: it.minValue !== null ? String(it.minValue) : "",
                          maxValue: it.maxValue !== null ? String(it.maxValue) : "",
                          unit: it.unit || "",
                          requiresPhoto: it.requiresPhoto,
                        })),
                      });
                      setShowTemplateModal(true);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium inline-flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={async () => {
                      await fetch("/api/restaurant/operations/templates", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "DUPLICATE", templateId: tpl.id }),
                      });
                      showToast("Template duplicated");
                      fetchAll();
                    }}
                    className="py-1.5 px-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs"
                    aria-label="Duplicate template"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      await fetch(`/api/restaurant/operations/templates?id=${tpl.id}`, {
                        method: "DELETE",
                      });
                      showToast("Template removed");
                      fetchAll();
                    }}
                    className="py-1.5 px-2.5 rounded-lg border border-red-300 dark:border-red-900/60 text-red-600 text-xs"
                    aria-label="Delete template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "AUDIT_HISTORY" && (
        <div className="space-y-3">
          {historyExecutions.length === 0 ? (
            <div className={`p-8 rounded-2xl border text-center ${cardCls}`}>
              No signed-off checklists yet.
            </div>
          ) : (
            historyExecutions.map((ex) => (
              <div key={ex.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${cardCls}`}>
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    {ex.template.name} — {ex.outlet.name}
                  </div>
                  <div className={`text-xs mt-1 ${mutedCls}`}>
                    Verified by{" "}
                    {ex.verifiedBy
                      ? `${ex.verifiedBy.firstName} ${ex.verifiedBy.lastName}`
                      : "Supervisor"}{" "}
                    at {formatOutletTime(ex.verifiedAt, ex.outlet.timezone)}
                  </div>
                  {ex.handoverNotes && (
                    <div className="text-xs mt-1">Handover: {ex.handoverNotes}</div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setReviewExecutionId(ex.id);
                    setReviewError(null);
                  }}
                  className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-medium"
                >
                  Inspect Record
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* STAFF CHECKLIST EXECUTION DRAWER */}
      {activeExecution && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
          <div className={`w-full max-w-2xl h-full overflow-y-auto p-5 space-y-5 ${isDark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"}`}>
            <div className="flex items-start justify-between gap-3 sticky top-0 py-2 bg-inherit z-10 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-lg font-bold">{activeExecution.template.name}</h2>
                <p className={`text-xs ${mutedCls}`}>
                  {activeExecution.outlet.name}
                  {activeExecution.stationName ? ` • Station: ${activeExecution.stationName}` : ""}
                  {activeExecution.dueAt
                    ? ` • Due ${formatOutletTime(activeExecution.dueAt, activeExecution.outlet.timezone)}`
                    : ""}
                </p>
              </div>
              <button
                aria-label="Close checklist"
                onClick={() => setActiveExecutionId(null)}
                className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitError && (
              <div
                role="alert"
                aria-live="polite"
                className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-700 dark:text-red-300 text-sm"
              >
                {submitError}
              </div>
            )}

            {groupedActiveItems.map(([section, items]) => (
              <div key={section} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                  {section}
                </h3>
                {items.map((item) => {
                  const draft = draftValues[item.id] || {
                    recordedValue: item.inputValue || "",
                    notes: item.notes || "",
                  };
                  const isLocked = activeExecution.status === "VERIFIED";

                  return (
                    <div key={item.id} className={`p-4 rounded-2xl border space-y-3 ${cardCls}`}>
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={item.isCompleted}
                            onChange={() =>
                              saveTask(item, {
                                isCompleted: !item.isCompleted,
                                recordedValue: draft.recordedValue || null,
                                notes: draft.notes || null,
                              })
                            }
                            className="mt-1 h-5 w-5 rounded border-zinc-400 text-indigo-600"
                          />
                          <div>
                            <div className="font-medium text-sm">
                              {item.title}
                              {item.isRequired && <span className="text-red-500 ml-1">*</span>}
                            </div>
                            {item.description && (
                              <p className={`text-xs mt-0.5 ${mutedCls}`}>{item.description}</p>
                            )}
                          </div>
                        </label>
                        <div className="text-xs shrink-0">
                          {savingItemId === item.id ? (
                            <span className="text-indigo-500">Saving...</span>
                          ) : savedItemIds[item.id] ? (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {item.reviewStatus === "RETURNED" && item.returnReason && (
                        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs">
                          <strong>Returned by supervisor:</strong> {item.returnReason}
                        </div>
                      )}

                      {item.requiresValueInput && (
                        <div className="space-y-1">
                          <label className={`block text-xs font-medium ${mutedCls}`}>
                            {item.valueInputLabel || "Reading"}
                            {item.unit ? ` (${item.unit})` : ""}
                            {(item.minValue !== null || item.maxValue !== null) &&
                              ` — Target: ${item.minValue ?? "—"} to ${item.maxValue ?? "—"} ${item.unit || ""}`}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              disabled={isLocked}
                              value={draft.recordedValue}
                              onChange={(e) =>
                                setDraftValues((prev) => ({
                                  ...prev,
                                  [item.id]: { ...draft, recordedValue: e.target.value },
                                }))
                              }
                              placeholder={`Enter ${item.valueInputLabel || "value"}`}
                              className={`flex-1 rounded-xl border px-3 py-2 text-sm ${inputCls}`}
                            />
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() =>
                                  saveTask(item, {
                                    recordedValue: draft.recordedValue,
                                    notes: draft.notes,
                                  })
                                }
                                className="px-3 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold"
                              >
                                Save Reading
                              </button>
                            )}
                          </div>
                          {item.isOutOfRange && (
                            <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Out of acceptable range — preserved and flagged for supervisor review.
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={draft.notes}
                          onChange={(e) =>
                            setDraftValues((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, notes: e.target.value },
                            }))
                          }
                          onBlur={() => {
                            if (!isLocked && draft.notes !== (item.notes || "")) {
                              saveTask(item, { notes: draft.notes });
                            }
                          }}
                          placeholder="Optional note or corrective action..."
                          className={`w-full rounded-xl border px-3 py-2 text-xs ${inputCls}`}
                        />
                      </div>

                      {item.requiresPhoto && (
                        <div className="flex flex-wrap items-center gap-3">
                          {item.photoUrl ? (
                            <a
                              href={item.photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-indigo-500 underline"
                            >
                              View uploaded photo
                            </a>
                          ) : (
                            <span className="text-xs text-amber-600">Photo required</span>
                          )}
                          {!isLocked && (
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-medium cursor-pointer">
                              <Camera className="w-3.5 h-3.5" />
                              {item.photoUrl ? "Replace Photo" : "Upload Photo"}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handlePhotoUpload(activeExecution.id, item, f);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {activeExecution.status !== "VERIFIED" && (
              <div className={`p-4 rounded-2xl border space-y-3 ${cardCls}`}>
                <label className="block text-xs font-semibold">Handover Notes</label>
                <textarea
                  rows={2}
                  value={handoverNotesInput}
                  onChange={(e) => setHandoverNotesInput(e.target.value)}
                  placeholder="Notes for the next shift or supervisor..."
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${inputCls}`}
                />
                <button
                  onClick={handleSubmitChecklist}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Submit Checklist for Sign-Off
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUPERVISOR REVIEW & HANDOVER MODAL */}
      {reviewExecution && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 space-y-5 ${cardCls}`}>
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-lg font-bold">
                  Supervisor Handover & Sign-Off: {reviewExecution.template.name}
                </h2>
                <p className={`text-xs mt-0.5 ${mutedCls}`}>
                  {reviewExecution.outlet.name}
                  {reviewExecution.assignedEmployee
                    ? ` • Assigned to ${reviewExecution.assignedEmployee.firstName} ${reviewExecution.assignedEmployee.lastName}`
                    : ""}
                </p>
              </div>
              <button
                aria-label="Close review modal"
                onClick={() => setReviewExecutionId(null)}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewError && (
              <div role="alert" className="p-3 rounded-xl bg-red-500/15 text-red-600 dark:text-red-300 text-sm">
                {reviewError}
              </div>
            )}

            <div className="space-y-3">
              {reviewExecution.items.map((item) => {
                const missingPhoto = item.requiresPhoto && !item.photoUrl;
                const missingReading = item.requiresValueInput && !item.inputValue;
                const history = Array.isArray(item.responseHistory) ? item.responseHistory : [];

                return (
                  <div key={item.id} className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm">{item.title}</div>
                        <div className={`text-xs mt-0.5 ${mutedCls}`}>
                          {item.isCompleted ? "Completed" : "Incomplete"}
                          {item.inputValue ? ` • Reading: ${item.inputValue} ${item.unit || ""}` : ""}
                          {item.notes ? ` • Note: ${item.notes}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.reviewStatus === "RETURNED" && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-600">
                            Returned
                          </span>
                        )}
                        {item.reviewStatus === "RESUBMITTED" && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-600">
                            Resubmitted
                          </span>
                        )}
                        {item.isOutOfRange && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-600">
                            Out of Range
                          </span>
                        )}
                        {(missingPhoto || missingReading) && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-600">
                            Missing Evidence
                          </span>
                        )}
                        {reviewExecution.status !== "VERIFIED" && (
                          <button
                            onClick={() => {
                              setReturningItemId(item.id);
                              setReturnReasonInput("");
                            }}
                            className="px-2.5 py-1 rounded-lg border border-amber-400/60 text-amber-600 text-xs font-medium"
                          >
                            Return Task
                          </button>
                        )}
                      </div>
                    </div>

                    {item.carryForwardOwner && (
                      <div className="text-xs text-indigo-500">
                        Carried Forward → Owner: {item.carryForwardOwner} ({item.carryForwardNote})
                      </div>
                    )}

                    {returningItemId === item.id && (
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={returnReasonInput}
                          onChange={(e) => setReturnReasonInput(e.target.value)}
                          placeholder="Reason for returning task..."
                          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs ${inputCls}`}
                        />
                        <button
                          onClick={() => handleReturnItem(reviewExecution, item)}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold"
                        >
                          Confirm Return
                        </button>
                      </div>
                    )}

                    {history.length > 0 && (
                      <details className={`text-xs ${mutedCls}`}>
                        <summary className="cursor-pointer select-none">
                          Response History ({history.length})
                        </summary>
                        <ul className="mt-1 space-y-1 pl-3 border-l border-zinc-300 dark:border-zinc-700">
                          {history.map((h, idx) => (
                            <li key={idx}>
                              [{h.action}] {h.actorName} ({formatOutletTime(h.at, reviewExecution.outlet.timezone)})
                              {h.recordedValue ? ` • Value: ${h.recordedValue}` : ""}
                              {h.reason ? ` • Reason: ${h.reason}` : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>

            {reviewExecution.status === "VERIFIED" ? (
              <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-sm">
                Signed off by{" "}
                {reviewExecution.verifiedBy
                  ? `${reviewExecution.verifiedBy.firstName} ${reviewExecution.verifiedBy.lastName}`
                  : "Supervisor"}{" "}
                at {formatOutletTime(reviewExecution.verifiedAt, reviewExecution.outlet.timezone)}.
              </div>
            ) : (
              <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allowCarryForward}
                    onChange={(e) => setAllowCarryForward(e.target.checked)}
                  />
                  Carry forward open exceptions to next shift
                </label>

                {allowCarryForward && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={carryForwardOwner}
                      onChange={(e) => setCarryForwardOwner(e.target.value)}
                      placeholder="Follow-up Owner (e.g. Afternoon Sous Chef)"
                      className={`rounded-xl border px-3 py-2 text-sm ${inputCls}`}
                    />
                    <input
                      type="text"
                      value={carryForwardNote}
                      onChange={(e) => setCarryForwardNote(e.target.value)}
                      placeholder="Carry-forward action note"
                      className={`rounded-xl border px-3 py-2 text-sm ${inputCls}`}
                    />
                  </div>
                )}

                <textarea
                  rows={2}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Supervisor sign-off / handover notes..."
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${inputCls}`}
                />

                <button
                  onClick={() => handleVerifyChecklist(reviewExecution)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm"
                >
                  Verify & Sign Off Checklist
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ASSIGN CHECKLIST MODAL */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleStartChecklist}
            className={`w-full max-w-lg rounded-2xl border p-6 space-y-4 ${cardCls}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Assign Shift Checklist</h2>
              <button type="button" onClick={() => setShowStartModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Template</label>
              <select
                required
                value={startForm.templateId}
                onChange={(e) => setStartForm({ ...startForm, templateId: e.target.value })}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${inputCls}`}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({TYPE_LABELS[t.type]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Outlet</label>
              <select
                required
                value={startForm.outletId}
                onChange={(e) => setStartForm({ ...startForm, outletId: e.target.value })}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${inputCls}`}
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Link to Shift (optional)</label>
              <select
                value={startForm.shiftAssignmentId}
                onChange={(e) => {
                  const sid = e.target.value;
                  const shift = shiftAssignments.find((s) => s.id === sid);
                  setStartForm({
                    ...startForm,
                    shiftAssignmentId: sid,
                    assignedEmployeeId: shift ? shift.employeeId : startForm.assignedEmployeeId,
                  });
                }}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${inputCls}`}
              >
                <option value="">No linked shift</option>
                {shiftAssignments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.employee.firstName} {s.employee.lastName} ({s.startTime}–{s.endTime})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Assigned Staff</label>
              <select
                value={startForm.assignedEmployeeId}
                onChange={(e) =>
                  setStartForm({ ...startForm, assignedEmployeeId: e.target.value })
                }
                className={`w-full rounded-xl border px-3 py-2 text-sm ${inputCls}`}
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Station</label>
                <input
                  type="text"
                  value={startForm.stationName}
                  onChange={(e) => setStartForm({ ...startForm, stationName: e.target.value })}
                  placeholder="e.g. Hot Line"
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${inputCls}`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Due Time</label>
                <input
                  type="datetime-local"
                  value={startForm.dueAt}
                  onChange={(e) => setStartForm({ ...startForm, dueAt: e.target.value })}
                  className={`w-full rounded-xl border px-3 py-2 text-sm ${inputCls}`}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm"
            >
              Assign Checklist
            </button>
          </form>
        </div>
      )}

      {/* CREATE / EDIT TEMPLATE MODAL */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTemplate}
            className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 space-y-4 ${cardCls}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingTemplateId ? "Edit Checklist Template" : "Create Checklist Template"}
              </h2>
              <button type="button" onClick={() => setShowTemplateModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                required
                type="text"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                placeholder="Template Name"
                className={`rounded-xl border px-3 py-2 text-sm ${inputCls}`}
              />
              <select
                value={templateForm.type}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, type: e.target.value as ChecklistType })
                }
                className={`rounded-xl border px-3 py-2 text-sm ${inputCls}`}
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {templateForm.items.map((it, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      required
                      type="text"
                      value={it.title}
                      onChange={(e) => {
                        const next = [...templateForm.items];
                        next[idx].title = e.target.value;
                        setTemplateForm({ ...templateForm, items: next });
                      }}
                      placeholder="Task instruction"
                      className={`rounded-lg border px-2.5 py-1.5 text-sm ${inputCls}`}
                    />
                    <input
                      type="text"
                      value={it.sectionName}
                      onChange={(e) => {
                        const next = [...templateForm.items];
                        next[idx].sectionName = e.target.value;
                        setTemplateForm({ ...templateForm, items: next });
                      }}
                      placeholder="Section (e.g. Cold Chain)"
                      className={`rounded-lg border px-2.5 py-1.5 text-sm ${inputCls}`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={it.isRequired}
                        onChange={(e) => {
                          const next = [...templateForm.items];
                          next[idx].isRequired = e.target.checked;
                          setTemplateForm({ ...templateForm, items: next });
                        }}
                      />
                      Required
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={it.requiresValueInput}
                        onChange={(e) => {
                          const next = [...templateForm.items];
                          next[idx].requiresValueInput = e.target.checked;
                          setTemplateForm({ ...templateForm, items: next });
                        }}
                      />
                      Requires Reading
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={it.requiresPhoto}
                        onChange={(e) => {
                          const next = [...templateForm.items];
                          next[idx].requiresPhoto = e.target.checked;
                          setTemplateForm({ ...templateForm, items: next });
                        }}
                      />
                      Requires Photo
                    </label>
                  </div>
                  {it.requiresValueInput && (
                    <div className="grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={it.valueInputLabel}
                        onChange={(e) => {
                          const next = [...templateForm.items];
                          next[idx].valueInputLabel = e.target.value;
                          setTemplateForm({ ...templateForm, items: next });
                        }}
                        placeholder="Label"
                        className={`rounded-lg border px-2 py-1 text-xs ${inputCls}`}
                      />
                      <input
                        type="number"
                        step="any"
                        value={it.minValue}
                        onChange={(e) => {
                          const next = [...templateForm.items];
                          next[idx].minValue = e.target.value;
                          setTemplateForm({ ...templateForm, items: next });
                        }}
                        placeholder="Min"
                        className={`rounded-lg border px-2 py-1 text-xs ${inputCls}`}
                      />
                      <input
                        type="number"
                        step="any"
                        value={it.maxValue}
                        onChange={(e) => {
                          const next = [...templateForm.items];
                          next[idx].maxValue = e.target.value;
                          setTemplateForm({ ...templateForm, items: next });
                        }}
                        placeholder="Max"
                        className={`rounded-lg border px-2 py-1 text-xs ${inputCls}`}
                      />
                      <input
                        type="text"
                        value={it.unit}
                        onChange={(e) => {
                          const next = [...templateForm.items];
                          next[idx].unit = e.target.value;
                          setTemplateForm({ ...templateForm, items: next });
                        }}
                        placeholder="Unit (°C)"
                        className={`rounded-lg border px-2 py-1 text-xs ${inputCls}`}
                      />
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setTemplateForm({
                    ...templateForm,
                    items: [
                      ...templateForm.items,
                      {
                        title: "",
                        sectionName: "General",
                        roleRequired: "",
                        priority: "MEDIUM",
                        isRequired: true,
                        requiresValueInput: false,
                        valueInputLabel: "",
                        minValue: "",
                        maxValue: "",
                        unit: "",
                        requiresPhoto: false,
                      },
                    ],
                  })
                }
                className="text-xs font-semibold text-indigo-500"
              >
                + Add Task
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm"
            >
              {editingTemplateId ? "Save Template Changes" : "Create Template"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
