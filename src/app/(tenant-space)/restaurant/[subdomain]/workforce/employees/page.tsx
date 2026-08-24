"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";
import ModuleAccessGuard from "@/components/ModuleAccessGuard";

interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  name: string;
}

interface Outlet {
  id: string;
  name: string;
}

interface SearchableComboboxProps {
  label: string;
  placeholder?: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
  onAddNew?: (name: string) => Promise<string | void>;
  emptyOptionLabel?: string;
  isDark: boolean;
}

function SearchableCombobox({
  label,
  value,
  options,
  onChange,
  onAddNew,
  emptyOptionLabel = "None",
  isDark,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedItem = options.find((o) => o.id === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options;

  const exactMatch = options.some(
    (o) => o.name.toLowerCase() === query.trim().toLowerCase()
  );

  const handleSelect = (id: string) => {
    onChange(id);
    setQuery("");
    setIsOpen(false);
  };

  const handleCreateNew = async () => {
    if (!query.trim() || !onAddNew) return;
    setIsCreating(true);
    try {
      const newId = await onAddNew(query.trim());
      if (newId) {
        onChange(newId);
      }
      setQuery("");
      setIsOpen(false);
    } catch {
      // ignore
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
        {label}
      </label>

      <div className="relative">
        <input
          type="text"
          value={isOpen ? query : selectedItem ? selectedItem.name : ""}
          placeholder={selectedItem ? selectedItem.name : emptyOptionLabel}
          onFocus={() => {
            setIsOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          className={`w-full pl-3 pr-8 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
            isDark
              ? "bg-[#0A0C12] border-white/[0.08] text-white placeholder-[#8F95A3]"
              : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
          }`}
        />

        {/* Dropdown Chevron / Clear indicator */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setQuery("");
              }}
              className="hover:text-slate-600 dark:hover:text-white p-0.5 cursor-pointer text-[10px]"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Floating Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 max-h-56 overflow-y-auto rounded-2xl border shadow-xl p-1 text-xs space-y-0.5 ${
            isDark
              ? "bg-[#121622] border-white/[0.1] text-white shadow-2xl shadow-black/80"
              : "bg-white border-slate-200 text-slate-900 shadow-xl shadow-slate-900/10"
          }`}
        >
          {emptyOptionLabel && (
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={`w-full text-left px-3 py-2 rounded-xl transition flex items-center justify-between cursor-pointer ${
                !value
                  ? isDark
                    ? "bg-[#0071E3]/20 text-[#0071E3] font-semibold"
                    : "bg-blue-50 text-[#0071E3] font-semibold"
                  : isDark
                  ? "hover:bg-white/[0.06] text-[#8F95A3]"
                  : "hover:bg-slate-100 text-slate-600"
              }`}
            >
              <span>{emptyOptionLabel}</span>
              {!value && <span>✓</span>}
            </button>
          )}

          {filteredOptions.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className={`w-full text-left px-3 py-2 rounded-xl transition flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? isDark
                      ? "bg-[#0071E3] text-white font-semibold"
                      : "bg-[#0071E3] text-white font-semibold"
                    : isDark
                    ? "hover:bg-white/[0.06] text-white"
                    : "hover:bg-slate-100 text-slate-800"
                }`}
              >
                <span className="truncate">{opt.name}</span>
                {isSelected && <span>✓</span>}
              </button>
            );
          })}

          {filteredOptions.length === 0 && !query && (
            <div className={`p-3 text-center text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
              No options available
            </div>
          )}

          {/* Quick Create on Typing */}
          {query.trim() && !exactMatch && onAddNew && (
            <button
              type="button"
              disabled={isCreating}
              onClick={handleCreateNew}
              className={`w-full text-left px-3 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer font-medium ${
                isDark
                  ? "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30"
                  : "bg-blue-50 text-[#0071E3] hover:bg-blue-100 border border-blue-200"
              }`}
            >
              <span>+</span>
              <span>{isCreating ? "Creating..." : `Create "${query.trim()}"`}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  personalEmail: string | null;
  phone: string | null;
  workerType: string;
  weeklyHoursLimit?: number | null;
  joiningDate: string;
  archivedAt: string | null;
  employmentRecords: Array<{
    department?: Department | null;
    designation?: Designation | null;
    primaryOutlet?: Outlet | null;
  }>;
  outletAssignments: Array<{ outlet: Outlet }>;
  memberships: Array<{ id: string; user: { email: string } }>;
}

export default function AppleEmployeeDirectoryPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [selectedWorkerType, setSelectedWorkerType] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    personalEmail: "",
    phone: "",
    gender: "MALE",
    workerType: "FULL_TIME",
    weeklyHoursLimit: "",
    joiningDate: new Date().toISOString().split("T")[0],
    departmentId: "",
    designationId: "",
    primaryOutletId: "",
  });

  const workerTypeOptions = [
    { id: "FULL_TIME", name: "Full-Time (48h)" },
    { id: "PART_TIME", name: "Part-Time (20h)" },
    { id: "INTERN", name: "Intern (20h)" },
    { id: "TEMPORARY", name: "Temporary (25h)" },
    { id: "CONTRACT", name: "Contractor (40h)" },
    { id: "CUSTOM", name: "Custom Hours..." },
  ];

  const handleAddNewDepartment = async (name: string) => {
    try {
      const code = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "DEPT";
      const res = await fetch("/api/restaurant/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      const data = await res.json();
      if (res.ok && data.department) {
        setDepartments((prev) => [...prev, data.department]);
        return data.department.id;
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNewDesignation = async (name: string) => {
    try {
      const code = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "DESIG";
      const res = await fetch("/api/restaurant/designations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      const data = await res.json();
      if (res.ok && data.designation) {
        setDesignations((prev) => [...prev, data.designation]);
        return data.designation.id;
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFilters = async () => {
    try {
      const [resDepts, resOutlets, resDesigs] = await Promise.all([
        fetch("/api/restaurant/departments"),
        fetch("/api/restaurant/outlets"),
        fetch("/api/restaurant/designations"),
      ]);
      const dataDepts = await resDepts.json();
      const dataOutlets = await resOutlets.json();
      const dataDesigs = resDesigs.ok ? await resDesigs.json() : { designations: [] };
      if (resDepts.ok) setDepartments(dataDepts.departments || []);
      if (resOutlets.ok) setOutlets(dataOutlets.outlets || []);
      if (resDesigs.ok) setDesignations(dataDesigs.designations || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams();
      if (search) qParams.append("search", search);
      if (selectedDept) qParams.append("departmentId", selectedDept);
      if (selectedOutlet) qParams.append("outletId", selectedOutlet);

      const res = await fetch(`/api/restaurant/employees?${qParams.toString()}`);
      const data = await res.json();
      if (res.ok) setEmployees(data.employees || []);
      else setError(data.error || "Failed to load employees");
    } catch {
      setError("Network error loading employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, selectedDept, selectedOutlet]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        ...formData,
        workerType: formData.workerType === "CUSTOM" ? "FULL_TIME" : formData.workerType,
        weeklyHoursLimit: formData.workerType === "CUSTOM" && formData.weeklyHoursLimit ? Number(formData.weeklyHoursLimit) : undefined,
      };

      const res = await fetch("/api/restaurant/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add employee");

      setShowModal(false);
      setFormData({
        firstName: "",
        lastName: "",
        personalEmail: "",
        phone: "",
        gender: "MALE",
        workerType: "FULL_TIME",
        weeklyHoursLimit: "",
        joiningDate: new Date().toISOString().split("T")[0],
        departmentId: "",
        designationId: "",
        primaryOutletId: "",
      });
      fetchEmployees();
    } catch (err: any) {
      setError(err.message || "Error adding employee");
    } finally {
      setSaving(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (selectedWorkerType === "CUSTOM") {
      return !!emp.weeklyHoursLimit && emp.weeklyHoursLimit !== 48 && emp.weeklyHoursLimit !== 40 && emp.weeklyHoursLimit !== 20;
    }
    if (selectedWorkerType && emp.workerType !== selectedWorkerType) return false;
    return true;
  });

  const stats = {
    total: employees.length,
    fullTime: employees.filter(
      (e) => (e.workerType === "FULL_TIME" || !e.workerType) && (!e.weeklyHoursLimit || e.weeklyHoursLimit >= 40)
    ).length,
    partTime: employees.filter(
      (e) => e.workerType === "PART_TIME" || e.workerType === "INTERN" || (e.weeklyHoursLimit && e.weeklyHoursLimit < 40)
    ).length,
    outletsCount: outlets.length,
  };

  const getWorkerTypeBadge = (wt?: string, hoursLimit?: number | null) => {
    if (hoursLimit && hoursLimit !== 48 && hoursLimit !== 40 && hoursLimit !== 20) {
      return {
        label: `Custom (${hoursLimit}h)`,
        cls: isDark
          ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/25"
          : "bg-indigo-50 text-indigo-800 border-indigo-200",
      };
    }
    switch (wt) {
      case "PART_TIME":
        return {
          label: `Part-Time (${hoursLimit || 20}h)`,
          cls: isDark
            ? "bg-amber-500/15 text-amber-300 border-amber-500/25"
            : "bg-amber-50 text-amber-800 border-amber-200",
        };
      case "INTERN":
        return {
          label: `Intern (${hoursLimit || 20}h)`,
          cls: isDark
            ? "bg-purple-500/15 text-purple-300 border-purple-500/25"
            : "bg-purple-50 text-purple-800 border-purple-200",
        };
      case "TEMPORARY":
        return {
          label: `Temporary (${hoursLimit || 25}h)`,
          cls: isDark
            ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/25"
            : "bg-cyan-50 text-cyan-800 border-cyan-200",
        };
      case "CONTRACT":
      case "CONSULTANT":
        return {
          label: `Contract (${hoursLimit || 40}h)`,
          cls: isDark
            ? "bg-blue-500/15 text-blue-300 border-blue-500/25"
            : "bg-blue-50 text-blue-800 border-blue-200",
        };
      default:
        if (hoursLimit && hoursLimit < 40) {
          return {
            label: `Custom (${hoursLimit}h)`,
            cls: isDark
              ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/25"
              : "bg-indigo-50 text-indigo-800 border-indigo-200",
          };
        }
        return {
          label: `Full-Time (${hoursLimit || 48}h)`,
          cls: isDark
            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
            : "bg-emerald-50 text-emerald-800 border-emerald-200",
        };
    }
  };

  return (
    <ModuleAccessGuard moduleKey="hr_onboarding" moduleName="HR & Workforce Directory" activeSection="Workforce">
      <div
        className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
          isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
        }`}
      >
        <RestaurantNavbar activeSection="Workforce" />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Executive Header Banner */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm shadow-slate-900/5"
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Human Resources & Staff
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Employee Directory
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Manage staff profiles, worker classifications, and primary branch outlet assignments.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                setError("");
                setShowModal(true);
              }}
              className="px-4 py-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
            >
              + Add Employee
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Staff", value: stats.total, color: isDark ? "text-white" : "text-slate-900", sub: "Registered employees" },
            { label: "Full-Time", value: stats.fullTime, color: isDark ? "text-emerald-400" : "text-emerald-600", sub: "48h / week capacity" },
            { label: "Part-Time & Interns", value: stats.partTime, color: isDark ? "text-[#58A6FF]" : "text-blue-600", sub: "20h / week capacity" },
            { label: "Branch Outlets", value: stats.outletsCount, color: isDark ? "text-amber-300" : "text-amber-600", sub: "Operating locations" },
          ].map((stat, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border transition space-y-1 ${
                isDark
                  ? "bg-[#121622]/60 border-white/[0.06]"
                  : "bg-white border-slate-200/80 shadow-xs"
              }`}
            >
              <p className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                {stat.label}
              </p>
              <p className={`text-2xl font-bold tracking-tight ${stat.color}`}>
                {stat.value}
              </p>
              <p className={`text-[11px] ${isDark ? "text-[#6C7280]" : "text-slate-400"}`}>
                {stat.sub}
              </p>
            </div>
          ))}
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
            {error}
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div
          className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row items-center gap-3 ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-xs"
          }`}
        >
          <div className="flex-1 w-full">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, employee code, or email..."
              className={`w-full px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                isDark
                  ? "bg-[#0A0C12] border-white/[0.08] text-white placeholder-[#555C6D]"
                  : "bg-[#F5F5F7] border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className={`px-3 py-2 text-xs font-medium rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
              }`}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className={`px-3 py-2 text-xs font-medium rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
              }`}
            >
              <option value="">All Outlets</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>

            <select
              value={selectedWorkerType}
              onChange={(e) => setSelectedWorkerType(e.target.value)}
              className={`px-3 py-2 text-xs font-medium rounded-xl border transition focus:outline-none focus:border-[#0071E3] cursor-pointer ${
                isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
              }`}
            >
              <option value="">All Worker Types</option>
              <option value="FULL_TIME">Full-Time (48h)</option>
              <option value="PART_TIME">Part-Time (20h)</option>
              <option value="CUSTOM">Custom Hours</option>
              <option value="INTERN">Intern (20h)</option>
              <option value="TEMPORARY">Temporary (25h)</option>
              <option value="CONTRACT">Contract (40h)</option>
            </select>
          </div>
        </div>

        {/* Employees Table View */}
        <div
          className={`rounded-2xl sm:rounded-3xl border overflow-hidden transition shadow-xs ${
            isDark ? "bg-[#121622]/60 border-white/[0.06]" : "bg-white border-slate-200/80"
          }`}
        >
          {loading ? (
            <div className="py-16 text-center text-xs opacity-60">Loading staff members...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-16 text-center text-xs opacity-60 space-y-1">
              <p className="font-semibold text-sm">No employees found</p>
              <p>Click &quot;+ Add Employee&quot; to register a staff profile.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className={`border-b text-[11px] font-medium uppercase tracking-wider ${
                    isDark ? "bg-[#0A0C12]/50 border-white/[0.06] text-[#8F95A3]" : "bg-slate-50/70 border-slate-100 text-slate-500"
                  }`}>
                    <th className="p-4">Staff Member</th>
                    <th className="p-4">Worker Type</th>
                    <th className="p-4">Department & Role</th>
                    <th className="p-4">Primary Outlet</th>
                    <th className="p-4">App Access</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className={`divide-y text-xs ${isDark ? "divide-white/[0.04]" : "divide-slate-100"}`}>
                  {filteredEmployees.map((emp) => {
                    const currentRec = emp.employmentRecords[0];
                    const hasLogin = emp.memberships.length > 0;
                    const wtBadge = getWorkerTypeBadge(emp.workerType, emp.weeklyHoursLimit);

                    return (
                      <tr key={emp.id} className={`transition ${isDark ? "hover:bg-white/[0.01]" : "hover:bg-slate-50/50"}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#0071E3]/15 text-[#0071E3] flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {emp.firstName.charAt(0)}
                              {emp.lastName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                                {emp.firstName} {emp.lastName}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                  {emp.employeeCode}
                                </span>
                                {emp.personalEmail && (
                                  <>
                                    <span className={`text-[10px] ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
                                    <span className={`text-[10px] truncate ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                      {emp.personalEmail}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${wtBadge.cls}`}>
                            {wtBadge.label}
                          </span>
                        </td>

                        <td className="p-4">
                          <p className={`font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                            {currentRec?.department?.name || "Unassigned Dept"}
                          </p>
                          <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                            {currentRec?.designation?.name || "Staff Member"}
                          </p>
                        </td>

                        <td className="p-4">
                          <span className={`font-medium ${isDark ? "text-[#BAC0CD]" : "text-slate-700"}`}>
                            {currentRec?.primaryOutlet?.name || "All Outlets"}
                          </span>
                        </td>

                        <td className="p-4">
                          {hasLogin ? (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-100 text-emerald-800 border-emerald-200"
                            }`}>
                              Active User
                            </span>
                          ) : (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                              isDark ? "bg-white/[0.04] text-[#8F95A3] border-white/[0.08]" : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}>
                              Employee Profile
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() => router.push(`/restaurant/${subdomain}/workforce/employees/${emp.id}`)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                              isDark
                                ? "bg-white/[0.04] text-[#BAC0CD] hover:text-white hover:bg-white/[0.08] border-white/[0.08]"
                                : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-slate-200"
                            }`}
                          >
                            View Profile →
                          </button>
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

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#121622] border-white/[0.08] text-white" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Add New Employee</h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Register staff member details and branch assignment.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData((f) => ({ ...f, firstName: e.target.value }))}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData((f) => ({ ...f, lastName: e.target.value }))}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.personalEmail}
                    onChange={(e) => setFormData((f) => ({ ...f, personalEmail: e.target.value }))}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
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
                    value={formData.phone}
                    onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              {formData.workerType === "CUSTOM" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <SearchableCombobox
                      label="Worker Type *"
                      value={formData.workerType}
                      options={workerTypeOptions}
                      onChange={(val) => {
                        setFormData((f) => ({
                          ...f,
                          workerType: val,
                          weeklyHoursLimit: val === "CUSTOM" ? f.weeklyHoursLimit || "10" : "",
                        }));
                      }}
                      emptyOptionLabel="Select Type..."
                      isDark={isDark}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Custom Max Hours *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      step="0.5"
                      placeholder="e.g. 10 or 35"
                      value={formData.weeklyHoursLimit}
                      onChange={(e) => setFormData((f) => ({ ...f, weeklyHoursLimit: e.target.value }))}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Joining Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.joiningDate}
                      onChange={(e) => setFormData((f) => ({ ...f, joiningDate: e.target.value }))}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <SearchableCombobox
                      label="Worker Type *"
                      value={formData.workerType}
                      options={workerTypeOptions}
                      onChange={(val) => {
                        setFormData((f) => ({
                          ...f,
                          workerType: val,
                          weeklyHoursLimit: val === "CUSTOM" ? "10" : "",
                        }));
                      }}
                      emptyOptionLabel="Select Type..."
                      isDark={isDark}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                      Joining Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.joiningDate}
                      onChange={(e) => setFormData((f) => ({ ...f, joiningDate: e.target.value }))}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <SearchableCombobox
                    label="Department"
                    value={formData.departmentId}
                    options={departments.map((d) => ({ id: d.id, name: d.name }))}
                    onChange={(val) => setFormData((f) => ({ ...f, departmentId: val }))}
                    onAddNew={handleAddNewDepartment}
                    emptyOptionLabel="None / General"
                    isDark={isDark}
                  />
                </div>

                <div>
                  <SearchableCombobox
                    label="Designation"
                    value={formData.designationId}
                    options={designations.map((d) => ({ id: d.id, name: d.name }))}
                    onChange={(val) => setFormData((f) => ({ ...f, designationId: val }))}
                    onAddNew={handleAddNewDesignation}
                    emptyOptionLabel="None / Staff"
                    isDark={isDark}
                  />
                </div>

                <div>
                  <SearchableCombobox
                    label="Primary Outlet"
                    value={formData.primaryOutletId}
                    options={outlets.map((o) => ({ id: o.id, name: o.name }))}
                    onChange={(val) => setFormData((f) => ({ ...f, primaryOutletId: val }))}
                    emptyOptionLabel="All Outlets"
                    isDark={isDark}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  {saving ? "Adding..." : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ModuleAccessGuard>
  );
}
