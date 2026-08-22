"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
  status: string;
}

export default function AppleShiftTemplatesPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [color, setColor] = useState("#0071E3");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/restaurant/shifts/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setName("");
    setStartTime("09:00");
    setEndTime("17:00");
    setBreakMinutes(30);
    setColor("#0071E3");
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (t: ShiftTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setStartTime(t.startTime);
    setEndTime(t.endTime);
    setBreakMinutes(t.breakMinutes);
    setColor(t.color);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingTemplate
        ? `/api/restaurant/shifts/templates/${editingTemplate.id}`
        : "/api/restaurant/shifts/templates";
      const method = editingTemplate ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          startTime,
          endTime,
          breakMinutes: Number(breakMinutes),
          color,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save template");
      }

      setModalOpen(false);
      fetchTemplates();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const [confirmArchiveTemplate, setConfirmArchiveTemplate] = useState<ShiftTemplate | null>(null);
  const [archiving, setArchiving] = useState(false);

  const handleDelete = async () => {
    if (!confirmArchiveTemplate) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/restaurant/shifts/templates/${confirmArchiveTemplate.id}`, { method: "DELETE" });
      if (res.ok) {
        setConfirmArchiveTemplate(null);
        fetchTemplates();
      }
    } catch {
      // ignore
    } finally {
      setArchiving(false);
    }
  };

  const colorPresets = ["#0071E3", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#6366F1", "#14B8A6"];

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Shift Templates" />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/shifts`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← Shifts Overview
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Template Configuration
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Reusable Shift Templates
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Define standard operational time slots, break policies, and color identifiers for weekly scheduling.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium rounded-xl transition shadow-sm cursor-pointer"
          >
            + Create Shift Template
          </button>
        </div>

        {/* Templates Grid */}
        {loading ? (
          <div className={`text-center py-16 text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div
            className={`p-12 rounded-3xl border text-center space-y-2 ${
              isDark ? "bg-[#121622]/40 border-white/[0.06]" : "bg-white border-slate-200"
            }`}
          >
            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
              No shift templates configured
            </h3>
            <p className={`text-xs max-w-sm mx-auto ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Create templates like Morning Prep, Lunch Rush, or Dinner Service to speed up weekly staff scheduling.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className={`p-5 rounded-3xl border transition flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md ${
                  isDark
                    ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/[0.12]"
                    : "bg-white border-slate-200/80 hover:border-slate-300"
                }`}
                style={{ borderTopColor: tmpl.color, borderTopWidth: "4px" }}
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className={`text-sm font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                      {tmpl.name}
                    </h3>
                    <span
                      className="w-3 h-3 rounded-full shadow-xs"
                      style={{ backgroundColor: tmpl.color }}
                    />
                  </div>

                  <div className="space-y-1">
                    <p className={`text-lg font-bold font-mono ${isDark ? "text-white" : "text-slate-900"}`}>
                      {tmpl.startTime} - {tmpl.endTime}
                    </p>
                    <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      {tmpl.breakMinutes} min unpaid break
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.04] dark:border-white/[0.04]">
                  <button
                    onClick={() => openEditModal(tmpl)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      isDark ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmArchiveTemplate(tmpl)}
                    className="text-xs font-medium px-2.5 py-1 text-rose-500 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Template Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex justify-between items-center">
              <h2 className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                {editingTemplate ? "Edit Shift Template" : "New Shift Template"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Shift, Dinner Rush"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-white focus:border-[#0071E3]"
                      : "bg-[#F5F5F7] border-slate-200 text-slate-900 focus:border-[#0071E3]"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white focus:border-[#0071E3]"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900 focus:border-[#0071E3]"
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white focus:border-[#0071E3]"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900 focus:border-[#0071E3]"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Unpaid Break (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition ${
                    isDark
                      ? "bg-[#0A0C12] border-white/[0.08] text-white focus:border-[#0071E3]"
                      : "bg-[#F5F5F7] border-slate-200 text-slate-900 focus:border-[#0071E3]"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-2 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Badge Color
                </label>
                <div className="flex items-center gap-2">
                  {colorPresets.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition cursor-pointer ${
                        color === c ? "ring-2 ring-offset-2 ring-[#0071E3] scale-110" : "opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Template Modal */}
      {confirmArchiveTemplate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <h2 className={`text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  Archive Shift Template
                </h2>
                <p className={`text-xs leading-relaxed ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Are you sure you want to archive{" "}
                  <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    {confirmArchiveTemplate.name}
                  </span>
                  ? It will no longer appear when scheduling shifts.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                disabled={archiving}
                onClick={() => setConfirmArchiveTemplate(null)}
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
                disabled={archiving}
                onClick={handleDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {archiving ? "Archiving..." : "Archive Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
