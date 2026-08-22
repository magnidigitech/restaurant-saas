import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { calculateTipDistribution, StaffTipParticipant, TipPoolRuleConfig } from "@/core/payroll/tipPoolEngine";
import { z } from "zod";

const calculateTipSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  customTipAmount: z.number().min(0).optional(),
  outletId: z.string().optional(),
  fohPercentage: z.number().min(0).max(100).default(70),
  bohPercentage: z.number().min(0).max(100).default(30),
  distributionMethod: z.enum(["HOURS_WORKED", "EQUAL_SPLIT", "ROLE_POINT_SYSTEM"]).default("HOURS_WORKED"),
  rolePoints: z.record(z.string(), z.number()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = calculateTipSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid calculation payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    // 1. Fetch POS tips in period if not passed
    let totalTips = data.customTipAmount;
    if (totalTips === undefined) {
      try {
        const posSum = await prisma.posOrder.aggregate({
          where: {
            restaurantId: session.activeRestaurantId,
            createdAt: { gte: start, lte: end },
            status: "COMPLETED",
          },
          _sum: { finalAmount: true },
        });
        const sales = Number(posSum._sum?.finalAmount || 0);
        totalTips = Number((sales * 0.15).toFixed(2));
      } catch {
        totalTips = 0;
      }
    }

    // 2. Fetch approved attendance records in period
    const attWhere: any = {
      restaurantId: session.activeRestaurantId,
      workDate: { gte: start, lte: end },
      isApproved: true,
    };
    if (data.outletId) attWhere.outletId = data.outletId;

    const records = await prisma.attendanceRecord.findMany({
      where: attWhere,
      include: {
        employee: {
          include: {
            employmentRecords: {
              where: { effectiveTo: null },
              include: { department: true, designation: true },
              take: 1,
            },
          },
        },
      },
    });

    // Group hours by employee
    const staffHoursMap = new Map<string, { employee: any; totalMinutes: number }>();
    for (const r of records) {
      if (!staffHoursMap.has(r.employeeId)) {
        staffHoursMap.set(r.employeeId, { employee: r.employee, totalMinutes: 0 });
      }
      staffHoursMap.get(r.employeeId)!.totalMinutes += r.totalWorkMinutes;
    }

    // Build participants
    const participants: StaffTipParticipant[] = [];
    for (const [empId, entry] of staffHoursMap.entries()) {
      const emp = entry.employee;
      const activeRecord = emp.employmentRecords?.[0];
      const deptName = activeRecord?.department?.name || "";
      const desigName = activeRecord?.designation?.name || "";

      const isFoh =
        deptName.toLowerCase().includes("front") ||
        deptName.toLowerCase().includes("service") ||
        deptName.toLowerCase().includes("bar") ||
        desigName.toLowerCase().includes("server") ||
        desigName.toLowerCase().includes("waiter") ||
        desigName.toLowerCase().includes("bartender") ||
        desigName.toLowerCase().includes("host");

      const hoursWorked = Number((entry.totalMinutes / 60).toFixed(2));

      participants.push({
        employeeId: empId,
        name: `${emp.firstName} ${emp.lastName}`,
        departmentName: deptName,
        designationName: desigName,
        isFoh,
        hoursWorked,
      });
    }

    const ruleConfig: TipPoolRuleConfig = {
      fohPercentage: data.fohPercentage,
      bohPercentage: data.bohPercentage,
      distributionMethod: data.distributionMethod,
      rolePoints: data.rolePoints,
    };

    const calculation = calculateTipDistribution(totalTips || 0, participants, ruleConfig);

    return NextResponse.json({
      success: true,
      calculation,
      totalParticipants: participants.length,
      fohCount: participants.filter((p) => p.isFoh).length,
      bohCount: participants.filter((p) => !p.isFoh).length,
    });
  } catch (error: any) {
    console.error("Calculate Tip Pool Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
