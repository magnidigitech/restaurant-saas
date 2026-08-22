"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface Outlet {
  id: string;
  name: string;
}

interface ShiftStaffMember {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  workerType?: string;
  employmentRecords?: Array<{
    department?: { name: string } | null;
    designation?: { name: string } | null;
  }>;
}

interface ShiftAssignment {
  id: string;
  employeeId: string;
  outletId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  employee: ShiftStaffMember;
  template?: { name: string };
}

interface ChecklistItemExecution {
  id: string;
  title: string;
  description?: string | null;
  roleRequired?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  isCompleted: boolean;
  completedAt?: string | null;
  completedByEmployeeId?: string | null;
  completedByEmployee?: { id: string; firstName: string; lastName: string } | null;
  inputValue?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  sortOrder: number;
}

interface ChecklistExecution {
  id: string;
  title: string;
  type: "OPENING" | "CLOSING" | "MID_DAY" | "FOOD_SAFETY" | "WEEKLY_MAINTENANCE" | "CUSTOM";
  executionDate: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED";
  assignedEmployeeId?: string | null;
  assignedEmployee?: ShiftStaffMember | null;
  verifiedByEmployeeId?: string | null;
  verifiedBy?: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
  verifiedAt?: string | null;
  notes?: string | null;
  items: ChecklistItemExecution[];
  totalItems: number;
  completedItems: number;
  progressPercent: number;
}

interface ChecklistTemplate {
  id: string;
  name: string;
  type: "OPENING" | "CLOSING" | "MID_DAY" | "FOOD_SAFETY" | "WEEKLY_MAINTENANCE" | "CUSTOM";
  description?: string | null;
  estimatedMinutes: number;
  items: Array<{
    id: string;
    title: string;
    description?: string | null;
    roleRequired?: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    requiresValueInput: boolean;
    valueInputLabel?: string | null;
  }>;
}

const TYPE_CONFIG = {
  OPENING: { label: "Morning Opening", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  CLOSING: { label: "Night Closing", color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
  FOOD_SAFETY: { label: "Food Safety & HACCP", color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
  MID_DAY: { label: "Mid-Day Duty", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  WEEKLY_MAINTENANCE: { label: "Weekly Deep Clean", color: "text-teal-500 bg-teal-500/10 border-teal-500/20" },
  CUSTOM: { label: "Custom Checklist", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
};

const COMMON_ROLES = [
  "Shift Supervisor",
  "Manager / MOD",
  "Kitchen / Line Cook",
  "Prep Cook",
  "Barista / Bartender",
  "Cashier / Front",
  "Server / Waiter",
  "Busser / Runner",
  "Dishwasher / Sanitation",
  "Facilities / Maintenance",
  "General / Any Staff",
];

const PRESET_TASK_SUGGESTIONS = [
  { label: "Cooler Temp (≤ 4°C)", title: "Record Walk-in Cooler Temp (Must be ≤ 4°C)", roleRequired: "Kitchen / Line Cook", priority: "CRITICAL" as const, requiresValueInput: true, valueInputLabel: "Cooler Temp (°C)" },
  { label: "Freezer Temp (≤ -18°C)", title: "Record Deep Freezer Temp (Must be ≤ -18°C)", roleRequired: "Kitchen / Line Cook", priority: "CRITICAL" as const, requiresValueInput: true, valueInputLabel: "Freezer Temp (°C)" },
  { label: "POS Cash Float ($200.00)", title: "Verify POS Cash Drawer Opening Float ($200.00)", roleRequired: "Cashier / Front", priority: "HIGH" as const, requiresValueInput: true, valueInputLabel: "Float Amount ($)" },
  { label: "Sanitizer PPM (200-400)", title: "Prepare 3-Bay Sink Sanitizer Buckets (200-400 PPM)", roleRequired: "Dishwasher / Sanitation", priority: "HIGH" as const, requiresValueInput: true, valueInputLabel: "Sanitizer PPM" },
  { label: "Espresso Calibration", title: "Calibrate Espresso Grinder & Pull Test Double Shot", roleRequired: "Barista / Bartender", priority: "MEDIUM" as const, requiresValueInput: false, valueInputLabel: "" },
  { label: "Griddle Scrub & Degrease", title: "Scrape, Scrub & Degrease Flat-Top Griddle", roleRequired: "Kitchen / Line Cook", priority: "HIGH" as const, requiresValueInput: false, valueInputLabel: "" },
  { label: "Fryer Oil Filter & Drain", title: "Filter Deep Fryer Vats & Wipe Splash Guards", roleRequired: "Kitchen / Line Cook", priority: "CRITICAL" as const, requiresValueInput: false, valueInputLabel: "" },
  { label: "Label Prep Inserts", title: "Wrap, Date & Masking-Tape Label All Prep Containers", roleRequired: "Prep Cook", priority: "HIGH" as const, requiresValueInput: false, valueInputLabel: "" },
  { label: "Restroom Check & Restock", title: "Restock Guest Restrooms (Soap, Paper Towels, Liners)", roleRequired: "Server / Waiter", priority: "HIGH" as const, requiresValueInput: false, valueInputLabel: "" },
  { label: "Lock Doors & Arm Alarm", title: "Lock Main & Back Exit Doors, Arm Security Alarm", roleRequired: "Shift Supervisor", priority: "CRITICAL" as const, requiresValueInput: false, valueInputLabel: "" },
];

export default function AppleOperationsChecklistsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);
  const router = useRouter();
  const { isDark } = useTheme();

  // Navigation Tab
  const [activeTab, setActiveTab] = useState<"LIVE_BOARD" | "TEMPLATES" | "AUDIT_HISTORY">("LIVE_BOARD");

  // Filter States
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>("");

  // Data States
  const [executions, setExecutions] = useState<ChecklistExecution[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modal States
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState<ChecklistExecution | null>(null);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Start Execution Form
  const [startForm, setStartForm] = useState({
    templateId: "",
    outletId: "",
    assignedEmployeeId: "",
    notes: "",
  });

  // Create / Edit Template Form
  const [templateForm, setTemplateForm] = useState<{
    name: string;
    type: ChecklistTemplate["type"];
    estimatedMinutes: number;
    description: string;
    items: Array<{
      title: string;
      roleRequired: string;
      priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      requiresValueInput: boolean;
      valueInputLabel: string;
    }>;
  }>({
    name: "",
    type: "OPENING",
    estimatedMinutes: 25,
    description: "",
    items: [
      { title: "Disarm alarm & unlock staff entrance", roleRequired: "Shift Supervisor", priority: "HIGH", requiresValueInput: false, valueInputLabel: "" },
      { title: "Power on kitchen exhaust & check cooler temps", roleRequired: "Kitchen / Line Cook", priority: "CRITICAL", requiresValueInput: true, valueInputLabel: "Cooler Temp (°C)" },
    ],
  });

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Blank Create Modal
  const handleOpenCreateModal = () => {
    setEditingTemplateId(null);
    setTemplateForm({
      name: "",
      type: "OPENING",
      estimatedMinutes: 25,
      description: "",
      items: [
        { title: "Disarm alarm & unlock staff entrance", roleRequired: "Shift Supervisor", priority: "HIGH", requiresValueInput: false, valueInputLabel: "" },
        { title: "Power on kitchen exhaust & check cooler temps", roleRequired: "Kitchen / Line Cook", priority: "CRITICAL", requiresValueInput: true, valueInputLabel: "Cooler Temp (°C)" },
      ],
    });
    setShowCreateTemplateModal(true);
  };

  // Open Edit Modal with Pre-filled Template Data
  const handleEditTemplate = (tpl: ChecklistTemplate) => {
    setEditingTemplateId(tpl.id);
    setTemplateForm({
      name: tpl.name,
      type: tpl.type,
      estimatedMinutes: tpl.estimatedMinutes,
      description: tpl.description || "",
      items: tpl.items.map((it) => ({
        title: it.title,
        roleRequired: it.roleRequired || "Shift Supervisor",
        priority: it.priority,
        requiresValueInput: it.requiresValueInput,
        valueInputLabel: it.valueInputLabel || "",
      })),
    });
    setShowCreateTemplateModal(true);
  };

  // 1-Click Duplicate Template
  const handleDuplicateTemplate = async (templateId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/restaurant/operations/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DUPLICATE", templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to duplicate template");
      showToast("SOP checklist template duplicated successfully!");
      fetchChecklists();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    if (!confirm(`Are you sure you want to delete the SOP template "${templateName}"?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/restaurant/operations/templates?id=${templateId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete template");
      showToast("SOP checklist template deleted successfully!");
      fetchChecklists();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const fetchOutlets = async () => {
    try {
      const res = await fetch("/api/restaurant/outlets");
      const data = await res.json();
      if (res.ok && data.outlets) {
        setOutlets(data.outlets);
        if (data.outlets.length > 0 && !selectedOutlet) {
          setSelectedOutlet(data.outlets[0].id);
        }
      }
    } catch { }
  };

  const fetchChecklists = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ date: selectedDate });
      if (selectedOutlet) q.append("outletId", selectedOutlet);

      const [resExecs, resTpls] = await Promise.all([
        fetch(`/api/restaurant/operations/checklists?${q.toString()}`),
        fetch("/api/restaurant/operations/templates"),
      ]);

      const dataExecs = await resExecs.json();
      const dataTpls = await resTpls.json();

      if (resExecs.ok) {
        setExecutions(dataExecs.executions || []);
        setShiftAssignments(dataExecs.shiftAssignments || []);
      }
      if (resTpls.ok) {
        setTemplates(dataTpls.templates || []);
      }
    } catch {
      showToast("Network error loading operations data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, [subdomain]);

  useEffect(() => {
    fetchChecklists();
  }, [selectedDate, selectedOutlet]);

  // Overall Daily Metrics
  const dailyStats = useMemo(() => {
    const totalTasks = executions.reduce((acc, e) => acc + e.totalItems, 0);
    const completedTasks = executions.reduce((acc, e) => acc + e.completedItems, 0);
    const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const openingExec = executions.find((e) => e.type === "OPENING");
    const closingExec = executions.find((e) => e.type === "CLOSING");
    const activeStaffCount = new Set(shiftAssignments.map((a) => a.employeeId)).size;
    const criticalPendingCount = executions.reduce(
      (acc, e) => acc + e.items.filter((i) => !i.isCompleted && i.priority === "CRITICAL").length,
      0
    );

    return {
      totalTasks,
      completedTasks,
      overallProgress,
      openingStatus: openingExec?.status || "NOT_STARTED",
      closingStatus: closingExec?.status || "NOT_STARTED",
      activeStaffCount,
      criticalPendingCount,
    };
  }, [executions, shiftAssignments]);

  // Handle Item Check-Off
  const handleToggleItem = async (executionId: string, itemId: string, currentCompleted: boolean, inputValue?: string) => {
    try {
      const res = await fetch("/api/restaurant/operations/checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_ITEM",
          itemId,
          isCompleted: !currentCompleted,
          inputValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update item");

      // Optimistic update
      setExecutions((prev) =>
        prev.map((exec) => {
          if (exec.id !== executionId) return exec;
          const updatedItems = exec.items.map((it) =>
            it.id === itemId ? { ...it, isCompleted: !currentCompleted, inputValue: inputValue !== undefined ? inputValue : it.inputValue } : it
          );
          const completedCount = updatedItems.filter((i) => i.isCompleted).length;
          const progressPercent = Math.round((completedCount / updatedItems.length) * 100);
          return {
            ...exec,
            items: updatedItems,
            completedItems: completedCount,
            progressPercent,
            status: completedCount === updatedItems.length ? (exec.status === "VERIFIED" ? "VERIFIED" : "COMPLETED") : completedCount > 0 ? "IN_PROGRESS" : "PENDING",
          };
        })
      );
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Handle Staff Assignment
  const handleAssignStaff = async (executionId: string, employeeId: string | null) => {
    try {
      const res = await fetch("/api/restaurant/operations/checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ASSIGN_STAFF",
          executionId,
          assignedEmployeeId: employeeId || null,
        }),
      });
      if (res.ok) {
        showToast("Assigned shift staff member!");
        fetchChecklists();
      }
    } catch {
      showToast("Error updating assignment", "error");
    }
  };

  // Handle Supervisor Verification
  const handleVerifyExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showVerifyModal) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/restaurant/operations/checklists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VERIFY_CHECKLIST",
          executionId: showVerifyModal.id,
          verificationNotes: verifyNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify checklist");
      showToast("Checklist verified and signed off by supervisor!");
      setShowVerifyModal(null);
      setVerifyNotes("");
      fetchChecklists();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Start Execution
  const handleStartExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startForm.templateId) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/restaurant/operations/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: startForm.templateId,
          outletId: startForm.outletId || selectedOutlet,
          executionDate: selectedDate,
          assignedEmployeeId: startForm.assignedEmployeeId || undefined,
          notes: startForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start checklist");
      showToast("Shift checklist initialized for today!");
      setShowStartModal(false);
      fetchChecklists();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Save Template (Create or Update)
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const url = "/api/restaurant/operations/templates";
      const method = editingTemplateId ? "PATCH" : "POST";
      const payload = editingTemplateId
        ? { action: "UPDATE", templateId: editingTemplateId, ...templateForm }
        : templateForm;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");
      showToast(editingTemplateId ? "SOP checklist template updated!" : "New SOP checklist template saved!");
      setShowCreateTemplateModal(false);
      setEditingTemplateId(null);
      fetchChecklists();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ModuleAccessGuard moduleKey="shifts" moduleName="Operations & Shift Checklists" activeSection="Operations">
      <div className={`min-h-screen transition-colors duration-200 ${isDark ? "bg-[#07090E] text-white" : "bg-[#F5F5F7] text-slate-900"}`}>
        <RestaurantNavbar activeSection="Operations" />

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className={`px-4 py-3 rounded-2xl border shadow-xl flex items-center gap-3 text-xs font-semibold ${
              toastMessage.type === "error"
                ? isDark ? "bg-[#121622] border-rose-500/30 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-800"
                : isDark ? "bg-[#121622] border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}>
              <span className="font-bold">{toastMessage.type === "error" ? "✕" : "✓"}</span>
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                  isDark ? "bg-[#0071E3]/15 text-[#64B5FF] border-[#0071E3]/30" : "bg-blue-50 text-[#0071E3] border-blue-200"
                }`}>
                  Shift Operations & Checklists
                </span>
                <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>•</span>
                <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Opening, Closing & HACCP Shift Duties
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Shift Tasks & Operational Checklists
              </h1>
              <p className={`text-xs mt-1 max-w-2xl ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Real-time opening readiness, kitchen closing shutdowns, equipment temperature audits, and duty assignment linked to shift staff.
              </p>
            </div>

            {/* Quick Actions & Date Controls */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`px-3 py-1.5 text-xs rounded-xl border font-medium ${
                  isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-800"
                }`}
              />

              {outlets.length > 0 && (
                <select
                  value={selectedOutlet}
                  onChange={(e) => setSelectedOutlet(e.target.value)}
                  className={`px-3 py-1.5 text-xs rounded-xl border font-medium cursor-pointer ${
                    isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-800"
                  }`}
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => {
                  setStartForm({
                    templateId: templates[0]?.id || "",
                    outletId: selectedOutlet,
                    assignedEmployeeId: "",
                    notes: "",
                  });
                  setShowStartModal(true);
                }}
                className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>+</span>
                <span>Start Checklist Run</span>
              </button>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div
            className={`p-1.5 rounded-2xl border transition flex items-center gap-1 overflow-x-auto no-scrollbar ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            {[
              { key: "LIVE_BOARD", label: "Live Shift Board", count: executions.length },
              { key: "TEMPLATES", label: "Checklist Templates & SOPs", count: templates.length },
              { key: "AUDIT_HISTORY", label: "Verification & Audit Ledger" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex-shrink-0 flex items-center gap-2 ${
                  activeTab === tab.key
                    ? "bg-[#0071E3] text-white shadow-xs"
                    : isDark
                    ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === tab.key ? "bg-white/20 text-white" : isDark ? "bg-white/[0.08] text-[#8F95A3]" : "bg-slate-200 text-slate-700"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={`p-5 rounded-2xl border transition ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Today's Task Completion
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <p className="text-2xl font-bold tracking-tight text-emerald-500 font-mono">
                  {dailyStats.overallProgress}%
                </p>
                <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  ({dailyStats.completedTasks}/{dailyStats.totalTasks} tasks)
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.06] mt-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${dailyStats.overallProgress}%` }}
                />
              </div>
            </div>

            <div
              className={`p-5 rounded-2xl border transition ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Morning Opening Readiness
              </span>
              <p className="text-2xl font-bold tracking-tight mt-1.5 flex items-center gap-2">
                <span className={dailyStats.openingStatus === "VERIFIED" ? "text-emerald-400" : dailyStats.openingStatus === "COMPLETED" ? "text-blue-400" : "text-amber-400"}>
                  {dailyStats.openingStatus === "VERIFIED"
                    ? "Verified ✓"
                    : dailyStats.openingStatus === "COMPLETED"
                    ? "Completed"
                    : dailyStats.openingStatus === "IN_PROGRESS"
                    ? "In Progress"
                    : "Scheduled"}
                </span>
              </p>
              <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Pre-service equipment &amp; cash float
              </p>
            </div>

            <div
              className={`p-5 rounded-2xl border transition ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Shift Staff on Duty
              </span>
              <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                {dailyStats.activeStaffCount} Member{dailyStats.activeStaffCount !== 1 ? "s" : ""}
              </p>
              <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Rostered for {new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>

            <div
              className={`p-5 rounded-2xl border transition ${
                dailyStats.criticalPendingCount > 0
                  ? isDark
                    ? "bg-rose-500/[0.08] border-rose-500/30"
                    : "bg-rose-50 border-rose-200"
                  : isDark
                  ? "bg-[#121622]/60 border-white/[0.06]"
                  : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <span className={`text-[11px] font-medium uppercase tracking-wider ${
                dailyStats.criticalPendingCount > 0 ? "text-rose-500" : isDark ? "text-[#8F95A3]" : "text-slate-500"
              }`}>
                Critical &amp; Food Safety Tasks
              </span>
              <p className={`text-2xl font-bold tracking-tight mt-1.5 ${
                dailyStats.criticalPendingCount > 0 ? "text-rose-500" : isDark ? "text-white" : "text-slate-900"
              }`}>
                {dailyStats.criticalPendingCount === 0 ? "All Clear ✓" : `${dailyStats.criticalPendingCount} Pending`}
              </p>
              <p className={`text-[11px] mt-1 ${dailyStats.criticalPendingCount > 0 ? "text-rose-500/80" : isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Temperature &amp; lockup compliance
              </p>
            </div>
          </div>

          {/* TAB 1: LIVE SHIFT CHECKLISTS BOARD */}
          {activeTab === "LIVE_BOARD" && (
            <div className="space-y-6">
              {loading ? (
                <div className="p-12 text-center text-xs opacity-60">Loading shift checklists...</div>
              ) : executions.length === 0 ? (
                <div className={`p-12 text-center rounded-3xl border ${
                  isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"
                }`}>
                  <div className="w-10 h-10 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mx-auto mb-3 text-xs font-bold font-mono">
                    SOP
                  </div>
                  <h4 className="text-base font-bold">No Active Checklists for this Date</h4>
                  <p className={`text-xs max-w-md mx-auto mt-1 mb-4 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Start today&apos;s Morning Opening, Night Closing, or HACCP Food Safety inspection from pre-configured SOP templates.
                  </p>
                  <button
                    onClick={() => {
                      setStartForm({
                        templateId: templates[0]?.id || "",
                        outletId: selectedOutlet,
                        assignedEmployeeId: "",
                        notes: "",
                      });
                      setShowStartModal(true);
                    }}
                    className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                  >
                    + Start Morning Opening List
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {executions.map((exec) => {
                    const cfg = TYPE_CONFIG[exec.type] || TYPE_CONFIG.CUSTOM;
                    const isFullyDone = exec.completedItems === exec.totalItems && exec.totalItems > 0;

                    return (
                      <div
                        key={exec.id}
                        className={`rounded-3xl border overflow-hidden transition flex flex-col justify-between ${
                          isDark ? "bg-[#121622]/80 border-white/[0.08]" : "bg-white border-slate-200/90 shadow-sm"
                        }`}
                      >
                        {/* Card Header */}
                        <div className="p-5 border-b border-black/[0.04] dark:border-white/[0.04] space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.color}`}>
                                  {cfg.label}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    exec.status === "VERIFIED"
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                      : isFullyDone
                                      ? "bg-blue-500/15 text-blue-400 border-blue-500/25"
                                      : exec.completedItems > 0
                                      ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                  }`}
                                >
                                  {exec.status === "VERIFIED" ? "VERIFIED ✓" : isFullyDone ? "COMPLETED" : `${exec.completedItems}/${exec.totalItems} DONE`}
                                </span>
                              </div>
                              <h3 className={`text-base font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                                {exec.title}
                              </h3>
                            </div>

                            {/* Progress Ring / Percentage */}
                            <div className="text-right">
                              <span className="text-lg font-mono font-bold text-emerald-500">
                                {exec.progressPercent}%
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${exec.progressPercent}%` }}
                            />
                          </div>

                          {/* Assigned Shift Member Integration */}
                          <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                            isDark ? "bg-[#0A0C12] border-white/[0.06]" : "bg-slate-50 border-slate-200"
                          }`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[11px] font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                Assigned On-Duty Staff:
                              </span>
                            </div>

                            <select
                              value={exec.assignedEmployeeId || ""}
                              onChange={(e) => handleAssignStaff(exec.id, e.target.value || null)}
                              className={`text-xs font-semibold rounded-lg px-2.5 py-1 border transition cursor-pointer max-w-[200px] truncate ${
                                isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-800"
                              }`}
                            >
                              <option value="">-- Unassigned (Whole Shift) --</option>
                              {shiftAssignments.map((a) => {
                                const desig = a.employee.employmentRecords?.[0]?.designation?.name;
                                const dept = a.employee.employmentRecords?.[0]?.department?.name;
                                return (
                                  <option key={a.employee.id} value={a.employee.id}>
                                    {a.employee.firstName} {a.employee.lastName} ({desig || "Staff"}{dept ? ` • ${dept}` : ""})
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>

                        {/* Checklist Task Items */}
                        <div className="p-4 space-y-2 max-h-[380px] overflow-y-auto no-scrollbar">
                          {exec.items.map((item) => (
                            <div
                              key={item.id}
                              className={`p-3 rounded-2xl border transition flex items-start justify-between gap-3 ${
                                item.isCompleted
                                  ? isDark
                                    ? "bg-emerald-950/[0.15] border-emerald-500/20"
                                    : "bg-emerald-50/60 border-emerald-200"
                                  : isDark
                                  ? "bg-[#0A0C12]/60 border-white/[0.04] hover:bg-white/[0.02]"
                                  : "bg-white border-slate-100 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={item.isCompleted}
                                  onChange={() => handleToggleItem(exec.id, item.id, item.isCompleted, item.inputValue || undefined)}
                                  className="mt-1 w-4 h-4 rounded text-[#0071E3] focus:ring-0 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <p className={`text-xs font-semibold leading-snug ${
                                    item.isCompleted
                                      ? "line-through opacity-70"
                                      : isDark
                                      ? "text-white"
                                      : "text-slate-900"
                                  }`}>
                                    {item.title}
                                  </p>

                                  {/* Badges & Meta */}
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {item.priority === "CRITICAL" && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25">
                                        CRITICAL
                                      </span>
                                    )}
                                    {item.roleRequired && (
                                      <span className={`text-[9px] font-medium px-1.5 py-0.2 rounded border ${
                                        isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
                                      }`}>
                                        {item.roleRequired}
                                      </span>
                                    )}
                                    {item.completedAt && (
                                      <span className={`text-[9px] ${isDark ? "text-emerald-400/80" : "text-emerald-600"}`}>
                                        ✓ Checked at {new Date(item.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Value Input (e.g. Fridge Temp or Cash Float) */}
                              {item.inputValue !== undefined && (
                                <div className="flex-shrink-0">
                                  <input
                                    type="text"
                                    placeholder="Log Value"
                                    value={item.inputValue || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleToggleItem(exec.id, item.id, item.isCompleted, val);
                                    }}
                                    className={`px-2 py-1 text-[11px] font-mono rounded-lg border w-24 text-right ${
                                      isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-800"
                                    }`}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Card Footer with Supervisor Sign-Off */}
                        <div className="p-4 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between gap-3 bg-black/[0.01] dark:bg-white/[0.01]">
                          <div className="text-[11px]">
                            {exec.verifiedAt ? (
                              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                                <span>✓ Supervisor Sign-Off: {exec.verifiedBy?.firstName} {exec.verifiedBy?.lastName}</span>
                              </div>
                            ) : (
                              <span className={isDark ? "text-[#8F95A3]" : "text-slate-400"}>
                                Pending supervisor verification
                              </span>
                            )}
                          </div>

                          {exec.status !== "VERIFIED" && isFullyDone && (
                            <button
                              onClick={() => {
                                setShowVerifyModal(exec);
                                setVerifyNotes("");
                              }}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
                            >
                              Verify &amp; Sign Off
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CHECKLIST TEMPLATES & SOP MASTER */}
          {activeTab === "TEMPLATES" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    SOP Checklist Templates
                  </h3>
                  <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Pre-configured and custom restaurant SOP checklists ready for daily shift dispatch.
                  </p>
                </div>

                <button
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Create Custom SOP Template</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {templates.map((tpl) => {
                  const cfg = TYPE_CONFIG[tpl.type] || TYPE_CONFIG.CUSTOM;

                  return (
                    <div
                      key={tpl.id}
                      className={`p-6 rounded-3xl border transition flex flex-col justify-between space-y-4 ${
                        isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            <span className={`text-xs font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                              ~{tpl.estimatedMinutes}m
                            </span>
                          </div>

                          {/* Edit / Duplicate / Delete Actions */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTemplate(tpl);
                              }}
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border transition cursor-pointer ${
                                isDark
                                  ? "bg-white/[0.04] border-white/[0.08] text-[#8F95A3] hover:bg-white/[0.1] hover:text-white"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              }`}
                              title="Edit SOP Template"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateTemplate(tpl.id);
                              }}
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border transition cursor-pointer ${
                                isDark
                                  ? "bg-white/[0.04] border-white/[0.08] text-[#8F95A3] hover:bg-white/[0.1] hover:text-white"
                                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              }`}
                              title="Duplicate SOP Template"
                            >
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(tpl.id, tpl.name);
                              }}
                              className="px-2 py-0.5 text-[10px] font-semibold rounded-md border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                              title="Delete SOP Template"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <h4 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                          {tpl.name}
                        </h4>
                        {tpl.description && (
                          <p className={`text-xs line-clamp-2 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            {tpl.description}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                        <p className={`text-[10px] uppercase font-semibold tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                          Includes {tpl.items.length} Standard Duties:
                        </p>
                        <div className="space-y-1 text-xs">
                          {tpl.items.slice(0, 3).map((it) => (
                            <div key={it.id} className="flex items-center gap-2 truncate opacity-80">
                              <span>•</span>
                              <span className="truncate">{it.title}</span>
                            </div>
                          ))}
                          {tpl.items.length > 3 && (
                            <p className="text-[11px] text-[#0071E3] font-medium pl-3">
                              +{tpl.items.length - 3} more duties
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setStartForm({
                            templateId: tpl.id,
                            outletId: selectedOutlet,
                            assignedEmployeeId: "",
                            notes: "",
                          });
                          setShowStartModal(true);
                        }}
                        className="w-full py-2 bg-[#0071E3]/15 hover:bg-[#0071E3]/25 text-[#0071E3] dark:text-[#64B5FF] text-xs font-semibold rounded-xl transition cursor-pointer"
                      >
                        Start Checklist for Today
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: VERIFICATION & AUDIT LEDGER */}
          {activeTab === "AUDIT_HISTORY" && (
            <div
              className={`rounded-3xl border overflow-hidden transition ${
                isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"
              }`}
            >
              <div className="p-6 border-b border-black/[0.04] dark:border-white/[0.04]">
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                  Shift Compliance &amp; Verification Audit Log
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Audited shift records, timestamps, and supervisor sign-offs for health and operational compliance.
                </p>
              </div>

              {executions.length === 0 ? (
                <div className="p-12 text-center text-xs opacity-60">No shift executions recorded for this date.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b text-[10px] font-semibold uppercase tracking-wider ${
                        isDark ? "bg-white/[0.02] border-white/[0.06] text-[#8F95A3]" : "bg-slate-50 border-slate-200 text-slate-500"
                      }`}>
                        <th className="py-3.5 px-6">Checklist &amp; Type</th>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Assigned Shift Member</th>
                        <th className="py-3.5 px-4 text-center">Progress</th>
                        <th className="py-3.5 px-4">Supervisor Sign-Off</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {executions.map((e) => (
                        <tr key={e.id} className={isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"}>
                          <td className="py-4 px-6 font-semibold">
                            {e.title}
                          </td>
                          <td className="py-4 px-4 font-mono">
                            {new Date(e.executionDate).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-4">
                            {e.assignedEmployee ? (
                              <span>{e.assignedEmployee.firstName} {e.assignedEmployee.lastName} ({e.assignedEmployee.employeeCode})</span>
                            ) : (
                              <span className="text-slate-400 italic">Whole Shift</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center font-mono font-semibold">
                            {e.completedItems}/{e.totalItems} ({e.progressPercent}%)
                          </td>
                          <td className="py-4 px-4">
                            {e.verifiedBy ? (
                              <span className="text-emerald-400 font-medium">
                                ✓ {e.verifiedBy.firstName} {e.verifiedBy.lastName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Pending</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              e.status === "VERIFIED"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                : "bg-blue-500/15 text-blue-400 border-blue-500/25"
                            }`}>
                              {e.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>

        {/* START CHECKLIST RUN MODAL */}
        {showStartModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}>
              <div className="flex justify-between items-start border-b pb-3">
                <h2 className="text-base font-bold">Start Shift Checklist Run</h2>
                <button onClick={() => setShowStartModal(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleStartExecution} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Select SOP Template *</label>
                  <select
                    required
                    value={startForm.templateId}
                    onChange={(e) => setStartForm({ ...startForm, templateId: e.target.value })}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (~{t.estimatedMinutes} mins)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Assign Shift Staff Member (Optional)</label>
                  <select
                    value={startForm.assignedEmployeeId}
                    onChange={(e) => setStartForm({ ...startForm, assignedEmployeeId: e.target.value })}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="">-- Assign to Whole Shift Team --</option>
                    {shiftAssignments.map((a) => (
                      <option key={a.employee.id} value={a.employee.id}>
                        {a.employee.firstName} {a.employee.lastName} ({a.employee.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Shift Notes / Focus Area</label>
                  <input
                    type="text"
                    placeholder="e.g. VIP party booking at 7 PM"
                    value={startForm.notes}
                    onChange={(e) => setStartForm({ ...startForm, notes: e.target.value })}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowStartModal(false)}
                    className="px-4 py-2 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? "Initializing..." : "Dispatch to Shift"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SUPERVISOR VERIFICATION MODAL */}
        {showVerifyModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}>
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h2 className="text-base font-bold">Supervisor Sign-Off</h2>
                  <p className="text-xs text-slate-400">{showVerifyModal.title}</p>
                </div>
                <button onClick={() => setShowVerifyModal(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleVerifyExecution} className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                  All {showVerifyModal.totalItems} duties have been completed by the shift staff. Confirming will stamp your verification signature.
                </div>

                <div>
                  <label className="block font-semibold mb-1">Supervisor Audit Notes (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Verified walk-in at 3.5°C and cash drawer balanced."
                    value={verifyNotes}
                    onChange={(e) => setVerifyNotes(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border resize-none ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setShowVerifyModal(null)} className="px-4 py-2 cursor-pointer">Cancel</button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? "Signing..." : "Sign Off & Verify ✓"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PROFESSIONAL CUSTOM SOP TASK BUILDER MODAL */}
        {showCreateTemplateModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-6 animate-in fade-in duration-150">
            <div className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
              isDark ? "bg-[#10131B] border-white/[0.1] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}>
              {/* Modal Header */}
              <div className={`p-5 sm:px-8 sm:py-6 border-b flex items-center justify-between gap-4 ${
                isDark ? "bg-[#0A0D14] border-white/[0.06]" : "bg-slate-50/80 border-slate-100"
              }`}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0071E3]/15 text-[#0071E3] border border-[#0071E3]/25 uppercase tracking-wider">
                      {editingTemplateId ? "Edit Mode" : "SOP Task Engine"}
                    </span>
                    <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>•</span>
                    <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      {templateForm.items.length} Task Step{templateForm.items.length !== 1 ? "s" : ""} Configured
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                    {editingTemplateId ? "Edit SOP Checklist Template" : "Custom SOP Checklist Builder"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowCreateTemplateModal(false);
                    setEditingTemplateId(null);
                  }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition cursor-pointer ${
                    isDark ? "bg-white/[0.06] text-white hover:bg-white/[0.12]" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleSaveTemplate} className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
                {/* 1. Template Meta & Scope */}
                <div className={`p-5 rounded-2xl border space-y-4 ${
                  isDark ? "bg-[#0A0D14]/60 border-white/[0.06]" : "bg-slate-50/60 border-slate-200/80"
                }`}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold mb-1.5">
                        Checklist Template Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Morning Opening & Equipment Calibration"
                        value={templateForm.name}
                        onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                        className={`w-full px-4 py-2.5 text-xs font-semibold rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                          isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1.5">
                        Category &amp; Frequency *
                      </label>
                      <select
                        value={templateForm.type}
                        onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value as any })}
                        className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                          isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                        }`}
                      >
                        <option value="OPENING">Morning Opening</option>
                        <option value="CLOSING">Night Closing</option>
                        <option value="FOOD_SAFETY">Food Safety &amp; HACCP</option>
                        <option value="MID_DAY">Mid-Day Duty</option>
                        <option value="WEEKLY_MAINTENANCE">Weekly Deep Clean</option>
                        <option value="CUSTOM">Custom Shift Checklist</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    <div className="md:col-span-2">
                      <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        Operational Guidelines &amp; Scope
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Must be executed 30 minutes before unlocking front customer entrance."
                        value={templateForm.description}
                        onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                        className={`w-full px-4 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                          isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        Estimated Duration
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[15, 25, 35, 45, 60].map((mins) => (
                          <button
                            type="button"
                            key={mins}
                            onClick={() => setTemplateForm({ ...templateForm, estimatedMinutes: mins })}
                            className={`px-2.5 py-1.5 text-xs font-mono font-semibold rounded-lg border transition cursor-pointer ${
                              templateForm.estimatedMinutes === mins
                                ? "bg-[#0071E3] text-white border-[#0071E3]"
                                : isDark
                                ? "bg-[#121622] border-white/[0.08] text-[#8F95A3] hover:text-white"
                                : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Quick-Add Presets Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Suggested Standard Duties
                    </span>
                    <span className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      Click to append to sequence
                    </span>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {PRESET_TASK_SUGGESTIONS.map((preset, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => {
                          setTemplateForm({
                            ...templateForm,
                            items: [
                              ...templateForm.items,
                              {
                                title: preset.title,
                                roleRequired: preset.roleRequired,
                                priority: preset.priority,
                                requiresValueInput: preset.requiresValueInput,
                                valueInputLabel: preset.valueInputLabel,
                              },
                            ],
                          });
                          showToast(`Added "${preset.label}" to checklist`);
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 transition cursor-pointer ${
                          isDark
                            ? "bg-[#121622] border-white/[0.08] text-[#E4E7EB] hover:bg-[#0071E3]/20 hover:border-[#0071E3]/40 hover:text-white"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-[#0071E3]"
                        }`}
                      >
                        <span>{preset.label}</span>
                        <span className="text-emerald-500 font-bold ml-0.5">+</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Task Sequence Builder */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                    <div>
                      <h4 className="text-sm font-bold tracking-tight">
                        Checklist Steps &amp; Duties Sequence
                      </h4>
                      <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Ordered steps for shift members to execute and log.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setTemplateForm({
                          ...templateForm,
                          items: [
                            ...templateForm.items,
                            {
                              title: "",
                              roleRequired: "Shift Supervisor",
                              priority: "MEDIUM",
                              requiresValueInput: false,
                              valueInputLabel: "",
                            },
                          ],
                        })
                      }
                      className="px-3.5 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>+</span>
                      <span>Add Blank Step</span>
                    </button>
                  </div>

                  {/* Task Step Cards */}
                  <div className="space-y-3">
                    {templateForm.items.map((it, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border transition space-y-3 ${
                          isDark
                            ? "bg-[#121622]/90 border-white/[0.08] hover:border-white/[0.14]"
                            : "bg-white border-slate-200 shadow-xs hover:border-slate-300"
                        }`}
                      >
                        {/* Step Card Top Bar */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-[#0071E3]/15 text-[#0071E3] font-mono font-bold text-xs flex items-center justify-center">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            <span className={`text-[11px] font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                              Step #{idx + 1}
                            </span>
                          </div>

                          {/* Re-order & Actions */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                const newItems = [...templateForm.items];
                                const temp = newItems[idx - 1];
                                newItems[idx - 1] = newItems[idx];
                                newItems[idx] = temp;
                                setTemplateForm({ ...templateForm, items: newItems });
                              }}
                              className="px-2 py-1 text-xs rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                              title="Move Up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={idx === templateForm.items.length - 1}
                              onClick={() => {
                                const newItems = [...templateForm.items];
                                const temp = newItems[idx + 1];
                                newItems[idx + 1] = newItems[idx];
                                newItems[idx] = temp;
                                setTemplateForm({ ...templateForm, items: newItems });
                              }}
                              className="px-2 py-1 text-xs rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                              title="Move Down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = [...templateForm.items];
                                newItems.splice(idx + 1, 0, { ...it, title: `${it.title} (Copy)` });
                                setTemplateForm({ ...templateForm, items: newItems });
                              }}
                              className="px-2 py-1 text-[11px] font-medium rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white cursor-pointer"
                              title="Duplicate Step"
                            >
                              Duplicate
                            </button>
                            {templateForm.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newItems = templateForm.items.filter((_, i) => i !== idx);
                                  setTemplateForm({ ...templateForm, items: newItems });
                                }}
                                className="px-2 py-1 text-[11px] font-medium rounded-lg hover:bg-rose-500/15 text-rose-400 cursor-pointer"
                                title="Delete Step"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Task Title Input */}
                        <div>
                          <input
                            type="text"
                            required
                            placeholder="Describe what needs to be checked or completed (e.g. Record walk-in cooler temp)..."
                            value={it.title}
                            onChange={(e) => {
                              const newItems = [...templateForm.items];
                              newItems[idx].title = e.target.value;
                              setTemplateForm({ ...templateForm, items: newItems });
                            }}
                            className={`w-full px-3.5 py-2 text-xs font-semibold rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                              isDark ? "bg-[#0A0D14] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                            }`}
                          />
                        </div>

                        {/* Task Settings: Role, Priority & Verification Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          {/* Role Selector */}
                          <div>
                            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                              Assigned Role / Station
                            </label>
                            <select
                              value={it.roleRequired || "Shift Supervisor"}
                              onChange={(e) => {
                                const newItems = [...templateForm.items];
                                newItems[idx].roleRequired = e.target.value;
                                setTemplateForm({ ...templateForm, items: newItems });
                              }}
                              className={`w-full px-3 py-1.5 text-xs font-semibold rounded-xl border cursor-pointer ${
                                isDark ? "bg-[#0A0D14] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                              }`}
                            >
                              {COMMON_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Priority Pill Selector */}
                          <div>
                            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                              Priority Level
                            </label>
                            <div className="flex items-center gap-1">
                              {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((p) => {
                                const active = it.priority === p;
                                return (
                                  <button
                                    type="button"
                                    key={p}
                                    onClick={() => {
                                      const newItems = [...templateForm.items];
                                      newItems[idx].priority = p;
                                      setTemplateForm({ ...templateForm, items: newItems });
                                    }}
                                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition cursor-pointer ${
                                      active
                                        ? p === "CRITICAL"
                                          ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                          : p === "HIGH"
                                          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                          : p === "MEDIUM"
                                          ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                                          : "bg-slate-500/20 text-slate-300 border-slate-500/40"
                                        : isDark
                                        ? "bg-[#0A0D14] border-white/[0.06] text-[#8F95A3] hover:text-white"
                                        : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
                                    }`}
                                  >
                                    {p.charAt(0)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Verification / Value Logging Requirement */}
                          <div>
                            <label className={`block text-[10px] font-semibold uppercase tracking-wider mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                              Verification Method
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = [...templateForm.items];
                                const req = !newItems[idx].requiresValueInput;
                                newItems[idx].requiresValueInput = req;
                                if (req && !newItems[idx].valueInputLabel) {
                                  newItems[idx].valueInputLabel = "Reading (°C / $)";
                                }
                                setTemplateForm({ ...templateForm, items: newItems });
                              }}
                              className={`w-full py-1.5 px-3 text-xs font-semibold rounded-xl border flex items-center justify-between transition cursor-pointer ${
                                it.requiresValueInput
                                  ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                                  : isDark
                                  ? "bg-[#0A0D14] border-white/[0.06] text-[#8F95A3]"
                                  : "bg-slate-50 border-slate-200 text-slate-600"
                              }`}
                            >
                              <span>{it.requiresValueInput ? "Numerical Reading" : "Checkbox Only"}</span>
                              <span className="text-[10px] font-mono">{it.requiresValueInput ? "ON" : "OFF"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Optional Custom Label when Value Input is ON */}
                        {it.requiresValueInput && (
                          <div className="pt-2 flex items-center gap-2">
                            <span className="text-xs text-cyan-400">↳ Label:</span>
                            <input
                              type="text"
                              placeholder="e.g. Fridge Temp (°C) or Cash Float ($)"
                              value={it.valueInputLabel || ""}
                              onChange={(e) => {
                                const newItems = [...templateForm.items];
                                newItems[idx].valueInputLabel = e.target.value;
                                setTemplateForm({ ...templateForm, items: newItems });
                              }}
                              className={`flex-1 px-3 py-1 text-xs rounded-lg border ${
                                isDark ? "bg-[#0A0D14] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className={`pt-4 border-t flex items-center justify-between gap-4 sticky bottom-0 ${
                  isDark ? "bg-[#10131B] border-white/[0.06]" : "bg-white border-slate-200"
                }`}>
                  <div className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    <span>Total: </span>
                    <span className="font-bold text-white dark:text-white text-slate-900">{templateForm.items.length} Tasks</span>
                    <span> • Est: </span>
                    <span className="font-bold text-emerald-500">~{templateForm.estimatedMinutes} Mins</span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateTemplateModal(false);
                        setEditingTemplateId(null);
                      }}
                      className={`px-5 py-2.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                        isDark ? "bg-white/[0.04] border-white/[0.08] text-white hover:bg-white/[0.08]" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-6 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <span>
                        {actionLoading
                          ? editingTemplateId
                            ? "Updating SOP Template..."
                            : "Saving SOP Template..."
                          : editingTemplateId
                          ? "Save Changes"
                          : "Save SOP Template"}
                      </span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
