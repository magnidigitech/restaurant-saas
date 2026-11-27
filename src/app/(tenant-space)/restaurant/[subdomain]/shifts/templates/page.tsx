"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";
import { ArrowLeft, Plus, Pencil, Trash2, Moon, Info } from "lucide-react";

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
  status: string;
}

function calcPaidDuration(start: string, end: string, breakMins: number): { hours: number; isOvernight: boolean } {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const isOvernight = end <= start;
  let gross = eh * 60 + em - (sh * 60 + sm);
  if (gross <= 0) gross += 24 * 60;
  const paid = Math.max(0, gross - breakMins);
  return { hours: Math.round((paid / 60) * 100) / 100, isOvernight };
}

export default function ShiftTemplatesPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);

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

    const preview = calcPaidDuration(startTime, endTime, Number(breakMinutes));
    if (preview.hours <= 0) {
      setError("Paid duration must be greater than 0 hours.");
      setSaving(false);
      return;
    }

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");
      setModalOpen(false);
      fetchTemplates();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/restaurant/shifts/templates/${id}`, { method: "DELETE" });
    if (res.ok) fetchTemplates();
  };

  return (
    <ModuleAccessGuard moduleKey="shifts" moduleName="Shift Templates">
      <div
        className={`min-h-screen font-sans antialiased flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Shifts & Scheduling" />

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={() => router.push(`/restaurant/${subdomain}/shifts`)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0071E3] mb-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Shift Operations</span>
              </button>
              <h1 className="text-xl font-bold tracking-tight">Shift Templates</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Info className="w-3.5 h-3.5 text-[#0071E3]" />
                <span>Updating a template only affects future assignments; existing scheduled shifts remain unchanged.</span>
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Template</span>
            </button>
          </div>

          <div
            className={`rounded-3xl border overflow-hidden ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200 shadow-xs"
            }`}
          >
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No shift templates configured yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.06] dark:border-white/[0.06] text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-4">Template</th>
                      <th className="py-3 px-4">Shift window</th>
                      <th className="py-3 px-4">Unpaid break</th>
                      <th className="py-3 px-4">Paid duration</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                    {templates.map((t) => {
                      const dur = calcPaidDuration(t.startTime, t.endTime, t.breakMinutes);
                      return (
                        <tr key={t.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                          <td className="py-3 px-4 font-semibold flex items-center gap-2.5">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: t.color }}
                            />
                            <span>{t.name}</span>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <span>
                              {t.startTime} – {t.endTime}
                            </span>
                            {dur.isOvernight && (
                              <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500">
                                <Moon className="w-2.5 h-2.5" />
                                Overnight
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono">{t.breakMinutes} min</td>
                          <td className="py-3 px-4 font-mono font-bold text-[#0071E3]">{dur.hours} hrs</td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(t)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0071E3] cursor-pointer"
                                title="Edit template"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(t.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                                title="Archive template"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <form
              onSubmit={handleSave}
              className={`w-full max-w-md rounded-3xl border p-6 space-y-4 ${
                isDark ? "bg-[#121622] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <h3 className="text-sm font-bold">{editingTemplate ? "Edit Template" : "Create Shift Template"}</h3>
              {error && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 text-xs">{error}</div>
              )}

              <div>
                <label className="block text-[11px] font-semibold mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dinner Rush, Overnight Close"
                  className="w-full px-3 py-2 text-xs rounded-xl border bg-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Start Time *</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">End Time *</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border bg-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Unpaid Break (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border bg-transparent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Color</label>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full h-9 rounded-xl border bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-500">
                Paid duration:{" "}
                <strong className="font-mono text-[#0071E3]">
                  {calcPaidDuration(startTime, endTime, Number(breakMinutes)).hours} hrs
                </strong>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#0071E3] text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ModuleAccessGuard>
  );
}
