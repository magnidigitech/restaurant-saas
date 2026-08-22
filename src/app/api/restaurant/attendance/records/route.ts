import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const patchAttendanceSchema = z.object({
  id: z.string().min(1),
  isApproved: z.boolean().optional(),
  totalWorkMinutes: z.number().optional(),
  totalBreakMinutes: z.number().optional(),
  overtimeMinutes: z.number().optional(),
  managerNotes: z.string().optional(),
  status: z.enum(["PRESENT", "LATE", "ON_BREAK", "EARLY_DEPARTURE", "HALF_DAY", "ABSENT", "ON_LEAVE"]).optional(),
});

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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const employeeId = searchParams.get("employeeId");
    const outletId = searchParams.get("outletId");
    const isApproved = searchParams.get("isApproved");

    let records: any[] = [];

    if ((prisma as any).attendanceRecord) {
      try {
        const whereClause: any = {
          restaurantId: session.activeRestaurantId,
        };

        if (employeeId) whereClause.employeeId = employeeId;
        if (outletId) whereClause.outletId = outletId;
        if (isApproved !== null && isApproved !== undefined) {
          whereClause.isApproved = isApproved === "true";
        }

        if (startDate && endDate) {
          whereClause.workDate = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        } else if (startDate) {
          whereClause.workDate = { gte: new Date(startDate) };
        }

        records = await (prisma as any).attendanceRecord.findMany({
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
            outlet: { select: { id: true, name: true } },
            shiftAssignment: {
              select: {
                id: true,
                startTime: true,
                endTime: true,
              },
            },
            timePunches: {
              orderBy: { punchTime: "asc" },
            },
          },
          orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
          take: 200,
        });
      } catch {
        records = [];
      }
    }

    if (records.length === 0) {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT ar.id, ar.work_date as "workDate", ar.status, ar.clock_in_time as "clockInTime", ar.clock_out_time as "clockOutTime",
                ar.total_work_minutes as "totalWorkMinutes", ar.total_break_minutes as "totalBreakMinutes",
                ar.overtime_minutes as "overtimeMinutes", ar.late_minutes as "lateMinutes", ar.is_approved as "isApproved",
                json_build_object('id', e.id, 'firstName', e.first_name, 'lastName', e.last_name, 'employeeCode', e.employee_code) as employee,
                json_build_object('id', o.id, 'name', o.name) as outlet
         FROM attendance_records ar
         JOIN employees e ON ar.employee_id = e.id
         JOIN restaurant_outlets o ON ar.outlet_id = o.id
         WHERE ar.restaurant_id = $1
         ORDER BY ar.work_date DESC LIMIT 200`,
        session.activeRestaurantId
      );
      records = rows;
    }

    return NextResponse.json({ success: true, records });
  } catch (error: any) {
    console.error("List Attendance Records Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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
    const result = patchAttendanceSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid patch payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    const isApprovedVal = data.isApproved !== undefined ? data.isApproved : false;

    await prisma.$executeRawUnsafe(
      `UPDATE attendance_records SET
         is_approved = COALESCE($1, is_approved),
         approved_by = CASE WHEN $1 = true THEN $2 ELSE approved_by END,
         approved_at = CASE WHEN $1 = true THEN NOW() ELSE approved_at END,
         manager_notes = COALESCE($3, manager_notes),
         updated_at = NOW()
       WHERE id = $4 AND restaurant_id = $5`,
      data.isApproved,
      session.userId,
      data.managerNotes || null,
      data.id,
      session.activeRestaurantId
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Patch Attendance Record Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
