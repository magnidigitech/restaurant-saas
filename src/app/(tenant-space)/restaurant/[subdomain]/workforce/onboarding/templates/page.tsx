"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

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
  badge: string;
  hasOptions?: boolean;
}

const GOOGLE_FIELD_TYPES: GoogleFieldType[] = [
  { key: "short_answer", taskType: "FORM_INPUT", label: "Short Answer", desc: "Single line text response", badge: "Short Text" },
  { key: "paragraph", taskType: "FORM_INPUT", label: "Paragraph", desc: "Long text paragraph response", badge: "Paragraph" },
  { key: "multiple_choice", taskType: "FORM_INPUT", label: "Multiple Choice (Radio)", desc: "Single option radio selection", badge: "Radio", hasOptions: true },
  { key: "checkboxes", taskType: "CHECKBOX", label: "Checkboxes (Multi-Select)", desc: "Multiple options checklist", badge: "Checkboxes", hasOptions: true },
  { key: "dropdown", taskType: "FORM_INPUT", label: "Dropdown", desc: "Select option from dropdown menu", badge: "Dropdown", hasOptions: true },
  { key: "file_upload", taskType: "DOCUMENT", label: "File Upload", desc: "Upload ID, PDF, License or Photo", badge: "File Upload" },
  { key: "signature", taskType: "SIGNATURE", label: "Digital Signature", desc: "Touch or mouse signature sign-off", badge: "Signature" },
  { key: "date", taskType: "DATE", label: "Date", desc: "Calendar date picker", badge: "Date" },
  { key: "time", taskType: "FORM_INPUT", label: "Time", desc: "Time picker input", badge: "Time" },
  { key: "agreement", taskType: "CHECKBOX", label: "Checklist Agreement", desc: "Confirmation agreement checkbox", badge: "Agreement" },
];

export default function OnboardingTemplatesPage() {
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Template | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // File upload demo state
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [previewFiles, setPreviewFiles] = useState<{ [key: string]: string }>({});

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

  useEffect(() => { fetchTemplates(); }, []);

  const handleCreateTemplate = async () => {
    if (!createForm.name) { setError("Template name is required"); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/restaurant/onboarding/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          tasks: [
            { title: "Full Legal Name", description: "As shown on official ID", taskType: "FORM_INPUT", isRequired: true },
            { title: "Digital Signature", description: "Sign to confirm onboarding details", taskType: "SIGNATURE", isRequired: true },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreateModal(false);
      setCreateForm({ name: "", description: "", isDefault: false });
      fetchTemplates();
    } catch (e: any) { setError(e.message || "Failed to create template"); }
    finally { setSubmitting(false); }
  };

  const handleAddField = async (fieldDef: GoogleFieldType) => {
    if (!selected) return;
    setAddingTask(true); setError("");
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
          isRequired: true,
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
    } catch (e: any) { setError(e.message || "Failed to add question field"); }
    finally { setAddingTask(false); }
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
      if (data.template) {
        setSelected(data.template);
      }
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
      if (currentConfig) cfg = JSON.parse(currentConfig);
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
      if (currentConfig) cfg = JSON.parse(currentConfig);
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
      if (currentConfig) cfg = JSON.parse(currentConfig);
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
    if (!confirm("Archive this template?")) return;
    await fetch(`/api/restaurant/onboarding/templates/${id}`, { method: "DELETE" });
    setSelected(null);
    fetchTemplates();
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-semibold">Loading Form Builder...</main>;

  const isReorderingActive = draggedIndex !== null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Top Navbar */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40 px-6 py-4 flex flex-wrap justify-between items-center gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900 transition-colors cursor-pointer text-sm font-semibold">
            ← Back
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Form & Template Builder</h1>
            <p className="text-xs text-gray-500">Create employee onboarding forms</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Template Select Dropdown */}
          <select
            value={selected?.id || ""}
            onChange={(e) => {
              const tpl = templates.find((t) => t.id === e.target.value);
              if (tpl) { setSelected(tpl); if (tpl.tasks.length > 0) setActiveTaskId(tpl.tasks[0].id); }
            }}
            className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:border-indigo-600 cursor-pointer"
          >
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.tasks.length} questions)</option>
            ))}
          </select>

          <div className="bg-gray-100 border border-gray-200 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setViewMode("edit")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                viewMode === "edit" ? "bg-indigo-600 text-white shadow" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Edit Form
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                viewMode === "preview" ? "bg-indigo-600 text-white shadow" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Preview Form
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-sm"
          >
            + Create Form
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

        {selected ? (
          viewMode === "edit" ? (
            <div className="space-y-6">
              {/* Reorder Mode Banner */}
              {isReorderingActive && (
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs px-4 py-2.5 rounded-xl font-semibold text-center animate-pulse">
                  Hold and drag card to target position. Release to save reordered positions.
                </div>
              )}

              {/* Form Title Card */}
              <div className="bg-white border-t-4 border-t-indigo-600 border-x border-b border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-indigo-600 mb-1">Form Title</label>
                  <input
                    type="text"
                    value={selected.name}
                    onChange={(e) => handleFormTitleChange(e.target.value)}
                    onBlur={handleSaveFormHeader}
                    placeholder="Form Title *"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xl font-bold text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">Form Description</label>
                  <input
                    type="text"
                    placeholder="Provide instructions for the employee (optional)..."
                    value={selected.description || ""}
                    onChange={(e) => handleFormDescriptionChange(e.target.value)}
                    onBlur={handleSaveFormHeader}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:bg-white focus:outline-none focus:border-indigo-600 transition-all"
                  />
                </div>

                <div className="flex justify-between items-center pt-2 text-xs text-gray-500 border-t border-gray-100">
                  <span className="font-semibold">{selected.tasks.length} Questions Configured</span>
                  <button onClick={() => handleArchive(selected.id)} className="text-red-600 hover:text-red-700 font-semibold cursor-pointer">
                    Archive Form
                  </button>
                </div>
              </div>

              {/* Question Cards Stack */}
              {selected.tasks.map((task, idx) => {
                const isActive = activeTaskId === task.id;
                const isDragging = draggedIndex === idx;
                const isDragTarget = dragOverIndex === idx;

                let parsedConfig = { subtype: "short_answer", options: ["Option 1", "Option 2"] };
                try {
                  if (task.fieldConfig) parsedConfig = JSON.parse(task.fieldConfig);
                } catch {}

                const currentFieldDef = GOOGLE_FIELD_TYPES.find((f) => f.key === parsedConfig.subtype) || GOOGLE_FIELD_TYPES[0];

                return (
                  <div
                    key={task.id}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onClick={() => setActiveTaskId(task.id)}
                    className={`bg-white border rounded-2xl transition-all duration-200 shadow-sm ${
                      isDragging
                        ? "border-2 border-indigo-600 bg-indigo-50 shadow-md ring-2 ring-indigo-200 opacity-50"
                        : isDragTarget
                        ? "border-t-4 border-t-indigo-600 border-indigo-300 bg-indigo-50/30"
                        : isActive
                        ? "border-indigo-600 ring-2 ring-indigo-100"
                        : "border-gray-200 hover:border-gray-300 cursor-pointer"
                    } ${isReorderingActive ? "p-3.5" : "p-6 space-y-4"}`}
                  >
                    {/* Header Row (Drag handle & title) */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragEnd={handleDragEnd}
                        className="flex items-center gap-3 cursor-grab active:cursor-grabbing text-gray-600 font-mono text-xs select-none flex-1"
                      >
                        <span className="font-bold tracking-widest text-base text-gray-400 hover:text-indigo-600">:::</span>
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-sm text-gray-900 line-clamp-1">{task.title || "Untitled Question"}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-gray-100 border border-gray-200 text-indigo-700 rounded">
                          {currentFieldDef.badge}
                        </span>

                        {/* Quick Up / Down Reorder Buttons */}
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => { e.stopPropagation(); handleMoveTask(idx, idx - 1); }}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 rounded text-xs font-bold text-gray-700 transition-all cursor-pointer"
                            title="Move Up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={idx === selected.tasks.length - 1}
                            onClick={(e) => { e.stopPropagation(); handleMoveTask(idx, idx + 1); }}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-30 rounded text-xs font-bold text-gray-700 transition-all cursor-pointer"
                            title="Move Down"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Question Card Full Body */}
                    {!isReorderingActive && (
                      <div className="space-y-4 pt-1">
                        {/* Question Title & Field Type Select */}
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 w-full">
                            <input
                              type="text"
                              value={task.title}
                              onChange={(e) => handleTaskTitleChange(task.id, e.target.value)}
                              onBlur={(e) => handleSyncTaskField(task.id, { title: e.target.value })}
                              placeholder="Question / Field Label *"
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                            />
                          </div>

                          <div className="w-full sm:w-auto">
                            <select
                              value={currentFieldDef.key}
                              onChange={(e) => {
                                const newDef = GOOGLE_FIELD_TYPES.find((f) => f.key === e.target.value);
                                if (newDef) handleTaskFieldDefChange(task.id, newDef);
                              }}
                              className="w-full sm:w-auto bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-indigo-600 cursor-pointer"
                            >
                              {GOOGLE_FIELD_TYPES.map((f) => (
                                <option key={f.key} value={f.key}>
                                  [{f.badge}] {f.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Optional Help Text */}
                        <div>
                          <input
                            type="text"
                            value={task.description || ""}
                            onChange={(e) => handleTaskDescriptionChange(task.id, e.target.value)}
                            onBlur={(e) => handleSyncTaskField(task.id, { description: e.target.value })}
                            placeholder="Help text or instructions for employee (optional)..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-600 focus:bg-white focus:outline-none focus:border-indigo-600"
                          />
                        </div>

                        {/* Custom Choice Option Builder */}
                        {currentFieldDef.hasOptions && (
                          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Choice Options</span>
                              <button
                                type="button"
                                onClick={() => handleAddOption(task.id, task.fieldConfig)}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                              >
                                + Add Choice Option
                              </button>
                            </div>

                            <div className="space-y-2">
                              {(parsedConfig.options || []).map((opt: string, optIdx: number) => (
                                <div key={optIdx} className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 font-mono">{optIdx + 1}.</span>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => handleUpdateOption(task.id, optIdx, e.target.value, task.fieldConfig)}
                                    onBlur={() => handleSyncTaskField(task.id, { fieldConfig: task.fieldConfig })}
                                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-indigo-600"
                                  />
                                  {(parsedConfig.options || []).length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOption(task.id, optIdx, task.fieldConfig)}
                                      className="text-gray-400 hover:text-red-500 text-xs px-2 py-1 cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Input Field Visual Mock */}
                        {!currentFieldDef.hasOptions && (
                          <div className="pt-1">
                            {currentFieldDef.key === "short_answer" && (
                              <input type="text" disabled placeholder="Short answer text response..." className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-400 cursor-not-allowed" />
                            )}
                            {currentFieldDef.key === "paragraph" && (
                              <textarea disabled placeholder="Paragraph text response..." rows={2} className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-400 cursor-not-allowed resize-none" />
                            )}
                            {currentFieldDef.key === "signature" && (
                              <div className="h-24 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-xs text-gray-400 font-mono">Digital Signature Canvas Pad</div>
                            )}
                            {currentFieldDef.key === "file_upload" && (
                              <div className="space-y-2">
                                <input
                                  type="file"
                                  ref={(el) => { fileInputRefs.current[task.id] = el; }}
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      setPreviewFiles((prev) => ({ ...prev, [task.id]: e.target.files![0].name }));
                                    }
                                  }}
                                  className="hidden"
                                />
                                <div
                                  onClick={() => fileInputRefs.current[task.id]?.click()}
                                  className="p-4 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-xl text-center text-xs text-gray-600 hover:text-indigo-600 cursor-pointer transition-all"
                                >
                                  {previewFiles[task.id] ? (
                                    <span className="font-bold text-indigo-600">Selected File: {previewFiles[task.id]}</span>
                                  ) : (
                                    "Click to select file attachment"
                                  )}
                                </div>
                              </div>
                            )}
                            {currentFieldDef.key === "date" && (
                              <input type="date" disabled className="bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-400 cursor-not-allowed" />
                            )}
                            {currentFieldDef.key === "time" && (
                              <input type="time" disabled className="bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-400 cursor-not-allowed" />
                            )}
                            {currentFieldDef.key === "agreement" && (
                              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-not-allowed">
                                <input type="checkbox" disabled checked className="accent-indigo-600" />
                                Confirmation check box
                              </label>
                            )}
                          </div>
                        )}

                        {/* Card Actions Footer */}
                        <div className="flex justify-between items-center pt-3 border-t border-gray-100 text-xs">
                          <label className="flex items-center gap-2 text-gray-700 font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={task.isRequired}
                              onChange={(e) => handleTaskRequiredChange(task.id, e.target.checked)}
                              className="accent-indigo-600 w-4 h-4"
                            />
                            Mandatory / Required Field
                          </label>

                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteField(task.id); }}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold rounded-lg transition-all cursor-pointer"
                          >
                            Delete Question
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Clean Add Question Section */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 text-center">
                  + Add New Question Field
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {GOOGLE_FIELD_TYPES.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => handleAddField(f)}
                      disabled={addingTask}
                      className="p-3 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-xl transition-all flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-white border border-gray-200 text-indigo-600 rounded">
                        {f.badge}
                      </span>
                      <span className="text-xs font-bold text-gray-900 text-center">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Live Form Preview */
            <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-6 shadow-sm">
              <div className="border-b border-gray-200 pb-4 space-y-1">
                <span className="text-xs text-indigo-600 font-bold uppercase tracking-widest">Live Employee Preview</span>
                <h2 className="text-2xl font-bold text-gray-900">{selected.name}</h2>
                {selected.description && <p className="text-sm text-gray-600">{selected.description}</p>}
              </div>

              <div className="space-y-5">
                {selected.tasks.map((task, idx) => {
                  let parsedConfig = { subtype: "short_answer", options: ["Option 1", "Option 2"] };
                  try {
                    if (task.fieldConfig) parsedConfig = JSON.parse(task.fieldConfig);
                  } catch {}

                  return (
                    <div key={task.id} className="space-y-3 p-5 bg-gray-50 rounded-xl border border-gray-200">
                      <label className="block text-sm font-bold text-gray-900">
                        {idx + 1}. {task.title} {task.isRequired && <span className="text-red-500">*</span>}
                      </label>
                      {task.description && <p className="text-xs text-gray-500">{task.description}</p>}

                      {parsedConfig.subtype === "short_answer" && (
                        <input type="text" placeholder="Short answer response..." className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-600" />
                      )}

                      {parsedConfig.subtype === "paragraph" && (
                        <textarea placeholder="Paragraph response..." rows={3} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-600 resize-none" />
                      )}

                      {parsedConfig.subtype === "multiple_choice" && (
                        <div className="space-y-2">
                          {(parsedConfig.options || []).map((opt: string, oIdx: number) => (
                            <label key={oIdx} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                              <input type="radio" name={`q_${task.id}`} className="accent-indigo-600 w-4 h-4" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      )}

                      {parsedConfig.subtype === "checkboxes" && (
                        <div className="space-y-2">
                          {(parsedConfig.options || []).map((opt: string, oIdx: number) => (
                            <label key={oIdx} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                              <input type="checkbox" className="accent-indigo-600 w-4 h-4" />
                              {opt}
                            </label>
                          ))}
                        </div>
                      )}

                      {parsedConfig.subtype === "dropdown" && (
                        <select className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-600">
                          <option value="">Select an option...</option>
                          {(parsedConfig.options || []).map((opt: string, oIdx: number) => (
                            <option key={oIdx} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {task.taskType === "DATE" && (
                        <input type="date" className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-600" />
                      )}

                      {parsedConfig.subtype === "time" && (
                        <input type="time" className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-600" />
                      )}

                      {task.taskType === "SIGNATURE" && (
                        <div className="h-32 border border-gray-200 bg-white rounded-xl flex items-center justify-center text-xs text-gray-400 font-mono">
                          Digital Signature Canvas Pad
                        </div>
                      )}

                      {task.taskType === "DOCUMENT" && (
                        <div className="space-y-2">
                          <input
                            type="file"
                            ref={(el) => { fileInputRefs.current[`prev_${task.id}`] = el; }}
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                setPreviewFiles((prev) => ({ ...prev, [`prev_${task.id}`]: e.target.files![0].name }));
                              }
                            }}
                            className="hidden"
                          />
                          <div
                            onClick={() => fileInputRefs.current[`prev_${task.id}`]?.click()}
                            className="p-5 border border-dashed border-gray-300 bg-white hover:border-indigo-500 rounded-xl text-center text-xs text-gray-600 hover:text-indigo-600 cursor-pointer transition-all"
                          >
                            {previewFiles[`prev_${task.id}`] ? (
                              <span className="font-bold text-indigo-600">Attached File: {previewFiles[`prev_${task.id}`]}</span>
                            ) : (
                              "Click to select and upload file attachment"
                            )}
                          </div>
                        </div>
                      )}

                      {parsedConfig.subtype === "agreement" && (
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pt-1">
                          <input type="checkbox" className="accent-indigo-600 w-4 h-4" />
                          I confirm and agree to the above details
                        </label>
                      )}
                    </div>
                  );
                })}

                <button disabled className="w-full py-3 bg-emerald-600 text-white font-bold text-sm rounded-xl cursor-not-allowed opacity-75">
                  Submit Form (Preview Mode Only)
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-20 border border-dashed border-gray-300 rounded-2xl text-gray-400">
            No template selected. Create a new form template to get started.
          </div>
        )}
      </main>

      {/* New Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Create Onboarding Form</h2>
              <p className="text-xs text-gray-500 mt-1">Set title and default parameters</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Form Name *</label>
                <input
                  placeholder="e.g. Kitchen Staff Onboarding"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Description</label>
                <textarea
                  placeholder="Instructions for employee (optional)..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:bg-white focus:outline-none focus:border-indigo-600 resize-none"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 font-semibold cursor-pointer">
                <input type="checkbox" checked={createForm.isDefault} onChange={(e) => setCreateForm((f) => ({ ...f, isDefault: e.target.checked }))} className="accent-indigo-600 w-4 h-4" />
                Set as default template for new hires
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all cursor-pointer">Cancel</button>
              <button onClick={handleCreateTemplate} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-50">{submitting ? "Creating..." : "Create Form"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
