"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

export default function AppleEmployeeDetailPage({
  params,
}: {
  params: Promise<{ subdomain: string; id: string }>;
}) {
  const router = useRouter();
  const { subdomain, id } = use(params);
  const { isDark } = useTheme();

  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "payroll" | "history" | "outlets" | "emergency" | "documents">("profile");
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);

  // Sub-modal states
  const [showModal, setShowModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit Capacity & Info form state
  const [editWorkerType, setEditWorkerType] = useState("FULL_TIME");
  const [editWeeklyHours, setEditWeeklyHours] = useState<string>("");
  const [editPhone, setEditPhone] = useState("");
  const [editPersonalEmail, setEditPersonalEmail] = useState("");

  // Form inputs for modals
  const [contactForm, setContactForm] = useState({ name: "", relationship: "Spouse", phone: "", address: "" });
  const [docForm, setDocForm] = useState({ type: "AADHAAR", documentNumber: "", fileUrl: "", issueDate: "", expiryDate: "" });

  const fetchEmployee = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurant/employees/${id}`);
      const data = await res.json();
      if (res.ok) {
        setEmployee(data.employee);
        if (data.employee.weeklyHoursLimit && data.employee.weeklyHoursLimit > 0) {
          setEditWorkerType("CUSTOM");
          setEditWeeklyHours(String(data.employee.weeklyHoursLimit));
        } else {
          setEditWorkerType(data.employee.workerType || "FULL_TIME");
          setEditWeeklyHours("");
        }
        setEditPhone(data.employee.phone || "");
        setEditPersonalEmail(data.employee.personalEmail || "");
      } else {
        setError(data.error || "Failed to load employee details");
      }
    } catch {
      setError("Network error loading employee");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchEmployee();
  }, [id]);

  const handleUpdateCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaveSuccess(false);

    try {
      const isCustom = editWorkerType === "CUSTOM";
      const parsedHours = isCustom && editWeeklyHours.trim() ? Number(editWeeklyHours) : null;
      const effectiveWorkerType = isCustom ? (employee?.workerType || "FULL_TIME") : editWorkerType;

      const res = await fetch(`/api/restaurant/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerType: effectiveWorkerType,
          weeklyHoursLimit: parsedHours,
          phone: editPhone || null,
          personalEmail: editPersonalEmail || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update employee details");

      setSaveSuccess(true);
      await fetchEmployee();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Error updating employee");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!employee) return;
    const isArchived = !!employee.archivedAt;
    if (!confirm(`Are you sure you want to ${isArchived ? "reactivate" : "archive"} ${employee.firstName}?`)) return;

    try {
      const res = await fetch(`/api/restaurant/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !isArchived }),
      });
      if (res.ok) fetchEmployee();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/restaurant/employees/${id}/emergency-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) {
        setShowModal(null);
        setContactForm({ name: "", relationship: "Spouse", phone: "", address: "" });
        fetchEmployee();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/restaurant/employees/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docForm),
      });
      if (res.ok) {
        setShowModal(null);
        setDocForm({ type: "AADHAAR", documentNumber: "", fileUrl: "", issueDate: "", expiryDate: "" });
        fetchEmployee();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <div className="w-8 h-8 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium">Loading Employee Profile...</p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div
        className={`min-h-screen flex flex-col font-sans antialiased ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Employees" />
        <main className="max-w-4xl mx-auto p-6 space-y-4">
          <button
            onClick={() => router.push(`/restaurant/${subdomain}/workforce/employees`)}
            className="text-xs text-[#0071E3] hover:underline cursor-pointer"
          >
            ← Back to Directory
          </button>
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
            {error || "Employee not found"}
          </div>
        </main>
      </div>
    );
  }

  const isArchived = !!employee.archivedAt;
  const currentRecord = employee.employmentRecords?.[0];

  const defaultHours =
    employee.workerType === "PART_TIME" || employee.workerType === "INTERN"
      ? 20
      : employee.workerType === "TEMPORARY"
      ? 25
      : employee.workerType === "CONTRACT" || employee.workerType === "CONSULTANT"
      ? 40
      : 48;

  const effectiveHours = employee.weeklyHoursLimit && employee.weeklyHoursLimit > 0
    ? employee.weeklyHoursLimit
    : defaultHours;

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Employees" />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push(`/restaurant/${subdomain}/workforce/employees`)}
            className={`inline-flex items-center gap-2 text-xs font-medium transition cursor-pointer px-3.5 py-1.5 rounded-xl border ${
              isDark
                ? "bg-white/[0.04] text-[#8F95A3] hover:text-white border-white/[0.06] hover:bg-white/[0.08]"
                : "bg-white text-slate-600 hover:text-slate-900 border-slate-200/80 hover:bg-slate-50 shadow-2xs"
            }`}
          >
            <span>←</span>
            <span>Back to Employee Directory</span>
          </button>
        </div>

        {/* Executive Profile Header Banner */}
        <div
          className={`p-5 sm:p-7 rounded-3xl border transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0071E3]/15 text-[#0071E3] flex items-center justify-center font-bold text-xl sm:text-2xl flex-shrink-0">
              {employee.firstName.charAt(0)}
              {employee.lastName.charAt(0)}
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                  isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
                }`}>
                  {employee.employeeCode}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                  employee.weeklyHoursLimit && employee.weeklyHoursLimit !== 48 && employee.weeklyHoursLimit !== 40 && employee.weeklyHoursLimit !== 20
                    ? isDark ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/25" : "bg-indigo-50 text-indigo-800 border-indigo-200"
                    : employee.workerType === "PART_TIME"
                    ? isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/25" : "bg-amber-50 text-amber-800 border-amber-200"
                    : isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}>
                  {employee.weeklyHoursLimit && employee.weeklyHoursLimit !== 48 && employee.weeklyHoursLimit !== 40 && employee.weeklyHoursLimit !== 20
                    ? `Custom (${employee.weeklyHoursLimit}h)`
                    : `${employee.workerType?.replace(/_/g, " ") || "FULL TIME"} (${effectiveHours}h)`}
                </span>
                {isArchived ? (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25">
                    Archived
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    Active
                  </span>
                )}
              </div>

              <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                {employee.firstName} {employee.lastName}
              </h1>

              <p className={`text-xs flex flex-wrap items-center gap-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                <span>Joined {new Date(employee.joiningDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                {currentRecord?.department && (
                  <>
                    <span>•</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{currentRecord.department.name}</span>
                  </>
                )}
                {currentRecord?.designation && (
                  <>
                    <span>•</span>
                    <span>{currentRecord.designation.name}</span>
                  </>
                )}
                {currentRecord?.primaryOutlet && (
                  <>
                    <span>•</span>
                    <span className="text-[#0071E3] font-medium">📍 {currentRecord.primaryOutlet.name}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleArchiveToggle}
              className={`w-full sm:w-auto px-4 py-2 text-xs font-medium rounded-xl border transition cursor-pointer text-center ${
                isArchived
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                  : "bg-rose-500/10 border-rose-500/25 text-rose-500 hover:bg-rose-500/20"
              }`}
            >
              {isArchived ? "Reactivate Staff" : "Archive Profile"}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          className={`p-1.5 rounded-2xl border transition flex items-center gap-1 overflow-x-auto no-scrollbar ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          {[
            { id: "profile", label: "Profile & Hours Capacity" },
            { id: "payroll", label: "Payrolls & Compensation", count: employee?.payslips?.length || 0 },
            { id: "history", label: "Employment History" },
            { id: "outlets", label: "Outlet Assignments" },
            { id: "emergency", label: "Emergency Contacts" },
            { id: "documents", label: "Documents" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex-shrink-0 flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-[#0071E3] text-white shadow-xs"
                  : isDark
                  ? "text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.id
                    ? "bg-white/20 text-white"
                    : isDark
                    ? "bg-white/[0.08] text-[#8F95A3]"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* TAB CONTENT: Profile & Custom Hours */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Capacity & Contact Editor */}
            <div className="lg:col-span-2 space-y-6">
              {/* Working Hours Capacity Card */}
              <div
                className={`p-6 rounded-3xl border transition space-y-4 ${
                  isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                      Working Hours Capacity Limit
                    </h2>
                    <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Configure the weekly maximum roster hours for this employee.
                    </p>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      isDark
                        ? "bg-[#0071E3]/15 text-[#58A6FF] border-[#0071E3]/25"
                        : "bg-blue-50 text-blue-800 border-blue-200"
                    }`}
                  >
                    Effective: {effectiveHours}h / week
                  </span>
                </div>

                {saveSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl">
                    Employee capacity limits & details updated successfully!
                  </div>
                )}

                <form onSubmit={handleUpdateCapacity} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        Worker Classification
                      </label>
                      <select
                        value={editWorkerType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditWorkerType(val);
                          if (val === "CUSTOM") {
                            setEditWeeklyHours((prev) => prev || "10");
                          } else {
                            setEditWeeklyHours("");
                          }
                        }}
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                          isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                        }`}
                      >
                        <option value="FULL_TIME">Full-Time (48h/wk default)</option>
                        <option value="PART_TIME">Part-Time (20h/wk default)</option>
                        <option value="INTERN">Intern (20h/wk default)</option>
                        <option value="TEMPORARY">Temporary (25h/wk default)</option>
                        <option value="CONTRACT">Contractor (40h/wk default)</option>
                        <option value="CUSTOM">Custom Hours Limit...</option>
                      </select>
                    </div>

                    {editWorkerType === "CUSTOM" && (
                      <div className="animate-in fade-in duration-150">
                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                          Custom Weekly Limit (Hours) *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="100"
                          step="0.5"
                          placeholder="e.g. 10 or 35"
                          value={editWeeklyHours}
                          onChange={(e) => setEditWeeklyHours(e.target.value)}
                          className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                            isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Preset quick buttons only when Custom is chosen */}
                  {editWorkerType === "CUSTOM" && (
                    <div className="space-y-1.5 animate-in fade-in duration-150">
                      <span className={`block text-[11px] font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Quick Capacity Presets:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[10, 15, 20, 25, 30, 35, 40].map((hrs) => (
                          <button
                            key={hrs}
                            type="button"
                            onClick={() => setEditWeeklyHours(String(hrs))}
                            className={`px-2.5 py-1 text-xs rounded-lg border transition cursor-pointer ${
                              editWeeklyHours === String(hrs)
                                ? "bg-[#0071E3] text-white border-[#0071E3]"
                                : isDark
                                ? "bg-[#0A0C12] text-[#8F95A3] border-white/[0.08] hover:text-white"
                                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            {hrs}h / wk
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={editPersonalEmail}
                        onChange={(e) => setEditPersonalEmail(e.target.value)}
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                          isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                          isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      {saving ? "Saving Changes..." : "Save Capacity & Details"}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Overview Card */}
            <div className="space-y-6">
              <div
                className={`p-6 rounded-3xl border transition space-y-4 ${
                  isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                }`}
              >
                <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Employment Summary
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className={`block text-[10px] uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      Department
                    </span>
                    <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {currentRecord?.department?.name || "Unassigned"}
                    </span>
                  </div>

                  <div>
                    <span className={`block text-[10px] uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      Designation / Role
                    </span>
                    <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {currentRecord?.designation?.name || "Staff Member"}
                    </span>
                  </div>

                  <div>
                    <span className={`block text-[10px] uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      Primary Branch Outlet
                    </span>
                    <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {currentRecord?.primaryOutlet?.name || "All Outlets"}
                    </span>
                  </div>

                  <div>
                    <span className={`block text-[10px] uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      Shift Schedule Capacity
                    </span>
                    <span className="font-semibold text-[#0071E3]">
                      Max {effectiveHours} hours / week
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: Payrolls & Compensation */}
        {activeTab === "payroll" && (() => {
          const payslips: any[] = employee?.payslips || [];
          const salaryStructure = employee?.salaryStructures?.[0] || null;
          const totalLifetimeNet = payslips.reduce((sum, p) => sum + (Number(p.netPay) || 0), 0);
          const totalLifetimeHours = payslips.reduce((sum, p) => sum + (Number(p.hoursWorked) || 0) + (Number(p.overtimeHours) || 0), 0);

          return (
            <div className="space-y-6">
              {/* Top Stat Metrics Ribbon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  className={`p-5 rounded-2xl border transition ${
                    isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                  }`}
                >
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Lifetime Net Paid
                  </span>
                  <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                    ${totalLifetimeNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Across all finalized pay cycles
                  </p>
                </div>

                <div
                  className={`p-5 rounded-2xl border transition ${
                    isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                  }`}
                >
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Total Tracked Hours
                  </span>
                  <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                    {totalLifetimeHours.toFixed(1)} hrs
                  </p>
                  <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Attendance & overtime hours
                  </p>
                </div>

                <div
                  className={`p-5 rounded-2xl border transition ${
                    isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                  }`}
                >
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Active Wage Rate
                  </span>
                  <p className="text-2xl font-bold tracking-tight mt-1.5 text-[#0071E3]">
                    {salaryStructure?.hourlyRate && Number(salaryStructure.hourlyRate) > 0
                      ? `$${Number(salaryStructure.hourlyRate).toFixed(2)}/hr`
                      : salaryStructure?.baseSalary && Number(salaryStructure.baseSalary) > 0
                      ? `$${Number(salaryStructure.baseSalary).toLocaleString()}/mo`
                      : employee?.hourlyRate
                      ? `$${Number(employee.hourlyRate).toFixed(2)}/hr`
                      : "$15.00/hr"}
                  </p>
                  <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    {employee?.workerType || "FULL_TIME"} • Attendance Pro-rated
                  </p>
                </div>

                <div
                  className={`p-5 rounded-2xl border transition ${
                    isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                  }`}
                >
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Pay Cycle Records
                  </span>
                  <p className={`text-2xl font-bold tracking-tight mt-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                    {payslips.length}
                  </p>
                  <p className={`text-[11px] mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Generated payslips on record
                  </p>
                </div>
              </div>

              {/* Past Payroll Runs & Payslips Table */}
              <div
                className={`rounded-3xl border overflow-hidden transition ${
                  isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
                }`}
              >
                <div className="p-6 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                      Payroll History & Generated Payslips
                    </h3>
                    <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Complete ledger of all pay runs and compensation distributions processed for {employee.firstName} {employee.lastName}.
                    </p>
                  </div>

                  <button
                    onClick={() => router.push(`/restaurant/${subdomain}/payroll/runs`)}
                    className="px-3.5 py-1.5 bg-[#0071E3]/10 hover:bg-[#0071E3]/20 text-[#0071E3] dark:text-[#64B5FF] text-xs font-semibold rounded-xl border border-[#0071E3]/20 transition flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                  >
                    <span>Go to Pay Cycles</span>
                    <span>→</span>
                  </button>
                </div>

                {payslips.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#0071E3] flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      No Payroll History Found
                    </h4>
                    <p className={`text-xs max-w-sm mx-auto ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      This employee has not been processed in any finalized pay runs yet. Once a pay cycle is initiated and calculated, their payslip statements will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className={`border-b text-[11px] font-semibold uppercase tracking-wider ${
                          isDark ? "bg-white/[0.02] border-white/[0.06] text-[#8F95A3]" : "bg-slate-50 border-slate-200 text-slate-500"
                        }`}>
                          <th className="py-3.5 px-6">Pay Run / Period</th>
                          <th className="py-3.5 px-4">Hours Logged</th>
                          <th className="py-3.5 px-4 text-right">Base Pay</th>
                          <th className="py-3.5 px-4 text-right">Allowances</th>
                          <th className="py-3.5 px-4 text-right">Deductions</th>
                          <th className="py-3.5 px-4 text-right">Net Payout</th>
                          <th className="py-3.5 px-4 text-center">Status</th>
                          <th className="py-3.5 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {payslips.map((p) => {
                          const startDate = p.periodStart ? new Date(p.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A";
                          const endDate = p.periodEnd ? new Date(p.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A";
                          const runTitle = p.payrollRun?.title || p.payrollRun?.name || "Standard Pay Cycle";
                          const totalHours = Number(p.hoursWorked) || 0;
                          const otHours = Number(p.overtimeHours) || 0;
                          const net = Number(p.netPay) || 0;

                          return (
                            <tr
                              key={p.id}
                              className={`transition ${isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50/80"}`}
                            >
                              <td className="py-4 px-6">
                                <div className="font-semibold text-sm">
                                  <span className={isDark ? "text-white" : "text-slate-900"}>{runTitle}</span>
                                </div>
                                <span className={`text-[11px] font-mono mt-0.5 block ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                                  {startDate} – {endDate}
                                </span>
                              </td>

                              <td className="py-4 px-4">
                                <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                                  {totalHours.toFixed(1)} hrs
                                </span>
                                {otHours > 0 && (
                                  <span className="block text-[10px] text-amber-500 font-medium">
                                    +{otHours.toFixed(1)}h Overtime
                                  </span>
                                )}
                              </td>

                              <td className={`py-4 px-4 text-right font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                                ${(Number(p.basePay) || 0).toFixed(2)}
                              </td>

                              <td className="py-4 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                +${((Number(p.totalAllowances) || 0) + (Number(p.pooledTipsAmount) || 0)).toFixed(2)}
                              </td>

                              <td className="py-4 px-4 text-right font-medium text-rose-500">
                                -${(Number(p.totalDeductions) || 0).toFixed(2)}
                              </td>

                              <td className="py-4 px-4 text-right">
                                <span className="text-sm font-bold text-[#0071E3] dark:text-[#64B5FF]">
                                  ${net.toFixed(2)}
                                </span>
                              </td>

                              <td className="py-4 px-4 text-center">
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                    p.status === "PAID"
                                      ? isDark
                                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : p.status === "GENERATED" || p.status === "APPROVED"
                                      ? isDark
                                        ? "bg-[#0071E3]/15 text-[#64B5FF] border-[#0071E3]/25"
                                        : "bg-blue-50 text-[#0071E3] border-blue-200"
                                      : isDark
                                      ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </td>

                              <td className="py-4 px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setSelectedPayslip(p)}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#0071E3] hover:bg-[#0077ED] text-white transition shadow-xs cursor-pointer"
                                  >
                                    Payslip
                                  </button>
                                  {p.payrollRunId && (
                                    <button
                                      onClick={() => router.push(`/restaurant/${subdomain}/payroll/runs/${p.payrollRunId}`)}
                                      title="Open Full Pay Run Detail"
                                      className={`p-1 rounded-lg border transition cursor-pointer ${
                                        isDark
                                          ? "border-white/[0.08] text-[#8F95A3] hover:text-white hover:bg-white/[0.04]"
                                          : "border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                      }`}
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </button>
                                  )}
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
            </div>
          );
        })()}

        {/* TAB CONTENT: Employment History */}
        {activeTab === "history" && (
          <div
            className={`p-6 rounded-3xl border transition space-y-4 ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Employment History & Role Records
            </h3>

            {employee.employmentRecords?.length === 0 ? (
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                No employment records logged.
              </p>
            ) : (
              <div className="space-y-3">
                {employee.employmentRecords.map((rec: any) => (
                  <div
                    key={rec.id}
                    className={`p-4 rounded-2xl border transition flex items-center justify-between ${
                      isDark ? "bg-[#0A0C12]/50 border-white/[0.06]" : "bg-slate-50 border-slate-200/80"
                    }`}
                  >
                    <div>
                      <p className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {rec.designation?.name || "Staff Member"} — {rec.department?.name || "General"}
                      </p>
                      <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Effective from {new Date(rec.effectiveFrom).toLocaleDateString()}
                        {rec.primaryOutlet && ` • ${rec.primaryOutlet.name}`}
                      </p>
                    </div>

                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      rec.status === "ACTIVE"
                        ? isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>
                      {rec.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: Outlet Assignments */}
        {activeTab === "outlets" && (
          <div
            className={`p-6 rounded-3xl border transition space-y-4 ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Assigned Branch Outlets
            </h3>

            {employee.outletAssignments?.length === 0 ? (
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                No specific branch assignments. (Eligible for all outlets).
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {employee.outletAssignments.map((oa: any) => (
                  <div
                    key={oa.id || oa.outlet.id}
                    className={`p-4 rounded-2xl border transition ${
                      isDark ? "bg-[#0A0C12]/50 border-white/[0.06]" : "bg-slate-50 border-slate-200/80"
                    }`}
                  >
                    <p className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {oa.outlet.name}
                    </p>
                    <p className={`text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Active Outlet Access
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: Emergency Contacts */}
        {activeTab === "emergency" && (
          <div
            className={`p-6 rounded-3xl border transition space-y-4 ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <div className="flex justify-between items-center">
              <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Emergency Contacts
              </h3>
              <button
                onClick={() => setShowModal("contact")}
                className="px-3 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                + Add Contact
              </button>
            </div>

            {employee.emergencyContacts?.length === 0 ? (
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                No emergency contacts on file.
              </p>
            ) : (
              <div className="space-y-3">
                {employee.emergencyContacts.map((c: any) => (
                  <div
                    key={c.id}
                    className={`p-4 rounded-2xl border transition flex items-center justify-between ${
                      isDark ? "bg-[#0A0C12]/50 border-white/[0.06]" : "bg-slate-50 border-slate-200/80"
                    }`}
                  >
                    <div>
                      <p className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {c.name} ({c.relationship})
                      </p>
                      <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Phone: {c.phone} {c.address && `• Address: ${c.address}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: Documents */}
        {activeTab === "documents" && (
          <div
            className={`p-6 rounded-3xl border transition space-y-4 ${
              isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80 shadow-xs"
            }`}
          >
            <div className="flex justify-between items-center">
              <h3 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Employee Documents
              </h3>
              <button
                onClick={() => setShowModal("document")}
                className="px-3 py-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                + Add Document
              </button>
            </div>

            {employee.documents?.length === 0 ? (
              <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                No verification documents uploaded.
              </p>
            ) : (
              <div className="space-y-3">
                {employee.documents.map((d: any) => (
                  <div
                    key={d.id}
                    className={`p-4 rounded-2xl border transition flex items-center justify-between ${
                      isDark ? "bg-[#0A0C12]/50 border-white/[0.06]" : "bg-slate-50 border-slate-200/80"
                    }`}
                  >
                    <div>
                      <p className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {d.type.replace(/_/g, " ")} — {d.documentNumber || "No ID Number"}
                      </p>
                      <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                        Uploaded {new Date(d.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Contact Modal */}
      {showModal === "contact" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold">Add Emergency Contact</h2>
              <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Contact Name *
                </label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Relationship *
                </label>
                <select
                  value={contactForm.relationship}
                  onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Child">Child</option>
                  <option value="Friend">Friend</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl"
                >
                  {saving ? "Adding..." : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Document Modal */}
      {showModal === "document" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold">Add Verification Document</h2>
              <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Document Type *
                </label>
                <select
                  value={docForm.type}
                  onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="AADHAAR">National ID / Aadhaar</option>
                  <option value="PAN">Tax ID / PAN</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENSE">Driver's License</option>
                  <option value="OTHER">Other Compliance Doc</option>
                </select>
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Document Number / Reference
                </label>
                <input
                  type="text"
                  value={docForm.documentNumber}
                  onChange={(e) => setDocForm({ ...docForm, documentNumber: e.target.value })}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border transition ${
                    isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium ${
                    isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl"
                >
                  {saving ? "Saving..." : "Save Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payslip Statement Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-xl p-6 rounded-3xl border shadow-2xl space-y-6 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    selectedPayslip.status === "PAID"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                      : "bg-blue-500/15 text-blue-400 border-blue-500/25"
                  }`}>
                    {selectedPayslip.status}
                  </span>
                  <span className={`text-xs font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                    Ref #{selectedPayslip.id.substring(0, 8).toUpperCase()}
                  </span>
                </div>
                <h2 className="text-lg font-bold mt-1">
                  Payslip Statement
                </h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {selectedPayslip.payrollRun?.title || selectedPayslip.payrollRun?.name || "Pay Cycle"} • {employee.firstName} {employee.lastName} ({employee.employeeCode})
                </p>
              </div>

              <button
                onClick={() => setSelectedPayslip(null)}
                className={`p-1.5 rounded-xl border transition cursor-pointer ${
                  isDark ? "border-white/[0.08] text-[#8F95A3] hover:text-white" : "border-slate-200 text-slate-500 hover:text-slate-900"
                }`}
              >
                ✕
              </button>
            </div>

            {/* Attendance & Hours Summary Banner */}
            <div className={`p-4 rounded-2xl border grid grid-cols-3 gap-3 text-center ${
              isDark ? "bg-[#0A0C12]/50 border-white/[0.06]" : "bg-slate-50 border-slate-200"
            }`}>
              <div>
                <span className={`text-[10px] uppercase font-medium block ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Period Dates
                </span>
                <span className="text-xs font-semibold mt-0.5 block">
                  {selectedPayslip.periodStart ? new Date(selectedPayslip.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A"} – {selectedPayslip.periodEnd ? new Date(selectedPayslip.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                </span>
              </div>
              <div>
                <span className={`text-[10px] uppercase font-medium block ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Regular Hours
                </span>
                <span className="text-xs font-semibold mt-0.5 block">
                  {Number(selectedPayslip.hoursWorked || 0).toFixed(1)} hrs
                </span>
              </div>
              <div>
                <span className={`text-[10px] uppercase font-medium block ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Overtime Hours
                </span>
                <span className="text-xs font-semibold mt-0.5 block text-amber-500">
                  {Number(selectedPayslip.overtimeHours || 0).toFixed(1)} hrs
                </span>
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="space-y-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Earnings & Additions
              </span>
              <div className={`p-3 rounded-2xl border space-y-2 text-xs ${
                isDark ? "bg-[#0A0C12]/30 border-white/[0.06]" : "bg-slate-50/50 border-slate-200"
              }`}>
                <div className="flex justify-between items-center">
                  <span>Base Attendance Pay</span>
                  <span className="font-semibold">${(Number(selectedPayslip.basePay) || 0).toFixed(2)}</span>
                </div>
                {Number(selectedPayslip.pooledTipsAmount) > 0 && (
                  <div className="flex justify-between items-center text-emerald-500">
                    <span>Pooled Staff Tips</span>
                    <span className="font-semibold">+${Number(selectedPayslip.pooledTipsAmount).toFixed(2)}</span>
                  </div>
                )}
                {selectedPayslip.earnings?.map((e: any) => (
                  <div key={e.id} className="flex justify-between items-center text-emerald-500">
                    <span>{e.name}</span>
                    <span className="font-semibold">+${Number(e.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="space-y-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Deductions & Withholdings
              </span>
              <div className={`p-3 rounded-2xl border space-y-2 text-xs ${
                isDark ? "bg-[#0A0C12]/30 border-white/[0.06]" : "bg-slate-50/50 border-slate-200"
              }`}>
                {Number(selectedPayslip.totalDeductions) === 0 && (!selectedPayslip.deductions || selectedPayslip.deductions.length === 0) ? (
                  <div className={`text-center py-1 ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                    No deductions applied for this cycle.
                  </div>
                ) : (
                  <>
                    {selectedPayslip.deductions?.map((d: any) => (
                      <div key={d.id} className="flex justify-between items-center text-rose-500">
                        <span>{d.name}</span>
                        <span className="font-semibold">-${Number(d.amount).toFixed(2)}</span>
                      </div>
                    ))}
                    {(!selectedPayslip.deductions || selectedPayslip.deductions.length === 0) && Number(selectedPayslip.totalDeductions) > 0 && (
                      <div className="flex justify-between items-center text-rose-500">
                        <span>Standard Deductions</span>
                        <span className="font-semibold">-${Number(selectedPayslip.totalDeductions).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Total Net Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              isDark ? "bg-[#0071E3]/15 border-[#0071E3]/30" : "bg-blue-50 border-blue-200"
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#0071E3] dark:text-[#64B5FF] block">
                  Net Salary Payout
                </span>
                <span className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                  Direct Bank Transfer / Paycheck
                </span>
              </div>
              <span className="text-2xl font-bold text-[#0071E3] dark:text-white">
                ${(Number(selectedPayslip.netPay) || 0).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                className="px-5 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
