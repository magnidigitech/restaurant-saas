import { prisma } from "@/core/database/client";
import { LeaveStatus, LeaveType } from "@prisma/client";
import type { LeaveActorContext } from "./authHelper";
import {
  localDateTimeToUtc,
  timeStringToMinutes,
} from "@/core/attendance/calculator";
import { validateShiftCandidate } from "@/modules/shifts/service";
import { sanitizeAuditPayload } from "@/modules/workforce/service";
import { sendMail } from "@/core/mail";

export const LEAVE_ALLOWANCES: Record<LeaveType, number> = {
  ANNUAL: 15,
  CASUAL: 7,
  SICK: 10,
  UNPAID: 30,
  MATERNITY_PATERNITY: 90,
};

export class LeaveError extends Error {
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

const sentNotifications = new Set<string>();

function addDaysKey(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function getLeaveIntervalUtc(
  leave: {
    startDate: Date;
    endDate: Date;
    isPartialDay: boolean;
    startTime?: string | null;
    endTime?: string | null;
  },
  timeZone: string
) {
  const startKey = new Date(leave.startDate).toISOString().slice(0, 10);
  const endKey = new Date(leave.endDate).toISOString().slice(0, 10);

  if (leave.isPartialDay && leave.startTime && leave.endTime) {
    return {
      startUtc: localDateTimeToUtc(startKey, leave.startTime, timeZone),
      endUtc: localDateTimeToUtc(endKey, leave.endTime, timeZone),
    };
  }

  return {
    startUtc: localDateTimeToUtc(startKey, "00:00", timeZone),
    endUtc: localDateTimeToUtc(addDaysKey(endKey, 1), "00:00", timeZone),
  };
}

function getShiftIntervalUtc(
  shift: {
    shiftDate: Date;
    startTime: string;
    endTime: string;
  },
  timeZone: string
) {
  const startKey = new Date(shift.shiftDate).toISOString().slice(0, 10);
  const startMins = timeStringToMinutes(shift.startTime);
  const endMins = timeStringToMinutes(shift.endTime);
  const isOvernight = endMins <= startMins;
  const endKey = isOvernight ? addDaysKey(startKey, 1) : startKey;
  return {
    startUtc: localDateTimeToUtc(startKey, shift.startTime, timeZone),
    endUtc: localDateTimeToUtc(endKey, shift.endTime, timeZone),
  };
}

export async function getLeaveBalances(
  restaurantId: string,
  employeeId: string
) {
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(new Date().getUTCFullYear(), 11, 31, 23, 59, 59));

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      restaurantId,
      employeeId,
      startDate: { gte: yearStart, lte: yearEnd },
      status: { in: ["APPROVED", "PENDING"] },
    },
    select: { leaveType: true, totalDays: true, status: true },
  });

  const summary: Record<
    string,
    { allowance: number; used: number; pending: number; remaining: number }
  > = {};

  for (const [lt, allowance] of Object.entries(LEAVE_ALLOWANCES)) {
    const used = leaves
      .filter((l) => l.leaveType === lt && l.status === "APPROVED")
      .reduce((acc, l) => acc + l.totalDays, 0);
    const pending = leaves
      .filter((l) => l.leaveType === lt && l.status === "PENDING")
      .reduce((acc, l) => acc + l.totalDays, 0);
    summary[lt] = {
      allowance,
      used,
      pending,
      remaining: Math.max(0, allowance - used),
    };
  }

  return summary;
}

export async function listLeaveRequests(
  ctx: LeaveActorContext,
  filters: {
    status?: string;
    leaveType?: string;
    employeeId?: string;
    outletId?: string;
    startDate?: string;
    endDate?: string;
  } = {}
) {
  const whereClause: any = {
    restaurantId: ctx.restaurantId,
  };

  if (!ctx.canApproveLeaves && !ctx.isAdmin) {
    if (!ctx.employeeId) return [];
    whereClause.employeeId = ctx.employeeId;
  } else {
    if (filters.employeeId) whereClause.employeeId = filters.employeeId;
    if (filters.outletId) {
      whereClause.OR = [
        { outletId: filters.outletId },
        {
          employee: {
            outletAssignments: { some: { outletId: filters.outletId } },
          },
        },
      ];
    } else if (ctx.accessibleOutletIds !== null) {
      const ids =
        ctx.accessibleOutletIds.length > 0
          ? ctx.accessibleOutletIds
          : ["__none__"];
      whereClause.OR = [
        { outletId: { in: ids } },
        { employee: { outletAssignments: { some: { outletId: { in: ids } } } } },
      ];
    }
  }

  if (filters.status && filters.status !== "ALL") {
    whereClause.status = filters.status as LeaveStatus;
  }
  if (filters.leaveType && filters.leaveType !== "ALL") {
    whereClause.leaveType = filters.leaveType as LeaveType;
  }
  if (filters.startDate) {
    whereClause.endDate = { gte: new Date(filters.startDate) };
  }
  if (filters.endDate) {
    whereClause.startDate = { lte: new Date(filters.endDate) };
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: whereClause,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          employmentRecords: {
            where: { effectiveTo: null },
            include: {
              department: { select: { name: true } },
              designation: { select: { name: true } },
              primaryOutlet: { select: { id: true, name: true, timezone: true } },
            },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Restrict reason & attachmentUrl to requester or authorized approver/admin
  return leaves.map((l) => {
    const isOwner = ctx.employeeId === l.employeeId;
    const canSeePrivate = isOwner || ctx.canApproveLeaves || ctx.isAdmin;
    return {
      ...l,
      reason: canSeePrivate ? l.reason : "[Restricted]",
      attachmentUrl: canSeePrivate ? l.attachmentUrl : null,
      attachmentName: canSeePrivate ? l.attachmentName : null,
      outlet: l.employee.employmentRecords[0]?.primaryOutlet || null,
    };
  });
}

export async function createLeaveRequest(
  ctx: LeaveActorContext,
  input: {
    employeeId?: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    totalDays?: number;
    isPartialDay?: boolean;
    startTime?: string | null;
    endTime?: string | null;
    hoursRequested?: number | null;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    reason: string;
  }
) {
  const targetEmployeeId =
    ctx.canApproveLeaves || ctx.isAdmin
      ? input.employeeId || ctx.employeeId
      : ctx.employeeId;

  if (!targetEmployeeId) {
    throw new LeaveError("Employee profile is required to submit leave", 400);
  }

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (endDate < startDate) {
    throw new LeaveError("End date must be on or after start date", 400);
  }

  let totalDays = input.totalDays ?? 1;
  let hoursRequested = input.hoursRequested ?? null;

  if (input.isPartialDay) {
    if (!input.startTime || !input.endTime) {
      throw new LeaveError(
        "Start time and end time are required for partial-day leave",
        400
      );
    }
    const sMins = timeStringToMinutes(input.startTime);
    const eMins = timeStringToMinutes(input.endTime);
    if (eMins <= sMins) {
      throw new LeaveError("End time must be after start time", 400);
    }
    hoursRequested = Number(((eMins - sMins) / 60).toFixed(2));
    totalDays = 0.5;
  }

  const emp = await prisma.employee.findFirst({
    where: { id: targetEmployeeId, restaurantId: ctx.restaurantId, archivedAt: null },
    select: {
      id: true,
      employmentRecords: {
        where: { effectiveTo: null },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { primaryOutletId: true },
      },
      outletAssignments: {
        where: { isPrimary: true },
        take: 1,
        select: { outletId: true },
      },
    },
  });

  if (!emp) {
    throw new LeaveError("Employee not found", 404);
  }

  const outletId =
    emp.employmentRecords[0]?.primaryOutletId ||
    emp.outletAssignments[0]?.outletId ||
    null;

  const leave = await prisma.leaveRequest.create({
    data: {
      restaurantId: ctx.restaurantId,
      employeeId: targetEmployeeId,
      outletId,
      leaveType: input.leaveType,
      startDate,
      endDate,
      totalDays,
      isPartialDay: Boolean(input.isPartialDay),
      startTime: input.isPartialDay ? input.startTime || null : null,
      endTime: input.isPartialDay ? input.endTime || null : null,
      hoursRequested,
      attachmentUrl: input.attachmentUrl || null,
      attachmentName: input.attachmentName || null,
      reason: input.reason.trim(),
      status: "PENDING",
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      restaurantId: ctx.restaurantId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      action: "LEAVE_REQUESTED",
      entityType: "LeaveRequest",
      entityId: leave.id,
      newValues: sanitizeAuditPayload({
        employeeId: targetEmployeeId,
        leaveType: leave.leaveType,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        totalDays: leave.totalDays,
        isPartialDay: leave.isPartialDay,
      }),
    },
  });

  return leave;
}

export async function previewLeaveShiftImpact(
  ctx: LeaveActorContext,
  leaveId: string
) {
  const leave = await prisma.leaveRequest.findFirst({
    where: { id: leaveId, restaurantId: ctx.restaurantId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          outletAssignments: { select: { outletId: true } },
        },
      },
    },
  });

  if (!leave) {
    throw new LeaveError("Leave request not found", 404);
  }

  if (ctx.accessibleOutletIds !== null) {
    const empOutletIds = new Set<string>(
      leave.employee.outletAssignments.map((a) => a.outletId)
    );
    if (leave.outletId) empOutletIds.add(leave.outletId);
    const inScope = Array.from(empOutletIds).some((id) =>
      ctx.accessibleOutletIds!.includes(id)
    );
    if (!inScope) {
      throw new LeaveError(
        "Leave request is outside your authorized outlet scope",
        403
      );
    }
  }

  const startKey = new Date(leave.startDate).toISOString().slice(0, 10);
  const endKey = new Date(leave.endDate).toISOString().slice(0, 10);
  const searchFrom = new Date(`${addDaysKey(startKey, -1)}T00:00:00Z`);
  const searchTo = new Date(`${endKey}T00:00:00Z`);

  const publishedShifts = await prisma.shiftAssignment.findMany({
    where: {
      restaurantId: ctx.restaurantId,
      employeeId: leave.employeeId,
      shiftDate: { gte: searchFrom, lte: searchTo },
      roster: { status: "PUBLISHED" },
    },
    include: {
      outlet: { select: { id: true, name: true, timezone: true } },
      roster: { select: { id: true, name: true } },
    },
    orderBy: [{ shiftDate: "asc" }, { startTime: "asc" }],
  });

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const conflicts = publishedShifts
    .filter((shift) => {
      if (shift.shiftDate < todayStart) return false; // preserve past shifts
      const tz = shift.outlet.timezone || "UTC";
      const leaveIv = getLeaveIntervalUtc(leave, tz);
      const shiftIv = getShiftIntervalUtc(shift, tz);
      return shiftIv.startUtc < leaveIv.endUtc && shiftIv.endUtc > leaveIv.startUtc;
    })
    .map((shift) => {
      const canResolveInOutlet =
        ctx.accessibleOutletIds === null ||
        ctx.accessibleOutletIds.includes(shift.outletId);
      return {
        assignmentId: shift.id,
        outletId: shift.outletId,
        outletName: shift.outlet.name,
        outletTimezone: shift.outlet.timezone,
        shiftDate: shift.shiftDate,
        startTime: shift.startTime,
        endTime: shift.endTime,
        roleName: shift.roleName || "Staff",
        rosterId: shift.roster?.id || shift.rosterId,
        rosterName: shift.roster?.name || "Published Roster",
        canResolveInOutlet,
      };
    });

  const blockedOutlets = conflicts.filter((c) => !c.canResolveInOutlet);
  const hasCrossOutletBlocker = blockedOutlets.length > 0;

  return {
    leaveId: leave.id,
    conflicts,
    hasCrossOutletBlocker,
    unresolvedMessage: hasCrossOutletBlocker
      ? `Cross-outlet shift conflict at ${Array.from(
          new Set(blockedOutlets.map((b) => b.outletName))
        ).join(", ")}. An authorized manager at that outlet must resolve coverage before approval.`
      : null,
  };
}

export async function reviewLeaveRequest(
  ctx: LeaveActorContext,
  leaveId: string,
  input: {
    status: "APPROVED" | "REJECTED" | "CANCELLED";
    managerNotes?: string;
    resolutions?: Array<{
      assignmentId: string;
      action: "UNASSIGN" | "REASSIGN";
      replacementEmployeeId?: string;
    }>;
  }
) {
  const existing = await prisma.leaveRequest.findFirst({
    where: { id: leaveId, restaurantId: ctx.restaurantId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          personalEmail: true,
        },
      },
    },
  });

  if (!existing) {
    throw new LeaveError("Leave request not found", 404);
  }

  // Self-cancellation allowed by owner while PENDING
  if (input.status === "CANCELLED") {
    const isOwner = ctx.employeeId === existing.employeeId;
    if (!isOwner && !ctx.canApproveLeaves && !ctx.isAdmin) {
      throw new LeaveError("Forbidden", 403);
    }
    if (existing.status === "CANCELLED") {
      return { leave: existing, alreadyDecided: true, resolvedShiftsCount: 0 };
    }
    if (existing.status !== "PENDING") {
      throw new LeaveError("Only pending leave requests can be cancelled", 400);
    }
    const cancelled = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: "CANCELLED", reviewedBy: ctx.userId, reviewedAt: new Date() },
    });
    return { leave: cancelled, alreadyDecided: false, resolvedShiftsCount: 0 };
  }

  if (!ctx.canApproveLeaves && !ctx.isAdmin) {
    throw new LeaveError("Missing leave approval permission", 403);
  }

  // Idempotent retry safety
  if (existing.status === input.status) {
    return { leave: existing, alreadyDecided: true, resolvedShiftsCount: 0 };
  }

  if (existing.status !== "PENDING") {
    throw new LeaveError(
      `Leave request is already ${existing.status}`,
      409,
      "ALREADY_DECIDED"
    );
  }

  const impact = await previewLeaveShiftImpact(ctx, leaveId);

  if (input.status === "APPROVED") {
    if (impact.hasCrossOutletBlocker) {
      throw new LeaveError(
        impact.unresolvedMessage || "Cross-outlet coverage must be resolved first.",
        403,
        "CROSS_OUTLET_BLOCKED",
        impact
      );
    }

    const resMap = new Map(
      (input.resolutions || []).map((r) => [r.assignmentId, r])
    );
    const unresolved = impact.conflicts.filter((c) => !resMap.has(c.assignmentId));
    if (unresolved.length > 0) {
      throw new LeaveError(
        `${unresolved.length} published shift(s) overlap this leave. Resolve coverage before approving.`,
        409,
        "COVERAGE_RESOLUTION_REQUIRED",
        impact
      );
    }

    // Validate all REASSIGN candidates against latest published schedule before committing
    for (const c of impact.conflicts) {
      const res = resMap.get(c.assignmentId)!;
      if (res.action === "REASSIGN") {
        if (!res.replacementEmployeeId) {
          throw new LeaveError(
            "Select a replacement employee for reassigned shifts",
            400
          );
        }
        const shift = await prisma.shiftAssignment.findUniqueOrThrow({
          where: { id: c.assignmentId },
        });
        const check = await validateShiftCandidate({
          restaurantId: ctx.restaurantId,
          employeeId: res.replacementEmployeeId,
          outletId: shift.outletId,
          shiftDate: shift.shiftDate,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes,
          excludeAssignmentId: shift.id,
        });
        if (!check.valid) {
          throw new LeaveError(
            `Replacement failed scheduling validation: ${check.blockingIssues[0].message}`,
            409,
            "REPLACEMENT_INVALID"
          );
        }
      }
    }
  }

  const rosterChanges: Array<{
    assignmentId: string;
    action: string;
    outletName: string;
    replacementEmployeeId?: string;
  }> = [];
  const replacementIds = new Set<string>();

  const updated = await prisma.$transaction(async (tx) => {
    const fresh = await tx.leaveRequest.findUniqueOrThrow({
      where: { id: leaveId },
    });
    if (fresh.status === input.status) {
      return fresh;
    }

    if (input.status === "APPROVED" && impact.conflicts.length > 0) {
      const resMap = new Map(
        (input.resolutions || []).map((r) => [r.assignmentId, r])
      );
      for (const c of impact.conflicts) {
        const res = resMap.get(c.assignmentId)!;
        if (res.action === "UNASSIGN") {
          await tx.shiftAssignment.delete({ where: { id: c.assignmentId } });
          rosterChanges.push({
            assignmentId: c.assignmentId,
            action: "UNASSIGN",
            outletName: c.outletName,
          });
        } else if (res.action === "REASSIGN" && res.replacementEmployeeId) {
          await tx.shiftAssignment.update({
            where: { id: c.assignmentId },
            data: { employeeId: res.replacementEmployeeId },
          });
          await tx.shiftChecklistExecution.updateMany({
            where: { shiftAssignmentId: c.assignmentId, status: { not: "VERIFIED" } },
            data: { assignedEmployeeId: res.replacementEmployeeId, version: { increment: 1 } },
          });
          replacementIds.add(res.replacementEmployeeId);
          rosterChanges.push({
            assignmentId: c.assignmentId,
            action: "REASSIGN",
            outletName: c.outletName,
            replacementEmployeeId: res.replacementEmployeeId,
          });
        }
      }
    }

    const saved = await tx.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: input.status,
        managerNotes: input.managerNotes || null,
        reviewedBy: ctx.userId,
        reviewedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        restaurantId: ctx.restaurantId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        action:
          input.status === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        entityType: "LeaveRequest",
        entityId: leaveId,
        newValues: sanitizeAuditPayload({
          status: input.status,
          employeeId: existing.employeeId,
          reviewedAt: saved.reviewedAt?.toISOString(),
          rosterChangesCount: rosterChanges.length,
          rosterChanges,
        }),
      },
    });

    return saved;
  });

  // Deduplicated notifications (never include private leave reason in coverage emails)
  const dedupKey = `leave:${leaveId}:${input.status}`;
  if (!sentNotifications.has(dedupKey)) {
    sentNotifications.add(dedupKey);
    if (existing.employee.personalEmail) {
      sendMail({
        to: existing.employee.personalEmail,
        subject: `Leave Request ${input.status === "APPROVED" ? "Approved" : "Declined"}`,
        html: `<p>Hi ${existing.employee.firstName}, your ${existing.leaveType} leave request has been <strong>${input.status.toLowerCase()}</strong>.</p>`,
        text: `Your ${existing.leaveType} leave request has been ${input.status.toLowerCase()}.`,
      }).catch(() => {});
    }
    if (replacementIds.size > 0) {
      const replacements = await prisma.employee.findMany({
        where: { id: { in: Array.from(replacementIds) } },
        select: { firstName: true, personalEmail: true },
      });
      for (const rep of replacements) {
        if (rep.personalEmail) {
          sendMail({
            to: rep.personalEmail,
            subject: "New Shift Coverage Assigned",
            html: `<p>Hi ${rep.firstName}, you have been assigned to cover a shift on the published roster. Check My Shifts for details.</p>`,
            text: "You have been assigned to cover a shift on the published roster.",
          }).catch(() => {});
        }
      }
    }
  }

  return {
    leave: updated,
    alreadyDecided: false,
    resolvedShiftsCount: rosterChanges.length,
  };
}
