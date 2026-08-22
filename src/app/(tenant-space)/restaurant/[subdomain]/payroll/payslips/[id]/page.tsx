"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTheme } from "@/core/theme/ThemeContext";
import RestaurantNavbar from "@/components/RestaurantNavbar";

interface PayslipDetail {
  id: string;
  startDate: string;
  endDate: string;
  currency: string;
  hoursWorked: string;
  overtimeHours: string;
  basePay: string;
  totalAllowances: string;
  totalDeductions: string;
  netPay: string;
  status: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    workerType: string;
    personalEmail?: string;
    phone?: string;
  };
  restaurant: {
    id: string;
    name: string;
    branding?: { applicationName: string; logoUrl?: string };
  };
  payrollRun: {
    id: string;
    name: string;
    paymentDate: string;
  };
  earnings: Array<{ id: string; name: string; amount: string; type: string }>;
  deductions: Array<{ id: string; name: string; amount: string; type: string }>;
  payments: Array<{ id: string; amount: string; paymentMethod: string; paidAt: string }>;
}

export default function ApplePayslipDetailPage(props: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const routeParams = useParams();
  const subdomain = (routeParams?.subdomain as string) || "";
  const { isDark } = useTheme();

  const [payslipId, setPayslipId] = useState<string>("");
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    props.params.then((p) => setPayslipId(p.id));
  }, [props.params]);

  useEffect(() => {
    if (!payslipId) return;
    fetch(`/api/restaurant/payroll/payslips/${payslipId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Payslip not found");
        return res.json();
      })
      .then((data) => setPayslip(data.payslip))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [payslipId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xs text-slate-400">Loading payslip voucher...</p>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-sm font-semibold text-rose-500">{error || "Payslip record not found"}</p>
        <button
          onClick={() => router.push(`/restaurant/${subdomain}/payroll/runs`)}
          className="text-xs font-medium text-[#0071E3] hover:underline cursor-pointer"
        >
          ← Return to Payroll Cycles
        </button>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
        isDark ? "bg-[#090B10] text-[#E4E7EB]" : "bg-[#F5F5F7] text-[#1D1D1F]"
      }`}
    >
      <div className="print:hidden">
        <RestaurantNavbar activeSection="Payslip Details" />
      </div>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Action Bar */}
        <div
          className={`p-4 rounded-2xl border transition flex justify-between items-center print:hidden ${
            isDark
              ? "bg-[#121622]/60 border-white/[0.06]"
              : "bg-white border-slate-200/80 shadow-sm"
          }`}
        >
          <button
            onClick={() => router.back()}
            className={`text-xs font-medium transition cursor-pointer ${
              isDark ? "text-[#8F95A3] hover:text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            ← Back to Pay Run
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            Print / Save as PDF
          </button>
        </div>

        {/* Official Printable Voucher */}
        <div
          className={`p-8 sm:p-12 rounded-3xl border space-y-8 print:shadow-none print:border-none print:p-0 ${
            isDark
              ? "bg-[#121622]/90 border-white/[0.08]"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b border-black/[0.06] dark:border-white/[0.06] pb-6">
            <div className="space-y-1">
              <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                {payslip.restaurant.branding?.applicationName || payslip.restaurant.name}
              </h1>
              <p className={`text-xs tracking-wider uppercase font-medium ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Official Salary Payslip Voucher
              </p>
            </div>
            <div className="text-right space-y-1">
              <span
                className={`text-[10px] font-medium px-3 py-1 rounded-full border ${
                  payslip.status === "PAID"
                    ? isDark
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : isDark
                    ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                    : "bg-blue-50 text-blue-800 border-blue-200"
                }`}
              >
                {payslip.status}
              </span>
              <p className={`text-[11px] font-mono ${isDark ? "text-[#8F95A3]" : "text-slate-500"}`}>
                Payout: {new Date(payslip.payrollRun.paymentDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Metadata Grid */}
          <div
            className={`grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl text-xs ${
              isDark ? "bg-[#0A0C12]/60 border border-white/[0.06]" : "bg-slate-50 border border-slate-100"
            }`}
          >
            <div>
              <span className={`uppercase font-medium text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Employee Name
              </span>
              <p className={`font-semibold mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                {payslip.employee.firstName} {payslip.employee.lastName}
              </p>
            </div>

            <div>
              <span className={`uppercase font-medium text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Employee Code
              </span>
              <p className={`font-mono font-semibold mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                {payslip.employee.employeeCode}
              </p>
            </div>

            <div>
              <span className={`uppercase font-medium text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Pay Period
              </span>
              <p className={`font-semibold mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                {new Date(payslip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} —{" "}
                {new Date(payslip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>

            <div>
              <span className={`uppercase font-medium text-[10px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                Hours Billed
              </span>
              <p className={`font-semibold mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                {Number(payslip.hoursWorked).toFixed(1)} hrs
                {Number(payslip.overtimeHours) > 0 && ` (+${Number(payslip.overtimeHours).toFixed(1)} OT)`}
              </p>
            </div>
          </div>

          {/* Earnings & Deductions Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Earnings */}
            <div className="space-y-3">
              <h3 className={`font-semibold uppercase tracking-wider text-[11px] pb-2 border-b ${isDark ? "text-emerald-400 border-white/[0.06]" : "text-emerald-700 border-slate-100"}`}>
                Earnings & Additions
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>Base Wages</span>
                  <span className={`font-mono font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    ${Number(payslip.basePay).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {payslip.earnings?.map((e) => (
                  <div key={e.id} className="flex justify-between items-center">
                    <span className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>{e.name}</span>
                    <span className="font-mono font-semibold text-emerald-500">
                      +${Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Deductions */}
            <div className="space-y-3">
              <h3 className={`font-semibold uppercase tracking-wider text-[11px] pb-2 border-b ${isDark ? "text-rose-400 border-white/[0.06]" : "text-rose-700 border-slate-100"}`}>
                Deductions & Withholdings
              </h3>
              <div className="space-y-2">
                {payslip.deductions?.length === 0 ? (
                  <p className={`text-[11px] ${isDark ? "text-[#8F95A3]" : "text-slate-400"}`}>
                    No tax or voluntary deductions applied.
                  </p>
                ) : (
                  payslip.deductions?.map((d) => (
                    <div key={d.id} className="flex justify-between items-center">
                      <span className={isDark ? "text-[#8F95A3]" : "text-slate-600"}>{d.name}</span>
                      <span className="font-mono font-semibold text-rose-500">
                        -${Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Net Pay Banner */}
          <div
            className={`p-6 rounded-2xl flex justify-between items-center border ${
              isDark
                ? "bg-emerald-500/10 border-emerald-500/20 text-white"
                : "bg-emerald-50 border-emerald-200 text-emerald-950"
            }`}
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                Net Take-Home Pay
              </p>
              <p className="text-2xl font-bold font-mono mt-0.5 text-emerald-500">
                ${Number(payslip.netPay).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <span className="text-xs opacity-70">
              Disbursed via Direct Deposit / Bank Transfer
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
