"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  PlusCircle,
  Copy,
  Trash2,
  Eye,
  Settings as SettingsIcon,
  UploadCloud,
  FileText,
  CheckSquare,
  Circle,
  ChevronDown,
  PenTool,
  Calendar,
  Clock,
  AlignLeft,
  AlignJustify,
  CheckCircle2,
  FolderPlus,
  GripHorizontal,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  User,
  ExternalLink,
} from "lucide-react";

type TaskType = "FORM_INPUT" | "SIGNATURE" | "DOCUMENT" | "DATE" | "CHECKBOX";

interface Task {
  id: string;
  title: string;
  description?: string;
  isRequired: boolean;
  sortOrder: number;
  requiresDoc: boolean;
  taskType: TaskType;
  fieldConfig?: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  archivedAt: string | null;
  tasks: Task[];
  _count: { onboardings: number };
}

interface GoogleFieldType {
  key: string;
  taskType: TaskType;
  label: string;
  desc: string;
  icon: React.ReactNode;
  hasOptions?: boolean;
}

const GOOGLE_FIELD_TYPES: GoogleFieldType[] = [
  { key: "short_answer", taskType: "FORM_INPUT", label: "Short answer", desc: "Single line text response", icon: <AlignLeft className="w-4 h-4 text-gray-600" /> },
  { key: "paragraph", taskType: "FORM_INPUT", label: "Paragraph", desc: "Long text paragraph response", icon: <AlignJustify className="w-4 h-4 text-gray-600" /> },
  { key: "multiple_choice", taskType: "FORM_INPUT", label: "Multiple choice", desc: "Single option selection", icon: <Circle className="w-4 h-4 text-gray-600" />, hasOptions: true },
  { key: "checkboxes", taskType: "CHECKBOX", label: "Checkboxes", desc: "Multiple options selection", icon: <CheckSquare className="w-4 h-4 text-gray-600" />, hasOptions: true },
  { key: "dropdown", taskType: "FORM_INPUT", label: "Dropdown", desc: "Choose from list menu", icon: <ChevronDown className="w-4 h-4 text-gray-600" />, hasOptions: true },
  { key: "file_upload", taskType: "DOCUMENT", label: "File upload", desc: "Upload ID, PDF, License or Photo", icon: <UploadCloud className="w-4 h-4 text-gray-600" /> },
  { key: "signature", taskType: "SIGNATURE", label: "Digital Signature", desc: "Mouse or touch signature sign-off", icon: <PenTool className="w-4 h-4 text-gray-600" /> },
  { key: "date", taskType: "DATE", label: "Date", desc: "Calendar date picker", icon: <Calendar className="w-4 h-4 text-gray-600" /> },
  { key: "time", taskType: "FORM_INPUT", label: "Time", desc: "Time picker input", icon: <Clock className="w-4 h-4 text-gray-600" /> },
  { key: "agreement", taskType: "CHECKBOX", label: "Agreement Checkbox", desc: "Confirmation checkbox", icon: <CheckCircle2 className="w-4 h-4 text-gray-600" /> },
];

export default function OnboardingTemplatesPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const subdomain = (params?.subdomain as string) || "";
  const requestedTemplateId = searchParams.get("templateId");

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Template | null>(null);

  // Tabs: "questions" | "responses" | "settings"
  const [activeTab, setActiveTab] = useState<"questions" | "responses" | "settings">("questions");
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Drag & Drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Field type dropdown menu open state per task
  const [openDropdownTaskId, setOpenDropdownTaskId] = useState<string | null>(null);

  // Floating sidebar add-question menu open/hover state
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Responses tab candidate sessions
  const [templateSessions, setTemplateSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Template creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", isDefault: false });
  const [submitting, setSubmitting] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/restaurant/onboarding/templates");
      if (res.ok) {
        const list: Template[] = (await res.json()).templates || [];
        setTemplates(list);
        if (requestedTemplateId) {
          const match = list.find((t) => t.id === requestedTemplateId);
          if (match) {
            setSelected(match);
            if (match.tasks.length > 0) setActiveTaskId(match.tasks[0].id);
            return;
          }
        }
        if (selected) {
          const fresh = list.find((t) => t.id === selected.id);
          if (fresh) {
            setSelected((prev) => ({
              ...fresh,
              name: prev?.name ?? fresh.name,
              description: prev?.description ?? fresh.description,
              tasks: prev?.tasks && prev.tasks.length === fresh.tasks.length
                ? prev.tasks.map((pt) => {
                    const found = fresh.tasks.find((ft) => ft.id === pt.id);
                    return found
                      ? { ...found, title: pt.title, description: pt.description, fieldConfig: pt.fieldConfig }
                      : pt;
                  })
                : fresh.tasks,
            }));
          }
        } else if (list.length > 0) {
          setSelected(list[0]);
          if (list[0].tasks.length > 0) setActiveTaskId(list[0].tasks[0].id);
        }
      }
    } catch {
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateSessions = async (tplId: string) => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/restaurant/onboarding/sessions?templateId=${tplId}`);
      if (res.ok) {
        const data = await res.json();
        setTemplateSessions(data.sessions || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selected && activeTab === "responses") {
      fetchTemplateSessions(selected.id);
    }
  }, [selected?.id, activeTab]);

  const handleCreateTemplate = async () => {
    if (!createForm.name) {
      setError("Template name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/restaurant/onboarding/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          tasks: [
            { title: "Full Legal Name", description: "As shown on official ID", taskType: "FORM_INPUT", isRequired: true, fieldConfig: JSON.stringify({ subtype: "short_answer" }) },
            { title: "Digital Signature", description: "Sign to confirm onboarding details", taskType: "SIGNATURE", isRequired: true, fieldConfig: JSON.stringify({ subtype: "signature" }) },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreateModal(false);
      setCreateForm({ name: "", description: "", isDefault: false });
      if (data.template) {
        setSelected(data.template);
        if (data.template.tasks?.length > 0) setActiveTaskId(data.template.tasks[0].id);
      }
      fetchTemplates();
    } catch (e: any) {
      setError(e.message || "Failed to create template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddField = async (fieldDef: GoogleFieldType) => {
    if (!selected) return;
    setAddingTask(true);
    setShowAddMenu(false);
    setError("");
    const initialConfig = fieldDef.hasOptions
      ? JSON.stringify({ subtype: fieldDef.key, options: ["Option 1", "Option 2"] })
      : JSON.stringify({ subtype: fieldDef.key });

    try {
      const res = await fetch(`/api/restaurant/onboarding/templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_task",
          title: `Untitled ${fieldDef.label}`,
          description: "",
          taskType: fieldDef.taskType,
          isRequired: false,
          requiresDoc: fieldDef.taskType === "DOCUMENT",
          fieldConfig: initialConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.template) {
        setSelected(data.template);
        const lastTask = data.template.tasks[data.template.tasks.length - 1];
        if (lastTask) setActiveTaskId(lastTask.id);
      }
      fetchTemplates();
    } catch (e: any) {
      setError(e.message || "Failed to add question field");
    } finally {
      setAddingTask(false);
    }
  };

  const handleDuplicateTask = async (taskToDup: Task) => {
    if (!selected) return;
    setAddingTask(true);
    setError("");
    try {
      const res = await fetch(`/api/restaurant/onboarding/templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_task",
          title: `${taskToDup.title} (Copy)`,
          description: taskToDup.description || "",
          taskType: taskToDup.taskType,
          isRequired: taskToDup.isRequired,
          requiresDoc: taskToDup.requiresDoc,
          fieldConfig: taskToDup.fieldConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.template) {
        setSelected(data.template);
        const lastTask = data.template.tasks[data.template.tasks.length - 1];
        if (lastTask) setActiveTaskId(lastTask.id);
      }
      fetchTemplates();
    } catch (e: any) {
      setError(e.message || "Failed to duplicate question");
    } finally {
      setAddingTask(false);
    }
  };

  const handleMoveTask = async (fromIdx: number, toIdx: number) => {
    if (!selected || toIdx < 0 || toIdx >= selected.tasks.length || fromIdx === toIdx) return;

    const newTasks = [...selected.tasks];
    const [moved] = newTasks.splice(fromIdx, 1);
    newTasks.splice(toIdx, 0, moved);

    setSelected((prev) => (prev ? { ...prev, tasks: newTasks } : prev));

    try {
      const res = await fetch(`/api/restaurant/onboarding/templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder_tasks",
          orderedTaskIds: newTasks.map((t) => t.id),
        }),
      });
      const data = await res.json();
      if (data.template) setSelected(data.template);
    } catch {
      setError("Failed to reorder questions");
      fetchTemplates();
    }
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIndex(idx);
    e.dataTransfer.setData("text/plain", idx.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== idx) setDragOverIndex(idx);
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const sourceIdxStr = e.dataTransfer.getData("text/plain");
    const sourceIdx = sourceIdxStr !== "" ? parseInt(sourceIdxStr, 10) : draggedIndex;

    if (sourceIdx !== null && !isNaN(sourceIdx) && sourceIdx !== targetIdx) {
      handleMoveTask(sourceIdx, targetIdx);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleTaskTitleChange = (taskId: string, title: string) => {
    if (!selected) return;
    setSelected((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, title } : t)),
      };
    });
  };

  const handleTaskDescriptionChange = (taskId: string, description: string) => {
    if (!selected) return;
    setSelected((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, description } : t)),
      };
    });
  };

  const handleTaskFieldDefChange = (taskId: string, fieldDef: GoogleFieldType) => {
    if (!selected) return;
    setOpenDropdownTaskId(null);
    const initialConfig = fieldDef.hasOptions
      ? JSON.stringify({ subtype: fieldDef.key, options: ["Option 1", "Option 2"] })
      : JSON.stringify({ subtype: fieldDef.key });

    setSelected((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? { ...t, taskType: fieldDef.taskType, requiresDoc: fieldDef.taskType === "DOCUMENT", fieldConfig: initialConfig }
            : t
        ),
      };
    });
    handleSyncTaskField(taskId, { taskType: fieldDef.taskType, requiresDoc: fieldDef.taskType === "DOCUMENT", fieldConfig: initialConfig });
  };

  const handleTaskRequiredChange = (taskId: string, isRequired: boolean) => {
    if (!selected) return;
    setSelected((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, isRequired } : t)),
      };
    });
    handleSyncTaskField(taskId, { isRequired });
  };

  const handleAddOption = (taskId: string, currentConfig?: string) => {
    let cfg: { subtype: string; options: string[] } = { subtype: "multiple_choice", options: ["Option 1"] };
    try {
      if (currentConfig) {
        const parsed = JSON.parse(currentConfig);
        cfg = {
          subtype: parsed.subtype || "multiple_choice",
          options: Array.isArray(parsed.options) ? parsed.options : ["Option 1"],
        };
      }
    } catch {}
    if (!Array.isArray(cfg.options)) cfg.options = [];
    cfg.options.push(`Option ${cfg.options.length + 1}`);

    const newConfigStr = JSON.stringify(cfg);
    setSelected((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, fieldConfig: newConfigStr } : t)),
      };
    });
    handleSyncTaskField(taskId, { fieldConfig: newConfigStr });
  };

  const handleUpdateOption = (taskId: string, optIdx: number, val: string, currentConfig?: string) => {
    let cfg: { subtype: string; options: string[] } = { subtype: "multiple_choice", options: [] };
    try {
      if (currentConfig) {
        const parsed = JSON.parse(currentConfig);
        cfg = {
          subtype: parsed.subtype || "multiple_choice",
          options: Array.isArray(parsed.options) ? parsed.options : [],
        };
      }
    } catch {}
    if (!Array.isArray(cfg.options)) cfg.options = [];
    cfg.options[optIdx] = val;

    const newConfigStr = JSON.stringify(cfg);
    setSelected((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, fieldConfig: newConfigStr } : t)),
      };
    });
  };

  const handleRemoveOption = (taskId: string, optIdx: number, currentConfig?: string) => {
    let cfg: { subtype: string; options: string[] } = { subtype: "multiple_choice", options: [] };
    try {
      if (currentConfig) {
        const parsed = JSON.parse(currentConfig);
        cfg = {
          subtype: parsed.subtype || "multiple_choice",
          options: Array.isArray(parsed.options) ? parsed.options : [],
        };
      }
    } catch {}
    if (Array.isArray(cfg.options)) {
      cfg.options.splice(optIdx, 1);
    }
    const newConfigStr = JSON.stringify(cfg);
    setSelected((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, fieldConfig: newConfigStr } : t)),
      };
    });
    handleSyncTaskField(taskId, { fieldConfig: newConfigStr });
  };

  const handleFormTitleChange = (name: string) => {
    if (!selected) return;
    setSelected((prev) => (prev ? { ...prev, name } : prev));
  };

  const handleFormDescriptionChange = (description: string) => {
    if (!selected) return;
    setSelected((prev) => (prev ? { ...prev, description } : prev));
  };

  const handleSaveFormHeader = async () => {
    if (!selected) return;
    try {
      await fetch(`/api/restaurant/onboarding/templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected.name, description: selected.description }),
      });
      fetchTemplates();
    } catch {
      setError("Failed to save template header");
    }
  };

  const handleSyncTaskField = async (taskId: string, fields: Partial<Task>) => {
    if (!selected) return;
    try {
      await fetch(`/api/restaurant/onboarding/templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_task",
          taskId,
          ...fields,
        }),
      });
    } catch {
      setError("Failed to sync field");
    }
  };

  const handleDeleteField = async (taskId: string) => {
    if (!selected) return;
    setSelected((prev) => {
      if (!prev) return prev;
      return { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) };
    });

    try {
      const res = await fetch(`/api/restaurant/onboarding/templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_task", taskId }),
      });
      const data = await res.json();
      if (data.template) setSelected(data.template);
      fetchTemplates();
    } catch {
      setError("Failed to delete field");
      fetchTemplates();
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Archive this form template?")) return;
    await fetch(`/api/restaurant/onboarding/templates/${id}`, { method: "DELETE" });
    setSelected(null);
    fetchTemplates();
  };

  // Safe Field Config parser
  const getParsedConfig = (fieldConfig?: string) => {
    let parsedConfig: { subtype: string; options: string[] } = { subtype: "short_answer", options: ["Option 1", "Option 2"] };
    try {
      if (fieldConfig) {
        const parsed = JSON.parse(fieldConfig);
        if (parsed && typeof parsed === "object") {
          parsedConfig = {
            subtype: parsed.subtype || "short_answer",
            options: Array.isArray(parsed.options) ? parsed.options : ["Option 1", "Option 2"],
          };
        }
      }
    } catch {
      parsedConfig = { subtype: "short_answer", options: ["Option 1", "Option 2"] };
    }
    return parsedConfig;
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f0ebf8] text-gray-600 font-medium text-sm">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-[#673ab7] border-t-transparent rounded-full animate-spin" />
          <span>Loading Google Form Builder...</span>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0ebf8] text-gray-900 font-sans selection:bg-[#673ab7]/20">
      {/* ── GOOGLE FORMS TOP HEADER ────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-[#673ab7] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={selected?.name || "Untitled Form"}
                  onChange={(e) => handleFormTitleChange(e.target.value)}
                  onBlur={handleSaveFormHeader}
                  className="text-base font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-b-[#673ab7] focus:outline-none truncate max-w-xs sm:max-w-md px-1"
                />
                {selected?.isDefault && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#673ab7] uppercase">
                    Default
                  </span>
                )}
              </div>
              <span className="text-[11px] text-gray-400 block px-1">All changes saved in cloud</span>
            </div>
          </div>

          {/* Form Switcher & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {templates.length > 0 && (
              <select
                value={selected?.id || ""}
                onChange={(e) => {
                  const tpl = templates.find((t) => t.id === e.target.value);
                  if (tpl) {
                    setSelected(tpl);
                    if (tpl.tasks.length > 0) setActiveTaskId(tpl.tasks[0].id);
                  }
                }}
                className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#673ab7] cursor-pointer"
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.tasks.length} questions)
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setViewMode(viewMode === "edit" ? "preview" : "edit")}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                viewMode === "preview" ? "bg-purple-100 text-[#673ab7]" : "hover:bg-gray-100 text-gray-600"
              }`}
              title="Preview Form"
            >
              <Eye className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setCreateForm({ name: "", description: "", isDefault: false });
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-[#673ab7] hover:bg-[#5e35b1] text-white font-semibold text-xs rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Form</span>
            </button>
          </div>
        </div>

        {/* Google Forms Sub-Navigation Tabs */}
        {selected && (
          <div className="flex items-center justify-center gap-8 border-t border-gray-100 text-sm font-medium text-gray-600">
            <button
              onClick={() => {
                setActiveTab("questions");
                setViewMode("edit");
              }}
              className={`py-2.5 px-4 border-b-2 transition-colors cursor-pointer ${
                activeTab === "questions" && viewMode === "edit"
                  ? "border-[#673ab7] text-[#673ab7] font-semibold"
                  : "border-transparent hover:text-gray-900"
              }`}
            >
              Questions
            </button>

            <button
              onClick={() => {
                setActiveTab("responses");
                setViewMode("edit");
              }}
              className={`py-2.5 px-4 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "responses"
                  ? "border-[#673ab7] text-[#673ab7] font-semibold"
                  : "border-transparent hover:text-gray-900"
              }`}
            >
              <span>Responses</span>
              <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-xs font-bold flex items-center justify-center">
                {selected._count?.onboardings || 0}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("settings");
                setViewMode("edit");
              }}
              className={`py-2.5 px-4 border-b-2 transition-colors cursor-pointer ${
                activeTab === "settings"
                  ? "border-[#673ab7] text-[#673ab7] font-semibold"
                  : "border-transparent hover:text-gray-900"
              }`}
            >
              Settings
            </button>
          </div>
        )}
      </header>

      {/* ── MAIN GOOGLE FORM CANVAS ────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl mb-4 font-semibold">
            {error}
          </div>
        )}

        {selected ? (
          viewMode === "preview" ? (
            /* ── PREVIEW MODE ── */
            <div className="space-y-4">
              <div className="bg-white border-t-[10px] border-t-[#673ab7] border-x border-b border-gray-200 rounded-xl p-8 shadow-sm space-y-3">
                <span className="text-xs text-[#673ab7] font-bold uppercase tracking-widest block">Live Employee Preview</span>
                <h1 className="text-3xl font-semibold text-gray-900">{selected.name}</h1>
                {selected.description && <p className="text-sm text-gray-600">{selected.description}</p>}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 font-medium">
                  <span>Candidate Form View</span>
                  <span className="text-red-500 font-semibold">* Indicates required field</span>
                </div>
              </div>

              {selected.tasks.map((task, idx) => {
                const parsedConfig = getParsedConfig(task.fieldConfig);

                return (
                  <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-3">
                    <label className="block text-base font-normal text-gray-900">
                      {idx + 1}. {task.title} {task.isRequired && <span className="text-red-500">*</span>}
                    </label>
                    {task.description && <p className="text-xs text-gray-500">{task.description}</p>}

                    {/* Form Field Preview Mock */}
                    <div className="pt-2">
                      {parsedConfig.subtype === "short_answer" && (
                        <input type="text" placeholder="Short answer text" disabled className="w-full sm:w-2/3 border-b border-gray-300 py-1.5 text-sm text-gray-400 outline-none bg-transparent" />
                      )}
                      {parsedConfig.subtype === "paragraph" && (
                        <textarea placeholder="Long answer text" disabled rows={2} className="w-full border-b border-gray-300 py-1.5 text-sm text-gray-400 outline-none bg-transparent resize-none" />
                      )}
                      {(parsedConfig.subtype === "multiple_choice" || parsedConfig.subtype === "checkboxes") && (
                        <div className="space-y-2">
                          {(parsedConfig.options || []).map((opt: string, oIdx: number) => (
                            <label key={oIdx} className="flex items-center gap-3 text-sm text-gray-700">
                              <input type={parsedConfig.subtype === "checkboxes" ? "checkbox" : "radio"} disabled className="accent-[#673ab7] w-4 h-4" />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {parsedConfig.subtype === "dropdown" && (
                        <select disabled className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-500">
                          <option>Choose an option...</option>
                          {(parsedConfig.options || []).map((opt: string, oIdx: number) => (
                            <option key={oIdx}>{opt}</option>
                          ))}
                        </select>
                      )}
                      {task.taskType === "DOCUMENT" && (
                        <div className="p-4 border border-dashed border-gray-300 bg-gray-50 rounded-lg text-center text-xs text-gray-500">
                          Click to select and upload file attachment (PDF / Image)
                        </div>
                      )}
                      {task.taskType === "SIGNATURE" && (
                        <div className="h-24 border border-gray-300 bg-white rounded-lg flex items-center justify-center text-xs text-gray-400">
                          Digital Signature Pad
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <button disabled className="w-full py-3 bg-[#673ab7] text-white font-semibold text-sm rounded-xl cursor-not-allowed opacity-75 shadow-sm">
                Submit Form (Preview Mode Only)
              </button>
            </div>
          ) : activeTab === "responses" ? (
            /* ── RESPONSES TAB ── */
            <div className="bg-white border border-gray-200 rounded-xl p-8 space-y-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Form Responses</h2>
                  <p className="text-xs text-gray-500 mt-1">Candidates onboarded with this form template</p>
                </div>
                <span className="text-3xl font-bold text-[#673ab7]">{selected._count?.onboardings || 0}</span>
              </div>

              {loadingSessions ? (
                <div className="py-8 text-center text-xs text-gray-400 animate-pulse">Loading candidate submissions...</div>
              ) : templateSessions.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-14 h-14 bg-purple-50 text-[#673ab7] rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                    📊
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">0 Candidate Submissions Yet</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Initiate onboarding for an employee to send them this form.
                  </p>
                  <button
                    onClick={() => router.push(`/restaurant/${subdomain}/workforce/employees?tab=onboarding`)}
                    className="px-4 py-2 bg-[#673ab7] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  >
                    Go to HR Onboarding &rarr;
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                    <span>Candidate Name</span>
                    <span>Submission Status</span>
                  </div>

                  {templateSessions.map((sess) => (
                    <div
                      key={sess.id}
                      onClick={() => {
                        if (sess.employee?.id) {
                          router.push(`/restaurant/${subdomain}/workforce/employees/${sess.employee.id}?tab=documents`);
                        }
                      }}
                      className="p-4 bg-gray-50 hover:bg-purple-50/60 border border-gray-200 hover:border-[#673ab7] rounded-xl transition-all flex items-center justify-between gap-4 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#673ab7]/10 text-[#673ab7] flex items-center justify-center font-bold text-xs shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 group-hover:text-[#673ab7] transition-colors flex items-center gap-1.5">
                            {sess.employee?.firstName} {sess.employee?.lastName}
                            <span className="text-xs font-mono font-normal text-gray-400">({sess.employee?.employeeCode})</span>
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Started: {sess.startedAt ? new Date(sess.startedAt).toLocaleDateString() : "Recently"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          sess.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {sess.status.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-[#673ab7] font-semibold group-hover:underline flex items-center gap-1">
                          View Documents <ExternalLink className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  ))}

                  <div className="pt-4 text-center">
                    <button
                      onClick={() => router.push(`/restaurant/${subdomain}/workforce/employees?tab=onboarding`)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      View All Onboarding Sessions &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "settings" ? (
            /* ── SETTINGS TAB ── */
            <div className="bg-white border border-gray-200 rounded-xl p-8 space-y-6 shadow-xs">
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-2xl font-semibold text-gray-900">Form Settings</h2>
                <p className="text-xs text-gray-500 mt-1">Manage defaults and form actions</p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900">Default Onboarding Template</h4>
                    <p className="text-gray-500">Automatically select this form when creating new hires</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full font-bold ${selected.isDefault ? "bg-purple-100 text-[#673ab7]" : "bg-gray-200 text-gray-600"}`}>
                    {selected.isDefault ? "Default Form" : "Standard Form"}
                  </span>
                </div>

                <div className="pt-4 flex justify-between items-center border-t border-gray-100">
                  <button
                    onClick={() => handleArchive(selected.id)}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    Archive Form Template
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── QUESTIONS EDIT CANVAS (GOOGLE FORM STYLE) ── */
            <div className="relative space-y-4">
              {/* 1. Main Header Card */}
              <div className="bg-white border-t-[10px] border-t-[#673ab7] border-x border-b border-gray-200 rounded-xl p-6 shadow-xs space-y-3 relative">
                <input
                  type="text"
                  value={selected.name}
                  onChange={(e) => handleFormTitleChange(e.target.value)}
                  onBlur={handleSaveFormHeader}
                  placeholder="Form title"
                  className="w-full text-3xl font-semibold text-gray-900 focus:border-b-2 focus:border-b-[#673ab7] border-b border-transparent outline-none py-1 transition-all"
                />
                <input
                  type="text"
                  value={selected.description || ""}
                  onChange={(e) => handleFormDescriptionChange(e.target.value)}
                  onBlur={handleSaveFormHeader}
                  placeholder="Form description (instructions for employee)..."
                  className="w-full text-sm text-gray-600 focus:border-b-2 focus:border-b-[#673ab7] border-b border-transparent outline-none py-1 transition-all"
                />
              </div>

              {/* 2. Questions Stack */}
              {selected.tasks.map((task, idx) => {
                const isActive = activeTaskId === task.id;
                const isDragging = draggedIndex === idx;
                const isDragTarget = dragOverIndex === idx;

                const parsedConfig = getParsedConfig(task.fieldConfig);
                const currentFieldDef =
                  GOOGLE_FIELD_TYPES.find((f) => f.key === parsedConfig.subtype) || GOOGLE_FIELD_TYPES[0];

                return (
                  <div key={task.id} className="relative group/card">
                    <div
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onClick={() => setActiveTaskId(task.id)}
                      className={`bg-white rounded-xl border transition-all duration-150 relative ${
                        isDragging
                          ? "border-2 border-[#673ab7] bg-purple-50/50 shadow-md opacity-50"
                          : isDragTarget
                          ? "border-t-4 border-t-[#673ab7] border-purple-300"
                          : isActive
                          ? "border-l-[6px] border-l-[#4285f4] border-gray-200 shadow-md p-6 space-y-5"
                          : "border-gray-200 hover:border-gray-300 shadow-xs p-5 space-y-3 cursor-pointer"
                      }`}
                    >
                      {/* Drag handle dots at center top */}
                      <div className="flex items-center justify-between">
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragEnd={handleDragEnd}
                          className="flex justify-center text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing select-none flex-1 py-1"
                          title="Drag to reorder question"
                        >
                          <GripHorizontal className="w-5 h-5" />
                        </div>

                        {/* Quick 1-click Move Up / Move Down buttons */}
                        <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveTask(idx, idx - 1);
                            }}
                            className="p-1 hover:bg-gray-100 disabled:opacity-30 rounded text-gray-600 transition-colors cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === selected.tasks.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveTask(idx, idx + 1);
                            }}
                            className="p-1 hover:bg-gray-100 disabled:opacity-30 rounded text-gray-600 transition-colors cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Top Row: Question Title & Field Type Select */}
                      {isActive ? (
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => handleTaskTitleChange(task.id, e.target.value)}
                            onBlur={(e) => handleSyncTaskField(task.id, { title: e.target.value })}
                            placeholder="Question"
                            className="flex-1 bg-[#f8f9fa] border-b border-gray-400 focus:border-b-2 focus:border-b-[#673ab7] px-3.5 py-3 text-base text-gray-900 outline-none rounded-t-md font-medium w-full"
                          />

                          {/* Custom Google Forms Dropdown Picker with Viewport Auto-Height Limit */}
                          <div className="relative w-full sm:w-56 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownTaskId(openDropdownTaskId === task.id ? null : task.id);
                              }}
                              className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-gray-300 hover:border-gray-400 rounded-lg text-xs font-semibold text-gray-800 cursor-pointer shadow-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                {currentFieldDef.icon}
                                <span className="truncate">{currentFieldDef.label}</span>
                              </div>
                              <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                            </button>

                            {/* Dropdown Menu Popup (Scrollable, never overflows screen) */}
                            {openDropdownTaskId === task.id && (
                              <div className="absolute right-0 top-12 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 py-2 max-h-64 overflow-y-auto animate-in fade-in duration-100">
                                {GOOGLE_FIELD_TYPES.map((f) => (
                                  <div
                                    key={f.key}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTaskFieldDefChange(task.id, f);
                                    }}
                                    className={`px-4 py-2.5 text-xs font-medium flex items-center gap-3 cursor-pointer hover:bg-purple-50 transition-colors ${
                                      currentFieldDef.key === f.key ? "bg-purple-50/80 text-[#673ab7] font-semibold" : "text-gray-700"
                                    }`}
                                  >
                                    {f.icon}
                                    <div>
                                      <span className="block">{f.label}</span>
                                      <span className="text-[10px] text-gray-400 block">{f.desc}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h3 className="text-base font-normal text-gray-900">
                              {task.title || "Untitled question"}{" "}
                              {task.isRequired && <span className="text-red-500">*</span>}
                            </h3>
                            {task.description && <p className="text-xs text-gray-500">{task.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
                            {currentFieldDef.icon}
                            <span className="font-semibold">{currentFieldDef.label}</span>
                          </div>
                        </div>
                      )}

                      {/* Optional Help Text Input (When Active) */}
                      {isActive && (
                        <div>
                          <input
                            type="text"
                            value={task.description || ""}
                            onChange={(e) => handleTaskDescriptionChange(task.id, e.target.value)}
                            onBlur={(e) => handleSyncTaskField(task.id, { description: e.target.value })}
                            placeholder="Form description / help text (optional)..."
                            className="w-full text-xs text-gray-600 border-b border-gray-200 focus:border-b-[#673ab7] outline-none py-1"
                          />
                        </div>
                      )}

                      {/* Question Options / Body */}
                      <div className="pt-1">
                        {/* Choice Options (Multiple choice, Checkboxes, Dropdown) */}
                        {currentFieldDef.hasOptions ? (
                          <div className="space-y-2.5">
                            {(parsedConfig.options || []).map((opt: string, optIdx: number) => (
                              <div key={optIdx} className="flex items-center gap-3">
                                {currentFieldDef.key === "checkboxes" ? (
                                  <SquareCheck className="w-4 h-4 text-gray-400 shrink-0" />
                                ) : (
                                  <Circle className="w-4 h-4 text-gray-400 shrink-0" />
                                )}
                                {isActive ? (
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => handleUpdateOption(task.id, optIdx, e.target.value, task.fieldConfig)}
                                    onBlur={() => handleSyncTaskField(task.id, { fieldConfig: task.fieldConfig })}
                                    className="flex-1 text-sm text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-b-[#673ab7] outline-none py-1"
                                  />
                                ) : (
                                  <span className="text-sm text-gray-700">{opt}</span>
                                )}
                                {isActive && (parsedConfig.options || []).length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(task.id, optIdx, task.fieldConfig)}
                                    className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}

                            {isActive && (
                              <button
                                type="button"
                                onClick={() => handleAddOption(task.id, task.fieldConfig)}
                                className="text-xs font-semibold text-gray-500 hover:text-[#673ab7] cursor-pointer pt-1 block"
                              >
                                + Add option
                              </button>
                            )}
                          </div>
                        ) : (
                          /* Non-option Field Types Mock Body */
                          <div className="py-2">
                            {currentFieldDef.key === "short_answer" && (
                              <div className="w-2/3 border-b border-dashed border-gray-300 text-xs text-gray-400 py-1">
                                Short-answer text
                              </div>
                            )}
                            {currentFieldDef.key === "paragraph" && (
                              <div className="w-full border-b border-dashed border-gray-300 text-xs text-gray-400 py-1">
                                Long-answer text
                              </div>
                            )}
                            {currentFieldDef.key === "file_upload" && (
                              <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                                <UploadCloud className="w-4 h-4 text-gray-400" />
                                <span>File upload attachment box (PDF, Images, IDs)</span>
                              </div>
                            )}
                            {currentFieldDef.key === "signature" && (
                              <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                                <PenTool className="w-4 h-4 text-gray-400" />
                                <span>Digital Signature Pad</span>
                              </div>
                            )}
                            {currentFieldDef.key === "date" && (
                              <div className="w-40 border-b border-dashed border-gray-300 text-xs text-gray-400 py-1 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span>Month, day, year</span>
                              </div>
                            )}
                            {currentFieldDef.key === "time" && (
                              <div className="w-32 border-b border-dashed border-gray-300 text-xs text-gray-400 py-1 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span>Time</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Bottom Actions Footer (Google Forms Toolbar) */}
                      {isActive && (
                        <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-100 text-gray-600">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateTask(task);
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteField(task.id);
                            }}
                            className="p-1.5 hover:bg-gray-100 hover:text-red-600 rounded-full transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="h-5 w-px bg-gray-300" />

                          {/* Required Toggle Switch */}
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
                            <span>Required</span>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTaskRequiredChange(task.id, !task.isRequired);
                              }}
                              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                                task.isRequired ? "bg-[#673ab7]" : "bg-gray-300"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                                  task.isRequired ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </div>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Google Forms Floating Vertical Toolbar on Active Card Right Side */}
                    {isActive && (
                      <div className="absolute right-[-54px] top-4 bg-white border border-gray-200 rounded-xl shadow-md p-1.5 flex flex-col items-center gap-2 z-20">
                        {/* Hover/Click Add Question Options Popover */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowAddMenu((prev) => !prev)}
                            className="p-2 hover:bg-purple-50 text-[#673ab7] rounded-lg transition-colors cursor-pointer"
                            title="Add Question Field"
                          >
                            <PlusCircle className="w-5 h-5" />
                          </button>

                          {/* Hover Popover of All 10 Field Options (Fits Screen & Scrollable) */}
                          {showAddMenu && (
                            <div className="absolute right-full top-0 mr-3 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 p-2 max-h-72 overflow-y-auto animate-in fade-in duration-100 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 block py-1">
                                Choose Question Type
                              </span>
                              {GOOGLE_FIELD_TYPES.map((f) => (
                                <div
                                  key={f.key}
                                  onClick={() => handleAddField(f)}
                                  className="px-3 py-2 text-xs font-medium flex items-center gap-2.5 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors text-gray-700"
                                >
                                  {f.icon}
                                  <div>
                                    <span className="block font-semibold">{f.label}</span>
                                    <span className="text-[10px] text-gray-400 block">{f.desc}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddField(GOOGLE_FIELD_TYPES[5])} // File upload
                          className="p-2 hover:bg-purple-50 text-gray-700 hover:text-[#673ab7] rounded-lg transition-colors cursor-pointer"
                          title="Add file upload field"
                        >
                          <UploadCloud className="w-5 h-5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddField(GOOGLE_FIELD_TYPES[6])} // Signature
                          className="p-2 hover:bg-purple-50 text-gray-700 hover:text-[#673ab7] rounded-lg transition-colors cursor-pointer"
                          title="Add digital signature field"
                        >
                          <PenTool className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Empty State */
          <div className="text-center py-20 px-6 border-2 border-dashed border-gray-300 rounded-2xl bg-white shadow-xs space-y-4 max-w-lg mx-auto my-8">
            <div className="w-16 h-16 bg-purple-50 text-[#673ab7] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <FolderPlus className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900">No Form Template Selected</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Create a custom employee onboarding form template with short answers, file uploads, multiple choices, and digital signatures.
              </p>
            </div>
            <button
              onClick={() => {
                setCreateForm({ name: "", description: "", isDefault: false });
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#673ab7] hover:bg-[#5e35b1] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              + Create Form Template
            </button>
          </div>
        )}
      </main>

      {/* ── CREATE FORM TEMPLATE MODAL ────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Create Google Form</h2>
              <p className="text-xs text-gray-500 mt-1">Set form title and parameters</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Form Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Kitchen Staff Onboarding"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-[#673ab7]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  placeholder="Instructions for employee (optional)..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-[#673ab7] resize-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createForm.isDefault}
                  onChange={(e) => setCreateForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="accent-[#673ab7] w-4 h-4"
                />
                Set as default onboarding form template
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-[#673ab7] hover:bg-[#5e35b1] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {submitting ? "Creating..." : "Create Form"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
