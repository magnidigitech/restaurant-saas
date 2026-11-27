"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface PreviewBlocker {
  code: string;
  severity: "BLOCKER" | "WARNING";
  employeeName?: string;
  message: string;
  sourceUrl: string;
}

interface EmployeeBreakdown {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  currency: string;
  approvedHours: number;
  regularHours: number;
  overtimeHours: number;
  applicableRateLabel: string;
  rateSegments: Array<{
    hourlyRate: number;
    regularHours: number;
    overtimeHours: number;
    regularEarnings: number;
    overtimeEarnings: number;
  }>;
  regularEarnings: number;
  overtimeEarnings: number;
  totalAllowances: number;
  finalizedTips: number;
  totalDeductions: number;
  grossPay: number;
  netPay: number;
  hasMissingRate: boolean;
  hasUnresolvedAttendance: boolean;
}

export default function PayrollRunDetailPage(props: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const routeParams = useParams();
  const subdomain = (routeParams?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [runId, setRunId] = useState("");
  const [run, setRun] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [actor, setActor] = useState<{
    canRunPayroll: boolean;
    canApprovePayroll: boolean;
  }>({ canRunPayroll: false, canApprovePayroll: false });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    props.params.then((p) => setRunId(p.id));
  }, [props.params]);

  const loadRunAndPreview = async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/restaurant/payroll/runs/${runId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load payroll run");
        setLoading(false);
        return;
      }
      setRun(data.run);
      if (data.actor) setActor(data.actor);

      if (data.run.status === "DRAFT" || data.run.status === "CALCULATING") {
        const pRes = await fetch(`/api/restaurant/payroll/runs/${runId}/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "PREVIEW" }),
        });
        const pData = await pRes.json();
        if (pRes.ok && pData.preview) setPreview(pData.preview);
      }
    } catch {
      setError("Network error loading payroll run");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRunAndPreview();
  }, [runId]);

  const handleFinalize = async () => {
    if (!run) return;
    setActionLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/restaurant/payroll/runs/${run.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedPreviewHash: preview?.previewHash || run.previewHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Finalization failed");
        if (res.status === 409) await loadRunAndPreview();
        return;
      }
      setNotice(
        data.alreadyFinalized
          ? "Run was already finalized."
          : "Payroll run finalized and payslips issued."
      );
      await loadRunAndPreview();
    } catch {
      setError("Network error finalizing payroll");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCorrection = async () => {
    if (!run) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/restaurant/payroll/runs/${run.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CORRECT" }),
      });
      const data = await res.json();
      if (res.ok && data.correction) {
        router.push(`/restaurant/${subdomain}/payroll/runs/${data.correction.id}`);
      } else {
        setError(data.error || "Failed to create adjustment run");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPreviewRows: EmployeeBreakdown[] = useMemo(() => {
    const rows = preview?.employeeBreakdowns || [];
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r: EmployeeBreakdown) =>
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q)
    );
  }, [preview, search]);

  const card = isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900";
  const muted = isDark ? "text-zinc-400" : "text-zinc-500";
  const input = isDark ? "bg-zinc-800 border-zinc-700 text-zinc-100" : "bg-white border-zinc-300 text-zinc-900";

  if (loading) {
    return (
      <div className="min-h-screen">
        <RestaurantNavbar />
        <div className="p-8 text-center text-sm text-zinc-500">Loading payroll workspace...</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen">
        <RestaurantNavbar />
        <div className="max-w-xl mx-auto p-8 text-center space-y-3">
          <p className="text-red-500 font-semibold">{error || "Payroll run not found"}</p>
          <Link href={`/restaurant/${subdomain}/payroll/runs`} className="text-sm text-indigo-500 underline">
            Return to Payroll Runs
          </Link>
        </div>
      </div>
    );
  }

  const isFinalized = run.status === "APPROVED" || run.status === "PAID";
  const currency = preview?.currency || run.outlet?.currency || run.currency || "USD";

  return (
    <div className="min-h-screen">
      <RestaurantNavbar />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href={`/restaurant/${subdomain}/payroll/runs`} className="text-xs text-indigo-500 hover:underline">
              ← Back to Payroll Runs
            </Link>
            <h1 className="text-2xl font-bold mt-1">{run.title}</h1>
            <p className={`text-sm ${muted}`}>
              {run.outlet?.name || "All Outlets"} •{" "}
              {new Date(run.periodStart).toLocaleDateString()} – {new Date(run.periodEnd).toLocaleDateString()} • Status:{" "}
              <strong>{run.status}</strong>
            </p>
            <p className={`text-xs mt-1 ${muted}`}>
              {run.previewedAt ? `Previewed: ${new Date(run.previewedAt).toLocaleString()}` : ""}
              {run.finalizedAt ? ` • Finalized: ${new Date(run.finalizedAt).toLocaleString()}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isFinalized && (
              <button
                disabled={actionLoading}
                onClick={loadRunAndPreview}
                className="px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-sm font-medium"
              >
                Refresh Preview
              </button>
            )}
            {!isFinalized && actor.canApprovePayroll && (
              <button
                disabled={actionLoading || (preview?.blockers?.length ?? 0) > 0}
                onClick={handleFinalize}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold"
              >
                Finalize & Issue Payslips
              </button>
            )}
            {isFinalized && (
              <>
                <a
                  href={`/api/restaurant/payroll/runs/${run.id}?format=csv`}
                  className="px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-sm font-medium"
                >
                  Export CSV
                </a>
                {actor.canApprovePayroll && (
                  <button
                    disabled={actionLoading}
                    onClick={handleCreateCorrection}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold"
                  >
                    Create Adjustment Run
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-600 text-sm">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="p-3.5 rounded-xl bg-emerald-500/15 text-emerald-600 text-sm">
            {notice}
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Gross Pay", val: preview ? preview.totals.totalGross : Number(run.totalGross) },
            { label: "Allowances", val: preview ? preview.totals.totalAllowances : Number(run.totalAllowances) },
            { label: "Deductions", val: preview ? preview.totals.totalDeductions : Number(run.totalDeductions) },
            { label: "Net Pay", val: preview ? preview.totals.totalNet : Number(run.totalNet) },
          ].map((t) => (
            <div key={t.label} className={`p-4 rounded-2xl border ${card}`}>
              <div className={`text-xs ${muted}`}>{t.label}</div>
              <div className="text-xl font-bold mt-1">
                {currency} {t.val.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Blockers & Warnings */}
        {!isFinalized && preview && (preview.blockers.length > 0 || preview.warnings.length > 0) && (
          <div className={`p-4 rounded-2xl border space-y-2 ${card}`}>
            <h2 className="font-semibold text-sm">Pre-Finalization Review Issues</h2>
            {preview.blockers.map((b: PreviewBlocker, idx: number) => (
              <div key={idx} className="p-2.5 rounded-xl bg-red-500/15 text-red-700 dark:text-red-300 text-xs flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>Blocker ({b.code}):</strong> {b.message}
                </span>
                <Link href={`/restaurant/${subdomain}${b.sourceUrl}`} className="underline font-semibold">
                  Resolve Source →
                </Link>
              </div>
            ))}
            {preview.warnings.map((w: PreviewBlocker, idx: number) => (
              <div key={idx} className="p-2.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>Warning ({w.code}):</strong> {w.message}
                </span>
                <Link href={`/restaurant/${subdomain}${w.sourceUrl}`} className="underline font-semibold">
                  Open Tip Pool →
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Filter & Breakdown */}
        {!isFinalized && preview ? (
          <div className="space-y-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter employees by name or code..."
              className={`w-full sm:max-w-xs rounded-xl border px-3 py-2 text-sm ${input}`}
            />

            {/* Desktop Table */}
            <div className={`hidden md:block overflow-x-auto rounded-2xl border ${card}`}>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Approved Hrs (OT)</th>
                    <th className="py-3 px-4">Applicable Rate</th>
                    <th className="py-3 px-4">Regular + OT</th>
                    <th className="py-3 px-4">Tips + Allow</th>
                    <th className="py-3 px-4">Deductions</th>
                    <th className="py-3 px-4 text-right">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredPreviewRows.map((eb) => (
                    <tr key={eb.employeeId}>
                      <td className="py-3 px-4 font-medium">
                        {eb.employeeName}
                        <div className={`text-xs ${muted}`}>{eb.employeeCode}</div>
                      </td>
                      <td className="py-3 px-4">
                        {eb.approvedHours.toFixed(2)}h ({eb.overtimeHours.toFixed(2)}h OT)
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {eb.applicableRateLabel}
                      </td>
                      <td className="py-3 px-4">
                        {currency} {(eb.regularEarnings + eb.overtimeEarnings).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        {currency} {(eb.finalizedTips + eb.totalAllowances).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        {currency} {eb.totalDeductions.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        {currency} {eb.netPay.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredPreviewRows.map((eb) => (
                <div key={eb.employeeId} className={`p-4 rounded-2xl border space-y-2 text-sm ${card}`}>
                  <div className="flex justify-between font-semibold">
                    <span>{eb.employeeName}</span>
                    <span>
                      {currency} {eb.netPay.toFixed(2)}
                    </span>
                  </div>
                  <div className={`text-xs ${muted}`}>
                    {eb.approvedHours.toFixed(2)}h ({eb.overtimeHours.toFixed(2)}h OT) • {eb.applicableRateLabel}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs pt-1">
                    <span>Regular + OT: {currency} {(eb.regularEarnings + eb.overtimeEarnings).toFixed(2)}</span>
                    <span>Tips: {currency} {eb.finalizedTips.toFixed(2)}</span>
                    <span>Allowances: {currency} {eb.totalAllowances.toFixed(2)}</span>
                    <span>Deductions: {currency} {eb.totalDeductions.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Finalized Payslips */
          <div className={`rounded-2xl border overflow-hidden ${card}`}>
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-sm">
              Issued Payslips ({run.payslips.length})
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {run.payslips.map((p: any) => (
                <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {p.employee.firstName} {p.employee.lastName} ({p.employee.employeeCode})
                    </div>
                    <div className={`text-xs ${muted}`}>
                      {Number(p.hoursWorked).toFixed(2)}h reg + {Number(p.overtimeHours).toFixed(2)}h OT • Tips: {p.currency} {Number(p.pooledTipsAmount).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">
                      {p.currency} {Number(p.netPay).toFixed(2)}
                    </span>
                    <Link
                      href={`/restaurant/${subdomain}/payroll/payslips/${p.id}`}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium"
                    >
                      View Payslip
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
