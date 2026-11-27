import { prisma } from "@/core/database/client";
import {
  calculateAttendanceMetrics,
  formatUtcToLocalDateKey,
  timeStringToMinutes,
} from "./calculator";
import crypto from "crypto";
import { sanitizeAuditPayload } from "@/modules/workforce/service";

export function hashPin(pin: string): string {
  const salt = "kiosk_salt_restaurant_saas";
  return crypto.pbkdf2Sync(pin, salt, 10000, 32, "sha256").toString("hex");
}

export function verifyPin(pin: string, storedHash: string): boolean {
  const calculated = hashPin(pin);
  return calculated === storedHash;
}

export class AttendanceError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(
    message: string,
    status = 400,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// In-memory sliding-window rate limiter for kiosk PIN attempts
const pinRateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 12;

export function checkKioskRateLimit(key: string) {
  const now = Date.now();
  const prev = (pinRateLimitMap.get(key) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (prev.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    throw new AttendanceError(
      "Too many kiosk PIN attempts. Please wait a few minutes and try again.",
      429,
      "RATE_LIMITED"
    );
  }
  prev.push(now);
  pinRateLimitMap.set(key, prev);
}

export function clearKioskRateLimit(key: string) {
  pinRateLimitMap.delete(key);
}

const BLOCKED_EMP_STATUSES = ["TERMINATED", "RESIGNED", "SUSPENDED"];

async function assertEmployeeOutletEligibility(
  restaurantId: string,
  employeeId: string,
  outletId: string,
  asOfDate: Date
) {
  const [assignments, empRecords] = await Promise.all([
    prisma.employeeOutletAssignment.findMany({
      where: { restaurantId, employeeId },
    }),
    prisma.employmentRecord.findMany({
      where: { restaurantId, employeeId, effectiveTo: null },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      take: 1,
      select: { primaryOutletId: true, effectiveFrom: true, status: true },
    }),
  ]);

  const latestStatus = empRecords[0]?.status;
  if (latestStatus && BLOCKED_EMP_STATUSES.includes(latestStatus)) {
    throw new AttendanceError(
      `Employee status (${latestStatus}) is not eligible to clock in at this outlet.`,
      403,
      "EMPLOYEE_NOT_ACTIVE"
    );
  }

  if (assignments.length === 0 && empRecords.every((r) => !r.primaryOutletId)) {
    return;
  }

  const targetMs = asOfDate.getTime();
  const eligible = new Set<string>();

  for (const a of assignments) {
    const fromMs = new Date(a.effectiveFrom).setUTCHours(0, 0, 0, 0);
    const toMs = a.effectiveTo
      ? new Date(a.effectiveTo).setUTCHours(23, 59, 59, 999)
      : Number.POSITIVE_INFINITY;
    if (targetMs >= fromMs && targetMs <= toMs) {
      eligible.add(a.outletId);
    }
  }

  for (const r of empRecords) {
    if (!r.primaryOutletId) continue;
    const fromMs = new Date(r.effectiveFrom).setUTCHours(0, 0, 0, 0);
    if (targetMs >= fromMs) {
      eligible.add(r.primaryOutletId);
    }
  }

  if (!eligible.has(outletId)) {
    throw new AttendanceError(
      "You are not scheduled or assigned to work at this outlet.",
      403,
      "WRONG_OUTLET"
    );
  }
}

async function resolveWorkDateAndPublishedShift(params: {
  restaurantId: string;
  employeeId: string;
  outletId: string;
  outletTimezone: string;
  punchTime: Date;
  punchType: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
}) {
  const localDateKey = formatUtcToLocalDateKey(
    params.punchTime,
    params.outletTimezone
  );
  const todayWorkDate = new Date(`${localDateKey}T00:00:00Z`);
  const prevWorkDate = new Date(todayWorkDate);
  prevWorkDate.setUTCDate(prevWorkDate.getUTCDate() - 1);

  // If employee has an open AttendanceRecord from yesterday (overnight shift), attach BREAK/CLOCK_OUT to yesterday
  const openYesterdayRecord = await prisma.attendanceRecord.findUnique({
    where: {
      employeeId_workDate: {
        employeeId: params.employeeId,
        workDate: prevWorkDate,
      },
    },
    include: {
      shiftAssignment: true,
      timePunches: { orderBy: { punchTime: "asc" } },
    },
  });

  if (
    openYesterdayRecord &&
    openYesterdayRecord.outletId === params.outletId &&
    openYesterdayRecord.clockInTime &&
    !openYesterdayRecord.clockOutTime &&
    params.punchType !== "CLOCK_IN"
  ) {
    return {
      workDate: prevWorkDate,
      existingRecord: openYesterdayRecord,
      matchedShift: openYesterdayRecord.shiftAssignment || null,
      exceptionFlags: Array.isArray(openYesterdayRecord.exceptionFlags)
        ? (openYesterdayRecord.exceptionFlags as string[])
        : [],
    };
  }

  // Otherwise check existing record for today
  const existingTodayRecord = await prisma.attendanceRecord.findUnique({
    where: {
      employeeId_workDate: {
        employeeId: params.employeeId,
        workDate: todayWorkDate,
      },
    },
    include: {
      shiftAssignment: true,
      timePunches: { orderBy: { punchTime: "asc" } },
    },
  });

  if (existingTodayRecord) {
    return {
      workDate: todayWorkDate,
      existingRecord: existingTodayRecord,
      matchedShift: existingTodayRecord.shiftAssignment || null,
      exceptionFlags: Array.isArray(existingTodayRecord.exceptionFlags)
        ? (existingTodayRecord.exceptionFlags as string[])
        : [],
    };
  }

  // Match against PUBLISHED roster assignments ONLY (never DRAFT or draftRevisionJson)
  const publishedMatches = await prisma.shiftAssignment.findMany({
    where: {
      restaurantId: params.restaurantId,
      employeeId: params.employeeId,
      outletId: params.outletId,
      shiftDate: todayWorkDate,
      roster: { status: "PUBLISHED" },
    },
    orderBy: { startTime: "asc" },
  });

  const exceptionFlags: string[] = [];
  let matchedShift = publishedMatches[0] || null;

  if (publishedMatches.length === 0) {
    // Check if clocking in late for an overnight shift that started yesterday
    const yesterdayOvernight = await prisma.shiftAssignment.findMany({
      where: {
        restaurantId: params.restaurantId,
        employeeId: params.employeeId,
        outletId: params.outletId,
        shiftDate: prevWorkDate,
        roster: { status: "PUBLISHED" },
      },
    });
    const overnightMatch = yesterdayOvernight.find(
      (s) => timeStringToMinutes(s.endTime) <= timeStringToMinutes(s.startTime)
    );
    if (overnightMatch) {
      matchedShift = overnightMatch;
      return {
        workDate: prevWorkDate,
        existingRecord: openYesterdayRecord,
        matchedShift,
        exceptionFlags,
      };
    }

    exceptionFlags.push("UNSCHEDULED");
  } else if (publishedMatches.length > 1) {
    exceptionFlags.push("AMBIGUOUS_SHIFT");
  }

  return {
    workDate: todayWorkDate,
    existingRecord: null,
    matchedShift,
    exceptionFlags,
  };
}

export function getValidActionsForState(
  activePunchState: "NOT_CLOCKED_IN" | "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT"
): Array<"CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT"> {
  switch (activePunchState) {
    case "NOT_CLOCKED_IN":
    case "CLOCKED_OUT":
      return ["CLOCK_IN"];
    case "CLOCKED_IN":
      return ["BREAK_START", "CLOCK_OUT"];
    case "ON_BREAK":
      return ["BREAK_END"];
  }
}

export async function identifyKioskEmployee(params: {
  restaurantId: string;
  outletId: string;
  kioskPin: string;
  ipAddress?: string;
}) {
  const rateKey = `${params.ipAddress || "local"}:${params.outletId}`;
  checkKioskRateLimit(rateKey);

  const outlet = await prisma.restaurantOutlet.findFirst({
    where: { id: params.outletId, restaurantId: params.restaurantId },
    select: { id: true, name: true, timezone: true },
  });
  if (!outlet) {
    throw new AttendanceError("Outlet not found", 404);
  }

  const hashed = hashPin(params.kioskPin);
  const employee = await prisma.employee.findFirst({
    where: {
      restaurantId: params.restaurantId,
      kioskPin: hashed,
      archivedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
    },
  });

  if (!employee) {
    throw new AttendanceError("Invalid 4-digit Kiosk PIN", 401, "INVALID_PIN");
  }

  clearKioskRateLimit(rateKey);

  const now = new Date();
  const tz = outlet.timezone || "UTC";
  const localDateKey = formatUtcToLocalDateKey(now, tz);
  const todayWorkDate = new Date(`${localDateKey}T00:00:00Z`);

  await assertEmployeeOutletEligibility(
    params.restaurantId,
    employee.id,
    outlet.id,
    todayWorkDate
  );

  const resolved = await resolveWorkDateAndPublishedShift({
    restaurantId: params.restaurantId,
    employeeId: employee.id,
    outletId: outlet.id,
    outletTimezone: tz,
    punchTime: now,
    punchType: "BREAK_END", // checks open overnight record first
  });

  const punches = resolved.existingRecord?.timePunches || [];
  const metrics = calculateAttendanceMetrics(
    punches.map((p) => ({ punchType: p.punchType, punchTime: p.punchTime })),
    resolved.matchedShift
      ? {
          startTime: resolved.matchedShift.startTime,
          endTime: resolved.matchedShift.endTime,
          breakMinutes: resolved.matchedShift.breakMinutes,
          shiftDate: resolved.matchedShift.shiftDate,
          timezone: tz,
        }
      : null,
    resolved.workDate
  );

  return {
    employee,
    outlet,
    currentState: metrics.activePunchState,
    validActions: getValidActionsForState(metrics.activePunchState),
    scheduledShift: resolved.matchedShift
      ? {
          id: resolved.matchedShift.id,
          startTime: resolved.matchedShift.startTime,
          endTime: resolved.matchedShift.endTime,
          breakMinutes: resolved.matchedShift.breakMinutes,
        }
      : null,
  };
}

export interface PunchInput {
  restaurantId: string;
  employeeId?: string;
  kioskPin?: string;
  outletId: string;
  punchType: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
  punchTime?: Date;
  idempotencyKey?: string;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  ipAddress?: string;
  photoUrl?: string;
  notes?: string;
}

export async function processPunch(input: PunchInput) {
  const now = input.punchTime ? new Date(input.punchTime) : new Date();

  // 1. Idempotency check (retry-safe for network drops / double taps)
  if (input.idempotencyKey) {
    const existingPunch = await prisma.timePunch.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        attendanceRecord: true,
      },
    });
    if (existingPunch) {
      return {
        success: true,
        duplicate: true,
        employee: existingPunch.employee,
        punch: existingPunch,
        attendanceRecord: existingPunch.attendanceRecord,
      };
    }
  }

  const outlet = await prisma.restaurantOutlet.findFirst({
    where: { id: input.outletId, restaurantId: input.restaurantId },
    select: { id: true, name: true, timezone: true },
  });
  if (!outlet) {
    throw new AttendanceError("Outlet not found", 404);
  }
  const tz = outlet.timezone || "UTC";

  // 2. Locate Employee (never expose kioskPin)
  let employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  } | null = null;

  if (input.employeeId) {
    employee = await prisma.employee.findFirst({
      where: {
        id: input.employeeId,
        restaurantId: input.restaurantId,
        archivedAt: null,
      },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
    });
  } else if (input.kioskPin) {
    const rateKey = `${input.ipAddress || "local"}:${input.outletId}`;
    checkKioskRateLimit(rateKey);
    const hashed = hashPin(input.kioskPin);
    employee = await prisma.employee.findFirst({
      where: {
        restaurantId: input.restaurantId,
        kioskPin: hashed,
        archivedAt: null,
      },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
    });
    if (employee) clearKioskRateLimit(rateKey);
  }

  if (!employee) {
    throw new AttendanceError("Invalid employee identification or PIN", 401);
  }

  // 3. Verify employee active status & outlet eligibility
  const localDateKey = formatUtcToLocalDateKey(now, tz);
  await assertEmployeeOutletEligibility(
    input.restaurantId,
    employee.id,
    outlet.id,
    new Date(`${localDateKey}T00:00:00Z`)
  );

  // 4. Resolve workDate, existing record, and PUBLISHED shift
  const resolved = await resolveWorkDateAndPublishedShift({
    restaurantId: input.restaurantId,
    employeeId: employee.id,
    outletId: outlet.id,
    outletTimezone: tz,
    punchTime: now,
    punchType: input.punchType,
  });

  const existingPunches = resolved.existingRecord?.timePunches || [];

  // Double-tap guard within 10 seconds for identical punchType
  const recentDuplicate = existingPunches.find(
    (p) =>
      p.punchType === input.punchType &&
      Math.abs(now.getTime() - new Date(p.punchTime).getTime()) < 10_000
  );
  if (recentDuplicate) {
    return {
      success: true,
      duplicate: true,
      employee,
      punch: recentDuplicate,
      attendanceRecord: resolved.existingRecord,
    };
  }

  // 5. Evaluate state machine
  const shiftForCalc = resolved.matchedShift
    ? {
        startTime: resolved.matchedShift.startTime,
        endTime: resolved.matchedShift.endTime,
        breakMinutes: resolved.matchedShift.breakMinutes,
        shiftDate: resolved.matchedShift.shiftDate,
        timezone: tz,
      }
    : (resolved.existingRecord?.scheduledSnapshot as any) || null;

  const currentMetrics = calculateAttendanceMetrics(
    existingPunches.map((p) => ({ punchType: p.punchType, punchTime: p.punchTime })),
    shiftForCalc,
    resolved.workDate
  );

  if (input.punchType === "CLOCK_IN") {
    if (currentMetrics.activePunchState === "CLOCKED_IN") {
      throw new AttendanceError(`${employee.firstName} is already clocked in.`, 409);
    }
    if (currentMetrics.activePunchState === "ON_BREAK") {
      throw new AttendanceError(
        `${employee.firstName} is currently on break. Please end break first.`,
        409
      );
    }
  } else if (input.punchType === "BREAK_START") {
    if (currentMetrics.activePunchState !== "CLOCKED_IN") {
      throw new AttendanceError("Must be clocked in to start a break.", 409);
    }
  } else if (input.punchType === "BREAK_END") {
    if (currentMetrics.activePunchState !== "ON_BREAK") {
      throw new AttendanceError("Cannot end break when not currently on break.", 409);
    }
  } else if (input.punchType === "CLOCK_OUT") {
    if (
      currentMetrics.activePunchState === "NOT_CLOCKED_IN" ||
      currentMetrics.activePunchState === "CLOCKED_OUT"
    ) {
      throw new AttendanceError("Must be clocked in before clocking out.", 409);
    }
  }

  // 6. Persist punch + AttendanceRecord atomically
  const scheduledSnapshot =
    resolved.existingRecord?.scheduledSnapshot ||
    (resolved.matchedShift
      ? {
          startTime: resolved.matchedShift.startTime,
          endTime: resolved.matchedShift.endTime,
          breakMinutes: resolved.matchedShift.breakMinutes,
          shiftDate: resolved.matchedShift.shiftDate.toISOString().slice(0, 10),
          timezone: tz,
        }
      : null);

  const allPunches = [
    ...existingPunches.map((p) => ({
      punchType: p.punchType,
      punchTime: p.punchTime,
    })),
    { punchType: input.punchType, punchTime: now },
  ];
  const newMetrics = calculateAttendanceMetrics(
    allPunches,
    shiftForCalc,
    resolved.workDate
  );

  const needsReview = resolved.exceptionFlags.length > 0;

  return prisma.$transaction(async (tx) => {
    const attendanceRecord = await tx.attendanceRecord.upsert({
      where: {
        employeeId_workDate: {
          employeeId: employee!.id,
          workDate: resolved.workDate,
        },
      },
      create: {
        restaurantId: input.restaurantId,
        employeeId: employee!.id,
        outletId: outlet.id,
        shiftAssignmentId: resolved.matchedShift?.id || null,
        workDate: resolved.workDate,
        status: newMetrics.status,
        clockInTime: newMetrics.clockInTime,
        clockOutTime: newMetrics.clockOutTime,
        totalWorkMinutes: newMetrics.totalWorkMinutes,
        totalBreakMinutes: newMetrics.totalBreakMinutes,
        overtimeMinutes: newMetrics.overtimeMinutes,
        lateMinutes: newMetrics.lateMinutes,
        earlyExitMinutes: newMetrics.earlyExitMinutes,
        needsReview,
        exceptionFlags: resolved.exceptionFlags,
        scheduledSnapshot: scheduledSnapshot as any,
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
        needsReview,
        exceptionFlags: resolved.exceptionFlags,
      },
    });

    const punch = await tx.timePunch.create({
      data: {
        restaurantId: input.restaurantId,
        employeeId: employee!.id,
        outletId: outlet.id,
        attendanceRecordId: attendanceRecord.id,
        punchType: input.punchType,
        punchTime: now,
        idempotencyKey: input.idempotencyKey || null,
        latitude: input.latitude,
        longitude: input.longitude,
        deviceInfo: input.deviceInfo || "Tablet Punch Kiosk",
        ipAddress: input.ipAddress,
        photoUrl: input.photoUrl,
        notes: input.notes,
      },
    });

    return {
      success: true,
      duplicate: false,
      employee,
      punch,
      attendanceRecord,
      metrics: newMetrics,
    };
  });
}

export async function correctAndApproveAttendance(params: {
  restaurantId: string;
  recordId: string;
  actor: { userId: string; userEmail: string };
  accessibleOutletIds: string[] | null;
  addMissedPunch?: {
    punchType: "CLOCK_IN" | "CLOCK_OUT" | "BREAK_START" | "BREAK_END";
    punchTime: Date;
  };
  totalWorkMinutes?: number;
  totalBreakMinutes?: number;
  overtimeMinutes?: number;
  status?: "PRESENT" | "LATE" | "ON_BREAK" | "EARLY_DEPARTURE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE";
  managerNotes?: string;
  correctionReason?: string;
  isApproved?: boolean;
}) {
  const existing = await prisma.attendanceRecord.findFirst({
    where: { id: params.recordId, restaurantId: params.restaurantId },
    include: {
      outlet: { select: { id: true, timezone: true } },
      shiftAssignment: true,
      timePunches: { orderBy: { punchTime: "asc" } },
    },
  });

  if (!existing) {
    throw new AttendanceError("Attendance record not found", 404);
  }

  if (
    params.accessibleOutletIds !== null &&
    !params.accessibleOutletIds.includes(existing.outletId)
  ) {
    throw new AttendanceError(
      "Attendance record is outside your authorized outlet scope",
      403
    );
  }

  const isCorrection =
    Boolean(params.addMissedPunch) ||
    params.totalWorkMinutes !== undefined ||
    params.totalBreakMinutes !== undefined ||
    params.overtimeMinutes !== undefined ||
    params.status !== undefined;

  if (isCorrection && !params.correctionReason?.trim()) {
    throw new AttendanceError(
      "A correction reason is required when modifying punches or worked time",
      400,
      "REASON_REQUIRED"
    );
  }

  return prisma.$transaction(async (tx) => {
    const punchesList = existing.timePunches.map((p) => ({
      punchType: p.punchType,
      punchTime: p.punchTime,
    }));

    if (params.addMissedPunch) {
      await tx.timePunch.create({
        data: {
          restaurantId: params.restaurantId,
          employeeId: existing.employeeId,
          outletId: existing.outletId,
          attendanceRecordId: existing.id,
          punchType: params.addMissedPunch.punchType,
          punchTime: params.addMissedPunch.punchTime,
          isManualAdjustment: true,
          adjustedBy: params.actor.userId,
          adjustmentReason: params.correctionReason!.trim(),
          deviceInfo: "Manager Correction",
        },
      });
      punchesList.push({
        punchType: params.addMissedPunch.punchType,
        punchTime: params.addMissedPunch.punchTime,
      });
    }

    const sched =
      (existing.scheduledSnapshot as any) ||
      (existing.shiftAssignment
        ? {
            startTime: existing.shiftAssignment.startTime,
            endTime: existing.shiftAssignment.endTime,
            breakMinutes: existing.shiftAssignment.breakMinutes,
            shiftDate: existing.shiftAssignment.shiftDate,
            timezone: existing.outlet.timezone || "UTC",
          }
        : null);

    const recalculated = calculateAttendanceMetrics(
      punchesList,
      sched,
      existing.workDate
    );

    const nextFlags = Array.isArray(existing.exceptionFlags)
      ? (existing.exceptionFlags as string[]).filter(
          (f) => f !== "MISSED_CLOCK_OUT"
        )
      : [];

    const updated = await tx.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        clockInTime: recalculated.clockInTime,
        clockOutTime: recalculated.clockOutTime,
        totalWorkMinutes:
          params.totalWorkMinutes !== undefined
            ? params.totalWorkMinutes
            : recalculated.totalWorkMinutes,
        totalBreakMinutes:
          params.totalBreakMinutes !== undefined
            ? params.totalBreakMinutes
            : recalculated.totalBreakMinutes,
        overtimeMinutes:
          params.overtimeMinutes !== undefined
            ? params.overtimeMinutes
            : recalculated.overtimeMinutes,
        lateMinutes: recalculated.lateMinutes,
        earlyExitMinutes: recalculated.earlyExitMinutes,
        status: params.status ?? recalculated.status,
        managerNotes:
          params.managerNotes !== undefined
            ? params.managerNotes
            : existing.managerNotes,
        exceptionFlags: nextFlags,
        ...(isCorrection
          ? {
              correctedBy: params.actor.userId,
              correctedAt: new Date(),
              correctionReason: params.correctionReason!.trim(),
            }
          : {}),
        ...(params.isApproved !== undefined
          ? {
              isApproved: params.isApproved,
              approvedBy: params.isApproved ? params.actor.userId : null,
              approvedAt: params.isApproved ? new Date() : null,
              needsReview: params.isApproved ? false : existing.needsReview,
            }
          : {}),
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        outlet: { select: { id: true, name: true } },
        timePunches: { orderBy: { punchTime: "asc" } },
      },
    });

    await tx.auditLog.create({
      data: {
        restaurantId: params.restaurantId,
        userId: params.actor.userId,
        userEmail: params.actor.userEmail,
        action: isCorrection ? "ATTENDANCE_CORRECTED" : "ATTENDANCE_APPROVED",
        entityType: "AttendanceRecord",
        entityId: existing.id,
        previousValues: sanitizeAuditPayload({
          totalWorkMinutes: existing.totalWorkMinutes,
          totalBreakMinutes: existing.totalBreakMinutes,
          clockOutTime: existing.clockOutTime?.toISOString() || null,
          isApproved: existing.isApproved,
        }),
        newValues: sanitizeAuditPayload({
          totalWorkMinutes: updated.totalWorkMinutes,
          totalBreakMinutes: updated.totalBreakMinutes,
          clockOutTime: updated.clockOutTime?.toISOString() || null,
          isApproved: updated.isApproved,
          reason: params.correctionReason?.trim() || null,
          addedPunchType: params.addMissedPunch?.punchType || null,
        }),
      },
    });

    return updated;
  });
}
