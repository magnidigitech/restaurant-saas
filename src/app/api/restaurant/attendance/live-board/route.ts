import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getAttendanceActorContext } from "@/core/attendance/authHelper";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;

    const auth = await getAttendanceActorContext({ outletId });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const now = new Date();
    const todayMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const tomorrowMidnight = new Date(
      todayMidnight.getTime() + 24 * 60 * 60 * 1000
    );

    const whereClause: any = {
      restaurantId: auth.ctx.restaurantId,
      workDate: {
        gte: todayMidnight,
        lt: tomorrowMidnight,
      },
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

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            profilePhotoUrl: true,
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
        outlet: { select: { id: true, name: true } },
        shiftAssignment: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
          },
        },
        timePunches: {
          orderBy: { punchTime: "desc" },
          take: 5,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    let clockedInCount = 0;
    let onBreakCount = 0;
    let lateCount = 0;
    let leftCount = 0;

    for (const rec of records) {
      if (rec.status === "ON_BREAK") {
        onBreakCount++;
      } else if (rec.status === "PRESENT") {
        if (!rec.clockOutTime) clockedInCount++;
        else leftCount++;
      } else if (rec.status === "LATE") {
        lateCount++;
        if (!rec.clockOutTime) clockedInCount++;
        else leftCount++;
      } else if (rec.status === "EARLY_DEPARTURE" || rec.status === "HALF_DAY") {
        leftCount++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        clockedInCount,
        onBreakCount,
        lateCount,
        completedShiftsCount: leftCount,
        totalScheduledToday: records.length,
      },
      records,
    });
  } catch (error: any) {
    console.error("Live Board Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
