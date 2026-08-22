import { prisma } from "@/core/database/client";
import { calculateTipDistribution, StaffTipParticipant, TipPoolRuleConfig } from "./tipPoolEngine";

export interface AttendanceSyncResult {
  payrollRunId: string;
  totalSyncedEmployees: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalTipsDistributed: number;
  syncedPayslips: {
    employeeId: string;
    employeeName: string;
    regularHours: number;
    overtimeHours: number;
    pooledTips: number;
    grossPay: number;
    netPay: number;
  }[];
}

export async function syncAttendanceToPayrollRun(
  restaurantId: string,
  payrollRunId: string,
  customTipTotal?: number
): Promise<AttendanceSyncResult> {
  // 1. Fetch the Payroll Run
  const payrollRun = await prisma.payrollRun.findUnique({
    where: {
      id: payrollRunId,
      restaurantId,
    },
    include: {
      outlet: true,
    },
  });

  if (!payrollRun) {
    throw new Error("Payroll run not found.");
  }

  const { periodStart, periodEnd, outletId } = payrollRun;

  // 2. Fetch all approved attendance records in this date window
  const attWhere: any = {
    restaurantId,
    workDate: {
      gte: periodStart,
      lte: periodEnd,
    },
    isApproved: true,
  };
  if (outletId) attWhere.outletId = outletId;

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: attWhere,
    include: {
      employee: {
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
            take: 1,
          },
        },
      },
    },
  });

  // Group attendance records by employee
  const employeeMap = new Map<
    string,
    {
      employee: any;
      totalWorkMinutes: number;
      overtimeMinutes: number;
      recordCount: number;
    }
  >();

  for (const record of attendanceRecords) {
    const empId = record.employeeId;
    if (!employeeMap.has(empId)) {
      employeeMap.set(empId, {
        employee: record.employee,
        totalWorkMinutes: 0,
        overtimeMinutes: 0,
        recordCount: 0,
      });
    }

    const entry = employeeMap.get(empId)!;
    entry.totalWorkMinutes += record.totalWorkMinutes;
    entry.overtimeMinutes += record.overtimeMinutes;
    entry.recordCount += 1;
  }

  // 3. Fetch POS sales in this date range to estimate tips if not passed explicitly
  let totalTips = customTipTotal;
  if (totalTips === undefined) {
    try {
      const posSum = await prisma.posOrder.aggregate({
        where: {
          restaurantId,
          createdAt: { gte: periodStart, lte: periodEnd },
          status: "COMPLETED",
        },
        _sum: { finalAmount: true },
      });
      // Standard 15% tip calculation on completed orders
      const sales = Number(posSum._sum?.finalAmount || 0);
      totalTips = Number((sales * 0.15).toFixed(2));
    } catch {
      totalTips = 0;
    }
  }

  // 4. Fetch Active Tip Pool Rule
  let tipRule: TipPoolRuleConfig = {
    fohPercentage: 70,
    bohPercentage: 30,
    distributionMethod: "HOURS_WORKED",
  };

  let storedRule: any = null;
  try {
    if ((prisma as any).tipPoolRule) {
      storedRule = await (prisma as any).tipPoolRule.findFirst({
        where: { restaurantId, isActive: true },
      });
    }
  } catch {
    storedRule = null;
  }

  if (storedRule) {
    tipRule = {
      fohPercentage: storedRule.fohPercentage,
      bohPercentage: storedRule.bohPercentage,
      distributionMethod: storedRule.distributionMethod as any,
      rolePoints: storedRule.rolePointsJson ? (storedRule.rolePointsJson as any) : undefined,
    };
  }

  // 5. Build Staff Tip Participants list
  const participants: StaffTipParticipant[] = [];

  for (const [empId, entry] of employeeMap.entries()) {
    const emp = entry.employee;
    const activeEmployment = emp.employmentRecords?.[0];
    const deptName = activeEmployment?.department?.name || "";
    const desigName = activeEmployment?.designation?.name || "";

    // Determine FOH vs BOH based on department / designation
    const isFoh =
      deptName.toLowerCase().includes("front") ||
      deptName.toLowerCase().includes("service") ||
      deptName.toLowerCase().includes("bar") ||
      desigName.toLowerCase().includes("server") ||
      desigName.toLowerCase().includes("waiter") ||
      desigName.toLowerCase().includes("bartender") ||
      desigName.toLowerCase().includes("host");

    const totalHours = Number((entry.totalWorkMinutes / 60).toFixed(2));

    participants.push({
      employeeId: empId,
      name: `${emp.firstName} ${emp.lastName}`,
      departmentName: deptName,
      designationName: desigName,
      isFoh,
      hoursWorked: totalHours,
    });
  }

  // 6. Calculate Tip Distribution
  const tipResult = calculateTipDistribution(totalTips || 0, participants, tipRule);

  // Map employeeId to their calculated tip amount
  const tipShareMap = new Map<string, number>();
  for (const alloc of tipResult.allocations) {
    tipShareMap.set(alloc.employeeId, alloc.tipAmount);
  }

  // 7. Update/Create Payslip for each employee with aggregated hours and tips
  let totalRegularHrs = 0;
  let totalOtHrs = 0;
  let totalGrossSum = 0;
  let totalNetSum = 0;
  const syncedPayslips: AttendanceSyncResult["syncedPayslips"] = [];

  for (const [empId, entry] of employeeMap.entries()) {
    const emp = entry.employee;
    const salaryStructure = emp.salaryStructures?.[0];

    const netWorkMins = Math.max(0, entry.totalWorkMinutes - entry.overtimeMinutes);
    const regularHours = Number((netWorkMins / 60).toFixed(2));
    const overtimeHours = Number((entry.overtimeMinutes / 60).toFixed(2));
    const tipAmount = tipShareMap.get(empId) || 0;

    totalRegularHrs += regularHours;
    totalOtHrs += overtimeHours;

    // Wage rates
    const baseSalary = Number(salaryStructure?.baseSalary || 0);
    const hourlyRate =
      Number(salaryStructure?.hourlyRate) > 0
        ? Number(salaryStructure.hourlyRate)
        : baseSalary > 0 && salaryStructure?.payFrequency === "HOURLY"
        ? baseSalary
        : baseSalary > 0
        ? Number((baseSalary / 160).toFixed(2))
        : 15.0;

    const basePay = Number((regularHours * hourlyRate).toFixed(2));
    const overtimePay = Number((overtimeHours * hourlyRate * 1.5).toFixed(2));
    const totalAllowances = Number(salaryStructure?.totalAllowances || 0);
    const totalDeductions = Number(salaryStructure?.totalDeductions || 0);

    const grossEarnings = Number((basePay + overtimePay + tipAmount + totalAllowances).toFixed(2));
    const netPay = Math.max(0, Number((grossEarnings - totalDeductions).toFixed(2)));

    totalGrossSum += grossEarnings;
    totalNetSum += netPay;

    // Upsert Payslip
    const payslip = await prisma.payslip.upsert({
      where: {
        payrollRunId_employeeId: {
          payrollRunId,
          employeeId: empId,
        },
      },
      create: {
        restaurantId,
        payrollRunId,
        employeeId: empId,
        periodStart,
        periodEnd,
        hoursWorked: regularHours,
        overtimeHours: overtimeHours,
        pooledTipsAmount: tipAmount,
        timesheetSyncCount: entry.recordCount,
        basePay,
        totalAllowances,
        totalDeductions,
        netPay,
        status: "GENERATED",
      },
      update: {
        hoursWorked: regularHours,
        overtimeHours: overtimeHours,
        pooledTipsAmount: tipAmount,
        timesheetSyncCount: entry.recordCount,
        basePay,
        totalAllowances,
        totalDeductions,
        netPay,
        status: "GENERATED",
      },
    });

    // Remove old earnings and insert detailed itemized earnings
    await prisma.payrollEarning.deleteMany({
      where: { payslipId: payslip.id },
    });

    const earningsToCreate: any[] = [
      {
        payslipId: payslip.id,
        name: `Regular Base (${regularHours} hrs @ $${hourlyRate}/hr)`,
        amount: basePay,
        type: "BASE",
      },
    ];

    if (overtimeHours > 0) {
      earningsToCreate.push({
        payslipId: payslip.id,
        name: `Overtime (${overtimeHours} hrs @ $${(hourlyRate * 1.5).toFixed(2)}/hr)`,
        amount: overtimePay,
        type: "OVERTIME",
      });
    }

    if (tipAmount > 0) {
      earningsToCreate.push({
        payslipId: payslip.id,
        name: "House Tip Pool Share",
        amount: tipAmount,
        type: "TIPS",
      });
    }

    await prisma.payrollEarning.createMany({
      data: earningsToCreate,
    });

    syncedPayslips.push({
      employeeId: empId,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      regularHours,
      overtimeHours,
      pooledTips: tipAmount,
      grossPay: grossEarnings,
      netPay,
    });
  }

  // 8. Record TipPoolRun history
  if (totalTips && totalTips > 0) {
    try {
      if ((prisma as any).tipPoolRun) {
        await (prisma as any).tipPoolRun.create({
          data: {
            restaurantId,
            payrollRunId,
            periodStart,
            periodEnd,
            totalCollectedTips: totalTips,
            fohPoolAmount: tipResult.fohPoolAmount,
            bohPoolAmount: tipResult.bohPoolAmount,
            distributionsJson: tipResult.allocations as any,
          },
        });
      }
    } catch {
      // ignore
    }
  }

  // Update PayrollRun status & totals
  await prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: "CALCULATING",
      totalGross: totalGrossSum,
      totalNet: totalNetSum,
    },
  });

  return {
    payrollRunId,
    totalSyncedEmployees: employeeMap.size,
    totalRegularHours: Number(totalRegularHrs.toFixed(2)),
    totalOvertimeHours: Number(totalOtHrs.toFixed(2)),
    totalTipsDistributed: tipResult.totalDistributedTips,
    syncedPayslips,
  };
}
