import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getAttendanceActorContext } from "@/core/attendance/authHelper";
import {
  AttendanceError,
  correctAndApproveAttendance,
} from "@/core/attendance/punchService";
import { z } from "zod";

const patchAttendanceSchema = z.object({
  id: z.string().min(1),
  isApproved: z.boolean().optional(),
  totalWorkMinutes: z.number().int().min(0).optional(),
  totalBreakMinutes: z.number().int().min(0).optional(),
  overtimeMinutes: z.number().int().min(0).optional(),
  managerNotes: z.string().optional(),
  correctionReason: z.string().optional(),
  status: z
    .enum([
      "PRESENT",
      "LATE",
      "ON_BREAK",
      "EARLY_DEPARTURE",
      "HALF_DAY",
      "ABSENT",
      "ON_LEAVE",
    ])
    .optional(),
  addMissedPunch: z
    .object({
      punchType: z.enum(["CLOCK_IN", "CLOCK_OUT", "BREAK_START", "BREAK_END"]),
      punchTime: z.string().min(1),
    })
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;

    const auth = await getAttendanceActorContext({ outletId });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const employeeId = searchParams.get("employeeId");
    const isApproved = searchParams.get("isApproved");
    const needsReview = searchParams.get("needsReview");

    const whereClause: any = {
      restaurantId: auth.ctx.restaurantId,
    };

    if (outletId) {
      whereClause.outletId = outletId;
    } else if (auth.ctx.accessibleOutletIds !== null) {
      whereClause.outletId = {
        in:
          auth.ctx.accessibleOutletIds.length > 0
            ? auth.ctx.accessibleOutletIds
            : ["__none__"],
      };
    }

    // Self-service fallback if user only has view_my_attendance
    if (!auth.ctx.canManageAttendance && !auth.ctx.isAdmin && auth.ctx.employeeId && !auth.ctx.canViewAttendance) {
      whereClause.employeeId = auth.ctx.employeeId;
    } else if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    if (isApproved !== null && isApproved !== undefined && isApproved !== "") {
      whereClause.isApproved = isApproved === "true";
    }
    if (needsReview === "true") {
      whereClause.OR = [{ needsReview: true }, { clockOutTime: null }];
    }

    if (startDate && endDate) {
      whereClause.workDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      whereClause.workDate = { gte: new Date(startDate) };
    }

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workerType: true,
            employmentRecords: {
              where: { effectiveTo: null },
              include: {
                department: { select: { name: true } },
                designation: { select: { name: true } },
              },
              take: 1,
            },
          },
        },
        outlet: { select: { id: true, name: true, timezone: true } },
        shiftAssignment: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            breakMinutes: true,
          },
        },
        timePunches: {
          orderBy: { punchTime: "asc" },
          select: {
            id: true,
            punchType: true,
            punchTime: true,
            isManualAdjustment: true,
            adjustedBy: true,
            adjustmentReason: true,
            deviceInfo: true,
          },
        },
      },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    const mapped = records.map((r) => {
      const flags = Array.isArray(r.exceptionFlags)
        ? ([...(r.exceptionFlags as string[])] as string[])
        : [];
      const hasMissedClockOut = Boolean(r.clockInTime && !r.clockOutTime);
      if (hasMissedClockOut && !flags.includes("MISSED_CLOCK_OUT")) {
        flags.push("MISSED_CLOCK_OUT");
      }
      return {
        ...r,
        exceptionFlags: flags,
        needsReview: r.needsReview || (hasMissedClockOut && !r.isApproved),
      };
    });

    return NextResponse.json({
      success: true,
      records: mapped,
      permissions: {
        canManageAttendance: auth.ctx.canManageAttendance,
      },
    });
  } catch (error: any) {
    console.error("List Attendance Records Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAttendanceActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const result = patchAttendanceSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid patch payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    const updated = await correctAndApproveAttendance({
      restaurantId: auth.ctx.restaurantId,
      recordId: data.id,
      actor: { userId: auth.ctx.userId, userEmail: auth.ctx.userEmail },
      accessibleOutletIds: auth.ctx.accessibleOutletIds,
      addMissedPunch: data.addMissedPunch
        ? {
            punchType: data.addMissedPunch.punchType,
            punchTime: new Date(data.addMissedPunch.punchTime),
          }
        : undefined,
      totalWorkMinutes: data.totalWorkMinutes,
      totalBreakMinutes: data.totalBreakMinutes,
      overtimeMinutes: data.overtimeMinutes,
      status: data.status,
      managerNotes: data.managerNotes,
      correctionReason: data.correctionReason,
      isApproved: data.isApproved,
    });

    return NextResponse.json({ success: true, record: updated });
  } catch (error: any) {
    if (error instanceof AttendanceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Patch Attendance Record Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
  }
}
