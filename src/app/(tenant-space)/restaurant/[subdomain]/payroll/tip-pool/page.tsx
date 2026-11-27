"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface Outlet {
  id: string;
  name: string;
  currency?: string;
}

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
  eligible: boolean;
  basisLabel: string;
  ineligibleReason?: string;
}

interface TipPreview {
  outletId: string;
  outletName: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  cashTipsAmount: number;
  cardTipsAmount: number;
  serviceChargesAmount: number;
  refundsAmount: number;
  adjustmentsAmount: number;
  eligiblePoolAmount: number;
  distribution: {
    totalCollectedTips: number;
    fohPoolAmount: number;
    bohPoolAmount: number;
    totalDistributedTips: number;
    undistributedAmount: number;
    undistributedReason: string | null;
    flags: string[];
    allocations: StaffAllocationPreview[];
  };
  missingConfig: string[];
}

interface TipPoolRunItem {
  id: string;
  outletId: string | null;
  status: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  eligiblePoolAmount: number;
  totalDistributedTips: number;
  undistributedAmount: number;
  payrollRun?: { id: string; title: string; status: string } | null;
}

export default function TipPoolStudioPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);
  const { isDark } = useTheme();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [adjustmentsAmount, setAdjustmentsAmount] = useState<number>(0);

  const [fohPercent, setFohPercent] = useState<number>(70);
  const [distMethod, setDistMethod] = useState<
    "HOURS_WORKED" | "EQUAL_SPLIT" | "ROLE_POINT_SYSTEM"
  >("HOURS_WORKED");
  const [includeCashTips, setIncludeCashTips] = useState(true);
  const [includeCardTips, setIncludeCardTips] = useState(true);
  const [includeServiceCharges, setIncludeServiceCharges] = useState(false);
  const [deductRefunds, setDeductRefunds] = useState(true);

  const [preview, setPreview] = useState<TipPreview | null>(null);
  const [runs, setRuns] = useState<TipPoolRunItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);

    fetch("/api/restaurant/outlets")
      .then((r) => r.json())
      .then((d) => {
        if (d.outlets?.length) {
          setOutlets(d.outlets);
          setSelectedOutletId(d.outlets[0].id);
        }
      })
      .catch(() => { });
  }, []);

  const fetchRunsAndRules = async (outletId: string) => {
    if (!outletId) return;
    try {
      const res = await fetch(`/api/restaurant/payroll/tip-pool/calculate?outletId=${outletId}`);
      const data = await res.json();
      if (res.ok) {
        setRuns(data.runs || []);
        if (data.rules?.length) {
          const r = data.rules[0];
          setFohPercent(r.fohPercentage ?? 70);
          setDistMethod(r.distributionMethod ?? "HOURS_WORKED");
          setIncludeCashTips(r.includeCashTips ?? true);
          setIncludeCardTips(r.includeCardTips ?? true);
          setIncludeServiceCharges(r.includeServiceCharges ?? false);
          setDeductRefunds(r.deductRefunds ?? true);
        }
      }
    } catch { }
  };

  useEffect(() => {
    if (selectedOutletId) fetchRunsAndRules(selectedOutletId);
  }, [selectedOutletId]);

  const runAction = async (action: "PREVIEW" | "SAVE" | "FINALIZE") => {
    if (!selectedOutletId || !startDate || !endDate) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/restaurant/payroll/tip-pool/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          outletId: selectedOutletId,
          startDate: `${startDate}T00:00:00.000Z`,
          endDate: `${endDate}T23:59:59.999Z`,
          adjustmentsAmount,
          fohPercentage: fohPercent,
          bohPercentage: 100 - fohPercent,
          distributionMethod: distMethod,
          includeCashTips,
          includeCardTips,
          includeServiceCharges,
          deductRefunds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || "Tip pool calculation failed", type: "err" });
        return;
      }
      if (data.preview) setPreview(data.preview);
      if (action === "FINALIZE") {
        setMessage({ text: "Tip pool finalized and locked for payroll.", type: "ok" });
        fetchRunsAndRules(selectedOutletId);
      } else if (action === "SAVE") {
        setMessage({ text: "Draft tip pool saved.", type: "ok" });
        fetchRunsAndRules(selectedOutletId);
      }
    } catch {
      setMessage({ text: "Network error calculating tip pool", type: "err" });
    } finally {
      setLoading(false);
    }
  };

  const card = isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900";
  const muted = isDark ? "text-zinc-400" : "text-zinc-500";
  const input = isDark ? "bg-zinc-800 border-zinc-700 text-zinc-100" : "bg-white border-zinc-300 text-zinc-900";

  return (
    <div className="min-h-screen">
      <RestaurantNavbar />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href={`/restaurant/${subdomain}/payroll`} className="text-xs text-indigo-500 hover:underline">
              ← Back to Payroll
            </Link>
            <h1 className="text-2xl font-bold mt-1">Tip Pooling & Reconciliation</h1>
            <p className={`text-sm ${muted}`}>
              Reconcile POS cash/card tips, service charges, refunds, and approved staff hours before finalizing into payroll.
            </p>
          </div>
        </div>

        {message && (
          <div
            role="status"
            className={`p-3 rounded-xl text-sm font-medium ${message.type === "err" ? "bg-red-500/15 text-red-600" : "bg-emerald-500/15 text-emerald-600"
              }`}
          >
            {message.text}
          </div>
        )}

        {/* Controls */}
        <div className={`p-5 rounded-2xl border space-y-4 ${card}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1 ${muted}`}>Outlet</label>
              <select
                aria-label="Tip pool outlet"
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${input}`}
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${muted}`}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${input}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${muted}`}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${input}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${muted}`}>Adjustments (+/-)</label>
              <input
                type="number"
                step="0.01"
                value={adjustmentsAmount}
                onChange={(e) => setAdjustmentsAmount(Number(e.target.value))}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${input}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <div>
              <label className={`block text-xs font-medium mb-1 ${muted}`}>Allocation Method</label>
              <select
                value={distMethod}
                onChange={(e) => setDistMethod(e.target.value as any)}
                className={`w-full rounded-xl border px-3 py-2 text-sm ${input}`}
              >
                <option value="HOURS_WORKED">Approved Hours Worked</option>
                <option value="ROLE_POINT_SYSTEM">Role Points × Hours</option>
                <option value="EQUAL_SPLIT">Equal Split</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${muted}`}>
                FOH / BOH Split ({fohPercent}% / {100 - fohPercent}%)
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={fohPercent}
                onChange={(e) => setFohPercent(Number(e.target.value))}
                className="w-full mt-2"
              />
            </div>
            <div className="flex flex-wrap gap-3 items-center text-xs pt-3">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={includeCashTips} onChange={(e) => setIncludeCashTips(e.target.checked)} />
                Cash Tips
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={includeCardTips} onChange={(e) => setIncludeCardTips(e.target.checked)} />
                Card Tips
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={includeServiceCharges} onChange={(e) => setIncludeServiceCharges(e.target.checked)} />
                Service Charges
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={deductRefunds} onChange={(e) => setDeductRefunds(e.target.checked)} />
                Deduct Refunds
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              disabled={loading}
              onClick={() => runAction("PREVIEW")}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              Preview Reconciliation
            </button>
            <button
              disabled={loading}
              onClick={() => runAction("FINALIZE")}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            >
              Finalize Tip Pool
            </button>
          </div>
        </div>

        {/* Reconciliation Summary & Breakdown */}
        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "Cash Tips", val: preview.cashTipsAmount },
                { label: "Card Tips", val: preview.cardTipsAmount },
                { label: "Service Chg", val: preview.serviceChargesAmount },
                { label: "Refunds", val: preview.refundsAmount },
                { label: "Adjustments", val: preview.adjustmentsAmount },
                { label: "Eligible Pool", val: preview.eligiblePoolAmount },
                { label: "Distributed", val: preview.distribution.totalDistributedTips },
              ].map((m) => (
                <div key={m.label} className={`p-3.5 rounded-2xl border ${card}`}>
                  <div className={`text-xs ${muted}`}>{m.label}</div>
                  <div className="text-lg font-bold mt-1">
                    {preview.currency} {m.val.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {preview.distribution.undistributedAmount > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-sm">
                <strong>Undistributed Amount:</strong> {preview.currency}{" "}
                {preview.distribution.undistributedAmount.toFixed(2)} —{" "}
                {preview.distribution.undistributedReason}
              </div>
            )}

            {preview.distribution.flags.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                {preview.distribution.flags.map((f, i) => (
                  <div key={i}>• {f}</div>
                ))}
              </div>
            )}

            <div className={`overflow-x-auto rounded-2xl border ${card}`}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Group</th>
                    <th className="py-3 px-4">Eligibility</th>
                    <th className="py-3 px-4">Basis</th>
                    <th className="py-3 px-4">Share %</th>
                    <th className="py-3 px-4 text-right">Tip Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {preview.distribution.allocations.map((a) => (
                    <tr key={a.employeeId}>
                      <td className="py-3 px-4 font-medium">{a.name}</td>
                      <td className="py-3 px-4">{a.isFoh ? "FOH" : "BOH"}</td>
                      <td className="py-3 px-4">
                        {a.eligible ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-600">
                            Eligible
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-600">
                            {a.ineligibleReason || "Ineligible"}
                          </span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-xs ${muted}`}>{a.basisLabel}</td>
                      <td className="py-3 px-4">{a.percentageOfPool.toFixed(2)}%</td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {preview.currency} {a.tipAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* History */}
        <div className={`p-5 rounded-2xl border space-y-3 ${card}`}>
          <h2 className="font-semibold text-base">Tip Pool Runs ({runs.length})</h2>
          {runs.length === 0 ? (
            <p className={`text-sm ${muted}`}>No tip pool runs recorded for this outlet.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <div key={r.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <span className="font-medium">
                      {new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}
                    </span>
                    <span className={`ml-2 text-xs ${muted}`}>
                      Pool: {r.currency} {r.eligiblePoolAmount.toFixed(2)} • Distributed: {r.currency} {r.totalDistributedTips.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.status === "FINALIZED" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
                      }`}>
                      {r.status}
                    </span>
                    {r.payrollRun && (
                      <span className="text-xs text-indigo-500">Linked: {r.payrollRun.title}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
