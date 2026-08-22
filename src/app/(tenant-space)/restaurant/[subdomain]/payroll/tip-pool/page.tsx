"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface StaffAllocationPreview {
  employeeId: string;
  name: string;
  departmentName?: string;
  designationName?: string;
  isFoh: boolean;
  hoursWorked: number;
  weight: number;
  percentageOfPool: number;
  tipAmount: number;
}

export default function TipPoolStudioPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Rule State
  const [ruleName, setRuleName] = useState("Standard Restaurant Pool");
  const [fohPercent, setFohPercent] = useState(70);
  const [distMethod, setDistMethod] = useState<"HOURS_WORKED" | "EQUAL_SPLIT" | "ROLE_POINT_SYSTEM">("HOURS_WORKED");
  const [rolePoints, setRolePoints] = useState<Record<string, number>>({
    "Lead Bartender": 1.5,
    "Server": 1.0,
    "Busser": 0.75,
    "Line Cook": 1.0,
    "Dishwasher": 0.8,
  });

  // Simulator Inputs
  const [totalTipsInput, setTotalTipsInput] = useState<number>(1200);
  const [simStartDate, setSimStartDate] = useState<string>("");
  const [simEndDate, setSimEndDate] = useState<string>("");

  // Preview Result State
  const [simulating, setSimulating] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [previewAllocations, setPreviewAllocations] = useState<StaffAllocationPreview[]>([]);
  const [summaryStats, setSummaryStats] = useState<{
    fohPool: number;
    bohPool: number;
    totalDistributed: number;
    fohCount: number;
    bohCount: number;
  } | null>(null);

  // Set default date range to past 7 days
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);

    setSimStartDate(start.toISOString().split("T")[0]);
    setSimEndDate(end.toISOString().split("T")[0]);
  }, []);

  // Fetch Existing Active Rule
  useEffect(() => {
    const fetchRule = async () => {
      try {
        const res = await fetch("/api/restaurant/payroll/tip-pool/rules");
        if (res.ok) {
          const data = await res.json();
          const rules = data.rules || [];
          if (rules.length > 0) {
            const active = rules[0];
            setRuleName(active.name);
            setFohPercent(active.fohPercentage);
            setDistMethod(active.distributionMethod);
            if (active.rolePointsJson) setRolePoints(active.rolePointsJson);
          }
        }
      } catch {
        // ignore
      }
    };
    fetchRule();
  }, []);

  // Run Tip Simulation Preview
  const runSimulation = async () => {
    if (!simStartDate || !simEndDate) return;
    setSimulating(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/restaurant/payroll/tip-pool/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: simStartDate,
          endDate: simEndDate,
          customTipAmount: Number(totalTipsInput),
          fohPercentage: fohPercent,
          bohPercentage: 100 - fohPercent,
          distributionMethod: distMethod,
          rolePoints,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPreviewAllocations(data.calculation.allocations || []);
        setSummaryStats({
          fohPool: data.calculation.fohPoolAmount,
          bohPool: data.calculation.bohPoolAmount,
          totalDistributed: data.calculation.totalDistributedTips,
          fohCount: data.fohCount,
          bohCount: data.bohCount,
        });
      } else {
        setStatusMessage(`Error: ${data.error}`);
      }
    } catch {
      setStatusMessage("Failed to simulate tip distribution");
    } finally {
      setSimulating(false);
    }
  };

  // Run on mount or parameter changes
  useEffect(() => {
    if (simStartDate && simEndDate) {
      runSimulation();
    }
  }, [fohPercent, distMethod, totalTipsInput, simStartDate, simEndDate]);

  // Save Rule Configuration
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRule(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/restaurant/payroll/tip-pool/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ruleName,
          fohPercentage: fohPercent,
          bohPercentage: 100 - fohPercent,
          distributionMethod: distMethod,
          rolePointsJson: rolePoints,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage("✅ Tip Pool policy saved and activated for all future payroll runs!");
      } else {
        setStatusMessage(`Error: ${data.error}`);
      }
    } catch {
      setStatusMessage("Failed to save rule");
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? "bg-[#0A0C12] text-white" : "bg-[#F5F5F7] text-slate-900"}`}>
      <RestaurantNavbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                isDark ? "bg-[#0071E3]/20 text-[#64B5FF] border-[#0071E3]/30" : "bg-blue-100 text-[#0071E3] border-blue-200"
              }`}>
                Tip Distribution Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              Tip Pooling & Allocation Studio
            </h1>
            <p className={`text-xs mt-1 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
              Configure house tip splits between Front of House & Kitchen and preview live proportional payouts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/restaurant/${subdomain}/payroll/runs`}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border transition ${
                isDark ? "bg-white/[0.04] text-white border-white/[0.08] hover:bg-white/[0.08]" : "bg-white text-slate-700 border-slate-200 shadow-xs"
              }`}
            >
              ← Back to Payroll Runs
            </Link>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`p-3.5 rounded-2xl border text-xs font-medium ${
            statusMessage.startsWith("✅")
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/15 border-rose-500/30 text-rose-300"
          }`}>
            {statusMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Rule Configuration Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className={`p-6 rounded-3xl border shadow-sm space-y-5 ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200"}`}>
              <div>
                <h2 className="text-base font-bold">House Tip Pool Policy</h2>
                <p className={`text-xs mt-0.5 ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Define how customer tips are divided across teams.
                </p>
              </div>

              <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium mb-1">Policy Name</label>
                  <input
                    type="text"
                    required
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border ${isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>

                {/* FOH vs BOH Ratio Slider */}
                <div className="space-y-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-[#0071E3]">Front of House: {fohPercent}%</span>
                    <span className="text-amber-500">Kitchen (BOH): {100 - fohPercent}%</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={fohPercent}
                    onChange={(e) => setFohPercent(parseInt(e.target.value))}
                    className="w-full accent-[#0071E3] cursor-pointer"
                  />

                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>100% Servers/Bar</span>
                    <span>50/50 Equal</span>
                    <span>100% Kitchen</span>
                  </div>
                </div>

                {/* Distribution Method Selector */}
                <div className="space-y-1.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                  <label className="block font-medium">Distribution Formula</label>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] p-1 border border-black/[0.04] dark:border-white/[0.04]">
                    {[
                      { key: "HOURS_WORKED", label: "Hours Worked" },
                      { key: "ROLE_POINT_SYSTEM", label: "Role Points" },
                      { key: "EQUAL_SPLIT", label: "Equal Split" },
                    ].map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setDistMethod(m.key as any)}
                        className={`py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          distMethod === m.key
                            ? "bg-[#0071E3] text-white shadow-xs"
                            : isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Role Multiplier Weights (If ROLE_POINT_SYSTEM) */}
                {distMethod === "ROLE_POINT_SYSTEM" && (
                  <div className="space-y-2 p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04]">
                    <span className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                      Role Multipliers (Points Weight)
                    </span>
                    <div className="space-y-2">
                      {Object.entries(rolePoints).map(([role, pt]) => (
                        <div key={role} className="flex justify-between items-center">
                          <span className="font-medium">{role}</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="5.0"
                            value={pt}
                            onChange={(e) =>
                              setRolePoints({ ...rolePoints, [role]: parseFloat(e.target.value) || 1.0 })
                            }
                            className={`w-20 px-2 py-1 text-right font-mono rounded-lg border ${
                              isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-white border-slate-200"
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingRule}
                  className="w-full py-2.5 bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {savingRule ? "Saving..." : "Save & Activate Tip Policy"}
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT: Live Simulation Preview Table */}
          <div className="lg:col-span-7 space-y-4">
            {/* Simulation Filter Bar */}
            <div className={`p-4 rounded-3xl border flex flex-col sm:flex-row justify-between items-center gap-3 ${
              isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"
            }`}>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Total Tips ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={totalTipsInput}
                    onChange={(e) => setTotalTipsInput(parseFloat(e.target.value) || 0)}
                    className={`px-3 py-1.5 text-xs font-mono font-bold w-28 rounded-xl border ${
                      isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Period Window</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={simStartDate}
                      onChange={(e) => setSimStartDate(e.target.value)}
                      className={`px-2.5 py-1.5 text-xs rounded-xl border ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                      }`}
                    />
                    <span className="text-xs text-slate-400">to</span>
                    <input
                      type="date"
                      value={simEndDate}
                      onChange={(e) => setSimEndDate(e.target.value)}
                      className={`px-2.5 py-1.5 text-xs rounded-xl border ${
                        isDark ? "bg-[#0A0C12] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={runSimulation}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] cursor-pointer"
              >
                🔄 Refresh
              </button>
            </div>

            {/* Summary Stat Pills */}
            {summaryStats && (
              <div className="grid grid-cols-3 gap-3">
                <div className={`p-3.5 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
                  <span className="text-[10px] font-bold uppercase text-[#0071E3] block">FOH Pool ({fohPercent}%)</span>
                  <span className="text-xl font-extrabold font-mono text-[#0071E3] mt-0.5 block">
                    ${summaryStats.fohPool.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400">{summaryStats.fohCount} Front staff</span>
                </div>

                <div className={`p-3.5 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
                  <span className="text-[10px] font-bold uppercase text-amber-500 block">Kitchen Pool ({100 - fohPercent}%)</span>
                  <span className="text-xl font-extrabold font-mono text-amber-500 mt-0.5 block">
                    ${summaryStats.bohPool.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400">{summaryStats.bohCount} Kitchen staff</span>
                </div>

                <div className={`p-3.5 rounded-2xl border ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-xs"}`}>
                  <span className="text-[10px] font-bold uppercase text-emerald-400 block">Total Distributed</span>
                  <span className="text-xl font-extrabold font-mono text-emerald-400 mt-0.5 block">
                    ${summaryStats.totalDistributed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400">100.00% Exact</span>
                </div>
              </div>
            )}

            {/* Payout Preview Table */}
            <div className={`rounded-3xl border overflow-hidden ${isDark ? "bg-[#121622] border-white/[0.06]" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="p-4 border-b border-black/[0.04] dark:border-white/[0.04]">
                <h3 className="text-sm font-bold">Calculated Employee Payouts ({previewAllocations.length})</h3>
                <p className={`text-xs ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                  Weighted by verified attendance hours logged during this pay window.
                </p>
              </div>

              {simulating ? (
                <div className="py-16 text-center text-xs space-y-2">
                  <div className="w-5 h-5 border-2 border-[#0071E3] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Calculating tip allocations from attendance records...</p>
                </div>
              ) : previewAllocations.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  No staff with logged attendance hours found in this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className={`border-b ${isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-slate-200 bg-slate-50"}`}>
                        <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Employee</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Group</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Hours</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Weight</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider text-[10px]">Pool Share</th>
                        <th className="p-3.5 font-bold uppercase tracking-wider text-[10px] text-right">Tip Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {previewAllocations.map((alloc) => (
                        <tr key={alloc.employeeId} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition">
                          <td className="p-3.5 font-bold">
                            <div>{alloc.name}</div>
                            <div className={`text-[10px] font-normal ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                              {alloc.designationName || alloc.departmentName || "Staff"}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              alloc.isFoh
                                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                            }`}>
                              {alloc.isFoh ? "FOH" : "Kitchen"}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono">{alloc.hoursWorked}h</td>
                          <td className="p-3.5 font-mono">{alloc.weight}x</td>
                          <td className="p-3.5 font-mono">{alloc.percentageOfPool}%</td>
                          <td className="p-3.5 font-mono font-extrabold text-emerald-400 text-right text-sm">
                            ${alloc.tipAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
