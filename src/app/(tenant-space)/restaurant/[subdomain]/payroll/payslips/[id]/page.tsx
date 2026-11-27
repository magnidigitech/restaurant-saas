"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

export default function PayslipDetailPage(props: { params: Promise<{ id: string }> }) {
  const routeParams = useParams();
  const subdomain = (routeParams?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [payslipId, setPayslipId] = useState("");
  const [payslip, setPayslip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    props.params.then((p) => setPayslipId(p.id));
  }, [props.params]);

  useEffect(() => {
    if (!payslipId) return;
    fetch(`/api/restaurant/payroll/payslips/${payslipId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load payslip");
        return data.payslip;
      })
      .then((slip) => setPayslip(slip))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [payslipId]);

  const card = isDark ? "bg-zinc-900 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900";
  const muted = isDark ? "text-zinc-400" : "text-zinc-500";

  if (loading) {
    return (
      <div className="min-h-screen">
        <RestaurantNavbar />
        <div className="p-8 text-center text-sm text-zinc-500">Loading payslip...</div>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="min-h-screen">
        <RestaurantNavbar />
        <div className="max-w-lg mx-auto p-8 text-center space-y-3">
          <p className="text-red-500 font-semibold">{error || "Payslip not found"}</p>
          <Link href={`/restaurant/${subdomain}/payroll`} className="text-sm text-indigo-500 underline">
            Back to Payroll
          </Link>
        </div>
      </div>
    );
  }

  const currency = payslip.currency || "USD";

  return (
    <div className="min-h-screen">
      <RestaurantNavbar />
      <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <div className={`p-5 rounded-2xl border space-y-4 ${card}`}>
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div>
              <div className={`text-xs uppercase tracking-wider ${muted}`}>
                {payslip.restaurant?.branding?.applicationName || payslip.restaurant?.name}
                {payslip.payrollRun?.outlet?.name ? ` • ${payslip.payrollRun.outlet.name}` : ""}
              </div>
              <h1 className="text-xl font-bold mt-1">
                {payslip.employee.firstName} {payslip.employee.lastName}
              </h1>
              <div className={`text-xs ${muted}`}>
                Code: {payslip.employee.employeeCode} • Period:{" "}
                {new Date(payslip.periodStart).toLocaleDateString()} –{" "}
                {new Date(payslip.periodEnd).toLocaleDateString()}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600">
              {payslip.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <div className={`text-xs ${muted}`}>Regular Hours</div>
              <div className="font-semibold">{Number(payslip.hoursWorked).toFixed(2)} hrs</div>
            </div>
            <div>
              <div className={`text-xs ${muted}`}>Overtime Hours</div>
              <div className="font-semibold">{Number(payslip.overtimeHours).toFixed(2)} hrs</div>
            </div>
            <div>
              <div className={`text-xs ${muted}`}>Pooled Tips</div>
              <div className="font-semibold">
                {currency} {Number(payslip.pooledTipsAmount).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-500">Earnings</h2>
            {payslip.earnings.map((e: any) => (
              <div key={e.id} className="flex justify-between text-sm gap-2">
                <span>{e.name}</span>
                <span className="font-medium shrink-0">
                  {currency} {Number(e.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-500">Deductions</h2>
            {payslip.deductions.length === 0 ? (
              <div className={`text-xs ${muted}`}>No deductions</div>
            ) : (
              payslip.deductions.map((d: any) => (
                <div key={d.id} className="flex justify-between text-sm gap-2">
                  <span>{d.name}</span>
                  <span className="font-medium shrink-0">
                    -{currency} {Number(d.amount).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <span className="font-bold text-base">Net Pay</span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {currency} {Number(payslip.netPay).toFixed(2)}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
