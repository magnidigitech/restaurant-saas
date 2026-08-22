import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId");

    const now = new Date();
    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);

    let records: any[] = [];

    if ((prisma as any).attendanceRecord) {
      try {
        const whereClause: any = {
          restaurantId: session.activeRestaurantId,
          workDate: {
            gte: todayMidnight,
            lt: tomorrowMidnight,
          },
        };
        if (outletId) whereClause.outletId = outletId;

        records = await (prisma as any).attendanceRecord.findMany({
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
      } catch {
        records = [];
      }
    }

    if (records.length === 0) {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT ar.id, ar.status, ar.clock_in_time as "clockInTime", ar.clock_out_time as "clockOutTime",
                ar.total_work_minutes as "totalWorkMinutes", ar.total_break_minutes as "totalBreakMinutes",
                ar.overtime_minutes as "overtimeMinutes", ar.late_minutes as "lateMinutes",
                json_build_object('id', e.id, 'firstName', e.first_name, 'lastName', e.last_name, 'employeeCode', e.employee_code) as employee,
                json_build_object('id', o.id, 'name', o.name) as outlet
         FROM attendance_records ar
         JOIN employees e ON ar.employee_id = e.id
         JOIN restaurant_outlets o ON ar.outlet_id = o.id
         WHERE ar.restaurant_id = $1 AND ar.work_date >= $2 AND ar.work_date < $3
         ORDER BY ar.updated_at DESC`,
        session.activeRestaurantId,
        todayMidnight,
        tomorrowMidnight
      );
      records = rows;
    }

    // Aggregate Stats
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

    let totalScheduled = 0;
    try {
      totalScheduled = await prisma.shiftAssignment.count({
        where: {
          restaurantId: session.activeRestaurantId,
          shiftDate: { gte: todayMidnight, lt: tomorrowMidnight },
        },
      });
    } catch {
      totalScheduled = 0;
    }

    return NextResponse.json({
      success: true,
      stats: {
        clockedInCount,
        onBreakCount,
        lateCount,
        completedShiftsCount: leftCount,
        totalScheduledToday: totalScheduled,
      },
      records,
    });
  } catch (error: any) {
    console.error("Attendance Live Board Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
