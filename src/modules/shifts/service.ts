import { prisma } from "@/core/database/client";
import { sendMail } from "@/core/mail";
import { ChecklistService } from "@/modules/operations/checklistService";
import {
  RosterStatus,
  ShiftAssignmentStatus,
  SwapRequestStatus,
} from "@prisma/client";
import {
  toDateKey,
  addDaysToKey,
  getShiftInterval,
  doIntervalsOverlap,
  getWorkweekBounds,
  getShiftPaidHoursInWindow,
} from "./timeUtils";

export interface DraftRevisionItem {
  draftId: string;
  action: "ADD" | "UPDATE" | "DELETE";
  targetAssignmentId?: string;
  employeeId: string;
  outletId: string;
  templateId?: string | null;
  shiftDate: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  breakMinutes: number;
  roleName?: string | null;
  notes?: string | null;
  overrideHoursLimit?: boolean;
  overrideReason?: string | null;
}

export interface DraftRevisionPayload {
  adds: DraftRevisionItem[];
  updates: DraftRevisionItem[];
  deletes: string[]; // assignment IDs
}

export interface ShiftActorInfo {
  userId: string;
  userEmail: string;
}

export interface ValidationIssue {
  code:
    | "OUTLET_INELIGIBLE"
    | "LEAVE_CONFLICT"
    | "SHIFT_OVERLAP"
    | "DAILY_CAP_EXCEEDED"
    | "HARD_WEEKLY_CAP_EXCEEDED"
    | "POLICY_WEEKLY_CAP_EXCEEDED"
    | "OVERRIDE_REASON_REQUIRED";
  severity: "BLOCKING" | "WARNING";
  message: string;
  assignmentId?: string;
  employeeId?: string;
  shiftDate?: string;
}

const VALID_ROSTER_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["AVAILABILITY_OPEN", "ASSIGNMENT_IN_PROGRESS", "ARCHIVED"],
  AVAILABILITY_OPEN: ["AVAILABILITY_LOCKED", "ASSIGNMENT_IN_PROGRESS", "DRAFT"],
  AVAILABILITY_LOCKED: ["ASSIGNMENT_IN_PROGRESS", "AVAILABILITY_OPEN"],
  ASSIGNMENT_IN_PROGRESS: ["PUBLISHED", "AVAILABILITY_OPEN", "DRAFT"],
  PUBLISHED: ["COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

function parseNormalizedDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) return dateInput;
  const key = toDateKey(dateInput);
  return new Date(`${key}T00:00:00.000Z`);
}

function getEmployeePolicyWeeklyLimit(employee: {
  workerType: string;
  weeklyHoursLimit: number | null;
}): number {
  if (employee.weeklyHoursLimit && employee.weeklyHoursLimit > 0) {
    return employee.weeklyHoursLimit;
  }
  switch (employee.workerType) {
    case "PART_TIME":
    case "INTERN":
      return 20.0;
    case "TEMPORARY":
      return 25.0;
    case "CONTRACT":
    case "CONSULTANT":
      return 40.0;
    case "FULL_TIME":
    default:
      return 48.0;
  }
}

async function getEmployeeEligibleOutletIds(
  restaurantId: string,
  employeeId: string,
  asOfDate: Date
): Promise<Set<string> | null> {
  const [assignments, empRecords] = await Promise.all([
    prisma.employeeOutletAssignment.findMany({
      where: { restaurantId, employeeId },
    }),
    prisma.employmentRecord.findMany({
      where: { restaurantId, employeeId, effectiveTo: null },
      select: { primaryOutletId: true, effectiveFrom: true, status: true },
    }),
  ]);

  if (assignments.length === 0 && empRecords.every((r) => !r.primaryOutletId)) {
    return null;
  }

  const eligible = new Set<string>();
  const targetMs = asOfDate.getTime();
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
    if (["TERMINATED", "RESIGNED", "SUSPENDED"].includes(r.status)) continue;
    const recFromMs = new Date(r.effectiveFrom).setUTCHours(0, 0, 0, 0);
    if (targetMs >= recFromMs) {
      eligible.add(r.primaryOutletId);
    }
  }
  return eligible;
}

export async function validateShiftCandidate(params: {
  restaurantId: string;
  employeeId: string;
  outletId: string;
  shiftDate: Date | string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  excludeAssignmentId?: string;
  overrideHoursLimit?: boolean;
  overrideReason?: string | null;
  canOverrideHours?: boolean;
  virtualReplacements?: Map<
    string,
    {
      id: string;
      employeeId: string;
      outletId: string;
      shiftDate: Date;
      startTime: string;
      endTime: string;
      breakMinutes: number;
      outletTimezone?: string;
      outletName?: string;
    } | null
  >;
  virtualAdditions?: Array<{
    id: string;
    employeeId: string;
    outletId: string;
    shiftDate: Date;
    startTime: string;
    endTime: string;
    breakMinutes: number;
  }>;
}): Promise<{
  valid: boolean;
  blockingIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  paidHours: number;
}> {
  const {
    restaurantId,
    employeeId,
    outletId,
    shiftDate,
    startTime,
    endTime,
    breakMinutes = 0,
    excludeAssignmentId,
    overrideHoursLimit = false,
    overrideReason,
    canOverrideHours = true,
    virtualReplacements,
    virtualAdditions,
  } = params;

  const blockingIssues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const dateKey = toDateKey(shiftDate);
  const targetDate = parseNormalizedDate(dateKey);

  const [employee, outlet] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: employeeId, restaurantId, archivedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        workerType: true,
        weeklyHoursLimit: true,
      },
    }),
    prisma.restaurantOutlet.findFirst({
      where: { id: outletId, restaurantId },
      select: {
        id: true,
        name: true,
        timezone: true,
        workweekStartDay: true,
        hardWeeklyHoursCap: true,
        allowOvertimeOverride: true,
      },
    }),
  ]);

  if (!employee) {
    blockingIssues.push({
      code: "OUTLET_INELIGIBLE",
      severity: "BLOCKING",
      message: "Employee not found or archived.",
      employeeId,
      shiftDate: dateKey,
    });
    return { valid: false, blockingIssues, warnings, paidHours: 0 };
  }

  if (!outlet) {
    blockingIssues.push({
      code: "OUTLET_INELIGIBLE",
      severity: "BLOCKING",
      message: "Target outlet not found.",
      employeeId,
      shiftDate: dateKey,
    });
    return { valid: false, blockingIssues, warnings, paidHours: 0 };
  }

  const tz = outlet.timezone || "UTC";
  const candidateInterval = getShiftInterval(dateKey, startTime, endTime, breakMinutes, tz);

  // 1. Outlet Eligibility Check
  const eligibleOutlets = await getEmployeeEligibleOutletIds(restaurantId, employeeId, targetDate);
  if (eligibleOutlets !== null && !eligibleOutlets.has(outletId)) {
    blockingIssues.push({
      code: "OUTLET_INELIGIBLE",
      severity: "BLOCKING",
      message: `${employee.firstName} ${employee.lastName} is not eligible for outlet "${outlet.name}".`,
      employeeId,
      shiftDate: dateKey,
    });
  }

  // 2. Approved Leave Conflict Check (covers overnight shift end date too)
  const endDateUtc = parseNormalizedDate(candidateInterval.endDateKey);
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      restaurantId,
      employeeId,
      status: "APPROVED",
      startDate: { lte: endDateUtc },
      endDate: { gte: targetDate },
    },
  });

  if (approvedLeaves.length > 0) {
    for (const lv of approvedLeaves) {
      let overlaps = true;
      if (lv.isPartialDay && lv.startTime && lv.endTime) {
        const lvStartKey = toDateKey(lv.startDate);
        const lvEndKey = toDateKey(lv.endDate);
        const lvInterval = getShiftInterval(
          lvStartKey,
          lv.startTime,
          lv.endTime,
          0,
          tz
        );
        // If multi-day partial, use full endDate
        if (lvEndKey !== lvStartKey) {
          const endBound = getShiftInterval(
            lvEndKey,
            lv.endTime,
            lv.endTime,
            0,
            tz
          ).startUtc;
          overlaps =
            candidateInterval.startUtc < endBound &&
            candidateInterval.endUtc > lvInterval.startUtc;
        } else {
          overlaps =
            candidateInterval.startUtc < lvInterval.endUtc &&
            candidateInterval.endUtc > lvInterval.startUtc;
        }
      }
      if (overlaps) {
        blockingIssues.push({
          code: "LEAVE_CONFLICT",
          severity: "BLOCKING",
          message: `Approved ${lv.leaveType.toLowerCase()} leave conflict for ${employee.firstName} ${employee.lastName} on ${dateKey}.`,
          employeeId,
          shiftDate: dateKey,
        });
        break;
      }
    }
  }

  // 3. Overlapping Shifts Across Dates & Outlets (including overnight shifts!)
  const prevDay = parseNormalizedDate(addDaysToKey(dateKey, -1));
  const nextDay = parseNormalizedDate(addDaysToKey(dateKey, 1));

  const dbNearbyShifts = await prisma.shiftAssignment.findMany({
    where: {
      restaurantId,
      employeeId,
      shiftDate: { gte: prevDay, lte: nextDay },
      status: { not: ShiftAssignmentStatus.CANCELLED },
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
    },
    include: {
      outlet: { select: { id: true, name: true, timezone: true } },
    },
  });

  const nearbyShifts: Array<{
    id: string;
    dateKey: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    outletName: string;
    outletTimezone: string;
  }> = [];

  for (const s of dbNearbyShifts) {
    if (virtualReplacements?.has(s.id)) {
      const rep = virtualReplacements.get(s.id);
      if (!rep || rep.employeeId !== employeeId) continue;
      nearbyShifts.push({
        id: rep.id,
        dateKey: toDateKey(rep.shiftDate),
        startTime: rep.startTime,
        endTime: rep.endTime,
        breakMinutes: rep.breakMinutes,
        outletName: rep.outletName || outlet.name,
        outletTimezone: rep.outletTimezone || tz,
      });
    } else {
      nearbyShifts.push({
        id: s.id,
        dateKey: toDateKey(s.shiftDate),
        startTime: s.startTime,
        endTime: s.endTime,
        breakMinutes: s.breakMinutes,
        outletName: s.outlet?.name || "Outlet",
        outletTimezone: s.outlet?.timezone || "UTC",
      });
    }
  }

  if (virtualAdditions) {
    for (const add of virtualAdditions) {
      if (add.employeeId !== employeeId || add.id === excludeAssignmentId) continue;
      const addKey = toDateKey(add.shiftDate);
      if (addKey >= toDateKey(prevDay) && addKey <= toDateKey(nextDay)) {
        nearbyShifts.push({
          id: add.id,
          dateKey: addKey,
          startTime: add.startTime,
          endTime: add.endTime,
          breakMinutes: add.breakMinutes,
          outletName: outlet.name,
          outletTimezone: tz,
        });
      }
    }
  }

  let existingSameDayHours = 0;
  for (const existing of nearbyShifts) {
    const exInterval = getShiftInterval(
      existing.dateKey,
      existing.startTime,
      existing.endTime,
      existing.breakMinutes,
      existing.outletTimezone
    );

    if (
      doIntervalsOverlap(
        candidateInterval.startUtc,
        candidateInterval.endUtc,
        exInterval.startUtc,
        exInterval.endUtc
      )
    ) {
      blockingIssues.push({
        code: "SHIFT_OVERLAP",
        severity: "BLOCKING",
        message: `Shift conflict: Overlaps with ${existing.startTime}–${existing.endTime} at ${existing.outletName} (${existing.dateKey}).`,
        employeeId,
        shiftDate: dateKey,
      });
    }

    if (existing.dateKey === dateKey) {
      existingSameDayHours += exInterval.paidHours;
    }
  }

  // 4. Daily Working Hours Hard Limit (Max 14.0 paid hours / day)
  if (existingSameDayHours + candidateInterval.paidHours > 14.0) {
    blockingIssues.push({
      code: "DAILY_CAP_EXCEEDED",
      severity: "BLOCKING",
      message: `Daily hard cap exceeded: ${(existingSameDayHours + candidateInterval.paidHours).toFixed(1)}h exceeds 14.0h daily maximum.`,
      employeeId,
      shiftDate: dateKey,
    });
  }

  // 5. Weekly Working Hours Check (Across ALL outlets, honoring outlet workweekStartDay & timezone)
  const { weekStartKey, weekEndKeyInclusive, weekStartUtc, weekEndUtc } = getWorkweekBounds(
    dateKey,
    outlet.workweekStartDay ?? 1,
    tz
  );

  const weekQueryStart = parseNormalizedDate(addDaysToKey(weekStartKey, -1));
  const weekQueryEnd = parseNormalizedDate(addDaysToKey(weekEndKeyInclusive, 1));

  const dbWeeklyShifts = await prisma.shiftAssignment.findMany({
    where: {
      restaurantId,
      employeeId,
      shiftDate: { gte: weekQueryStart, lte: weekQueryEnd },
      status: { not: ShiftAssignmentStatus.CANCELLED },
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
    },
    include: {
      outlet: { select: { timezone: true } },
    },
  });

  let existingWeeklyHours = 0;
  for (const s of dbWeeklyShifts) {
    if (virtualReplacements?.has(s.id)) {
      const rep = virtualReplacements.get(s.id);
      if (!rep || rep.employeeId !== employeeId) continue;
      const iv = getShiftInterval(
        toDateKey(rep.shiftDate),
        rep.startTime,
        rep.endTime,
        rep.breakMinutes,
        rep.outletTimezone || tz
      );
      existingWeeklyHours += getShiftPaidHoursInWindow(iv, weekStartUtc, weekEndUtc);
    } else {
      const iv = getShiftInterval(
        toDateKey(s.shiftDate),
        s.startTime,
        s.endTime,
        s.breakMinutes,
        s.outlet?.timezone || "UTC"
      );
      existingWeeklyHours += getShiftPaidHoursInWindow(iv, weekStartUtc, weekEndUtc);
    }
  }

  if (virtualAdditions) {
    for (const add of virtualAdditions) {
      if (add.employeeId !== employeeId || add.id === excludeAssignmentId) continue;
      const iv = getShiftInterval(
        toDateKey(add.shiftDate),
        add.startTime,
        add.endTime,
        add.breakMinutes,
        tz
      );
      existingWeeklyHours += getShiftPaidHoursInWindow(iv, weekStartUtc, weekEndUtc);
    }
  }

  const candidateWeekHours = getShiftPaidHoursInWindow(
    candidateInterval,
    weekStartUtc,
    weekEndUtc
  );
  const projectedWeeklyHours = Math.round((existingWeeklyHours + candidateWeekHours) * 100) / 100;

  const policyLimit = getEmployeePolicyWeeklyLimit(employee);
  const hardCap = outlet.hardWeeklyHoursCap;

  if (hardCap !== null && hardCap !== undefined && projectedWeeklyHours > hardCap) {
    blockingIssues.push({
      code: "HARD_WEEKLY_CAP_EXCEEDED",
      severity: "BLOCKING",
      message: `Hard weekly cap (${hardCap.toFixed(1)}h) exceeded: ${employee.firstName} would be at ${projectedWeeklyHours.toFixed(1)}h for week of ${weekStartKey}.`,
      employeeId,
      shiftDate: dateKey,
    });
  } else if (projectedWeeklyHours > policyLimit) {
    if (!outlet.allowOvertimeOverride || !canOverrideHours) {
      blockingIssues.push({
        code: "POLICY_WEEKLY_CAP_EXCEEDED",
        severity: "BLOCKING",
        message: `Weekly hours cap (${policyLimit.toFixed(1)}h) exceeded (${projectedWeeklyHours.toFixed(1)}h) and policy does not permit override.`,
        employeeId,
        shiftDate: dateKey,
      });
    } else if (!overrideHoursLimit) {
      blockingIssues.push({
        code: "POLICY_WEEKLY_CAP_EXCEEDED",
        severity: "WARNING",
        message: `Weekly hours warning: ${employee.firstName} reaches ${projectedWeeklyHours.toFixed(1)}h (policy cap: ${policyLimit.toFixed(1)}h). Manager override with audit reason required.`,
        employeeId,
        shiftDate: dateKey,
      });
    } else if (!overrideReason || !overrideReason.trim()) {
      blockingIssues.push({
        code: "OVERRIDE_REASON_REQUIRED",
        severity: "BLOCKING",
        message: "An audit reason is required when overriding a weekly hours warning.",
        employeeId,
        shiftDate: dateKey,
      });
    } else {
      warnings.push({
        code: "POLICY_WEEKLY_CAP_EXCEEDED",
        severity: "WARNING",
        message: `Overtime override applied (${projectedWeeklyHours.toFixed(1)}h / ${policyLimit.toFixed(1)}h): ${overrideReason}`,
        employeeId,
        shiftDate: dateKey,
      });
    }
  }

  return {
    valid: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    paidHours: candidateInterval.paidHours,
  };
}

async function writeAuditLog(params: {
  restaurantId: string;
  actor?: ShiftActorInfo;
  action: string;
  entityType: string;
  entityId: string;
  previousValues?: any;
  newValues?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        restaurantId: params.restaurantId,
        userId: params.actor?.userId || "SYSTEM",
        userEmail: params.actor?.userEmail || "system@restobird.com",
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        previousValues: params.previousValues ? JSON.stringify(params.previousValues) : null,
        newValues: params.newValues ? JSON.stringify(params.newValues) : null,
      },
    });
  } catch (err) {
    console.error("Failed to write shift audit log:", err);
  }
}

export const ShiftService = {
  // ── Shift Templates ────────────────────────────────────────────────────────
  async getTemplates(restaurantId: string) {
    return prisma.shiftTemplate.findMany({
      where: { restaurantId, archivedAt: null },
      orderBy: { startTime: "asc" },
    });
  },

  async getTemplateById(restaurantId: string, id: string) {
    const template = await prisma.shiftTemplate.findFirst({
      where: { id, restaurantId, archivedAt: null },
    });
    if (!template) throw new Error("Shift template not found");
    return template;
  },

  async createTemplate(
    restaurantId: string,
    data: {
      name: string;
      startTime: string;
      endTime: string;
      breakMinutes?: number;
      color?: string;
      status?: string;
    }
  ) {
    const iv = getShiftInterval("2026-01-05", data.startTime, data.endTime, data.breakMinutes ?? 0, "UTC");
    if (iv.grossMinutes <= 0) {
      throw new Error("Shift duration must be greater than 0 minutes.");
    }
    if ((data.breakMinutes ?? 0) >= iv.grossMinutes) {
      throw new Error("Unpaid break cannot equal or exceed total shift duration.");
    }

    return prisma.shiftTemplate.create({
      data: {
        restaurantId,
        name: data.name.trim(),
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes: data.breakMinutes ?? 0,
        color: data.color ?? "#3b82f6",
        status: data.status ?? "ACTIVE",
      },
    });
  },

  async updateTemplate(
    restaurantId: string,
    id: string,
    data: {
      name?: string;
      startTime?: string;
      endTime?: string;
      breakMinutes?: number;
      color?: string;
      status?: string;
    }
  ) {
    const existing = await this.getTemplateById(restaurantId, id);
    const nextStart = data.startTime ?? existing.startTime;
    const nextEnd = data.endTime ?? existing.endTime;
    const nextBreak = data.breakMinutes ?? existing.breakMinutes;

    const iv = getShiftInterval("2026-01-05", nextStart, nextEnd, nextBreak, "UTC");
    if (iv.grossMinutes <= 0) {
      throw new Error("Shift duration must be greater than 0 minutes.");
    }
    if (nextBreak >= iv.grossMinutes) {
      throw new Error("Unpaid break cannot equal or exceed total shift duration.");
    }

    return prisma.shiftTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.breakMinutes !== undefined && { breakMinutes: data.breakMinutes }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  },

  async deleteTemplate(restaurantId: string, id: string) {
    await this.getTemplateById(restaurantId, id);
    return prisma.shiftTemplate.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  },

  // ── Rosters ────────────────────────────────────────────────────────────────
  async getRosters(restaurantId: string, outletId?: string) {
    const where: any = { restaurantId };
    if (outletId) where.outletId = outletId;

    return prisma.shiftRoster.findMany({
      where,
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            timezone: true,
            workweekStartDay: true,
            hardWeeklyHoursCap: true,
            allowOvertimeOverride: true,
          },
        },
        _count: { select: { assignments: true } },
      },
      orderBy: { startDate: "desc" },
    });
  },

  async getRosterById(restaurantId: string, id: string) {
    const roster = await prisma.shiftRoster.findFirst({
      where: { id, restaurantId },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            timezone: true,
            workweekStartDay: true,
            hardWeeklyHoursCap: true,
            allowOvertimeOverride: true,
          },
        },
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                profilePhotoUrl: true,
              },
            },
            template: { select: { id: true, name: true, color: true } },
            outlet: { select: { id: true, name: true, timezone: true } },
          },
          orderBy: [{ shiftDate: "asc" }, { startTime: "asc" }],
        },
      },
    });
    if (!roster) throw new Error("Shift roster not found");
    return roster;
  },

  async createRoster(
    restaurantId: string,
    data: {
      outletId: string;
      name: string;
      startDate: Date | string;
      endDate: Date | string;
      availabilityDeadline?: Date | string;
      departments?: string[];
      notes?: string;
    },
    actor?: ShiftActorInfo
  ) {
    await prisma.restaurantOutlet.findFirstOrThrow({
      where: { id: data.outletId, restaurantId },
    });

    const start = parseNormalizedDate(data.startDate);
    const end = parseNormalizedDate(data.endDate);
    if (end < start) {
      throw new Error("Roster end date must be on or after start date.");
    }

    const roster = await prisma.shiftRoster.create({
      data: {
        restaurantId,
        outletId: data.outletId,
        name: data.name.trim(),
        startDate: start,
        endDate: end,
        availabilityDeadline: data.availabilityDeadline ? new Date(data.availabilityDeadline) : null,
        departments: data.departments ? data.departments : undefined,
        notes: data.notes,
        status: RosterStatus.DRAFT,
        version: 1,
      },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            timezone: true,
            workweekStartDay: true,
            hardWeeklyHoursCap: true,
            allowOvertimeOverride: true,
          },
        },
      },
    });

    await writeAuditLog({
      restaurantId,
      actor,
      action: "ROSTER_CREATED",
      entityType: "ShiftRoster",
      entityId: roster.id,
      newValues: { name: roster.name, outletId: roster.outletId, startDate: roster.startDate, endDate: roster.endDate },
    });

    return roster;
  },

  async updateRoster(
    restaurantId: string,
    id: string,
    data: {
      name?: string;
      startDate?: Date | string;
      endDate?: Date | string;
      notes?: string;
      status?: RosterStatus | string;
      availabilityDeadline?: Date | string | null;
      expectedVersion?: number;
    },
    actor?: ShiftActorInfo
  ) {
    const existing = await prisma.shiftRoster.findFirstOrThrow({
      where: { id, restaurantId },
    });

    if (data.expectedVersion !== undefined && existing.version !== data.expectedVersion) {
      const err: any = new Error(
        `Stale roster conflict: Roster was modified by another manager (your version: ${data.expectedVersion}, latest version: ${existing.version}). Please refresh.`
      );
      err.statusCode = 409;
      throw err;
    }

    if (data.status && data.status !== existing.status) {
      const allowedNext = VALID_ROSTER_TRANSITIONS[existing.status] || [];
      if (!allowedNext.includes(data.status)) {
        throw new Error(
          `Invalid lifecycle transition: Cannot move roster from ${existing.status} to ${data.status}.`
        );
      }
      if (data.status === "PUBLISHED") {
        return this.publishRoster(restaurantId, id, actor || { userId: "SYSTEM", userEmail: "system@restobird.com" }, data.expectedVersion);
      }
    }

    const updateData: any = {
      version: { increment: 1 },
    };
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.startDate) updateData.startDate = parseNormalizedDate(data.startDate);
    if (data.endDate) updateData.endDate = parseNormalizedDate(data.endDate);
    if (data.availabilityDeadline !== undefined) {
      updateData.availabilityDeadline = data.availabilityDeadline ? new Date(data.availabilityDeadline) : null;
    }
    if (data.status) updateData.status = data.status as RosterStatus;

    const updated = await prisma.shiftRoster.update({
      where: { id },
      data: updateData,
    });

    if (data.status && data.status !== existing.status) {
      await writeAuditLog({
        restaurantId,
        actor,
        action: "ROSTER_STATUS_CHANGED",
        entityType: "ShiftRoster",
        entityId: id,
        previousValues: { status: existing.status, version: existing.version },
        newValues: { status: updated.status, version: updated.version },
      });
    }

    return this.getRosterById(restaurantId, id);
  },

  async saveDraftRevision(
    restaurantId: string,
    rosterId: string,
    revision: DraftRevisionPayload,
    expectedVersion?: number,
    actor?: ShiftActorInfo
  ) {
    const roster = await prisma.shiftRoster.findFirstOrThrow({
      where: { id: rosterId, restaurantId },
    });

    if (expectedVersion !== undefined && roster.version !== expectedVersion) {
      const err: any = new Error(
        `Stale roster conflict: Another manager updated this roster (your v${expectedVersion}, current v${roster.version}). Please refresh.`
      );
      err.statusCode = 409;
      throw err;
    }

    const updated = await prisma.shiftRoster.update({
      where: { id: rosterId },
      data: {
        draftRevisionJson: revision as any,
        version: { increment: 1 },
      },
    });

    await writeAuditLog({
      restaurantId,
      actor,
      action: "ROSTER_REVISION_SAVED",
      entityType: "ShiftRoster",
      entityId: rosterId,
      newValues: {
        version: updated.version,
        adds: revision.adds.length,
        updates: revision.updates.length,
        deletes: revision.deletes.length,
      },
    });

    return updated;
  },

  async getRosterReview(restaurantId: string, rosterId: string) {
    const roster = await this.getRosterById(restaurantId, rosterId);
    const liveAssignments = roster.assignments || [];
    const revision = (roster.draftRevisionJson as unknown as DraftRevisionPayload | null) || null;

    const added: any[] = [];
    const changed: any[] = [];
    const removed: any[] = [];
    const blockingIssues: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    if (roster.status === "PUBLISHED" && revision) {
      const deleteSet = new Set(revision.deletes || []);
      const virtualReplacements = new Map<string, any>();

      for (const delId of deleteSet) {
        virtualReplacements.set(delId, null);
        const live = liveAssignments.find((a) => a.id === delId);
        if (live) removed.push(live);
      }

      for (const upd of revision.updates || []) {
        const targetId = upd.targetAssignmentId || upd.draftId;
        const live = liveAssignments.find((a) => a.id === targetId);
        if (live) {
          changed.push({ before: live, after: upd });
        }
        virtualReplacements.set(targetId, {
          id: targetId,
          employeeId: upd.employeeId,
          outletId: upd.outletId,
          shiftDate: parseNormalizedDate(upd.shiftDate),
          startTime: upd.startTime,
          endTime: upd.endTime,
          breakMinutes: upd.breakMinutes,
          outletTimezone: roster.outlet?.timezone,
          outletName: roster.outlet?.name,
        });
      }

      const virtualAdditions = (revision.adds || []).map((a) => ({
        id: a.draftId,
        employeeId: a.employeeId,
        outletId: a.outletId,
        shiftDate: parseNormalizedDate(a.shiftDate),
        startTime: a.startTime,
        endTime: a.endTime,
        breakMinutes: a.breakMinutes,
      }));

      for (const add of revision.adds || []) {
        added.push(add);
        const res = await validateShiftCandidate({
          restaurantId,
          employeeId: add.employeeId,
          outletId: add.outletId,
          shiftDate: add.shiftDate,
          startTime: add.startTime,
          endTime: add.endTime,
          breakMinutes: add.breakMinutes,
          excludeAssignmentId: add.draftId,
          overrideHoursLimit: add.overrideHoursLimit,
          overrideReason: add.overrideReason,
          virtualReplacements,
          virtualAdditions,
        });
        blockingIssues.push(...res.blockingIssues.map((i) => ({ ...i, assignmentId: add.draftId })));
        warnings.push(...res.warnings.map((w) => ({ ...w, assignmentId: add.draftId })));
      }

      for (const upd of revision.updates || []) {
        const targetId = upd.targetAssignmentId || upd.draftId;
        const res = await validateShiftCandidate({
          restaurantId,
          employeeId: upd.employeeId,
          outletId: upd.outletId,
          shiftDate: upd.shiftDate,
          startTime: upd.startTime,
          endTime: upd.endTime,
          breakMinutes: upd.breakMinutes,
          excludeAssignmentId: targetId,
          overrideHoursLimit: upd.overrideHoursLimit,
          overrideReason: upd.overrideReason,
          virtualReplacements,
          virtualAdditions,
        });
        blockingIssues.push(...res.blockingIssues.map((i) => ({ ...i, assignmentId: targetId })));
        warnings.push(...res.warnings.map((w) => ({ ...w, assignmentId: targetId })));
      }
    } else {
      for (const a of liveAssignments) {
        added.push(a);
        const res = await validateShiftCandidate({
          restaurantId,
          employeeId: a.employeeId,
          outletId: a.outletId,
          shiftDate: a.shiftDate,
          startTime: a.startTime,
          endTime: a.endTime,
          breakMinutes: a.breakMinutes,
          excludeAssignmentId: a.id,
          overrideHoursLimit: true,
          overrideReason: "Roster review check",
        });
        blockingIssues.push(...res.blockingIssues.map((i) => ({ ...i, assignmentId: a.id })));
        warnings.push(...res.warnings.map((w) => ({ ...w, assignmentId: a.id })));
      }
    }

    return {
      roster: {
        id: roster.id,
        name: roster.name,
        status: roster.status,
        version: roster.version,
        startDate: roster.startDate,
        endDate: roster.endDate,
        outlet: roster.outlet,
      },
      diff: { added, changed, removed },
      blockingIssues,
      warnings,
      canPublish: blockingIssues.length === 0,
    };
  },

  async publishRoster(
    restaurantId: string,
    id: string,
    actor: ShiftActorInfo | string,
    expectedVersion?: number
  ) {
    const actorInfo: ShiftActorInfo =
      typeof actor === "string" ? { userId: actor, userEmail: "manager@restobird.com" } : actor;

    const existing = await prisma.shiftRoster.findFirstOrThrow({
      where: { id, restaurantId },
      include: { outlet: true },
    });

    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      const err: any = new Error(
        `Stale edit conflict: Roster has changed (your v${expectedVersion}, current v${existing.version}). Refresh before publishing.`
      );
      err.statusCode = 409;
      throw err;
    }

    const review = await this.getRosterReview(restaurantId, id);
    if (!review.canPublish) {
      throw new Error(
        `Cannot publish roster with ${review.blockingIssues.length} blocking issue(s): ${review.blockingIssues[0].message}`
      );
    }

    const wasAlreadyPublished = existing.status === RosterStatus.PUBLISHED;
    const revision = (existing.draftRevisionJson as unknown as DraftRevisionPayload | null) || null;
    const affectedEmployeeIds = new Set<string>();

    const publishedRoster = await prisma.$transaction(async (tx) => {
      const fresh = await tx.shiftRoster.findUniqueOrThrow({ where: { id } });
      if (expectedVersion !== undefined && fresh.version !== expectedVersion) {
        const err: any = new Error("Stale edit conflict detected during publish transaction.");
        err.statusCode = 409;
        throw err;
      }

      if (wasAlreadyPublished && revision) {
        if (revision.deletes && revision.deletes.length > 0) {
          const toDelete = await tx.shiftAssignment.findMany({
            where: { id: { in: revision.deletes }, rosterId: id, restaurantId },
            select: { id: true, employeeId: true },
          });
          toDelete.forEach((d) => affectedEmployeeIds.add(d.employeeId));
          await tx.shiftAssignment.deleteMany({
            where: { id: { in: revision.deletes }, rosterId: id, restaurantId },
          });
        }

        for (const upd of revision.updates || []) {
          const targetId = upd.targetAssignmentId || upd.draftId;
          affectedEmployeeIds.add(upd.employeeId);
          await tx.shiftAssignment.update({
            where: { id: targetId },
            data: {
              employeeId: upd.employeeId,
              outletId: upd.outletId,
              templateId: upd.templateId || null,
              shiftDate: parseNormalizedDate(upd.shiftDate),
              startTime: upd.startTime,
              endTime: upd.endTime,
              breakMinutes: upd.breakMinutes ?? 0,
              roleName: upd.roleName || null,
              notes: upd.notes || null,
            },
          });
          await tx.shiftChecklistExecution.updateMany({
            where: { shiftAssignmentId: targetId, status: { not: "VERIFIED" } },
            data: { assignedEmployeeId: upd.employeeId, version: { increment: 1 } },
          });
        }

        for (const add of revision.adds || []) {
          affectedEmployeeIds.add(add.employeeId);
          await tx.shiftAssignment.create({
            data: {
              restaurantId,
              rosterId: id,
              templateId: add.templateId || null,
              employeeId: add.employeeId,
              outletId: add.outletId,
              shiftDate: parseNormalizedDate(add.shiftDate),
              startTime: add.startTime,
              endTime: add.endTime,
              breakMinutes: add.breakMinutes ?? 0,
              roleName: add.roleName || null,
              notes: add.notes || null,
              status: ShiftAssignmentStatus.SCHEDULED,
            },
          });
        }
      } else {
        const currentAssignments = await tx.shiftAssignment.findMany({
          where: { rosterId: id, restaurantId },
          select: { employeeId: true },
        });
        currentAssignments.forEach((a) => affectedEmployeeIds.add(a.employeeId));
      }

      const nextVersion = fresh.version + 1;
      const shouldNotify = nextVersion > fresh.lastNotifiedVersion;

      const updated = await tx.shiftRoster.update({
        where: { id },
        data: {
          status: RosterStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedBy: actorInfo.userId,
          draftRevisionJson: null as any,
          version: nextVersion,
          lastNotifiedVersion: shouldNotify ? nextVersion : fresh.lastNotifiedVersion,
        },
        include: { outlet: true },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          userId: actorInfo.userId,
          userEmail: actorInfo.userEmail,
          action: wasAlreadyPublished ? "ROSTER_REVISION_PUBLISHED" : "ROSTER_PUBLISHED",
          entityType: "ShiftRoster",
          entityId: id,
          previousValues: JSON.stringify({ status: fresh.status, version: fresh.version }),
          newValues: JSON.stringify({
            status: updated.status,
            version: updated.version,
            addedCount: review.diff.added.length,
            changedCount: review.diff.changed.length,
            removedCount: review.diff.removed.length,
            notifiedEmployeesCount: shouldNotify ? affectedEmployeeIds.size : 0,
          }),
        },
      });

      return { updated, shouldNotify };
    });

    if (publishedRoster.shouldNotify && affectedEmployeeIds.size > 0) {
      const employees = await prisma.employee.findMany({
        where: { id: { in: Array.from(affectedEmployeeIds) }, restaurantId },
        select: { id: true, firstName: true, personalEmail: true },
      });

      for (const emp of employees) {
        if (!emp.personalEmail) continue;
        sendMail({
          to: emp.personalEmail,
          subject: `Schedule Published: ${existing.name} (${existing.outlet?.name || "Outlet"})`,
          text: `Hi ${emp.firstName}, your shift schedule for ${existing.name} has been published. Log in to Resto Bird to view your upcoming shifts.`,
          html: `<p>Hi ${emp.firstName},</p><p>Your shift schedule for <strong>${existing.name}</strong> at <strong>${existing.outlet?.name || "your outlet"}</strong> has been published.</p><p>Please check your <strong>My Shifts</strong> view for exact local times and roles.</p>`,
        }).catch(() => {});
      }
    }

    return publishedRoster.updated;
  },

  async deleteRoster(restaurantId: string, id: string) {
    await prisma.shiftRoster.findFirstOrThrow({ where: { id, restaurantId } });
    return prisma.shiftRoster.delete({ where: { id } });
  },

  // ── Shift Assignments ──────────────────────────────────────────────────────
  async getAssignments(
    restaurantId: string,
    params: {
      rosterId?: string;
      outletId?: string;
      employeeId?: string;
      startDate?: Date | string;
      endDate?: Date | string;
      publishedOnly?: boolean;
    }
  ) {
    const where: any = { restaurantId };
    if (params.rosterId) where.rosterId = params.rosterId;
    if (params.outletId) where.outletId = params.outletId;
    if (params.employeeId) where.employeeId = params.employeeId;
    if (params.startDate || params.endDate) {
      where.shiftDate = {};
      if (params.startDate) where.shiftDate.gte = parseNormalizedDate(params.startDate);
      if (params.endDate) where.shiftDate.lte = parseNormalizedDate(params.endDate);
    }
    if (params.publishedOnly) {
      where.roster = { status: { in: [RosterStatus.PUBLISHED, RosterStatus.COMPLETED] } };
      where.status = { not: ShiftAssignmentStatus.CANCELLED };
    }

    return prisma.shiftAssignment.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            profilePhotoUrl: true,
            employmentRecords: {
              where: { effectiveTo: null },
              select: { designation: { select: { name: true } } },
              take: 1,
            },
          },
        },
        outlet: { select: { id: true, name: true, timezone: true } },
        template: { select: { id: true, name: true, color: true } },
        roster: { select: { id: true, name: true, status: true } },
      },
      orderBy: [{ shiftDate: "asc" }, { startTime: "asc" }],
    });
  },

  async createAssignment(
    restaurantId: string,
    data: {
      rosterId?: string;
      templateId?: string;
      employeeId: string;
      outletId: string;
      shiftDate: Date | string;
      startTime: string;
      endTime: string;
      breakMinutes?: number;
      roleName?: string | null;
      status?: ShiftAssignmentStatus;
      notes?: string;
      overrideHoursLimit?: boolean;
      overrideReason?: string;
      expectedVersion?: number;
    },
    actor?: ShiftActorInfo
  ) {
    const validation = await validateShiftCandidate({
      restaurantId,
      employeeId: data.employeeId,
      outletId: data.outletId,
      shiftDate: data.shiftDate,
      startTime: data.startTime,
      endTime: data.endTime,
      breakMinutes: data.breakMinutes ?? 0,
      overrideHoursLimit: data.overrideHoursLimit || false,
      overrideReason: data.overrideReason,
    });

    if (!validation.valid) {
      throw new Error(validation.blockingIssues[0].message);
    }

    if (data.rosterId && data.expectedVersion !== undefined) {
      const roster = await prisma.shiftRoster.findFirstOrThrow({
        where: { id: data.rosterId, restaurantId },
      });
      if (roster.version !== data.expectedVersion) {
        const err: any = new Error(
          `Stale edit conflict: Roster version changed (${data.expectedVersion} vs ${roster.version}).`
        );
        err.statusCode = 409;
        throw err;
      }
    }

    const created = await prisma.shiftAssignment.create({
      data: {
        restaurantId,
        rosterId: data.rosterId || null,
        templateId: data.templateId || null,
        employeeId: data.employeeId,
        outletId: data.outletId,
        shiftDate: parseNormalizedDate(data.shiftDate),
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes: data.breakMinutes ?? 0,
        roleName: data.roleName || null,
        status: data.status ?? ShiftAssignmentStatus.SCHEDULED,
        notes: data.notes,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        template: { select: { id: true, name: true, color: true } },
        outlet: { select: { id: true, name: true, timezone: true } },
      },
    });

    if (data.rosterId) {
      await prisma.shiftRoster.update({
        where: { id: data.rosterId },
        data: { version: { increment: 1 } },
      });
    }

    if (data.overrideHoursLimit && data.overrideReason) {
      await writeAuditLog({
        restaurantId,
        actor,
        action: "SHIFT_OVERTIME_OVERRIDDEN",
        entityType: "ShiftAssignment",
        entityId: created.id,
        newValues: {
          employeeId: data.employeeId,
          shiftDate: data.shiftDate,
          overrideReason: data.overrideReason,
        },
      });
    }

    return created;
  },

  async bulkCreateAssignments(
    restaurantId: string,
    assignments: Array<{
      rosterId?: string;
      templateId?: string;
      employeeId: string;
      outletId: string;
      shiftDate: Date | string;
      startTime: string;
      endTime: string;
      breakMinutes?: number;
      roleName?: string | null;
      status?: ShiftAssignmentStatus;
      notes?: string;
      overrideHoursLimit?: boolean;
      overrideReason?: string;
    }>,
    _actor?: ShiftActorInfo
  ) {
    for (const item of assignments) {
      const validation = await validateShiftCandidate({
        restaurantId,
        employeeId: item.employeeId,
        outletId: item.outletId,
        shiftDate: item.shiftDate,
        startTime: item.startTime,
        endTime: item.endTime,
        breakMinutes: item.breakMinutes ?? 0,
        overrideHoursLimit: item.overrideHoursLimit || false,
        overrideReason: item.overrideReason,
      });
      if (!validation.valid) {
        throw new Error(validation.blockingIssues[0].message);
      }
    }

    const created = await prisma.$transaction(
      assignments.map((item) =>
        prisma.shiftAssignment.create({
          data: {
            restaurantId,
            rosterId: item.rosterId || null,
            templateId: item.templateId || null,
            employeeId: item.employeeId,
            outletId: item.outletId,
            shiftDate: parseNormalizedDate(item.shiftDate),
            startTime: item.startTime,
            endTime: item.endTime,
            breakMinutes: item.breakMinutes ?? 0,
            roleName: item.roleName || null,
            status: item.status ?? ShiftAssignmentStatus.SCHEDULED,
            notes: item.notes,
          },
        })
      )
    );

    const rosterIds = Array.from(new Set(assignments.map((a) => a.rosterId).filter(Boolean) as string[]));
    if (rosterIds.length > 0) {
      await prisma.shiftRoster.updateMany({
        where: { id: { in: rosterIds }, restaurantId },
        data: { version: { increment: 1 } },
      });
    }

    return created;
  },

  async updateAssignment(
    restaurantId: string,
    id: string,
    data: {
      templateId?: string | null;
      employeeId?: string;
      shiftDate?: Date | string;
      startTime?: string;
      endTime?: string;
      breakMinutes?: number;
      roleName?: string | null;
      status?: ShiftAssignmentStatus;
      notes?: string | null;
      overrideHoursLimit?: boolean;
      overrideReason?: string;
      expectedVersion?: number;
    },
    actor?: ShiftActorInfo
  ) {
    const existing = await prisma.shiftAssignment.findFirstOrThrow({ where: { id, restaurantId } });

    if (existing.rosterId && data.expectedVersion !== undefined) {
      const roster = await prisma.shiftRoster.findFirst({ where: { id: existing.rosterId } });
      if (roster && roster.version !== data.expectedVersion) {
        const err: any = new Error(
          `Stale edit conflict: Roster version changed (${data.expectedVersion} vs ${roster.version}).`
        );
        err.statusCode = 409;
        throw err;
      }
    }

    const targetEmployee = data.employeeId || existing.employeeId;
    const targetDate = data.shiftDate || existing.shiftDate;
    const targetStart = data.startTime || existing.startTime;
    const targetEnd = data.endTime || existing.endTime;
    const targetBreak = data.breakMinutes !== undefined ? data.breakMinutes : existing.breakMinutes;

    if (
      data.employeeId ||
      data.startTime ||
      data.endTime ||
      data.shiftDate ||
      data.breakMinutes !== undefined
    ) {
      const validation = await validateShiftCandidate({
        restaurantId,
        employeeId: targetEmployee,
        outletId: existing.outletId,
        shiftDate: targetDate,
        startTime: targetStart,
        endTime: targetEnd,
        breakMinutes: targetBreak,
        excludeAssignmentId: id,
        overrideHoursLimit: data.overrideHoursLimit || false,
        overrideReason: data.overrideReason,
      });
      if (!validation.valid) {
        throw new Error(validation.blockingIssues[0].message);
      }
    }

    const updated = await prisma.shiftAssignment.update({
      where: { id },
      data: {
        employeeId: data.employeeId,
        templateId: data.templateId,
        shiftDate: data.shiftDate ? parseNormalizedDate(data.shiftDate) : undefined,
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes: data.breakMinutes,
        roleName: data.roleName,
        status: data.status,
        notes: data.notes,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        template: { select: { id: true, name: true, color: true } },
        outlet: { select: { id: true, name: true, timezone: true } },
      },
    });

    if (existing.rosterId) {
      await prisma.shiftRoster.update({
        where: { id: existing.rosterId },
        data: { version: { increment: 1 } },
      });
    }

    if (data.employeeId && data.employeeId !== existing.employeeId) {
      await ChecklistService.syncAssigneeForShift(id, data.employeeId);
    }

    if (data.overrideHoursLimit && data.overrideReason) {
      await writeAuditLog({
        restaurantId,
        actor,
        action: "SHIFT_OVERTIME_OVERRIDDEN",
        entityType: "ShiftAssignment",
        entityId: id,
        newValues: { overrideReason: data.overrideReason },
      });
    }

    return updated;
  },

  async deleteAssignment(restaurantId: string, id: string) {
    const existing = await prisma.shiftAssignment.findFirstOrThrow({ where: { id, restaurantId } });
    const deleted = await prisma.shiftAssignment.delete({ where: { id } });
    if (existing.rosterId) {
      await prisma.shiftRoster.update({
        where: { id: existing.rosterId },
        data: { version: { increment: 1 } },
      });
    }
    return deleted;
  },

  // ── Employee Availability ──────────────────────────────────────────────────
  async getAvailability(restaurantId: string, employeeId: string) {
    return prisma.shiftAvailability.findMany({
      where: { restaurantId, employeeId },
      orderBy: { dayOfWeek: "asc" },
    });
  },

  async setAvailability(
    restaurantId: string,
    employeeId: string,
    availabilities: Array<{
      dayOfWeek: number;
      isAvailable: boolean;
      preferredStartTime?: string;
      preferredEndTime?: string;
      notes?: string;
    }>
  ) {
    await prisma.employee.findFirstOrThrow({
      where: { id: employeeId, restaurantId, archivedAt: null },
    });

    return prisma.$transaction(
      availabilities.map((av) =>
        prisma.shiftAvailability.upsert({
          where: {
            employeeId_dayOfWeek: {
              employeeId,
              dayOfWeek: av.dayOfWeek,
            },
          },
          update: {
            isAvailable: av.isAvailable,
            preferredStartTime: av.preferredStartTime,
            preferredEndTime: av.preferredEndTime,
            notes: av.notes,
          },
          create: {
            restaurantId,
            employeeId,
            dayOfWeek: av.dayOfWeek,
            isAvailable: av.isAvailable,
            preferredStartTime: av.preferredStartTime,
            preferredEndTime: av.preferredEndTime,
            notes: av.notes,
          },
        })
      )
    );
  },

  // ── Shift Swap Requests ────────────────────────────────────────────────────
  async getSwapRequests(
    restaurantId: string,
    params?: { status?: SwapRequestStatus; employeeId?: string }
  ) {
    const where: any = { restaurantId };
    if (params?.status) where.status = params.status;
    if (params?.employeeId) {
      where.OR = [
        { requesterEmployeeId: params.employeeId },
        { targetEmployeeId: params.employeeId },
      ];
    }

    return prisma.shiftSwapRequest.findMany({
      where,
      include: {
        requesterEmployee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        targetEmployee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        requesterAssignment: {
          include: {
            outlet: { select: { id: true, name: true, timezone: true } },
            template: { select: { name: true, color: true } },
            roster: { select: { id: true, name: true, status: true } },
          },
        },
        targetAssignment: {
          include: {
            outlet: { select: { id: true, name: true, timezone: true } },
            template: { select: { name: true, color: true } },
            roster: { select: { id: true, name: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async createSwapRequest(
    restaurantId: string,
    data: {
      assignmentId: string;
      requesterEmployeeId: string;
      targetEmployeeId?: string;
      targetAssignmentId?: string;
      reason?: string;
    }
  ) {
    const assignment = await prisma.shiftAssignment.findFirstOrThrow({
      where: { id: data.assignmentId, restaurantId, employeeId: data.requesterEmployeeId },
      include: { roster: true },
    });

    if (assignment.roster && assignment.roster.status !== RosterStatus.PUBLISHED) {
      throw new Error("Shift swaps can only be requested for published roster shifts.");
    }

    let targetAssignment: any = null;
    if (data.targetAssignmentId) {
      targetAssignment = await prisma.shiftAssignment.findFirstOrThrow({
        where: { id: data.targetAssignmentId, restaurantId },
      });
    }

    return prisma.shiftSwapRequest.create({
      data: {
        restaurantId,
        assignmentId: assignment.id,
        requesterEmployeeId: data.requesterEmployeeId,
        targetEmployeeId: data.targetEmployeeId || null,
        targetAssignmentId: data.targetAssignmentId || null,
        peerStatus: data.targetEmployeeId ? "PENDING_PEER" : "NOT_REQUIRED",
        requesterSnapshotUpdatedAt: assignment.updatedAt,
        targetSnapshotUpdatedAt: targetAssignment?.updatedAt || null,
        reason: data.reason,
        status: SwapRequestStatus.PENDING,
      },
    });
  },

  async respondToSwapAsPeer(
    restaurantId: string,
    swapId: string,
    targetEmployeeId: string,
    accept: boolean,
    notes?: string
  ) {
    const swap = await prisma.shiftSwapRequest.findFirstOrThrow({
      where: { id: swapId, restaurantId },
    });

    if (swap.status !== SwapRequestStatus.PENDING) {
      throw new Error(`Swap request is already ${swap.status}.`);
    }
    if (swap.targetEmployeeId !== targetEmployeeId) {
      throw new Error("Only the designated coworker can respond to this swap request.");
    }
    if (swap.peerStatus !== "PENDING_PEER") {
      throw new Error(`Peer response already recorded (${swap.peerStatus}).`);
    }

    return prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        peerStatus: accept ? "ACCEPTED" : "DECLINED",
        targetAcceptedAt: accept ? new Date() : null,
        ...(accept ? {} : { status: SwapRequestStatus.REJECTED, reviewNotes: notes || "Declined by coworker" }),
      },
    });
  },

  async reviewSwapRequest(
    restaurantId: string,
    id: string,
    data: {
      status: SwapRequestStatus;
      reviewNotes?: string;
      reviewedBy: string;
      reviewedByEmail?: string;
    }
  ) {
    const swap = await prisma.shiftSwapRequest.findFirstOrThrow({
      where: { id, restaurantId },
      include: {
        requesterAssignment: { include: { roster: true, outlet: true } },
        targetAssignment: { include: { roster: true, outlet: true } },
      },
    });

    if (swap.status !== SwapRequestStatus.PENDING) {
      throw new Error(`Swap request is already ${swap.status}`);
    }

    if (data.status === SwapRequestStatus.APPROVED) {
      if (swap.peerStatus === "PENDING_PEER") {
        throw new Error("Coworker acceptance is required before manager approval.");
      }
      if (swap.peerStatus === "DECLINED") {
        throw new Error("Cannot approve: Coworker declined this swap.");
      }

      if (
        swap.requesterSnapshotUpdatedAt &&
        swap.requesterAssignment.updatedAt.getTime() > swap.requesterSnapshotUpdatedAt.getTime()
      ) {
        await prisma.shiftSwapRequest.update({
          where: { id },
          data: {
            status: SwapRequestStatus.REJECTED,
            reviewNotes: "Auto-rejected: Requester shift was modified after swap request was submitted.",
            reviewedBy: data.reviewedBy,
            reviewedAt: new Date(),
          },
        });
        throw new Error("Stale swap request: The requester's shift was modified after this swap was submitted.");
      }

      if (
        swap.targetAssignment &&
        swap.targetSnapshotUpdatedAt &&
        swap.targetAssignment.updatedAt.getTime() > swap.targetSnapshotUpdatedAt.getTime()
      ) {
        await prisma.shiftSwapRequest.update({
          where: { id },
          data: {
            status: SwapRequestStatus.REJECTED,
            reviewNotes: "Auto-rejected: Target shift was modified after swap request was submitted.",
            reviewedBy: data.reviewedBy,
            reviewedAt: new Date(),
          },
        });
        throw new Error("Stale swap request: The target shift was modified after this swap was submitted.");
      }

      if (!swap.targetEmployeeId) {
        throw new Error("A target coworker must be assigned before approving this swap.");
      }

      const virtualReplacements = new Map<string, any>();
      virtualReplacements.set(swap.assignmentId, {
        id: swap.assignmentId,
        employeeId: swap.targetEmployeeId,
        outletId: swap.requesterAssignment.outletId,
        shiftDate: swap.requesterAssignment.shiftDate,
        startTime: swap.requesterAssignment.startTime,
        endTime: swap.requesterAssignment.endTime,
        breakMinutes: swap.requesterAssignment.breakMinutes,
        outletTimezone: swap.requesterAssignment.outlet?.timezone,
        outletName: swap.requesterAssignment.outlet?.name,
      });

      if (swap.targetAssignment) {
        virtualReplacements.set(swap.targetAssignment.id, {
          id: swap.targetAssignment.id,
          employeeId: swap.requesterEmployeeId,
          outletId: swap.targetAssignment.outletId,
          shiftDate: swap.targetAssignment.shiftDate,
          startTime: swap.targetAssignment.startTime,
          endTime: swap.targetAssignment.endTime,
          breakMinutes: swap.targetAssignment.breakMinutes,
          outletTimezone: swap.targetAssignment.outlet?.timezone,
          outletName: swap.targetAssignment.outlet?.name,
        });
      }

      const targetValidation = await validateShiftCandidate({
        restaurantId,
        employeeId: swap.targetEmployeeId,
        outletId: swap.requesterAssignment.outletId,
        shiftDate: swap.requesterAssignment.shiftDate,
        startTime: swap.requesterAssignment.startTime,
        endTime: swap.requesterAssignment.endTime,
        breakMinutes: swap.requesterAssignment.breakMinutes,
        excludeAssignmentId: swap.assignmentId,
        virtualReplacements,
      });

      if (!targetValidation.valid) {
        throw new Error(`Target employee validation failed: ${targetValidation.blockingIssues[0].message}`);
      }

      if (swap.targetAssignment) {
        const requesterValidation = await validateShiftCandidate({
          restaurantId,
          employeeId: swap.requesterEmployeeId,
          outletId: swap.targetAssignment.outletId,
          shiftDate: swap.targetAssignment.shiftDate,
          startTime: swap.targetAssignment.startTime,
          endTime: swap.targetAssignment.endTime,
          breakMinutes: swap.targetAssignment.breakMinutes,
          excludeAssignmentId: swap.targetAssignment.id,
          virtualReplacements,
        });
        if (!requesterValidation.valid) {
          throw new Error(`Requester validation failed: ${requesterValidation.blockingIssues[0].message}`);
        }
      }

      return prisma.$transaction(async (tx) => {
        if (swap.targetAssignment && swap.targetEmployeeId) {
          await tx.shiftAssignment.update({
            where: { id: swap.assignmentId },
            data: { employeeId: swap.targetEmployeeId },
          });
          await tx.shiftAssignment.update({
            where: { id: swap.targetAssignment.id },
            data: { employeeId: swap.requesterEmployeeId },
          });
          await tx.shiftChecklistExecution.updateMany({
            where: { shiftAssignmentId: swap.assignmentId, status: { not: "VERIFIED" } },
            data: { assignedEmployeeId: swap.targetEmployeeId, version: { increment: 1 } },
          });
          await tx.shiftChecklistExecution.updateMany({
            where: { shiftAssignmentId: swap.targetAssignment.id, status: { not: "VERIFIED" } },
            data: { assignedEmployeeId: swap.requesterEmployeeId, version: { increment: 1 } },
          });
        } else if (swap.targetEmployeeId) {
          await tx.shiftAssignment.update({
            where: { id: swap.assignmentId },
            data: { employeeId: swap.targetEmployeeId },
          });
          await tx.shiftChecklistExecution.updateMany({
            where: { shiftAssignmentId: swap.assignmentId, status: { not: "VERIFIED" } },
            data: { assignedEmployeeId: swap.targetEmployeeId, version: { increment: 1 } },
          });
        }

        const updatedSwap = await tx.shiftSwapRequest.update({
          where: { id },
          data: {
            status: SwapRequestStatus.APPROVED,
            reviewNotes: data.reviewNotes,
            reviewedBy: data.reviewedBy,
            reviewedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            restaurantId,
            userId: data.reviewedBy,
            userEmail: data.reviewedByEmail || "manager@restobird.com",
            action: "SHIFT_SWAP_APPROVED",
            entityType: "ShiftSwapRequest",
            entityId: id,
            newValues: JSON.stringify({
              assignmentId: swap.assignmentId,
              requesterEmployeeId: swap.requesterEmployeeId,
              targetEmployeeId: swap.targetEmployeeId,
              targetAssignmentId: swap.targetAssignmentId,
            }),
          },
        });

        return updatedSwap;
      });
    }

    return prisma.shiftSwapRequest.update({
      where: { id },
      data: {
        status: data.status,
        reviewNotes: data.reviewNotes,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
      },
    });
  },

  // ── Availability-First Roster Methods ──────────────────────────────────────
  async getRosterAvailability(
    restaurantId: string,
    rosterId: string,
    filters?: { departmentId?: string; employeeId?: string }
  ) {
    const roster = await prisma.shiftRoster.findFirstOrThrow({
      where: { id: rosterId, restaurantId },
      include: { outlet: { select: { id: true, name: true, timezone: true } } },
    });

    const whereEmployee: any = { restaurantId, archivedAt: null };
    if (filters?.employeeId) {
      whereEmployee.id = filters.employeeId;
    }

    const employees = await prisma.employee.findMany({
      where: whereEmployee,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        profilePhotoUrl: true,
        employmentRecords: {
          where: { effectiveTo: null },
          select: {
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { firstName: "asc" },
    });

    const employeeIds = employees.map((e) => e.id);

    const [dateAvailabilities, submissions, approvedLeaves] = await Promise.all([
      prisma.rosterDateAvailability.findMany({
        where: { rosterId, employeeId: { in: employeeIds } },
      }),
      prisma.rosterEmployeeSubmission.findMany({
        where: { rosterId, employeeId: { in: employeeIds } },
      }),
      prisma.leaveRequest.findMany({
        where: {
          restaurantId,
          employeeId: { in: employeeIds },
          status: "APPROVED",
          startDate: { lte: roster.endDate },
          endDate: { gte: roster.startDate },
        },
      }),
    ]);

    const startKey = toDateKey(roster.startDate);
    const endKey = toDateKey(roster.endDate);
    const dateList: string[] = [];
    let currKey = startKey;
    while (currKey <= endKey) {
      dateList.push(currKey);
      currKey = addDaysToKey(currKey, 1);
    }

    const result = employees.map((emp) => {
      const empAvailMap: Record<string, any> = {};
      const empSubmission = submissions.find((s) => s.employeeId === emp.id);

      dateList.forEach((dStr) => {
        const found = dateAvailabilities.find(
          (a) => a.employeeId === emp.id && toDateKey(a.date) === dStr
        );

        const isOnLeave = approvedLeaves.some((l) => {
          const lStart = toDateKey(l.startDate);
          const lEnd = toDateKey(l.endDate);
          return l.employeeId === emp.id && dStr >= lStart && dStr <= lEnd;
        });

        if (isOnLeave) {
          empAvailMap[dStr] = {
            type: "LEAVE",
            isAvailable: false,
            label: "Approved leave",
            availableFrom: null,
            availableUntil: null,
          };
        } else if (found) {
          empAvailMap[dStr] = {
            type: found.type,
            isAvailable: found.type === "AVAILABLE" || found.type === "SPECIFIC_TIME",
            label:
              found.type === "SPECIFIC_TIME"
                ? `Available at specific times (${found.availableFrom || ""} - ${found.availableUntil || ""})`
                : found.type === "AVAILABLE"
                ? "Available"
                : "Unavailable",
            availableFrom: found.availableFrom,
            availableUntil: found.availableUntil,
            notes: found.notes,
          };
        } else {
          empAvailMap[dStr] = {
            type: "NOT_UPDATED",
            isAvailable: false,
            label: "Not submitted",
            availableFrom: null,
            availableUntil: null,
          };
        }
      });

      const primaryRecord = emp.employmentRecords?.[0];
      return {
        employee: {
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          employeeCode: emp.employeeCode,
          profilePhotoUrl: emp.profilePhotoUrl,
          department: primaryRecord?.department?.name || "General",
          departmentId: primaryRecord?.department?.id || null,
          designation: primaryRecord?.designation?.name || "Staff",
        },
        submissionStatus: empSubmission?.status || "DRAFT",
        submittedAt: empSubmission?.submittedAt || null,
        days: empAvailMap,
      };
    });

    return { roster, dates: dateList, availabilities: result };
  },

  async saveRosterDateAvailabilities(
    restaurantId: string,
    rosterId: string,
    employeeId: string,
    dateAvailabilities: Array<{
      date: string | Date;
      type: "AVAILABLE" | "NOT_AVAILABLE" | "SPECIFIC_TIME" | "LEAVE";
      availableFrom?: string;
      availableUntil?: string;
      notes?: string;
    }>
  ) {
    const roster = await prisma.shiftRoster.findFirstOrThrow({
      where: { id: rosterId, restaurantId },
    });
    if (roster.status !== RosterStatus.AVAILABILITY_OPEN && roster.status !== RosterStatus.DRAFT) {
      throw new Error(
        `Availability submissions are locked for this roster period (${roster.status.replace(/_/g, " ")}).`
      );
    }
    if (roster.availabilityDeadline && new Date() > roster.availabilityDeadline) {
      throw new Error("The availability submission deadline for this roster has passed.");
    }

    const validItems = (dateAvailabilities || []).filter(
      (item) => item.type && (item.type as string) !== "NOT_UPDATED" && item.type !== "LEAVE"
    );
    if (validItems.length === 0) return [];

    return prisma.$transaction(
      validItems.map((item) => {
        const dateObj = parseNormalizedDate(item.date);
        return prisma.rosterDateAvailability.upsert({
          where: {
            rosterId_employeeId_date: {
              rosterId,
              employeeId,
              date: dateObj,
            },
          },
          update: {
            type: item.type as any,
            availableFrom: item.availableFrom || null,
            availableUntil: item.availableUntil || null,
            notes: item.notes || null,
          },
          create: {
            restaurantId,
            rosterId,
            employeeId,
            date: dateObj,
            type: item.type as any,
            availableFrom: item.availableFrom || null,
            availableUntil: item.availableUntil || null,
            notes: item.notes || null,
          },
        });
      })
    );
  },

  async applyRecurringAvailabilityToRoster(
    restaurantId: string,
    rosterId: string,
    employeeId: string
  ) {
    const roster = await prisma.shiftRoster.findFirstOrThrow({
      where: { id: rosterId, restaurantId },
    });
    if (roster.status !== RosterStatus.AVAILABILITY_OPEN && roster.status !== RosterStatus.DRAFT) {
      throw new Error(
        `Availability submissions are locked for this roster period (${roster.status.replace(/_/g, " ")}).`
      );
    }

    const recurring = await prisma.shiftAvailability.findMany({ where: { restaurantId, employeeId } });

    const startKey = toDateKey(roster.startDate);
    const endKey = toDateKey(roster.endDate);

    const itemsToUpsert: any[] = [];
    let currKey = startKey;
    while (currKey <= endKey) {
      const dateObj = parseNormalizedDate(currKey);
      const dayOfWeek = dateObj.getUTCDay();
      const match = recurring.find((r) => r.dayOfWeek === dayOfWeek);

      const type = match
        ? match.isAvailable
          ? match.preferredStartTime && match.preferredEndTime
            ? "SPECIFIC_TIME"
            : "AVAILABLE"
          : "NOT_AVAILABLE"
        : "AVAILABLE";

      itemsToUpsert.push({
        date: dateObj,
        type,
        availableFrom: match?.preferredStartTime || null,
        availableUntil: match?.preferredEndTime || null,
        notes: match?.notes || null,
      });
      currKey = addDaysToKey(currKey, 1);
    }

    return this.saveRosterDateAvailabilities(restaurantId, rosterId, employeeId, itemsToUpsert);
  },

  async submitEmployeeAvailability(
    restaurantId: string,
    rosterId: string,
    employeeId: string,
    notes?: string
  ) {
    const roster = await prisma.shiftRoster.findFirstOrThrow({
      where: { id: rosterId, restaurantId },
    });
    if (roster.status !== RosterStatus.AVAILABILITY_OPEN && roster.status !== RosterStatus.DRAFT) {
      throw new Error(
        `Availability submissions are closed for this roster period (${roster.status.replace(/_/g, " ")}).`
      );
    }
    if (roster.availabilityDeadline && new Date() > roster.availabilityDeadline) {
      throw new Error("The availability submission deadline for this roster has passed.");
    }

    return prisma.rosterEmployeeSubmission.upsert({
      where: {
        rosterId_employeeId: { rosterId, employeeId },
      },
      update: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        notes: notes || null,
      },
      create: {
        restaurantId,
        rosterId,
        employeeId,
        status: "SUBMITTED",
        submittedAt: new Date(),
        notes: notes || null,
      },
    });
  },

  async getSmartEmployeeSuggestions(
    restaurantId: string,
    rosterId: string,
    shiftDateStr: string,
    startTime: string,
    endTime: string,
    departmentId?: string,
    breakMinutes: number = 0
  ) {
    const roster = await prisma.shiftRoster.findFirstOrThrow({
      where: { id: rosterId, restaurantId },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            timezone: true,
            workweekStartDay: true,
            hardWeeklyHoursCap: true,
          },
        },
      },
    });

    const tz = roster.outlet?.timezone || "UTC";
    const targetDateStr = toDateKey(shiftDateStr);
    const shiftDateZero = parseNormalizedDate(targetDateStr);
    const candidateInterval = getShiftInterval(targetDateStr, startTime, endTime, breakMinutes, tz);

    const employees = await prisma.employee.findMany({
      where: { restaurantId, archivedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        profilePhotoUrl: true,
        workerType: true,
        weeklyHoursLimit: true,
        outletAssignments: true,
        employmentRecords: {
          where: { effectiveTo: null },
          select: {
            primaryOutletId: true,
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
          },
        },
      },
    });

    const employeeIds = employees.map((e) => e.id);
    const { weekStartKey, weekEndKeyInclusive, weekStartUtc, weekEndUtc } = getWorkweekBounds(
      targetDateStr,
      roster.outlet?.workweekStartDay ?? 1,
      tz
    );

    const weekQueryStart = parseNormalizedDate(addDaysToKey(weekStartKey, -1));
    const weekQueryEnd = parseNormalizedDate(addDaysToKey(weekEndKeyInclusive, 1));
    const endDateUtc = parseNormalizedDate(candidateInterval.endDateKey);

    const [availabilities, approvedLeaves, existingAssignments] = await Promise.all([
      prisma.rosterDateAvailability.findMany({
        where: { rosterId, employeeId: { in: employeeIds } },
      }),
      prisma.leaveRequest.findMany({
        where: {
          restaurantId,
          employeeId: { in: employeeIds },
          status: "APPROVED",
          startDate: { lte: endDateUtc },
          endDate: { gte: shiftDateZero },
        },
      }),
      prisma.shiftAssignment.findMany({
        where: {
          restaurantId,
          employeeId: { in: employeeIds },
          shiftDate: { gte: weekQueryStart, lte: weekQueryEnd },
          status: { not: ShiftAssignmentStatus.CANCELLED },
        },
        include: { outlet: { select: { name: true, timezone: true } } },
      }),
    ]);

    const recommended: any[] = [];
    const partiallyAvailable: any[] = [];
    const unavailable: any[] = [];

    for (const emp of employees) {
      const dept = emp.employmentRecords?.[0]?.department;
      const desig = emp.employmentRecords?.[0]?.designation;
      if (departmentId && dept?.id !== departmentId) continue;

      let isOutletEligible = true;
      const hasAnyOutletScope =
        emp.outletAssignments.length > 0 || emp.employmentRecords.some((r) => !!r.primaryOutletId);
      if (hasAnyOutletScope) {
        const eligibleSet = new Set<string>();
        const shiftEndOfDay = new Date(shiftDateZero);
        shiftEndOfDay.setUTCHours(23, 59, 59, 999);
        for (const a of emp.outletAssignments) {
          const startsOk = a.effectiveFrom <= shiftEndOfDay;
          const endsOk = !a.effectiveTo || a.effectiveTo >= shiftDateZero;
          if (startsOk && endsOk) {
            eligibleSet.add(a.outletId);
          }
        }
        for (const r of emp.employmentRecords) {
          if (r.primaryOutletId) eligibleSet.add(r.primaryOutletId);
        }
        isOutletEligible = eligibleSet.has(roster.outletId);
      }

      const empWeeklyShifts = existingAssignments.filter((a) => a.employeeId === emp.id);
      let weeklyHoursAssigned = 0;
      let hasOverlap = false;
      let overlapDesc = "";

      for (const s of empWeeklyShifts) {
        const iv = getShiftInterval(
          toDateKey(s.shiftDate),
          s.startTime,
          s.endTime,
          s.breakMinutes,
          s.outlet?.timezone || "UTC"
        );
        weeklyHoursAssigned += getShiftPaidHoursInWindow(iv, weekStartUtc, weekEndUtc);

        if (
          doIntervalsOverlap(
            candidateInterval.startUtc,
            candidateInterval.endUtc,
            iv.startUtc,
            iv.endUtc
          )
        ) {
          hasOverlap = true;
          overlapDesc = `${s.startTime}–${s.endTime} at ${s.outlet?.name || "Outlet"}`;
        }
      }

      weeklyHoursAssigned = Math.round(weeklyHoursAssigned * 100) / 100;
      const weeklyShiftCount = empWeeklyShifts.length;
      const maxWeeklyHours = getEmployeePolicyWeeklyLimit(emp);
      const remainingWeeklyHours = Math.max(
        0,
        Math.round((maxWeeklyHours - weeklyHoursAssigned) * 100) / 100
      );

      const isOnLeave = approvedLeaves.some((l) => l.employeeId === emp.id);
      const avail = availabilities.find(
        (a) => a.employeeId === emp.id && toDateKey(a.date) === targetDateStr
      );

      const availabilityStatus = isOnLeave
        ? "LEAVE"
        : avail?.type === "AVAILABLE"
        ? "AVAILABLE"
        : avail?.type === "SPECIFIC_TIME"
        ? "SPECIFIC_TIME"
        : avail?.type === "NOT_AVAILABLE"
        ? "NOT_AVAILABLE"
        : "NOT_UPDATED";

      const empData = {
        employeeId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        employeeCode: emp.employeeCode,
        profilePhotoUrl: emp.profilePhotoUrl,
        departmentName: dept?.name || "General",
        designationName: desig?.name || "Staff",
        weeklyHoursAssigned,
        weeklyShiftCount,
        maxWeeklyHours,
        remainingWeeklyHours,
        availabilityType: availabilityStatus,
        availableFrom: avail?.availableFrom || null,
        availableUntil: avail?.availableUntil || null,
        reason: "",
      };

      if (!isOutletEligible) {
        empData.reason = `Not assigned to ${roster.outlet?.name || "this outlet"}.`;
        unavailable.push(empData);
      } else if (isOnLeave) {
        empData.reason = "Approved leave on this date.";
        unavailable.push(empData);
      } else if (hasOverlap) {
        empData.reason = `Overlapping shift (${overlapDesc}).`;
        unavailable.push(empData);
      } else if (avail?.type === "NOT_AVAILABLE") {
        empData.reason = "Marked Unavailable for this date.";
        unavailable.push(empData);
      } else if (weeklyHoursAssigned + candidateInterval.paidHours > maxWeeklyHours) {
        empData.reason = `Exceeds ${maxWeeklyHours}h weekly cap (${(weeklyHoursAssigned + candidateInterval.paidHours).toFixed(1)}h total, ${remainingWeeklyHours}h remaining).`;
        unavailable.push(empData);
      } else if (avail?.type === "SPECIFIC_TIME") {
        const candStartMin =
          parseInt(startTime.split(":")[0], 10) * 60 + parseInt(startTime.split(":")[1], 10);
        let candEndMin =
          parseInt(endTime.split(":")[0], 10) * 60 + parseInt(endTime.split(":")[1], 10);
        if (candEndMin <= candStartMin) candEndMin += 24 * 60;

        const availStartMin = avail.availableFrom
          ? parseInt(avail.availableFrom.split(":")[0], 10) * 60 +
            parseInt(avail.availableFrom.split(":")[1], 10)
          : 0;
        let availEndMin = avail.availableUntil
          ? parseInt(avail.availableUntil.split(":")[0], 10) * 60 +
            parseInt(avail.availableUntil.split(":")[1], 10)
          : 24 * 60;
        if (availEndMin <= availStartMin) availEndMin += 24 * 60;

        if (candStartMin >= availStartMin && candEndMin <= availEndMin) {
          empData.reason = `Available ${avail.availableFrom}–${avail.availableUntil} · ${remainingWeeklyHours}h remaining`;
          recommended.push(empData);
        } else {
          empData.reason = `Available at specific times (${avail.availableFrom || ""}–${avail.availableUntil || ""}) · ${remainingWeeklyHours}h remaining`;
          partiallyAvailable.push(empData);
        }
      } else if (avail?.type === "AVAILABLE") {
        empData.reason = `Confirmed Available · ${remainingWeeklyHours}h remaining`;
        recommended.push(empData);
      } else {
        empData.reason = `Availability not submitted · ${remainingWeeklyHours}h remaining`;
        partiallyAvailable.push(empData);
      }
    }

    recommended.sort(
      (a, b) => a.weeklyHoursAssigned - b.weeklyHoursAssigned || a.weeklyShiftCount - b.weeklyShiftCount
    );

    return {
      recommended,
      partiallyAvailable,
      unavailable,
    };
  },
};
