import { createHash } from "node:crypto";
import { prisma } from "@/core/database/client";
import {
  PayFrequency,
  PayrollRunStatus,
  PayslipStatus,
  EarningType,
  DeductionType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";

export class PayrollError extends Error {
  status: number;
  code: string;
  details?: Record<string, any>;

  constructor(
    message: string,
    status = 400,
    code = "PAYROLL_ERROR",
    details?: Record<string, any>
  ) {
    super(message);
    this.name = "PayrollError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface AllowanceItem {
  name: string;
  amount: number;
  isPercentage?: boolean;
}

export interface DeductionItem {
  name: string;
  amount: number;
  isPercentage?: boolean;
  type?: DeductionType;
}

export interface PayrollBlocker {
  code:
  | "MISSING_RATE"
  | "UNRESOLVED_ATTENDANCE"
  | "OVERLAPPING_RUN"
  | "UNFINALIZED_TIPS"
  | "MISSING_CONFIG";
  severity: "BLOCKER" | "WARNING";
  employeeId?: string;
  employeeName?: string;
  message: string;
  sourceUrl: string;
}

export interface RateSegmentBreakdown {
  salaryStructureId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  hourlyRate: number;
  regularHours: number;
  overtimeHours: number;
  regularEarnings: number;
  overtimeEarnings: number;
}

export interface EmployeePayrollPreview {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  currency: string;
  approvedHours: number;
  regularHours: number;
  overtimeHours: number;
  timesheetSyncCount: number;
  applicableRateLabel: string;
  rateSegments: RateSegmentBreakdown[];
  regularEarnings: number;
  overtimeEarnings: number;
  allowances: Array<{ name: string; amount: number }>;
  totalAllowances: number;
  finalizedTips: number;
  deductions: Array<{ name: string; amount: number; type: DeductionType }>;
  totalDeductions: number;
  grossPay: number;
  netPay: number;
  hasMissingRate: boolean;
  hasUnresolvedAttendance: boolean;
}

export interface PayrollPreviewResult {
  runId: string;
  title: string;
  outletId: string | null;
  outletName: string | null;
  currency: string;
  periodStart: string;
  periodEnd: string;
  overtimeMultiplier: number;
  previewHash: string;
  blockers: PayrollBlocker[];
  warnings: PayrollBlocker[];
  missingConfig: string[];
  consumedTipPoolRunIds: string[];
  employeeBreakdowns: EmployeePayrollPreview[];
  totals: {
    totalGross: number;
    totalAllowances: number;
    totalDeductions: number;
    totalTips: number;
    totalNet: number;
  };
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function pickStructureForDate<
  T extends { effectiveFrom: Date; effectiveTo: Date | null; hourlyRate: any; baseSalary: any }
>(structures: T[], workDate: Date): T | null {
  const time = workDate.getTime();
  // Structures ordered by effectiveFrom desc
  const matching = structures.filter((s) => {
    const from = s.effectiveFrom.getTime();
    const to = s.effectiveTo ? s.effectiveTo.getTime() : Number.POSITIVE_INFINITY;
    return from <= time && time <= to;
  });
  return matching[0] || structures[0] || null;
}

function resolveHourlyRate(struct: {
  hourlyRate: Prisma.Decimal;
  baseSalary: Prisma.Decimal;
  payFrequency: PayFrequency;
}): number | null {
  const hr = Number(struct.hourlyRate || 0);
  if (hr > 0) return hr;
  const base = Number(struct.baseSalary || 0);
  if (base > 0) {
    if (struct.payFrequency === PayFrequency.WEEKLY) return roundCents(base / 40);
    if (struct.payFrequency === PayFrequency.BI_WEEKLY) return roundCents(base / 80);
    return roundCents(base / 160);
  }
  return null;
}

export const PayrollService = {
  // ── Salary Structures ──────────────────────────────────────────────────────
  async getSalaryStructures(restaurantId: string) {
    return prisma.salaryStructure.findMany({
      where: { restaurantId, status: "ACTIVE" },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workerType: true,
            personalEmail: true,
          },
        },
      },
      orderBy: [{ employeeId: "asc" }, { effectiveFrom: "desc" }],
    });
  },

  async getSalaryStructureByEmployee(restaurantId: string, employeeId: string) {
    return prisma.salaryStructure.findFirst({
      where: { restaurantId, employeeId, status: "ACTIVE" },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workerType: true,
          },
        },
      },
      orderBy: { effectiveFrom: "desc" },
    });
  },

  async upsertSalaryStructure(
    restaurantId: string,
    data: {
      employeeId: string;
      payFrequency?: PayFrequency;
      currency?: string;
      baseSalary: number;
      hourlyRate?: number;
      allowances?: AllowanceItem[];
      deductions?: DeductionItem[];
      effectiveFrom?: Date | string;
      effectiveTo?: Date | string;
      createNewVersion?: boolean;
    }
  ) {
    await prisma.employee.findFirstOrThrow({
      where: { id: data.employeeId, restaurantId, archivedAt: null },
    });

    const allowancesJson = data.allowances ? JSON.stringify(data.allowances) : null;
    const deductionsJson = data.deductions ? JSON.stringify(data.deductions) : null;
    const effectiveFromDate = data.effectiveFrom ? new Date(data.effectiveFrom) : new Date();

    const existing = await prisma.salaryStructure.findFirst({
      where: { restaurantId, employeeId: data.employeeId, status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
    });

    // If createNewVersion or effectiveFrom is strictly newer than existing, close out previous effectiveTo
    if (
      existing &&
      (data.createNewVersion ||
        (data.effectiveFrom && effectiveFromDate.getTime() > existing.effectiveFrom.getTime()))
    ) {
      const prevEnd = new Date(effectiveFromDate.getTime() - 1);
      await prisma.salaryStructure.update({
        where: { id: existing.id },
        data: { effectiveTo: prevEnd },
      });

      return prisma.salaryStructure.create({
        data: {
          restaurantId,
          employeeId: data.employeeId,
          payFrequency: data.payFrequency ?? existing.payFrequency,
          currency: data.currency ?? existing.currency,
          baseSalary: new Prisma.Decimal(data.baseSalary),
          hourlyRate: new Prisma.Decimal(data.hourlyRate ?? 0),
          allowancesJson,
          deductionsJson,
          effectiveFrom: effectiveFromDate,
          effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        },
      });
    }

    if (existing) {
      return prisma.salaryStructure.update({
        where: { id: existing.id },
        data: {
          payFrequency: data.payFrequency ?? existing.payFrequency,
          currency: data.currency ?? existing.currency,
          baseSalary: new Prisma.Decimal(data.baseSalary),
          hourlyRate: new Prisma.Decimal(data.hourlyRate ?? 0),
          allowancesJson,
          deductionsJson,
          effectiveFrom: data.effectiveFrom ? effectiveFromDate : existing.effectiveFrom,
          effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : existing.effectiveTo,
        },
      });
    }

    return prisma.salaryStructure.create({
      data: {
        restaurantId,
        employeeId: data.employeeId,
        payFrequency: data.payFrequency ?? PayFrequency.MONTHLY,
        currency: data.currency ?? "USD",
        baseSalary: new Prisma.Decimal(data.baseSalary),
        hourlyRate: new Prisma.Decimal(data.hourlyRate ?? 0),
        allowancesJson,
        deductionsJson,
        effectiveFrom: effectiveFromDate,
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      },
    });
  },

  // ── Payroll Runs ───────────────────────────────────────────────────────────
  async getPayrollRuns(
    restaurantId: string,
    filters?: { outletId?: string; accessibleOutletIds?: string[] | null }
  ) {
    const where: any = { restaurantId };
    if (filters?.outletId) {
      where.outletId = filters.outletId;
    } else if (filters?.accessibleOutletIds) {
      where.outletId = { in: filters.accessibleOutletIds };
    }

    return prisma.payrollRun.findMany({
      where,
      include: {
        outlet: { select: { id: true, name: true, currency: true } },
        _count: { select: { payslips: true } },
      },
      orderBy: { periodStart: "desc" },
    });
  },

  async getPayrollRunById(restaurantId: string, id: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { id, restaurantId },
      include: {
        outlet: { select: { id: true, name: true, currency: true } },
        tipPoolRuns: {
          select: {
            id: true,
            status: true,
            eligiblePoolAmount: true,
            totalDistributedTips: true,
            undistributedAmount: true,
          },
        },
        payslips: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                workerType: true,
              },
            },
            earnings: true,
            deductions: true,
            payments: true,
          },
          orderBy: { employee: { firstName: "asc" } },
        },
      },
    });
    if (!run) throw new PayrollError("Payroll run not found", 404, "RUN_NOT_FOUND");
    return run;
  },

  async createPayrollRun(
    restaurantId: string,
    data: {
      outletId?: string;
      title: string;
      periodStart: Date | string;
      periodEnd: Date | string;
      paymentDate: Date | string;
      overtimeMultiplier?: number;
      notes?: string;
      correctionOfRunId?: string;
    }
  ) {
    let currency = "USD";
    if (data.outletId) {
      const outlet = await prisma.restaurantOutlet.findFirst({
        where: { id: data.outletId, restaurantId },
        select: { id: true, currency: true },
      });
      if (!outlet) throw new PayrollError("Outlet not found", 404, "OUTLET_NOT_FOUND");
      currency = outlet.currency || "USD";
    }

    return prisma.payrollRun.create({
      data: {
        restaurantId,
        outletId: data.outletId || null,
        title: data.title,
        currency,
        overtimeMultiplier: data.overtimeMultiplier ?? 1.5,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        paymentDate: new Date(data.paymentDate),
        correctionOfRunId: data.correctionOfRunId || null,
        notes: data.notes,
        status: PayrollRunStatus.DRAFT,
      },
    });
  },

  async previewPayrollRun(
    restaurantId: string,
    runId: string,
    actorUserId?: string
  ): Promise<PayrollPreviewResult> {
    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, restaurantId },
      include: { outlet: { select: { id: true, name: true, currency: true } } },
    });
    if (!run) throw new PayrollError("Payroll run not found", 404, "RUN_NOT_FOUND");

    const blockers: PayrollBlocker[] = [];
    const warnings: PayrollBlocker[] = [];
    const missingConfig: string[] = [];

    if (!run.overtimeMultiplier || run.overtimeMultiplier <= 0) {
      missingConfig.push("Overtime multiplier not configured.");
    }

    // 1. Overlapping runs check (same outlet or tenant-wide)
    const overlapping = await prisma.payrollRun.findMany({
      where: {
        restaurantId,
        id: { not: run.id },
        status: { not: PayrollRunStatus.CANCELLED },
        correctionOfRunId: null,
        ...(run.outletId ? { OR: [{ outletId: run.outletId }, { outletId: null }] } : {}),
        periodStart: { lte: run.periodEnd },
        periodEnd: { gte: run.periodStart },
      },
      select: { id: true, title: true, status: true },
    });
    for (const ov of overlapping) {
      if (!run.correctionOfRunId) {
        blockers.push({
          code: "OVERLAPPING_RUN",
          severity: "BLOCKER",
          message: `Overlaps with payroll run "${ov.title}" (${ov.status}).`,
          sourceUrl: `/payroll/runs/${ov.id}`,
        });
      }
    }

    // 2. Eligible active employees
    const employeeWhere: any = { restaurantId, archivedAt: null };
    if (run.outletId) {
      employeeWhere.outletAssignments = { some: { outletId: run.outletId } };
    }
    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      include: {
        salaryStructures: {
          where: { status: "ACTIVE" },
          orderBy: { effectiveFrom: "desc" },
        },
      },
      orderBy: { firstName: "asc" },
    });

    // 3. Attendance records (both approved & unresolved/open)
    const attWhere: any = {
      restaurantId,
      workDate: { gte: run.periodStart, lte: run.periodEnd },
    };
    if (run.outletId) attWhere.outletId = run.outletId;

    const allAttendance = await prisma.attendanceRecord.findMany({
      where: attWhere,
      orderBy: { workDate: "asc" },
    });

    const unresolvedAttMap = new Map<string, number>();
    const approvedByEmp = new Map<string, typeof allAttendance>();

    for (const r of allAttendance) {
      const hasOpenPunch = Boolean(r.clockInTime && !r.clockOutTime);
      if (!r.isApproved || r.needsReview || hasOpenPunch) {
        unresolvedAttMap.set(r.employeeId, (unresolvedAttMap.get(r.employeeId) || 0) + 1);
      } else {
        if (!approvedByEmp.has(r.employeeId)) approvedByEmp.set(r.employeeId, []);
        approvedByEmp.get(r.employeeId)!.push(r);
      }
    }

    // Also check open TimePunch without clock-out in period
    const punchWhere: any = {
      restaurantId,
      punchTime: { gte: run.periodStart, lte: run.periodEnd },
      attendanceRecordId: null,
    };
    if (run.outletId) punchWhere.outletId = run.outletId;
    const orphanPunches = await prisma.timePunch.findMany({ where: punchWhere });
    for (const p of orphanPunches) {
      unresolvedAttMap.set(p.employeeId, (unresolvedAttMap.get(p.employeeId) || 0) + 1);
    }

    // 4. Tip Pool Runs in period: finalized unconsumed runs enter payroll; draft runs trigger warning/blocker
    const tipWhere: any = {
      restaurantId,
      periodStart: { lte: run.periodEnd },
      periodEnd: { gte: run.periodStart },
    };
    if (run.outletId) tipWhere.outletId = run.outletId;

    const tipRuns = await prisma.tipPoolRun.findMany({ where: tipWhere });
    const draftTipRuns = tipRuns.filter((t) => t.status !== "FINALIZED");
    for (const dt of draftTipRuns) {
      warnings.push({
        code: "UNFINALIZED_TIPS",
        severity: "WARNING",
        message: `Draft tip pool run (${dt.eligiblePoolAmount.toFixed(2)} ${dt.currency}) is not finalized and will not be included.`,
        sourceUrl: "/payroll/tip-pool",
      });
    }

    // Only finalized tip pool runs not yet consumed by another payroll run (or from original run during correction delta)
    const eligibleTipRuns = tipRuns.filter(
      (t) =>
        t.status === "FINALIZED" &&
        (t.payrollRunId === null ||
          t.payrollRunId === run.id ||
          (run.correctionOfRunId && t.payrollRunId === run.correctionOfRunId))
    );
    const tipShareMap = new Map<string, number>();
    const consumedTipPoolRunIds: string[] = [];

    for (const tr of eligibleTipRuns) {
      if (tr.payrollRunId === null || tr.payrollRunId === run.id) {
        consumedTipPoolRunIds.push(tr.id);
      }
      const allocs = Array.isArray(tr.distributionsJson)
        ? (tr.distributionsJson as Array<{ employeeId: string; tipAmount: number }>)
        : [];
      for (const a of allocs) {
        if (a.employeeId && Number(a.tipAmount) > 0) {
          tipShareMap.set(
            a.employeeId,
            roundCents((tipShareMap.get(a.employeeId) || 0) + Number(a.tipAmount))
          );
        }
      }
    }

    // If this is a linked correction run, load original finalized payslips to compute delta-only adjustments
    const origSlipMap = new Map<
      string,
      {
        regularHours: number;
        overtimeHours: number;
        regularEarnings: number;
        overtimeEarnings: number;
        allowances: number;
        tips: number;
        deductions: number;
      }
    >();
    if (run.correctionOfRunId) {
      const origRun = await prisma.payrollRun.findFirst({
        where: { id: run.correctionOfRunId, restaurantId },
        include: {
          payslips: {
            include: { earnings: true },
          },
        },
      });
      if (origRun) {
        for (const s of origRun.payslips) {
          const otEarn = s.earnings
            .filter((e) => e.type === EarningType.OVERTIME)
            .reduce((acc, e) => acc + Number(e.amount), 0);
          origSlipMap.set(s.employeeId, {
            regularHours: Number(s.hoursWorked),
            overtimeHours: Number(s.overtimeHours),
            regularEarnings: Number(s.basePay),
            overtimeEarnings: roundCents(otEarn),
            allowances: Number(s.totalAllowances),
            tips: Number(s.pooledTipsAmount),
            deductions: Number(s.totalDeductions),
          });
        }
      }
    }

    const currency = run.outlet?.currency || run.currency || "USD";
    const overtimeMultiplier = run.overtimeMultiplier || 1.5;

    const employeeBreakdowns: EmployeePayrollPreview[] = [];
    let totalGross = 0;
    let totalAllowances = 0;
    let totalDeductions = 0;
    let totalTips = 0;
    let totalNet = 0;

    for (const emp of employees) {
      const empName = `${emp.firstName} ${emp.lastName}`.trim();
      const unresolvedCount = unresolvedAttMap.get(emp.id) || 0;
      if (unresolvedCount > 0) {
        blockers.push({
          code: "UNRESOLVED_ATTENDANCE",
          severity: "BLOCKER",
          employeeId: emp.id,
          employeeName: empName,
          message: `${empName} has ${unresolvedCount} unresolved or unapproved attendance record(s).`,
          sourceUrl: `/attendance${run.outletId ? `?outletId=${run.outletId}` : ""}`,
        });
      }

      const empAtt = approvedByEmp.get(emp.id) || [];
      const tipAmount = tipShareMap.get(emp.id) || 0;

      // Skip employees with zero approved hours, zero unresolved attendance, and zero tips
      if (empAtt.length === 0 && unresolvedCount === 0 && tipAmount === 0) {
        continue;
      }

      const segmentMap = new Map<
        string,
        {
          struct: (typeof emp.salaryStructures)[number];
          hourlyRate: number;
          regMins: number;
          otMins: number;
        }
      >();
      let missingRateForEmp = false;

      for (const att of empAtt) {
        const struct = pickStructureForDate(emp.salaryStructures, att.workDate);
        const rate = struct ? resolveHourlyRate(struct) : null;
        if (!struct || rate === null) {
          missingRateForEmp = true;
          continue;
        }
        if (!segmentMap.has(struct.id)) {
          segmentMap.set(struct.id, { struct, hourlyRate: rate, regMins: 0, otMins: 0 });
        }
        const seg = segmentMap.get(struct.id)!;
        const reg = Math.max(0, att.totalWorkMinutes - att.overtimeMinutes);
        seg.regMins += reg;
        seg.otMins += att.overtimeMinutes;
      }

      if (empAtt.length === 0 && emp.salaryStructures.length === 0) {
        missingRateForEmp = true;
      }

      if (missingRateForEmp) {
        blockers.push({
          code: "MISSING_RATE",
          severity: "BLOCKER",
          employeeId: emp.id,
          employeeName: empName,
          message: `${empName} is missing an active pay rate / salary structure for this period.`,
          sourceUrl: "/payroll/salary-structures",
        });
      }

      const rateSegments: RateSegmentBreakdown[] = Array.from(segmentMap.values())
        .sort((a, b) => a.struct.effectiveFrom.getTime() - b.struct.effectiveFrom.getTime())
        .map((seg) => {
          const regularHours = roundCents(seg.regMins / 60);
          const overtimeHours = roundCents(seg.otMins / 60);
          const regularEarnings = roundCents(regularHours * seg.hourlyRate);
          const overtimeEarnings = roundCents(overtimeHours * seg.hourlyRate * overtimeMultiplier);
          return {
            salaryStructureId: seg.struct.id,
            effectiveFrom: seg.struct.effectiveFrom.toISOString(),
            effectiveTo: seg.struct.effectiveTo ? seg.struct.effectiveTo.toISOString() : null,
            hourlyRate: seg.hourlyRate,
            regularHours,
            overtimeHours,
            regularEarnings,
            overtimeEarnings,
          };
        });

      const regularHours = roundCents(
        rateSegments.reduce((acc, s) => acc + s.regularHours, 0)
      );
      const overtimeHours = roundCents(
        rateSegments.reduce((acc, s) => acc + s.overtimeHours, 0)
      );
      const approvedHours = roundCents(regularHours + overtimeHours);
      const regularEarnings = roundCents(
        rateSegments.reduce((acc, s) => acc + s.regularEarnings, 0)
      );
      const overtimeEarnings = roundCents(
        rateSegments.reduce((acc, s) => acc + s.overtimeEarnings, 0)
      );

      const latestStruct = emp.salaryStructures[0] || null;
      let allowancesList: AllowanceItem[] = [];
      let deductionsList: DeductionItem[] = [];
      if (latestStruct?.allowancesJson) {
        try {
          allowancesList = JSON.parse(latestStruct.allowancesJson);
        } catch { }
      }
      if (latestStruct?.deductionsJson) {
        try {
          deductionsList = JSON.parse(latestStruct.deductionsJson);
        } catch { }
      }

      const computedAllowances = allowancesList.map((al) => ({
        name: al.name,
        amount: al.isPercentage
          ? roundCents((regularEarnings * al.amount) / 100)
          : approvedHours > 0
            ? roundCents((al.amount * approvedHours) / 160)
            : 0,
      }));
      const empTotalAllowances = roundCents(
        computedAllowances.reduce((acc, a) => acc + a.amount, 0)
      );

      const computedDeductions = deductionsList.map((ded) => ({
        name: ded.name,
        amount: ded.isPercentage
          ? roundCents((regularEarnings * ded.amount) / 100)
          : approvedHours > 0
            ? roundCents((ded.amount * approvedHours) / 160)
            : 0,
        type: ded.type || DeductionType.OTHER,
      }));
      const empTotalDeductions = roundCents(
        computedDeductions.reduce((acc, d) => acc + d.amount, 0)
      );

      const orig = run.correctionOfRunId ? origSlipMap.get(emp.id) : undefined;
      const finalRegHours = orig ? roundCents(regularHours - orig.regularHours) : regularHours;
      const finalOtHours = orig ? roundCents(overtimeHours - orig.overtimeHours) : overtimeHours;
      const finalApprovedHours = roundCents(finalRegHours + finalOtHours);
      const finalRegEarnings = orig ? roundCents(regularEarnings - orig.regularEarnings) : regularEarnings;
      const finalOtEarnings = orig ? roundCents(overtimeEarnings - orig.overtimeEarnings) : overtimeEarnings;
      const finalAllowancesTotal = orig ? roundCents(empTotalAllowances - orig.allowances) : empTotalAllowances;
      const finalTips = orig ? roundCents(tipAmount - orig.tips) : tipAmount;
      const finalDeductionsTotal = orig ? roundCents(empTotalDeductions - orig.deductions) : empTotalDeductions;

      const grossPay = roundCents(
        finalRegEarnings + finalOtEarnings + finalTips + finalAllowancesTotal
      );
      const netPay = orig
        ? roundCents(grossPay - finalDeductionsTotal)
        : Math.max(0, roundCents(grossPay - finalDeductionsTotal));

      if (orig && grossPay === 0 && finalDeductionsTotal === 0 && netPay === 0) {
        continue;
      }

      const finalRateSegments: RateSegmentBreakdown[] = orig
        ? [
          {
            salaryStructureId: rateSegments[0]?.salaryStructureId || "adjustment",
            effectiveFrom: run.periodStart.toISOString(),
            effectiveTo: run.periodEnd.toISOString(),
            hourlyRate: rateSegments[rateSegments.length - 1]?.hourlyRate || 0,
            regularHours: finalRegHours,
            overtimeHours: finalOtHours,
            regularEarnings: finalRegEarnings,
            overtimeEarnings: finalOtEarnings,
          },
        ]
        : rateSegments;

      const finalAllowancesList = orig
        ? finalAllowancesTotal !== 0
          ? [{ name: "Adjustment: Allowances", amount: finalAllowancesTotal }]
          : []
        : computedAllowances;

      const finalDeductionsList = orig
        ? finalDeductionsTotal !== 0
          ? [{ name: "Adjustment: Deductions", amount: finalDeductionsTotal, type: DeductionType.OTHER }]
          : []
        : computedDeductions;

      const applicableRateLabel = orig
        ? "Adjustment Delta"
        : rateSegments.length > 1
          ? `Split (${rateSegments.map((s) => `${s.hourlyRate}/hr`).join(" → ")})`
          : rateSegments.length === 1
            ? `${rateSegments[0].hourlyRate}/hr`
            : "Missing rate";

      employeeBreakdowns.push({
        employeeId: emp.id,
        employeeName: empName,
        employeeCode: emp.employeeCode,
        currency,
        approvedHours: finalApprovedHours,
        regularHours: finalRegHours,
        overtimeHours: finalOtHours,
        timesheetSyncCount: empAtt.length,
        applicableRateLabel,
        rateSegments: finalRateSegments,
        regularEarnings: finalRegEarnings,
        overtimeEarnings: finalOtEarnings,
        allowances: finalAllowancesList,
        totalAllowances: finalAllowancesTotal,
        finalizedTips: finalTips,
        deductions: finalDeductionsList,
        totalDeductions: finalDeductionsTotal,
        grossPay,
        netPay,
        hasMissingRate: missingRateForEmp,
        hasUnresolvedAttendance: unresolvedCount > 0,
      });

      totalGross = roundCents(totalGross + grossPay);
      totalAllowances = roundCents(totalAllowances + finalAllowancesTotal);
      totalDeductions = roundCents(totalDeductions + finalDeductionsTotal);
      totalTips = roundCents(totalTips + finalTips);
      totalNet = roundCents(totalNet + netPay);
    }

    const fingerprintPayload = {
      runId: run.id,
      periodStart: run.periodStart.toISOString(),
      periodEnd: run.periodEnd.toISOString(),
      overtimeMultiplier,
      attendance: allAttendance.map((a) => ({
        id: a.id,
        u: a.updatedAt.toISOString(),
        m: a.totalWorkMinutes,
        o: a.overtimeMinutes,
        ap: a.isApproved,
      })),
      orphanPunches: orphanPunches.map((p) => p.id),
      structures: employees.flatMap((e) =>
        e.salaryStructures.map((s) => ({
          id: s.id,
          u: s.updatedAt.toISOString(),
          hr: String(s.hourlyRate),
          bs: String(s.baseSalary),
          ef: s.effectiveFrom.toISOString(),
          et: s.effectiveTo?.toISOString() || null,
        }))
      ),
      tipRuns: eligibleTipRuns.map((t) => ({
        id: t.id,
        tot: t.totalDistributedTips,
      })),
    };

    const previewHash = createHash("sha256")
      .update(JSON.stringify(fingerprintPayload))
      .digest("hex");

    if (
      (run.status === PayrollRunStatus.DRAFT || run.status === PayrollRunStatus.CALCULATING) &&
      actorUserId
    ) {
      await prisma.payrollRun.update({
        where: { id: run.id },
        data: {
          previewHash,
          previewedAt: new Date(),
          previewedBy: actorUserId,
          totalGross: new Prisma.Decimal(totalGross),
          totalAllowances: new Prisma.Decimal(totalAllowances),
          totalDeductions: new Prisma.Decimal(totalDeductions),
          totalNet: new Prisma.Decimal(totalNet),
        },
      });
    }

    return {
      runId: run.id,
      title: run.title,
      outletId: run.outletId,
      outletName: run.outlet?.name || null,
      currency,
      periodStart: run.periodStart.toISOString(),
      periodEnd: run.periodEnd.toISOString(),
      overtimeMultiplier,
      previewHash,
      blockers,
      warnings,
      missingConfig,
      consumedTipPoolRunIds,
      employeeBreakdowns,
      totals: {
        totalGross,
        totalAllowances,
        totalDeductions,
        totalTips,
        totalNet,
      },
    };
  },

  async executePayrollCalculation(
    restaurantId: string,
    runId: string,
    processedBy: string
  ) {
    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, restaurantId },
    });
    if (!run) throw new PayrollError("Payroll run not found", 404, "RUN_NOT_FOUND");
    if (run.status === PayrollRunStatus.APPROVED || run.status === PayrollRunStatus.PAID) {
      throw new PayrollError(
        "Cannot recalculate a finalized or paid payroll run. Create an adjustment run instead.",
        409,
        "ALREADY_FINALIZED"
      );
    }

    const preview = await this.previewPayrollRun(restaurantId, runId, processedBy);

    await prisma.$transaction(async (tx) => {
      await tx.payslip.deleteMany({
        where: { payrollRunId: run.id, restaurantId },
      });

      for (const eb of preview.employeeBreakdowns) {
        const earningsToCreate: Array<{ name: string; amount: number; type: EarningType }> = [];
        for (const seg of eb.rateSegments) {
          earningsToCreate.push({
            name: `Regular Base (${seg.regularHours.toFixed(2)} hrs @ ${eb.currency} ${seg.hourlyRate}/hr)`,
            amount: seg.regularEarnings,
            type: EarningType.BASE,
          });
          if (seg.overtimeHours > 0) {
            earningsToCreate.push({
              name: `Overtime (${seg.overtimeHours.toFixed(2)} hrs @ ${eb.currency} ${(seg.hourlyRate * preview.overtimeMultiplier).toFixed(2)}/hr)`,
              amount: seg.overtimeEarnings,
              type: EarningType.OVERTIME,
            });
          }
        }
        if (eb.finalizedTips > 0) {
          earningsToCreate.push({
            name: "Finalized House Tip Pool Share",
            amount: eb.finalizedTips,
            type: EarningType.TIPS,
          });
        }
        for (const al of eb.allowances) {
          earningsToCreate.push({
            name: al.name,
            amount: al.amount,
            type: EarningType.ALLOWANCE,
          });
        }

        await tx.payslip.create({
          data: {
            restaurantId,
            payrollRunId: run.id,
            employeeId: eb.employeeId,
            periodStart: run.periodStart,
            periodEnd: run.periodEnd,
            currency: eb.currency,
            hoursWorked: new Prisma.Decimal(eb.regularHours),
            overtimeHours: new Prisma.Decimal(eb.overtimeHours),
            pooledTipsAmount: new Prisma.Decimal(eb.finalizedTips),
            timesheetSyncCount: eb.timesheetSyncCount,
            basePay: new Prisma.Decimal(eb.regularEarnings),
            totalAllowances: new Prisma.Decimal(eb.totalAllowances),
            totalDeductions: new Prisma.Decimal(eb.totalDeductions),
            netPay: new Prisma.Decimal(eb.netPay),
            status: PayslipStatus.DRAFT,
            earnings: {
              create: earningsToCreate.map((e) => ({
                name: e.name,
                amount: new Prisma.Decimal(e.amount),
                type: e.type,
              })),
            },
            deductions: {
              create: eb.deductions.map((d) => ({
                name: d.name,
                amount: new Prisma.Decimal(d.amount),
                type: d.type,
              })),
            },
          },
        });
      }

      await tx.payrollRun.update({
        where: { id: run.id },
        data: {
          status: PayrollRunStatus.CALCULATING,
          processedBy,
          previewHash: preview.previewHash,
          previewedAt: new Date(),
          previewedBy: processedBy,
          totalGross: new Prisma.Decimal(preview.totals.totalGross),
          totalAllowances: new Prisma.Decimal(preview.totals.totalAllowances),
          totalDeductions: new Prisma.Decimal(preview.totals.totalDeductions),
          totalNet: new Prisma.Decimal(preview.totals.totalNet),
        },
      });
    });

    return this.getPayrollRunById(restaurantId, runId);
  },

  async finalizePayrollRun(
    restaurantId: string,
    runId: string,
    actorUserId: string,
    actorEmail: string,
    expectedPreviewHash?: string
  ) {
    const existing = await prisma.payrollRun.findFirst({
      where: { id: runId, restaurantId },
      include: { payslips: true },
    });
    if (!existing) throw new PayrollError("Payroll run not found", 404, "RUN_NOT_FOUND");

    // Idempotent finalization
    if (
      existing.status === PayrollRunStatus.APPROVED ||
      existing.status === PayrollRunStatus.PAID
    ) {
      return {
        run: await this.getPayrollRunById(restaurantId, runId),
        alreadyFinalized: true,
      };
    }

    const preview = await this.previewPayrollRun(restaurantId, runId);

    if (preview.blockers.length > 0) {
      throw new PayrollError(
        `Cannot finalize payroll: ${preview.blockers.map((b) => b.message).join(" ")}`,
        400,
        "PAYROLL_BLOCKED",
        { blockers: preview.blockers }
      );
    }

    const hashToMatch = expectedPreviewHash || existing.previewHash;
    if (hashToMatch && preview.previewHash !== hashToMatch) {
      throw new PayrollError(
        "Payroll inputs (attendance, pay rates, or tip allocations) changed after preview. Refresh the preview before finalizing.",
        409,
        "PREVIEW_STALE",
        { latestPreviewHash: preview.previewHash }
      );
    }

    let claimedInTx = false;

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      // Atomic conditional claim prevents concurrent finalization races from duplicating payslips
      const claim = await tx.payrollRun.updateMany({
        where: {
          id: runId,
          restaurantId,
          status: { in: [PayrollRunStatus.DRAFT, PayrollRunStatus.CALCULATING] },
        },
        data: {
          status: PayrollRunStatus.APPROVED,
          approvedBy: actorUserId,
          approvedAt: now,
          finalizedBy: actorUserId,
          finalizedAt: now,
          previewHash: preview.previewHash,
          totalGross: new Prisma.Decimal(preview.totals.totalGross),
          totalAllowances: new Prisma.Decimal(preview.totals.totalAllowances),
          totalDeductions: new Prisma.Decimal(preview.totals.totalDeductions),
          totalNet: new Prisma.Decimal(preview.totals.totalNet),
          version: { increment: 1 },
        },
      });

      if (claim.count === 0) {
        return;
      }
      claimedInTx = true;

      // Lock consumed finalized tip pool runs atomically so they cannot be counted twice
      if (preview.consumedTipPoolRunIds.length > 0) {
        const lockRes = await tx.tipPoolRun.updateMany({
          where: {
            id: { in: preview.consumedTipPoolRunIds },
            restaurantId,
            status: "FINALIZED",
            OR: [{ payrollRunId: null }, { payrollRunId: runId }],
          },
          data: { payrollRunId: runId },
        });
        if (lockRes.count !== preview.consumedTipPoolRunIds.length) {
          throw new PayrollError(
            "One or more finalized tip pool allocations were already consumed by another payroll run.",
            409,
            "TIP_POOL_ALREADY_CONSUMED"
          );
        }
      }

      await tx.payslip.deleteMany({
        where: { payrollRunId: runId, restaurantId },
      });

      for (const eb of preview.employeeBreakdowns) {
        const earningsToCreate: Array<{ name: string; amount: number; type: EarningType }> = [];
        for (const seg of eb.rateSegments) {
          if (seg.regularEarnings !== 0 || !existing.correctionOfRunId) {
            earningsToCreate.push({
              name: existing.correctionOfRunId
                ? `Adjustment: Regular Base (${seg.regularHours.toFixed(2)} hrs @ ${eb.currency} ${seg.hourlyRate}/hr)`
                : `Regular Base (${seg.regularHours.toFixed(2)} hrs @ ${eb.currency} ${seg.hourlyRate}/hr)`,
              amount: seg.regularEarnings,
              type: EarningType.BASE,
            });
          }
          if (seg.overtimeHours !== 0 || seg.overtimeEarnings !== 0) {
            earningsToCreate.push({
              name: existing.correctionOfRunId
                ? `Adjustment: Overtime (${seg.overtimeHours.toFixed(2)} hrs @ ${eb.currency} ${(seg.hourlyRate * preview.overtimeMultiplier).toFixed(2)}/hr)`
                : `Overtime (${seg.overtimeHours.toFixed(2)} hrs @ ${eb.currency} ${(seg.hourlyRate * preview.overtimeMultiplier).toFixed(2)}/hr)`,
              amount: seg.overtimeEarnings,
              type: EarningType.OVERTIME,
            });
          }
        }
        if (eb.finalizedTips !== 0) {
          earningsToCreate.push({
            name: existing.correctionOfRunId
              ? "Adjustment: House Tip Pool Share"
              : "Finalized House Tip Pool Share",
            amount: eb.finalizedTips,
            type: EarningType.TIPS,
          });
        }
        for (const al of eb.allowances) {
          earningsToCreate.push({
            name: al.name,
            amount: al.amount,
            type: EarningType.ALLOWANCE,
          });
        }

        await tx.payslip.create({
          data: {
            restaurantId,
            payrollRunId: runId,
            employeeId: eb.employeeId,
            periodStart: existing.periodStart,
            periodEnd: existing.periodEnd,
            currency: eb.currency,
            hoursWorked: new Prisma.Decimal(eb.regularHours),
            overtimeHours: new Prisma.Decimal(eb.overtimeHours),
            pooledTipsAmount: new Prisma.Decimal(eb.finalizedTips),
            timesheetSyncCount: eb.timesheetSyncCount,
            basePay: new Prisma.Decimal(eb.regularEarnings),
            totalAllowances: new Prisma.Decimal(eb.totalAllowances),
            totalDeductions: new Prisma.Decimal(eb.totalDeductions),
            netPay: new Prisma.Decimal(eb.netPay),
            status: PayslipStatus.GENERATED,
            earnings: {
              create: earningsToCreate.map((e) => ({
                name: e.name,
                amount: new Prisma.Decimal(e.amount),
                type: e.type,
              })),
            },
            deductions: {
              create: eb.deductions.map((d) => ({
                name: d.name,
                amount: new Prisma.Decimal(d.amount),
                type: d.type,
              })),
            },
          },
        });
      }

      // Sanitized audit log: no private pay rates or deduction amounts
      await tx.auditLog.create({
        data: {
          restaurant: { connect: { id: restaurantId } },
          userId: actorUserId,
          userEmail: actorEmail,
          action: existing.correctionOfRunId ? "PAYROLL_CORRECTION_FINALIZED" : "PAYROLL_FINALIZED",
          entityType: "PayrollRun",
          entityId: runId,
          newValues: JSON.stringify({
            status: "APPROVED",
            outletId: existing.outletId,
            payslipCount: preview.employeeBreakdowns.length,
            consumedTipPoolRunCount: preview.consumedTipPoolRunIds.length,
          }),
        },
      });
    });

    return {
      run: await this.getPayrollRunById(restaurantId, runId),
      alreadyFinalized: !claimedInTx,
    };
  },

  async approvePayrollRun(
    restaurantId: string,
    runId: string,
    approvedBy: string,
    actorEmail = "system@restobird.com",
    expectedPreviewHash?: string
  ) {
    const res = await this.finalizePayrollRun(
      restaurantId,
      runId,
      approvedBy,
      actorEmail,
      expectedPreviewHash
    );
    return res.run;
  },

  async createCorrectionRun(
    restaurantId: string,
    originalRunId: string,
    actorUserId: string,
    actorEmail: string,
    notes?: string
  ) {
    const orig = await prisma.payrollRun.findFirst({
      where: { id: originalRunId, restaurantId },
    });
    if (!orig) throw new PayrollError("Original payroll run not found", 404, "RUN_NOT_FOUND");
    if (orig.status !== PayrollRunStatus.APPROVED && orig.status !== PayrollRunStatus.PAID) {
      throw new PayrollError(
        "Correction runs can only be created from finalized or paid payroll runs.",
        400,
        "NOT_FINALIZED"
      );
    }

    const correction = await prisma.payrollRun.create({
      data: {
        restaurantId,
        outletId: orig.outletId,
        title: `${orig.title} (Adjustment)`,
        currency: orig.currency,
        overtimeMultiplier: orig.overtimeMultiplier,
        periodStart: orig.periodStart,
        periodEnd: orig.periodEnd,
        paymentDate: new Date(),
        correctionOfRunId: orig.id,
        notes: notes || `Adjustment run for ${orig.title}`,
        status: PayrollRunStatus.DRAFT,
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurant: { connect: { id: restaurantId } },
        userId: actorUserId,
        userEmail: actorEmail,
        action: "PAYROLL_CORRECTION_CREATED",
        entityType: "PayrollRun",
        entityId: correction.id,
        newValues: JSON.stringify({
          correctionOfRunId: orig.id,
          outletId: orig.outletId,
        }),
      },
    });

    return correction;
  },

  async markPayrollPaid(
    restaurantId: string,
    runId: string,
    paymentMethod: PaymentMethod = PaymentMethod.BANK_TRANSFER
  ) {
    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, restaurantId },
      include: { payslips: true },
    });
    if (!run) throw new PayrollError("Payroll run not found", 404, "RUN_NOT_FOUND");
    if (run.status === PayrollRunStatus.PAID) return run;
    if (run.status !== PayrollRunStatus.APPROVED) {
      throw new PayrollError("Only APPROVED payroll runs can be marked as PAID", 400, "NOT_APPROVED");
    }

    return prisma.$transaction(async (tx) => {
      for (const slip of run.payslips) {
        await tx.payslip.update({
          where: { id: slip.id },
          data: { status: PayslipStatus.PAID },
        });
        await tx.payrollPayment.create({
          data: {
            payslipId: slip.id,
            amount: slip.netPay,
            paymentMethod,
            status: PaymentStatus.COMPLETED,
            paidAt: new Date(),
          },
        });
      }

      return tx.payrollRun.update({
        where: { id: runId },
        data: { status: PayrollRunStatus.PAID },
      });
    });
  },

  async deletePayrollRun(restaurantId: string, runId: string) {
    const run = await prisma.payrollRun.findFirst({ where: { id: runId, restaurantId } });
    if (!run) throw new PayrollError("Payroll run not found", 404, "RUN_NOT_FOUND");
    if (run.status === PayrollRunStatus.APPROVED || run.status === PayrollRunStatus.PAID) {
      throw new PayrollError("Cannot delete a finalized or PAID payroll run", 409, "ALREADY_FINALIZED");
    }
    return prisma.payrollRun.delete({ where: { id: runId } });
  },

  // ── Payslips ───────────────────────────────────────────────────────────────
  async getPayslips(
    restaurantId: string,
    params?: {
      payrollRunId?: string;
      employeeId?: string;
      onlyIssued?: boolean;
      accessibleOutletIds?: string[] | null;
    }
  ) {
    const where: any = { restaurantId };
    if (params?.payrollRunId) where.payrollRunId = params.payrollRunId;
    if (params?.employeeId) where.employeeId = params.employeeId;
    if (params?.onlyIssued) {
      where.status = { in: [PayslipStatus.GENERATED, PayslipStatus.PAID] };
    }
    if (params?.accessibleOutletIds) {
      where.payrollRun = { outletId: { in: params.accessibleOutletIds } };
    }

    return prisma.payslip.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, workerType: true },
        },
        payrollRun: {
          select: { id: true, title: true, status: true, paymentDate: true, outletId: true },
        },
        earnings: true,
        deductions: true,
        payments: true,
      },
      orderBy: { periodStart: "desc" },
    });
  },

  async getPayslipById(restaurantId: string, id: string) {
    const payslip = await prisma.payslip.findFirst({
      where: { id, restaurantId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workerType: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            branding: { select: { applicationName: true, logoUrl: true } },
          },
        },
        payrollRun: {
          select: {
            id: true,
            title: true,
            status: true,
            paymentDate: true,
            outletId: true,
            outlet: { select: { id: true, name: true } },
          },
        },
        earnings: true,
        deductions: true,
        payments: true,
      },
    });
    if (!payslip) throw new PayrollError("Payslip not found", 404, "PAYSLIP_NOT_FOUND");
    return payslip;
  },
};
