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
      orderBy: { createdAt: "desc" },
    });
  },

  async getSalaryStructureByEmployee(restaurantId: string, employeeId: string) {
    const struct = await prisma.salaryStructure.findFirst({
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
    return struct;
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
    }
  ) {
    await prisma.employee.findFirstOrThrow({
      where: { id: data.employeeId, restaurantId, archivedAt: null },
    });

    const allowancesJson = data.allowances ? JSON.stringify(data.allowances) : null;
    const deductionsJson = data.deductions ? JSON.stringify(data.deductions) : null;

    // Check if structure exists
    const existing = await prisma.salaryStructure.findFirst({
      where: { restaurantId, employeeId: data.employeeId, status: "ACTIVE" },
    });

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
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : existing.effectiveFrom,
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
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      },
    });
  },

  // ── Payroll Runs ───────────────────────────────────────────────────────────
  async getPayrollRuns(restaurantId: string, outletId?: string) {
    const where: any = { restaurantId };
    if (outletId) where.outletId = outletId;

    return prisma.payrollRun.findMany({
      where,
      include: {
        outlet: { select: { id: true, name: true } },
        _count: { select: { payslips: true } },
      },
      orderBy: { periodStart: "desc" },
    });
  },

  async getPayrollRunById(restaurantId: string, id: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { id, restaurantId },
      include: {
        outlet: { select: { id: true, name: true } },
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
    if (!run) throw new Error("Payroll run not found");
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
      notes?: string;
    }
  ) {
    if (data.outletId) {
      await prisma.restaurantOutlet.findFirstOrThrow({
        where: { id: data.outletId, restaurantId },
      });
    }

    return prisma.payrollRun.create({
      data: {
        restaurantId,
        outletId: data.outletId || null,
        title: data.title,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        paymentDate: new Date(data.paymentDate),
        notes: data.notes,
        status: PayrollRunStatus.DRAFT,
      },
    });
  },

  /**
   * Execute comprehensive calculation for a payroll run.
   * Seamlessly combines:
   * 1. Approved Attendance Records (actual clock-in/out hours & overtime).
   * 2. Fallback to Scheduled Shift Assignments if no attendance punches exist.
   * 3. 1.5x Overtime Wage multiplier.
   * 4. House Tip Pooling Engine (FOH vs. BOH proportional allocation).
   * 5. Configured Allowances & Statutory Deductions.
   */
  async executePayrollCalculation(
    restaurantId: string,
    runId: string,
    processedBy: string
  ) {
    const run = await prisma.payrollRun.findFirstOrThrow({
      where: { id: runId, restaurantId },
    });

    if (run.status === PayrollRunStatus.PAID) {
      throw new Error("Cannot recalculate a payroll run that is already marked as PAID");
    }

    // 1. Fetch eligible active employees
    const employeeWhere: any = { restaurantId, archivedAt: null };
    if (run.outletId) {
      employeeWhere.outletAssignments = {
        some: { outletId: run.outletId },
      };
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      include: {
        employmentRecords: {
          where: { effectiveTo: null },
          include: {
            department: true,
            designation: true,
          },
          take: 1,
        },
        salaryStructures: {
          where: { status: "ACTIVE" },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
    });

    // 2. Fetch all approved attendance records in this date window
    const attWhere: any = {
      restaurantId,
      workDate: {
        gte: run.periodStart,
        lte: run.periodEnd,
      },
      isApproved: true,
    };
    if (run.outletId) attWhere.outletId = run.outletId;

    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: attWhere,
    });

    const attendanceMap = new Map<string, { totalWorkMins: number; overtimeMins: number; count: number }>();
    for (const r of attendanceRecords) {
      if (!attendanceMap.has(r.employeeId)) {
        attendanceMap.set(r.employeeId, { totalWorkMins: 0, overtimeMins: 0, count: 0 });
      }
      const item = attendanceMap.get(r.employeeId)!;
      item.totalWorkMins += r.totalWorkMinutes;
      item.overtimeMins += r.overtimeMinutes;
      item.count += 1;
    }

    // 3. Fetch scheduled shifts for employees who have no attendance records yet
    const shiftWhere: any = {
      restaurantId,
      shiftDate: {
        gte: run.periodStart,
        lte: run.periodEnd,
      },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    };
    if (run.outletId) shiftWhere.outletId = run.outletId;

    const scheduledShifts = await prisma.shiftAssignment.findMany({
      where: shiftWhere,
    });

    const shiftMap = new Map<string, number>();
    for (const s of scheduledShifts) {
      const [startH, startM] = s.startTime.split(":").map(Number);
      const [endH, endM] = s.endTime.split(":").map(Number);
      let durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      if (durationMinutes < 0) durationMinutes += 24 * 60; // Overnight shift
      durationMinutes = Math.max(0, durationMinutes - s.breakMinutes);
      shiftMap.set(s.employeeId, (shiftMap.get(s.employeeId) || 0) + durationMinutes);
    }

    // 4. Fetch Active Tip Pool Rule & calculate POS tips
    let totalTipsCollected = 0;
    try {
      const posSum = await prisma.posOrder.aggregate({
        where: {
          restaurantId,
          createdAt: { gte: run.periodStart, lte: run.periodEnd },
          status: "COMPLETED",
        },
        _sum: { finalAmount: true },
      });
      totalTipsCollected = Number(((Number(posSum._sum?.finalAmount || 0)) * 0.15).toFixed(2));
    } catch {
      totalTipsCollected = 0;
    }

    let activeTipRule: any = null;
    try {
      if ((prisma as any).tipPoolRule) {
        activeTipRule = await (prisma as any).tipPoolRule.findFirst({
          where: { restaurantId, isActive: true },
        });
      }
    } catch {
      activeTipRule = null;
    }

    const fohPct = activeTipRule?.fohPercentage ?? 70;
    const bohPct = activeTipRule?.bohPercentage ?? 30;

    // 5. Pre-calculate employee total hours for tip pooling
    const tipParticipants: Array<{
      employeeId: string;
      isFoh: boolean;
      hours: number;
    }> = [];

    for (const emp of employees) {
      const att = attendanceMap.get(emp.id);
      let totalMins = 0;
      if (att && att.count > 0) {
        totalMins = att.totalWorkMins;
      } else {
        totalMins = shiftMap.get(emp.id) || 0;
      }

      const activeRecord = emp.employmentRecords?.[0];
      const deptName = (activeRecord?.department?.name || "").toLowerCase();
      const desigName = (activeRecord?.designation?.name || "").toLowerCase();
      const isFoh =
        deptName.includes("front") ||
        deptName.includes("service") ||
        deptName.includes("bar") ||
        desigName.includes("server") ||
        desigName.includes("waiter") ||
        desigName.includes("bartender") ||
        desigName.includes("host");

      const hours = Number((totalMins / 60).toFixed(2));
      if (hours > 0) {
        tipParticipants.push({ employeeId: emp.id, isFoh, hours });
      }
    }

    // Allocate tip amounts per employee
    const tipShareMap = new Map<string, number>();
    if (totalTipsCollected > 0 && tipParticipants.length > 0) {
      const fohStaff = tipParticipants.filter((p) => p.isFoh);
      const bohStaff = tipParticipants.filter((p) => !p.isFoh);

      const fohTotalHours = fohStaff.reduce((sum, p) => sum + p.hours, 0);
      const bohTotalHours = bohStaff.reduce((sum, p) => sum + p.hours, 0);

      const fohPool = (totalTipsCollected * fohPct) / 100;
      const bohPool = (totalTipsCollected * bohPct) / 100;

      if (fohTotalHours > 0) {
        for (const p of fohStaff) {
          tipShareMap.set(p.employeeId, Number(((fohPool * p.hours) / fohTotalHours).toFixed(2)));
        }
      }
      if (bohTotalHours > 0) {
        for (const p of bohStaff) {
          tipShareMap.set(p.employeeId, Number(((bohPool * p.hours) / bohTotalHours).toFixed(2)));
        }
      }
    }

    // 6. Clear existing payslips for this run to prevent duplicates
    await prisma.payslip.deleteMany({
      where: { payrollRunId: run.id, restaurantId },
    });

    let runTotalGross = 0;
    let runTotalAllowances = 0;
    let runTotalDeductions = 0;
    let runTotalNet = 0;

    for (const emp of employees) {
      const salaryStruct = emp.salaryStructures[0];
      const currency = salaryStruct?.currency || "USD";
      const baseSalary = salaryStruct ? Number(salaryStruct.baseSalary) : 0;
      const hourlyRate = salaryStruct && Number(salaryStruct.hourlyRate) > 0
        ? Number(salaryStruct.hourlyRate)
        : baseSalary > 0 ? Number((baseSalary / 160).toFixed(2)) : 15.0;

      let regularHours = 0;
      let overtimeHours = 0;
      let syncCount = 0;

      const att = attendanceMap.get(emp.id);
      if (att && att.count > 0) {
        syncCount = att.count;
        const netWorkMins = Math.max(0, att.totalWorkMins - att.overtimeMins);
        regularHours = Number((netWorkMins / 60).toFixed(2));
        overtimeHours = Number((att.overtimeMins / 60).toFixed(2));
      } else {
        const scheduledMins = shiftMap.get(emp.id) || 0;
        regularHours = Number((scheduledMins / 60).toFixed(2));
        overtimeHours = 0;
      }

      // Pure Attendance-Based Base Pay Calculation (regularHours * hourlyRate)
      const calculatedBasePay = Number((regularHours * hourlyRate).toFixed(2));

      // Calculate Overtime Pay (1.5x base hourly rate)
      const overtimePay = overtimeHours > 0 ? Number((overtimeHours * hourlyRate * 1.5).toFixed(2)) : 0;
      const tipAmount = tipShareMap.get(emp.id) || 0;

      // Parse Allowances (Attendance-pro-rated for fixed sums, or % of earned base pay)
      let allowances: AllowanceItem[] = [];
      if (salaryStruct?.allowancesJson) {
        try {
          allowances = JSON.parse(salaryStruct.allowancesJson);
        } catch {
          allowances = [];
        }
      }

      let totalAllowances = 0;
      const earningsToCreate: Array<{ name: string; amount: number; type: EarningType }> = [
        {
          name: `Regular Base (${regularHours.toFixed(2)} hrs @ $${hourlyRate}/hr)`,
          amount: Math.round(calculatedBasePay * 100) / 100,
          type: EarningType.BASE,
        },
      ];

      if (overtimeHours > 0) {
        earningsToCreate.push({
          name: `Overtime (${overtimeHours.toFixed(2)} hrs @ $${(hourlyRate * 1.5).toFixed(2)}/hr)`,
          amount: Math.round(overtimePay * 100) / 100,
          type: EarningType.OVERTIME,
        });
      }

      if (tipAmount > 0) {
        earningsToCreate.push({
          name: "House Tip Pool Share",
          amount: Math.round(tipAmount * 100) / 100,
          type: EarningType.TIPS,
        });
      }

      for (const al of allowances) {
        const amt = al.isPercentage
          ? (calculatedBasePay * al.amount) / 100
          : regularHours > 0
          ? Number(((al.amount * (regularHours + overtimeHours)) / 160).toFixed(2))
          : 0;
        totalAllowances += amt;
        earningsToCreate.push({
          name: al.name,
          amount: Math.round(amt * 100) / 100,
          type: EarningType.ALLOWANCE,
        });
      }

      // Parse Deductions (Attendance-pro-rated for fixed sums, or % of earned base pay)
      let deductions: DeductionItem[] = [];
      if (salaryStruct?.deductionsJson) {
        try {
          deductions = JSON.parse(salaryStruct.deductionsJson);
        } catch {
          deductions = [];
        }
      }

      let totalDeductions = 0;
      const deductionsToCreate: Array<{ name: string; amount: number; type: DeductionType }> = [];

      for (const ded of deductions) {
        const amt = ded.isPercentage
          ? (calculatedBasePay * ded.amount) / 100
          : regularHours > 0
          ? Number(((ded.amount * (regularHours + overtimeHours)) / 160).toFixed(2))
          : 0;
        totalDeductions += amt;
        deductionsToCreate.push({
          name: ded.name,
          amount: Math.round(amt * 100) / 100,
          type: ded.type || DeductionType.TAX,
        });
      }

      const grossPay = Number((calculatedBasePay + overtimePay + tipAmount + totalAllowances).toFixed(2));
      const netPay = Math.max(0, Number((grossPay - totalDeductions).toFixed(2)));

      runTotalGross += grossPay;
      runTotalAllowances += totalAllowances;
      runTotalDeductions += totalDeductions;
      runTotalNet += netPay;

      // Create Detailed Payslip
      await prisma.payslip.create({
        data: {
          restaurantId,
          payrollRunId: run.id,
          employeeId: emp.id,
          periodStart: run.periodStart,
          periodEnd: run.periodEnd,
          currency,
          hoursWorked: new Prisma.Decimal(regularHours),
          overtimeHours: new Prisma.Decimal(overtimeHours),
          pooledTipsAmount: new Prisma.Decimal(tipAmount),
          timesheetSyncCount: syncCount,
          basePay: new Prisma.Decimal(calculatedBasePay),
          totalAllowances: new Prisma.Decimal(Number(totalAllowances.toFixed(2))),
          totalDeductions: new Prisma.Decimal(Number(totalDeductions.toFixed(2))),
          netPay: new Prisma.Decimal(netPay),
          status: PayslipStatus.DRAFT,
          earnings: {
            create: earningsToCreate.map((e) => ({
              name: e.name,
              amount: new Prisma.Decimal(e.amount),
              type: e.type,
            })),
          },
          deductions: {
            create: deductionsToCreate.map((d) => ({
              name: d.name,
              amount: new Prisma.Decimal(d.amount),
              type: d.type,
            })),
          },
        },
      });
    }

    // Update run totals and status
    return prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        totalGross: new Prisma.Decimal(Number(runTotalGross.toFixed(2))),
        totalAllowances: new Prisma.Decimal(Number(runTotalAllowances.toFixed(2))),
        totalDeductions: new Prisma.Decimal(Number(runTotalDeductions.toFixed(2))),
        totalNet: new Prisma.Decimal(Number(runTotalNet.toFixed(2))),
        status: PayrollRunStatus.CALCULATING,
        processedBy,
      },
      include: {
        payslips: {
          include: {
            employee: { select: { firstName: true, lastName: true, employeeCode: true } },
          },
        },
      },
    });
  },

  async approvePayrollRun(restaurantId: string, runId: string, approvedBy: string) {
    await prisma.payrollRun.findFirstOrThrow({ where: { id: runId, restaurantId } });

    await prisma.payslip.updateMany({
      where: { payrollRunId: runId, restaurantId },
      data: { status: PayslipStatus.GENERATED },
    });

    return prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: PayrollRunStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
      },
    });
  },

  async markPayrollPaid(
    restaurantId: string,
    runId: string,
    paymentMethod: PaymentMethod = PaymentMethod.BANK_TRANSFER
  ) {
    const run = await prisma.payrollRun.findFirstOrThrow({
      where: { id: runId, restaurantId },
      include: { payslips: true },
    });

    if (run.status !== PayrollRunStatus.APPROVED) {
      throw new Error("Only APPROVED payroll runs can be marked as PAID");
    }

    return prisma.$transaction(async (tx) => {
      // Mark all payslips as PAID and record payment
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
    const run = await prisma.payrollRun.findFirstOrThrow({ where: { id: runId, restaurantId } });
    if (run.status === PayrollRunStatus.PAID) {
      throw new Error("Cannot delete a PAID payroll run");
    }
    return prisma.payrollRun.delete({ where: { id: runId } });
  },

  // ── Payslips ───────────────────────────────────────────────────────────────
  async getPayslips(
    restaurantId: string,
    params?: { payrollRunId?: string; employeeId?: string }
  ) {
    const where: any = { restaurantId };
    if (params?.payrollRunId) where.payrollRunId = params.payrollRunId;
    if (params?.employeeId) where.employeeId = params.employeeId;

    return prisma.payslip.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, workerType: true } },
        payrollRun: { select: { id: true, title: true, status: true, paymentDate: true } },
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
            personalEmail: true,
            phone: true,
          },
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            branding: { select: { applicationName: true, logoUrl: true } },
          },
        },
        payrollRun: { select: { id: true, title: true, status: true, paymentDate: true } },
        earnings: true,
        deductions: true,
        payments: true,
      },
    });
    if (!payslip) throw new Error("Payslip not found");
    return payslip;
  },
};
