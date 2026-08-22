"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  workerType: string;
}

interface SalaryStructure {
  id: string;
  employeeId: string;
  payFrequency: string;
  currency: string;
  baseSalary: string;
  hourlyRate: string;
  allowancesJson?: string;
  deductionsJson?: string;
  employee: Employee;
}

interface LineItem {
  name: string;
  amount: number;
  isPercentage: boolean;
  type?: string;
}

export default function AppleSalaryStructuresPage() {
  const router = useRouter();
  const params = useParams();
  const subdomain = (params?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer / Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [payFrequency, setPayFrequency] = useState("MONTHLY");
  const [currency, setCurrency] = useState("USD");
  const [baseSalary, setBaseSalary] = useState(3000);
  const [hourlyRate, setHourlyRate] = useState(20);
  const [allowances, setAllowances] = useState<LineItem[]>([]);
  const [deductions, setDeductions] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [resEmployees, resStructures] = await Promise.all([
        fetch("/api/restaurant/employees"),
        fetch("/api/restaurant/payroll/salary-structures"),
      ]);

      const employeesData = resEmployees.ok ? (await resEmployees.json()).employees || [] : [];
      const structuresData = resStructures.ok ? (await resStructures.json()).structures || [] : [];

      setEmployees(employeesData);
      setStructures(structuresData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openConfigModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    const existing = structures.find((s) => s.employeeId === emp.id);

    if (existing) {
      setPayFrequency(existing.payFrequency || "MONTHLY");
      setCurrency(existing.currency || "USD");
      setBaseSalary(Number(existing.baseSalary) || 0);
      setHourlyRate(Number(existing.hourlyRate) || 0);
      try {
        setAllowances(existing.allowancesJson ? JSON.parse(existing.allowancesJson) : []);
      } catch {
        setAllowances([]);
      }
      try {
        setDeductions(existing.deductionsJson ? JSON.parse(existing.deductionsJson) : []);
      } catch {
        setDeductions([]);
      }
    } else {
      setPayFrequency("MONTHLY");
      setCurrency("USD");
      setBaseSalary(emp.workerType === "FULL_TIME" ? 3500 : 0);
      setHourlyRate(emp.workerType === "PART_TIME" ? 18 : 0);
      setAllowances([]);
      setDeductions([]);
    }

    setError(null);
    setModalOpen(true);
  };

  const addAllowance = () => {
    setAllowances([...allowances, { name: "", amount: 0, isPercentage: false }]);
  };

  const updateAllowance = (idx: number, field: keyof LineItem, val: any) => {
    const updated = [...allowances];
    updated[idx] = { ...updated[idx], [field]: val };
    setAllowances(updated);
  };

  const removeAllowance = (idx: number) => {
    setAllowances(allowances.filter((_, i) => i !== idx));
  };

  const addDeduction = () => {
    setDeductions([...deductions, { name: "", amount: 0, isPercentage: false }]);
  };

  const updateDeduction = (idx: number, field: keyof LineItem, val: any) => {
    const updated = [...deductions];
    updated[idx] = { ...updated[idx], [field]: val };
    setDeductions(updated);
  };

  const removeDeduction = (idx: number) => {
    setDeductions(deductions.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/restaurant/payroll/salary-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          payFrequency,
          currency,
          baseSalary: Number(baseSalary),
          hourlyRate: Number(hourlyRate),
          allowances: allowances.filter((a) => a.name.trim()),
          deductions: deductions.filter((d) => d.name.trim()),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save salary structure");
      }

      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <RestaurantNavbar activeSection="Salary Structures" />

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
                onClick={() => router.push(`/restaurant/${subdomain}/payroll`)}
                className={`text-xs font-medium transition cursor-pointer ${
                  isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                ← Payroll Hub
              </button>
              <span className={`text-xs ${isDark ? "text-[#484E5E]" : "text-slate-300"}`}>•</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className={`text-[11px] font-medium uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Compensation Engine
              </span>
            </div>

            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Staff Salary & Rate Structures
            </h1>
            <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Configure individual base wages, hourly overtime rates, standard allowances, and tax deductions.
            </p>
          </div>
        </div>

        {/* Directory Table */}
        <div
          className={`rounded-3xl border overflow-hidden transition shadow-sm ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80"
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${isDark ? "bg-[#0A0C12]/50 border-white/[0.06] text-[#8F95A3]" : "bg-slate-50/70 border-slate-100 text-slate-500"}`}>
                  <th className="p-4 font-medium uppercase tracking-wider">Staff Member</th>
                  <th className="p-4 font-medium uppercase tracking-wider">Frequency</th>
                  <th className="p-4 font-medium uppercase tracking-wider">Base Pay</th>
                  <th className="p-4 font-medium uppercase tracking-wider">Hourly Rate</th>
                  <th className="p-4 font-medium uppercase tracking-wider">Rules</th>
                  <th className="p-4 font-medium text-right uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? "divide-white/[0.04]" : "divide-slate-100"}`}>
                {loading ? (
                  <tr>
                    <td colSpan={6} className={`p-16 text-center text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      Loading compensation records...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`p-16 text-center text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                      No staff members registered. Add employees in Workforce module to configure salaries.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => {
                    const struct = structures.find((s) => s.employeeId === emp.id);
                    let allowCount = 0;
                    let dedCount = 0;
                    try {
                      allowCount = struct?.allowancesJson ? JSON.parse(struct.allowancesJson).length : 0;
                    } catch {}
                    try {
                      dedCount = struct?.deductionsJson ? JSON.parse(struct.deductionsJson).length : 0;
                    } catch {}

                    return (
                      <tr
                        key={emp.id}
                        className={`transition ${isDark ? "hover:bg-white/[0.01]" : "hover:bg-slate-50/50"}`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-xs">
                              {emp.firstName.charAt(0)}
                              {emp.lastName.charAt(0)}
                            </div>
                            <div>
                              <p className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                                {emp.firstName} {emp.lastName}
                              </p>
                              <p className={`text-[10px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                                {emp.employeeCode} • {emp.workerType}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${
                              struct
                                ? isDark
                                  ? "bg-white/[0.04] text-white border-white/[0.08]"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                                : isDark
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            {struct?.payFrequency || "Unset"}
                          </span>
                        </td>

                        <td className={`p-4 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                          {struct ? (
                            `$${Number(struct.baseSalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          ) : (
                            <span className="text-amber-500 text-[11px] font-normal">Pending Setup</span>
                          )}
                        </td>

                        <td className={`p-4 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                          {struct && Number(struct.hourlyRate) > 0 ? `$${Number(struct.hourlyRate).toFixed(2)}/hr` : "—"}
                        </td>

                        <td className={`p-4 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                          {struct ? (
                            <span className="text-[11px]">
                              +{allowCount} allowance / -{dedCount} deduction
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() => openConfigModal(emp)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                              struct
                                ? isDark
                                  ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]"
                                  : "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200"
                                : "bg-[#0071E3] text-white border-[#0071E3] hover:bg-[#0077ED]"
                            }`}
                          >
                            {struct ? "Edit Structure" : "Configure Pay"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      {modalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div
            className={`max-w-lg w-full p-6 rounded-3xl border shadow-2xl space-y-4 my-8 ${
              isDark ? "bg-[#121622] border-white/[0.08]" : "bg-white border-slate-200"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className={`text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                  Salary Structure
                </h2>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  {selectedEmployee.firstName} {selectedEmployee.lastName} ({selectedEmployee.employeeCode})
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
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

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Pay Frequency
                  </label>
                  <select
                    value={payFrequency}
                    onChange={(e) => setPayFrequency(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="BI_WEEKLY">Bi-Weekly</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Base Salary
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(Number(e.target.value))}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? "text-[#8F95A3]" : "text-slate-600"}`}>
                    Hourly Rate
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className={`w-full px-3.5 py-2.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                      isDark
                        ? "bg-[#0A0C12] border-white/[0.08] text-white"
                        : "bg-[#F5F5F7] border-slate-200 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              {/* Allowances */}
              <div className="space-y-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                    Allowances & Bonuses
                  </span>
                  <button
                    type="button"
                    onClick={addAllowance}
                    className="text-xs font-medium text-[#0071E3] hover:underline"
                  >
                    + Add Rule
                  </button>
                </div>

                {allowances.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Housing, Travel"
                      value={a.name}
                      onChange={(e) => updateAllowance(idx, "name", e.target.value)}
                      className={`flex-1 px-3 py-1.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200"
                      }`}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={a.amount}
                      onChange={(e) => updateAllowance(idx, "amount", Number(e.target.value))}
                      className={`w-24 px-3 py-1.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200"
                      }`}
                    />
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={a.isPercentage}
                        onChange={(e) => updateAllowance(idx, "isPercentage", e.target.checked)}
                      />
                      %
                    </label>
                    <button
                      type="button"
                      onClick={() => removeAllowance(idx)}
                      className="text-slate-400 hover:text-rose-500 px-1 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Deductions */}
              <div className="space-y-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-700"}`}>
                    Tax & Deductions
                  </span>
                  <button
                    type="button"
                    onClick={addDeduction}
                    className="text-xs font-medium text-[#0071E3] hover:underline"
                  >
                    + Add Rule
                  </button>
                </div>

                {deductions.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Income Tax, Insurance"
                      value={d.name}
                      onChange={(e) => updateDeduction(idx, "name", e.target.value)}
                      className={`flex-1 px-3 py-1.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200"
                      }`}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={d.amount}
                      onChange={(e) => updateDeduction(idx, "amount", Number(e.target.value))}
                      className={`w-24 px-3 py-1.5 text-xs rounded-xl border transition focus:outline-none focus:border-[#0071E3] ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08] text-white" : "bg-[#F5F5F7] border-slate-200"
                      }`}
                    />
                    <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.isPercentage}
                        onChange={(e) => updateDeduction(idx, "isPercentage", e.target.checked)}
                      />
                      %
                    </label>
                    <button
                      type="button"
                      onClick={() => removeDeduction(idx)}
                      className="text-slate-400 hover:text-rose-500 px-1 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
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
                  {saving ? "Saving..." : "Save Structure"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
