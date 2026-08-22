"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface MasterDataItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
}

type TabType = "departments" | "designations";

const DEPARTMENT_PRESETS = [
  { name: "Kitchen & Culinary (BOH)", code: "KITCHEN", desc: "Food prep, cooking line, stock handling & stewarding" },
  { name: "Front of House (FOH)", code: "FOH", desc: "Dining room service, table hosting & guest experience" },
  { name: "Bar & Beverage", code: "BAR", desc: "Cocktail mixology, wine cellar & beverage inventory" },
  { name: "Management & Operations", code: "MGMT", desc: "Store supervision, roster scheduling & cash audits" },
  { name: "Billing & Delivery", code: "BILLING", desc: "Cashier counters, POS settlement & takeout orders" },
  { name: "Pastry & Bakery", code: "BAKERY", desc: "Desserts, bread crafting & confectionery station" },
];

const DESIGNATION_PRESETS = [
  { name: "Executive Chef", code: "EXEC-CHEF", desc: "Kitchen leadership, menu formulation & food costing" },
  { name: "Sous Chef", code: "SOUS-CHEF", desc: "Kitchen line supervision & prep checklists" },
  { name: "Line Cook", code: "LINE-COOK", desc: "Station cooking across grill, sauté, fryer & pantry" },
  { name: "Bartender", code: "BARTENDER", desc: "Crafting drinks, draft beer & bar stock management" },
  { name: "Lead Server / Waiter", code: "SERVER", desc: "Table orders, food delivery & guest checkout" },
  { name: "Cashier / Host", code: "CASHIER", desc: "Reservations, guest reception & billing desk" },
  { name: "Shift Supervisor", code: "SUPERVISOR", desc: "Floor coordination, shift handovers & approvals" },
  { name: "General Manager", code: "GM", desc: "Full operations, staff payroll & P&L oversight" },
];

export default function MasterDataPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const router = useRouter();
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>("departments");
  const [departmentsList, setDepartmentsList] = useState<MasterDataItem[]>([]);
  const [designationsList, setDesignationsList] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterDataItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [descInput, setDescInput] = useState("");
  const [statusInput, setStatusInput] = useState("ACTIVE");

  const fetchAllData = async () => {
    setLoading(true);
    setError("");
    try {
      const [deptRes, desRes] = await Promise.all([
        fetch("/api/restaurant/departments"),
        fetch("/api/restaurant/designations"),
      ]);

      const deptData = deptRes.ok ? await deptRes.json() : {};
      const desData = desRes.ok ? await desRes.json() : {};

      setDepartmentsList(deptData.departments || []);
      setDesignationsList(desData.designations || []);
    } catch {
      setError("Network error loading master data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleSeedPresets = async () => {
    setSeeding(true);
    setSeedSuccess(null);
    setError("");
    try {
      const res = await fetch("/api/restaurant/master-data/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize presets");
      setSeedSuccess(data.message || "Standard restaurant departments & roles initialized.");
      fetchAllData();
    } catch (err: any) {
      setError(err.message || "Error seeding presets");
    } finally {
      setSeeding(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setNameInput("");
    setCodeInput("");
    setDescInput("");
    setStatusInput("ACTIVE");
    setShowModal(true);
  };

  const handleOpenEdit = (item: MasterDataItem) => {
    setEditingItem(item);
    setNameInput(item.name);
    setCodeInput(item.code);
    setDescInput(item.description || "");
    setStatusInput(item.status);
    setShowModal(true);
  };

  const handleApplyPreset = (preset: { name: string; code: string; desc: string }) => {
    setNameInput(preset.name);
    setCodeInput(preset.code);
    setDescInput(preset.desc);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const method = editingItem ? "PATCH" : "POST";
      const payload: any = {
        name: nameInput,
        code: codeInput,
        description: descInput || null,
        status: statusInput,
      };
      if (editingItem) payload.id = editingItem.id;

      const res = await fetch(`/api/restaurant/${activeTab}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to save record");

      setShowModal(false);
      fetchAllData();
    } catch (err: any) {
      setError(err.message || "Error saving record");
    } finally {
      setSaving(false);
    }
  };

  const currentList = activeTab === "departments" ? departmentsList : designationsList;

  const filteredData = currentList.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const tabs: { key: TabType; label: string; count: number; desc: string }[] = [
    {
      key: "departments",
      label: "Departments & Stations",
      count: departmentsList.length,
      desc: "Kitchen, FOH, Bar & Operational Zones",
    },
    {
      key: "designations",
      label: "Designations & Staff Roles",
      count: designationsList.length,
      desc: "Chefs, Bartenders, Servers, Cashiers & Managers",
    },
  ];

  if (loading && departmentsList.length === 0 && designationsList.length === 0) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
          }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Operational Master Data...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
    >
      <RestaurantNavbar activeSection="Master Data" />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Executive Header Banner */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isDark
            ? "bg-[#121622]/60 border-white/[0.06]"
            : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
            }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/restaurant/${subdomain}/dashboard`)}
                className={`text-xs font-medium transition cursor-pointer ${isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                  }`}
              >
                ← Dashboard
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Administration Hub
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Organizational Master Data
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Manage standardized departments, kitchen stations, and staff designations used across rosters, attendance & payroll.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {departmentsList.length === 0 && designationsList.length === 0 && (
              <button
                onClick={handleSeedPresets}
                disabled={seeding}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className={`w-3.5 h-3.5 ${seeding ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>{seeding ? "Initializing..." : "Auto-Seed Restaurant Presets"}</span>
              </button>
            )}

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Add {activeTab === "departments" ? "Department" : "Designation"}</span>
            </button>
          </div>
        </div>

        {/* Success / Error Alerts */}
        {seedSuccess && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between text-xs transition animate-in fade-in ${isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{seedSuccess}</span>
            </div>
            <button onClick={() => setSeedSuccess(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-2xl">
            {error}
          </div>
        )}

        {/* Operational Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setActiveTab("departments")}
            className={`p-5 rounded-3xl border transition cursor-pointer flex items-center justify-between ${activeTab === "departments"
              ? isDark
                ? "bg-[#0071E3]/15 border-[#0071E3]/40"
                : "bg-blue-50/70 border-blue-200"
              : isDark
                ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/10"
                : "bg-white border-slate-200/80 hover:border-slate-300"
              }`}
          >
            <div className="space-y-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Operational Departments
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {departmentsList.length}
                </span>
                <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>stations configured</span>
              </div>
            </div>
          </div>

          <div
            onClick={() => setActiveTab("designations")}
            className={`p-5 rounded-3xl border transition cursor-pointer flex items-center justify-between ${activeTab === "designations"
              ? isDark
                ? "bg-[#0071E3]/15 border-[#0071E3]/40"
                : "bg-blue-50/70 border-blue-200"
              : isDark
                ? "bg-[#121622]/60 border-white/[0.06] hover:border-white/10"
                : "bg-white border-slate-200/80 hover:border-slate-300"
              }`}
          >
            <div className="space-y-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Staff Designations & Roles
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {designationsList.length}
                </span>
                <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>job titles active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Selector & Search Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div
            className={`p-1.5 rounded-2xl border transition flex items-center gap-1 ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
              }`}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchQuery("");
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${activeTab === tab.key
                  ? "bg-[#0071E3] text-white shadow-xs"
                  : isDark
                    ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : isDark
                      ? "bg-white/[0.06] text-[#8F95A3]"
                      : "bg-slate-200 text-slate-700"
                    }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="text"
              placeholder={`Search ${activeTab === "departments" ? "departments" : "roles"}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-8 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#121622]/60 border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
                }`}
            />
            <svg
              className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Master Data Table */}
        <div
          className={`p-6 rounded-3xl border transition space-y-4 ${isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
        >
          {filteredData.length === 0 ? (
            <div className={`p-12 text-center text-xs space-y-3 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto text-xl">
                📋
              </div>
              <div>
                <p className="font-semibold text-sm">No {activeTab} configured yet</p>
                <p className="opacity-75 max-w-sm mx-auto mt-1">
                  Click &quot;Auto-Seed Restaurant Presets&quot; to initialize with standard culinary and service divisions, or create a custom entry.
                </p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  onClick={handleSeedPresets}
                  disabled={seeding}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  ⚡ Auto-Seed Presets
                </button>
                <button
                  onClick={handleOpenAdd}
                  className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  + Add Custom {activeTab === "departments" ? "Department" : "Designation"}
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className={`border-b text-[11px] font-semibold uppercase tracking-wider ${isDark ? "border-white/[0.06] text-[#8F95A3]" : "border-slate-200 text-slate-500"
                      }`}
                  >
                    <th className="pb-3 px-3">Identifier Code</th>
                    <th className="pb-3 px-3">{activeTab === "departments" ? "Department Name" : "Designation Title"}</th>
                    <th className="pb-3 px-3">Scope / Description</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
                      <td className="py-3.5 px-3">
                        <span
                          className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${isDark
                            ? "bg-white/[0.04] text-[#BAC0CD] border-white/[0.08]"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                        >
                          {item.code}
                        </span>
                      </td>
                      <td className={`py-3.5 px-3 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {item.name}
                      </td>
                      <td className={`py-3.5 px-3 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        {item.description || "—"}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${item.status === "ACTIVE"
                            ? isDark
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                              : "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : isDark
                              ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="text-xs text-[#0071E3] hover:underline cursor-pointer font-semibold"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Master Data Modal with Quick Preset Chips */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 ${isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
              }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">
                  {editingItem ? "Edit" : "Add"} {activeTab === "departments" ? "Department" : "Designation"}
                </h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Define standardized organizational units for staff assignments.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            {!editingItem && (
              <div className="space-y-1.5 pt-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                  Quick Select Common Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(activeTab === "departments" ? DEPARTMENT_PRESETS : DESIGNATION_PRESETS).map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${nameInput === p.name
                        ? "bg-[#0071E3] text-white border-[#0071E3]"
                        : isDark
                          ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08] hover:text-white hover:bg-white/[0.08]"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                        }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 pt-2">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  {activeTab === "departments" ? "Department Name" : "Designation Title"} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeTab === "departments" ? "e.g. Kitchen & Culinary" : "e.g. Executive Chef"}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Identifier Code (Uppercase) *
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeTab === "departments" ? "e.g. KITCHEN" : "e.g. CHEF"}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  className={`w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Operational Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Primary duties, stations & reporting scope..."
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Status
                </label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingItem ? "Update Record" : "Create Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

