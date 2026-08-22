import { prisma } from "@/core/database/client";
import { calculateAttendanceMetrics } from "./calculator";
import crypto from "crypto";

/**
 * Hashes a 4-digit PIN for storage.
 */
export function hashPin(pin: string): string {
  const salt = "kiosk_salt_restaurant_saas";
  return crypto.pbkdf2Sync(pin, salt, 10000, 32, "sha256").toString("hex");
}

/**
 * Verifies a 4-digit PIN against stored hash.
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  const calculated = hashPin(pin);
  return calculated === storedHash;
}

export interface PunchInput {
  restaurantId: string;
  employeeId?: string;
  kioskPin?: string; // Optional if punching via tablet PIN pad
  outletId: string;
  punchType: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
  punchTime?: Date;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  ipAddress?: string;
  photoUrl?: string;
  notes?: string;
}

export async function processPunch(input: PunchInput) {
  const now = input.punchTime ? new Date(input.punchTime) : new Date();

  // 1. Locate Employee
  let employee: any = null;
  if (input.employeeId) {
    employee = await prisma.employee.findUnique({
      where: { id: input.employeeId },
      include: {
        outletAssignments: true,
      },
    });
  } else if (input.kioskPin) {
    const hashed = hashPin(input.kioskPin);
    try {
      if ((prisma as any).employee) {
        employee = await (prisma as any).employee.findFirst({
          where: {
            restaurantId: input.restaurantId,
            kioskPin: hashed,
            archivedAt: null,
          },
        });
      }
    } catch {
      // fallback
    }

    if (!employee) {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, first_name as "firstName", last_name as "lastName", employee_code as "employeeCode", restaurant_id as "restaurantId"
         FROM employees
         WHERE restaurant_id = $1 AND kiosk_pin = $2 AND archived_at IS NULL
         LIMIT 1`,
        input.restaurantId,
        hashed
      );
      employee = rows[0] || null;
    }
  }

  if (!employee) {
    throw new Error("Invalid employee identification or PIN");
  }

  // 2. Resolve work date (Midnight UTC)
  const workDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // 3. Find today's scheduled shift for this employee
  let scheduledShift: any = null;
  try {
    scheduledShift = await prisma.shiftAssignment.findFirst({
      where: {
        employeeId: employee.id,
        shiftDate: {
          gte: workDate,
          lt: new Date(workDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });
  } catch {
    // ignore
  }

  // 4. Fetch existing punches for today
  let existingPunches: any[] = [];
  if ((prisma as any).timePunch) {
    try {
      existingPunches = await (prisma as any).timePunch.findMany({
        where: {
          employeeId: employee.id,
          punchTime: {
            gte: workDate,
            lt: new Date(workDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { punchTime: "asc" },
      });
    } catch {
      existingPunches = [];
    }
  }

  if (existingPunches.length === 0) {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, punch_type as "punchType", punch_time as "punchTime"
       FROM time_punches
       WHERE employee_id = $1 AND punch_time >= $2 AND punch_time < $3
       ORDER BY punch_time ASC`,
      employee.id,
      workDate,
      new Date(workDate.getTime() + 24 * 60 * 60 * 1000)
    );
    existingPunches = rows;
  }

  // 5. Evaluate state machine
  const currentMetrics = calculateAttendanceMetrics(
    existingPunches.map((p) => ({ punchType: p.punchType, punchTime: p.punchTime })),
    scheduledShift
  );

  if (input.punchType === "CLOCK_IN") {
    if (currentMetrics.activePunchState === "CLOCKED_IN") {
      throw new Error(`${employee.firstName} is already clocked in.`);
    }
    if (currentMetrics.activePunchState === "ON_BREAK") {
      throw new Error(`${employee.firstName} is currently on break. Please end break first.`);
    }
  } else if (input.punchType === "BREAK_START") {
    if (currentMetrics.activePunchState !== "CLOCKED_IN") {
      throw new Error("Must be clocked in to start a break.");
    }
  } else if (input.punchType === "BREAK_END") {
    if (currentMetrics.activePunchState !== "ON_BREAK") {
      throw new Error("Cannot end break when not currently on break.");
    }
  } else if (input.punchType === "CLOCK_OUT") {
    if (currentMetrics.activePunchState === "NOT_CLOCKED_IN" || currentMetrics.activePunchState === "CLOCKED_OUT") {
      throw new Error("Must be clocked in before clocking out.");
    }
  }

  // 6. Record the TimePunch
  let punch: any = null;
  const punchId = crypto.randomUUID();

  if ((prisma as any).timePunch) {
    try {
      punch = await (prisma as any).timePunch.create({
        data: {
          id: punchId,
          restaurantId: input.restaurantId,
          employeeId: employee.id,
          outletId: input.outletId,
          punchType: input.punchType,
          punchTime: now,
          latitude: input.latitude,
          longitude: input.longitude,
          deviceInfo: input.deviceInfo || "Tablet Punch Kiosk",
          ipAddress: input.ipAddress,
          photoUrl: input.photoUrl,
          notes: input.notes,
        },
      });
    } catch {
      // fallback to raw query
    }
  }

  if (!punch) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO time_punches (id, restaurant_id, employee_id, outlet_id, punch_type, punch_time, latitude, longitude, device_info, ip_address, photo_url, notes, created_at)
       VALUES ($1, $2, $3, $4, $5::"PunchType", $6, $7, $8, $9, $10, $11, $12, NOW())`,
      punchId,
      input.restaurantId,
      employee.id,
      input.outletId,
      input.punchType,
      now,
      input.latitude || null,
      input.longitude || null,
      input.deviceInfo || "Tablet Punch Kiosk",
      input.ipAddress || null,
      input.photoUrl || null,
      input.notes || null
    );
    punch = { id: punchId, punchType: input.punchType, punchTime: now };
  }

  // 7. Recalculate combined attendance metrics with the new punch
  const allPunches = [...existingPunches, punch];
  const newMetrics = calculateAttendanceMetrics(
    allPunches.map((p) => ({ punchType: p.punchType, punchTime: p.punchTime })),
    scheduledShift
  );

  // 8. Upsert the Daily AttendanceRecord
  let attendanceRecord: any = null;
  if ((prisma as any).attendanceRecord) {
    try {
      attendanceRecord = await (prisma as any).attendanceRecord.upsert({
        where: {
          employeeId_workDate: {
            employeeId: employee.id,
            workDate,
          },
        },
        create: {
          restaurantId: input.restaurantId,
          employeeId: employee.id,
          outletId: input.outletId,
          shiftAssignmentId: scheduledShift?.id || null,
          workDate,
          status: newMetrics.status,
          clockInTime: newMetrics.clockInTime,
          clockOutTime: newMetrics.clockOutTime,
          totalWorkMinutes: newMetrics.totalWorkMinutes,
          totalBreakMinutes: newMetrics.totalBreakMinutes,
          overtimeMinutes: newMetrics.overtimeMinutes,
          lateMinutes: newMetrics.lateMinutes,
          earlyExitMinutes: newMetrics.earlyExitMinutes,
        },
        update: {
          status: newMetrics.status,
          clockInTime: newMetrics.clockInTime,
          clockOutTime: newMetrics.clockOutTime,
          totalWorkMinutes: newMetrics.totalWorkMinutes,
          totalBreakMinutes: newMetrics.totalBreakMinutes,
          overtimeMinutes: newMetrics.overtimeMinutes,
          lateMinutes: newMetrics.lateMinutes,
          earlyExitMinutes: newMetrics.earlyExitMinutes,
        },
      });
    } catch {
      // fallback to raw query
    }
  }

  if (!attendanceRecord) {
    const recordId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO attendance_records (id, restaurant_id, employee_id, outlet_id, shift_assignment_id, work_date, status, clock_in_time, clock_out_time, total_work_minutes, total_break_minutes, overtime_minutes, late_minutes, early_exit_minutes, is_approved, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::"AttendanceStatus", $8, $9, $10, $11, $12, $13, $14, false, NOW(), NOW())
       ON CONFLICT (employee_id, work_date) DO UPDATE SET
         status = EXCLUDED.status,
         clock_in_time = EXCLUDED.clock_in_time,
         clock_out_time = EXCLUDED.clock_out_time,
         total_work_minutes = EXCLUDED.total_work_minutes,
         total_break_minutes = EXCLUDED.total_break_minutes,
         overtime_minutes = EXCLUDED.overtime_minutes,
         late_minutes = EXCLUDED.late_minutes,
         early_exit_minutes = EXCLUDED.early_exit_minutes,
         updated_at = NOW()`,
      recordId,
      input.restaurantId,
      employee.id,
      input.outletId,
      scheduledShift?.id || null,
      workDate,
      newMetrics.status,
      newMetrics.clockInTime,
      newMetrics.clockOutTime,
      newMetrics.totalWorkMinutes,
      newMetrics.totalBreakMinutes,
      newMetrics.overtimeMinutes,
      newMetrics.lateMinutes,
      newMetrics.earlyExitMinutes
    );
    attendanceRecord = { id: recordId, workDate, status: newMetrics.status };
  }

  // Associate punch with the attendance record
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE time_punches SET attendance_record_id = $1 WHERE id = $2`,
      attendanceRecord.id,
      punch.id
    );
  } catch {
    // ignore
  }

  return {
    success: true,
    employee: {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeCode: employee.employeeCode,
    },
    punch,
    attendanceRecord,
    metrics: newMetrics,
  };
}
