import { prisma } from "@/core/database/client";
import {
  AssignmentType,
  EmploymentStatus,
  WorkerType,
} from "@prisma/client";
import type { WorkforceActorContext } from "./authHelper";

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  PROBATION: "On probation",
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  NOTICE: "Serving notice",
  SUSPENDED: "Suspended",
  RESIGNED: "Resigned",
  TERMINATED: "Terminated",
};

export const VALID_EMPLOYMENT_TRANSITIONS: Record<
  EmploymentStatus,
  EmploymentStatus[]
> = {
  PROBATION: ["PROBATION", "ACTIVE", "NOTICE", "SUSPENDED", "RESIGNED", "TERMINATED"],
  ACTIVE: ["ACTIVE", "PROBATION", "ON_LEAVE", "NOTICE", "SUSPENDED", "RESIGNED", "TERMINATED"],
  ON_LEAVE: ["ON_LEAVE", "ACTIVE", "NOTICE", "SUSPENDED", "RESIGNED", "TERMINATED"],
  NOTICE: ["NOTICE", "ACTIVE", "SUSPENDED", "RESIGNED", "TERMINATED"],
  SUSPENDED: ["SUSPENDED", "ACTIVE", "NOTICE", "RESIGNED", "TERMINATED"],
  RESIGNED: ["RESIGNED", "ACTIVE"],
  TERMINATED: ["TERMINATED", "ACTIVE"],
};

export const SCHEDULING_BLOCKED_STATUSES: EmploymentStatus[] = [
  "TERMINATED",
  "RESIGNED",
  "SUSPENDED",
];

const SENSITIVE_AUDIT_KEYS = new Set([
  "kioskPin",
  "documentNumber",
  "fileUrl",
  "bankAccount",
  "accountNumber",
  "routingNumber",
  "ifsc",
  "taxId",
  "ssn",
  "sin",
]);

export function sanitizeAuditPayload(
  obj: Record<string, unknown> | null | undefined
): string | null {
  if (!obj) return null;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!SENSITIVE_AUDIT_KEYS.has(k)) {
      clean[k] = v;
    }
  }
  return JSON.stringify(clean);
}

export class WorkforceError extends Error {
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

function buildOutletScopeWhere(
  restaurantId: string,
  accessibleOutletIds: string[] | null,
  outletFilter?: string
) {
  if (outletFilter) {
    if (
      accessibleOutletIds !== null &&
      !accessibleOutletIds.includes(outletFilter)
    ) {
      throw new WorkforceError("Outlet is outside your authorized scope", 403);
    }
    return {
      restaurantId,
      archivedAt: null,
      OR: [
        { outletAssignments: { some: { outletId: outletFilter } } },
        { employmentRecords: { some: { primaryOutletId: outletFilter } } },
      ],
    };
  }

  if (accessibleOutletIds === null) {
    return { restaurantId, archivedAt: null };
  }

  if (accessibleOutletIds.length === 0) {
    return { restaurantId, archivedAt: null, id: "__none__" };
  }

  return {
    restaurantId,
    archivedAt: null,
    OR: [
      {
        outletAssignments: {
          some: { outletId: { in: accessibleOutletIds } },
        },
      },
      {
        employmentRecords: {
          some: { primaryOutletId: { in: accessibleOutletIds } },
        },
      },
    ],
  };
}

export interface DirectoryFilters {
  search?: string;
  outletId?: string;
  departmentId?: string;
  workerType?: WorkerType;
  employmentStatus?: EmploymentStatus;
  archiveStatus?: "active" | "archived" | "all";
}

/**
 * Searchable, filterable, outlet-scoped directory projection.
 * Explicitly excludes kioskPin, documents, banking, and emergency contacts.
 */
export async function listDirectoryEmployees(
  ctx: WorkforceActorContext,
  filters: DirectoryFilters = {}
) {
  const baseWhere = buildOutletScopeWhere(
    ctx.restaurantId,
    ctx.accessibleOutletIds,
    filters.outletId
  );

  const where: Record<string, unknown> = { ...baseWhere };

  if (filters.archiveStatus === "archived") {
    where.archivedAt = { not: null };
  } else if (filters.archiveStatus === "all") {
    delete where.archivedAt;
  } else {
    where.archivedAt = null;
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    where.AND = [
      {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { employeeCode: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const employees = await prisma.employee.findMany({
    where,
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      phone: true,
      profilePhotoUrl: true,
      workerType: true,
      weeklyHoursLimit: true,
      joiningDate: true,
      archivedAt: true,
      createdAt: true,
      memberships: {
        take: 1,
        select: {
          id: true,
          status: true,
        },
      },
      employmentRecords: {
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          status: true,
          employmentType: true,
          effectiveFrom: true,
          effectiveTo: true,
          departmentId: true,
          designationId: true,
          primaryOutletId: true,
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
          primaryOutlet: { select: { id: true, name: true } },
        },
      },
      outletAssignments: {
        select: {
          id: true,
          outletId: true,
          isPrimary: true,
          assignmentType: true,
          effectiveFrom: true,
          effectiveTo: true,
          outlet: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const now = new Date();

  const mapped = employees
    .map((emp) => {
      const currentRecord = emp.employmentRecords[0] || null;
      const status: EmploymentStatus = currentRecord?.status || "ACTIVE";
      const workerType: WorkerType =
        currentRecord?.employmentType || emp.workerType || "FULL_TIME";
      const activeAssignments = emp.outletAssignments.filter(
        (a) => !a.effectiveTo || a.effectiveTo >= now
      );
      const primaryAssignment =
        activeAssignments.find((a) => a.isPrimary) ||
        emp.outletAssignments.find((a) => a.isPrimary);

      const primaryOutlet =
        currentRecord?.primaryOutlet || primaryAssignment?.outlet || null;

      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        phone: emp.phone,
        profilePhotoUrl: emp.profilePhotoUrl,
        weeklyHoursLimit: emp.weeklyHoursLimit,
        joiningDate: emp.joiningDate,
        archivedAt: emp.archivedAt,
        employmentStatus: status,
        employmentStatusLabel: EMPLOYMENT_STATUS_LABELS[status] || status,
        workerType,
        department: currentRecord?.department || null,
        designation: currentRecord?.designation || null,
        primaryOutlet,
        appAccessStatus: emp.memberships[0]?.status || "NONE",
        eligibleOutletsCount: activeAssignments.length,
        outletAssignments: activeAssignments,
      };
    })
    .filter((emp) => {
      if (filters.departmentId && emp.department?.id !== filters.departmentId) {
        return false;
      }
      if (filters.workerType && emp.workerType !== filters.workerType) {
        return false;
      }
      if (
        filters.employmentStatus &&
        emp.employmentStatus !== filters.employmentStatus
      ) {
        return false;
      }
      return true;
    });

  return mapped;
}

/**
 * Minimal roster-eligible employee list for shift managers without needing
 * full workforce profile permissions.
 */
export async function getRosterEligibleEmployees(
  ctx: WorkforceActorContext,
  outletId?: string,
  asOfDate?: Date
) {
  const baseWhere = buildOutletScopeWhere(
    ctx.restaurantId,
    ctx.accessibleOutletIds,
    outletId
  );

  const employees = await prisma.employee.findMany({
    where: baseWhere,
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      workerType: true,
      weeklyHoursLimit: true,
      employmentRecords: {
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          status: true,
          employmentType: true,
          effectiveFrom: true,
          primaryOutletId: true,
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
        },
      },
      outletAssignments: {
        select: {
          outletId: true,
          isPrimary: true,
          assignmentType: true,
          effectiveFrom: true,
          effectiveTo: true,
        },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const targetMs = asOfDate ? new Date(asOfDate).setUTCHours(12, 0, 0, 0) : null;

  return employees
    .map((emp) => {
      const rec = emp.employmentRecords[0] || null;
      const status: EmploymentStatus = rec?.status || "ACTIVE";
      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        weeklyHoursLimit: emp.weeklyHoursLimit,
        employmentStatus: status,
        effectiveFrom: rec?.effectiveFrom || null,
        workerType: rec?.employmentType || emp.workerType || "FULL_TIME",
        department: rec?.department || null,
        designation: rec?.designation || null,
        primaryOutletId: rec?.primaryOutletId || null,
        outletAssignments: emp.outletAssignments,
      };
    })
    .filter((emp) => {
      if (SCHEDULING_BLOCKED_STATUSES.includes(emp.employmentStatus)) {
        return false;
      }
      if (targetMs !== null && outletId) {
        const hasActiveOutletAssignment = emp.outletAssignments.some((a) => {
          if (a.outletId !== outletId) return false;
          const fromMs = new Date(a.effectiveFrom).setUTCHours(0, 0, 0, 0);
          const toMs = a.effectiveTo
            ? new Date(a.effectiveTo).setUTCHours(23, 59, 59, 999)
            : Number.POSITIVE_INFINITY;
          return targetMs >= fromMs && targetMs <= toMs;
        });
        const hasPrimaryRec =
          emp.primaryOutletId === outletId &&
          (!emp.effectiveFrom ||
            targetMs >= new Date(emp.effectiveFrom).setUTCHours(0, 0, 0, 0));
        return hasActiveOutletAssignment || hasPrimaryRec;
      }
      return true;
    });
}

export async function assertEmployeeInScope(
  ctx: WorkforceActorContext,
  employeeId: string,
  options?: { includeArchived?: boolean }
) {
  const emp = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      restaurantId: ctx.restaurantId,
      ...(options?.includeArchived ? {} : { archivedAt: null }),
    },
    select: {
      id: true,
      outletAssignments: { select: { outletId: true } },
      employmentRecords: {
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { primaryOutletId: true },
      },
    },
  });

  if (!emp) {
    throw new WorkforceError("Employee not found", 404);
  }

  if (ctx.accessibleOutletIds !== null) {
    const empOutletIds = new Set<string>(
      emp.outletAssignments.map((a) => a.outletId)
    );
    const primary = emp.employmentRecords[0]?.primaryOutletId;
    if (primary) empOutletIds.add(primary);

    const hasIntersection = Array.from(empOutletIds).some((id) =>
      ctx.accessibleOutletIds!.includes(id)
    );
    if (!hasIntersection) {
      throw new WorkforceError(
        "Employee is outside your authorized outlet scope",
        403
      );
    }
  }

  return emp;
}

export async function getEmployeeProfile(
  ctx: WorkforceActorContext,
  employeeId: string
) {
  await assertEmployeeInScope(ctx, employeeId, { includeArchived: true });

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, restaurantId: ctx.restaurantId },
    select: {
      id: true,
      restaurantId: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      personalEmail: ctx.canViewSensitive,
      phone: true,
      alternatePhone: ctx.canViewSensitive,
      dateOfBirth: ctx.canViewSensitive,
      gender: true,
      profilePhotoUrl: true,
      joiningDate: true,
      workerType: true,
      weeklyHoursLimit: true,
      kioskPin: true, // checked for boolean only, stripped below
      createdAt: true,
      updatedAt: true,
      memberships: {
        select: {
          id: true,
          status: true,
          userId: true,
          user: { select: { id: true, email: true, name: true } },
          accessGrants: {
            include: {
              role: { select: { id: true, name: true } },
              outlet: { select: { id: true, name: true } },
            },
          },
        },
      },
      employmentRecords: {
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        include: {
          department: true,
          designation: true,
          primaryOutlet: true,
          reportingManager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
            },
          },
        },
      },
      outletAssignments: {
        orderBy: [{ isPrimary: "desc" }, { effectiveFrom: "desc" }],
        include: {
          outlet: { select: { id: true, name: true, timezone: true } },
        },
      },
      emergencyContacts: ctx.canViewSensitive,
      documents: ctx.canViewSensitive
        ? { orderBy: { createdAt: "desc" } }
        : false,
      salaryStructures: ctx.canViewPayroll
        ? { orderBy: { effectiveFrom: "desc" } }
        : false,
      payslips: ctx.canViewPayroll
        ? { orderBy: { createdAt: "desc" }, take: 12 }
        : false,
      shiftAssignments: {
        where: {
          shiftDate: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) },
        },
        orderBy: { shiftDate: "asc" },
        take: 10,
        include: {
          outlet: { select: { id: true, name: true } },
          roster: { select: { id: true, status: true, name: true } },
        },
      },
    },
  });

  if (!employee) {
    throw new WorkforceError("Employee not found", 404);
  }

  const auditHistory = await prisma.auditLog.findMany({
    where: {
      restaurantId: ctx.restaurantId,
      entityType: {
        in: ["Employee", "EmploymentRecord", "EmployeeOutletAssignment"],
      },
      entityId: employeeId,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      action: true,
      entityType: true,
      userEmail: true,
      previousValues: true,
      newValues: true,
      createdAt: true,
    },
  });

  const { kioskPin, memberships, ...safeEmployee } = employee;
  const currentRecord = employee.employmentRecords[0] || null;
  const currentStatus: EmploymentStatus = currentRecord?.status || "ACTIVE";

  return {
    ...safeEmployee,
    membership: memberships[0] || null,
    hasKioskPin: Boolean(kioskPin),
    currentStatus,
    currentStatusLabel: EMPLOYMENT_STATUS_LABELS[currentStatus] || currentStatus,
    allowedNextStatuses: VALID_EMPLOYMENT_TRANSITIONS[currentStatus] || [],
    permissions: {
      canManageWorkforce: ctx.canManageWorkforce,
      canViewSensitive: ctx.canViewSensitive,
      canViewPayroll: ctx.canViewPayroll,
    },
    auditHistory,
  };
}

/**
 * Preview future published shifts impacted by a scheduling-affecting change
 * (status change to TERMINATED/RESIGNED/SUSPENDED, or ending/removing an outlet assignment).
 */
export async function previewSchedulingImpact(params: {
  restaurantId: string;
  employeeId: string;
  effectiveDate: Date;
  outletId?: string;
}) {
  const startOfDay = new Date(params.effectiveDate);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const affectedShifts = await prisma.shiftAssignment.findMany({
    where: {
      restaurantId: params.restaurantId,
      employeeId: params.employeeId,
      shiftDate: { gte: startOfDay },
      ...(params.outletId ? { outletId: params.outletId } : {}),
      roster: {
        status: "PUBLISHED",
      },
    },
    orderBy: [{ shiftDate: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      rosterId: true,
      shiftDate: true,
      startTime: true,
      endTime: true,
      roleName: true,
      outletId: true,
      outlet: { select: { id: true, name: true } },
      roster: { select: { id: true, name: true, status: true } },
    },
  });

  return {
    count: affectedShifts.length,
    requiresResolution: affectedShifts.length > 0,
    affectedShifts: affectedShifts.map((s) => ({
      id: s.id,
      shiftDate: s.shiftDate,
      startTime: s.startTime,
      endTime: s.endTime,
      roleTitle: s.roleName || "Staff",
      outletId: s.outletId,
      outletName: s.outlet.name,
      rosterId: s.roster?.id || s.rosterId,
      rosterName: s.roster?.name || "Published Roster",
    })),
  };
}

export interface TransitionEmploymentInput {
  status: EmploymentStatus;
  workerType: WorkerType;
  effectiveFrom: Date;
  departmentId?: string | null;
  designationId?: string | null;
  primaryOutletId?: string | null;
  probationEndDate?: Date | null;
  confirmationDate?: Date | null;
  noticePeriod?: number | null;
  reason?: string | null;
  weeklyHoursLimit?: number | null;
  resolution?: "CANCEL_SHIFTS" | "KEEP_SHIFTS";
}

export async function transitionEmploymentRecord(
  ctx: WorkforceActorContext,
  employeeId: string,
  input: TransitionEmploymentInput
) {
  await assertEmployeeInScope(ctx, employeeId);

  if (
    input.primaryOutletId &&
    ctx.accessibleOutletIds !== null &&
    !ctx.accessibleOutletIds.includes(input.primaryOutletId)
  ) {
    throw new WorkforceError(
      "Target primary outlet is outside your authorized scope",
      403
    );
  }

  const latest = await prisma.employmentRecord.findFirst({
    where: { employeeId },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  const currentStatus: EmploymentStatus = latest?.status || "ACTIVE";
  const allowed = VALID_EMPLOYMENT_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(input.status)) {
    throw new WorkforceError(
      `Invalid status transition from ${EMPLOYMENT_STATUS_LABELS[currentStatus]} to ${EMPLOYMENT_STATUS_LABELS[input.status]}`,
      400,
      "INVALID_STATUS_TRANSITION"
    );
  }

  const isBlockingStatus = SCHEDULING_BLOCKED_STATUSES.includes(input.status);
  const oldPrimaryOutletId = latest?.primaryOutletId || null;
  const primaryChanged =
    Boolean(input.primaryOutletId) &&
    oldPrimaryOutletId !== null &&
    input.primaryOutletId !== oldPrimaryOutletId;

  let impact = { count: 0, requiresResolution: false, affectedShifts: [] as unknown[] };
  if (isBlockingStatus) {
    impact = await previewSchedulingImpact({
      restaurantId: ctx.restaurantId,
      employeeId,
      effectiveDate: input.effectiveFrom,
    });
  } else if (primaryChanged && oldPrimaryOutletId) {
    const otherAssignment = await prisma.employeeOutletAssignment.findFirst({
      where: {
        employeeId,
        restaurantId: ctx.restaurantId,
        outletId: oldPrimaryOutletId,
        isPrimary: false,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.effectiveFrom } }],
      },
    });
    if (!otherAssignment) {
      impact = await previewSchedulingImpact({
        restaurantId: ctx.restaurantId,
        employeeId,
        effectiveDate: input.effectiveFrom,
        outletId: oldPrimaryOutletId,
      });
    }
  }

  if (impact.requiresResolution && !input.resolution) {
    throw new WorkforceError(
      `This change affects ${impact.count} future published shift(s). Choose how to resolve them before saving.`,
      409,
      "AFFECTS_PUBLISHED_SHIFTS",
      impact
    );
  }

  if (isBlockingStatus && impact.requiresResolution && input.resolution === "KEEP_SHIFTS") {
    throw new WorkforceError(
      `Staff with status "${EMPLOYMENT_STATUS_LABELS[input.status]}" cannot remain assigned to future published shifts. Cancel/unassign affected shifts to proceed.`,
      409,
      "POLICY_REQUIRES_UNASSIGN",
      impact
    );
  }

  return prisma.$transaction(async (tx) => {
    if (latest && !latest.effectiveTo) {
      await tx.employmentRecord.update({
        where: { id: latest.id },
        data: { effectiveTo: input.effectiveFrom },
      });
    }

    const created = await tx.employmentRecord.create({
      data: {
        restaurantId: ctx.restaurantId,
        employeeId,
        status: input.status,
        employmentType: input.workerType,
        effectiveFrom: input.effectiveFrom,
        departmentId: input.departmentId ?? latest?.departmentId ?? null,
        designationId: input.designationId ?? latest?.designationId ?? null,
        primaryOutletId:
          input.primaryOutletId !== undefined
            ? input.primaryOutletId
            : latest?.primaryOutletId ?? null,
        probationEndDate: input.probationEndDate ?? null,
        confirmationDate: input.confirmationDate ?? null,
        noticePeriod: input.noticePeriod ?? latest?.noticePeriod ?? null,
        notes: input.reason?.trim() || null,
      },
      include: {
        department: true,
        designation: true,
        primaryOutlet: true,
      },
    });

    await tx.employee.update({
      where: { id: employeeId },
      data: {
        workerType: input.workerType,
        ...(input.weeklyHoursLimit !== undefined
          ? { weeklyHoursLimit: input.weeklyHoursLimit }
          : {}),
      },
    });

    if (created.primaryOutletId) {
      await tx.employeeOutletAssignment.updateMany({
        where: {
          employeeId,
          restaurantId: ctx.restaurantId,
          isPrimary: true,
          outletId: { not: created.primaryOutletId },
        },
        data: { isPrimary: false, assignmentType: "TEMPORARY" },
      });

      await tx.employeeOutletAssignment.upsert({
        where: {
          employeeId_outletId: {
            employeeId,
            outletId: created.primaryOutletId,
          },
        },
        update: {
          isPrimary: true,
          assignmentType: "PRIMARY",
          effectiveTo: null,
        },
        create: {
          restaurantId: ctx.restaurantId,
          employeeId,
          outletId: created.primaryOutletId,
          isPrimary: true,
          assignmentType: "PRIMARY",
          effectiveFrom: input.effectiveFrom,
        },
      });
    }

    let cancelledShiftsCount = 0;
    if (impact.requiresResolution && input.resolution === "CANCEL_SHIFTS") {
      const startOfDay = new Date(input.effectiveFrom);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const del = await tx.shiftAssignment.deleteMany({
        where: {
          restaurantId: ctx.restaurantId,
          employeeId,
          shiftDate: { gte: startOfDay },
          ...(!isBlockingStatus && oldPrimaryOutletId
            ? { outletId: oldPrimaryOutletId }
            : {}),
          roster: { status: "PUBLISHED" },
        },
      });
      cancelledShiftsCount = del.count;
    }

    await tx.auditLog.create({
      data: {
        restaurantId: ctx.restaurantId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        action:
          currentStatus !== input.status
            ? "EMPLOYMENT_STATUS_CHANGED"
            : "EMPLOYMENT_DETAILS_UPDATED",
        entityType: "EmploymentRecord",
        entityId: employeeId,
        previousValues: sanitizeAuditPayload({
          status: currentStatus,
          workerType: latest?.employmentType || null,
          primaryOutletId: latest?.primaryOutletId || null,
          departmentId: latest?.departmentId || null,
          designationId: latest?.designationId || null,
        }),
        newValues: sanitizeAuditPayload({
          status: created.status,
          workerType: created.employmentType,
          primaryOutletId: created.primaryOutletId,
          departmentId: created.departmentId,
          designationId: created.designationId,
          effectiveFrom: created.effectiveFrom.toISOString(),
          reason: created.notes,
          cancelledShiftsCount,
        }),
      },
    });

    return { record: created, cancelledShiftsCount };
  });
}

export async function upsertOutletAssignment(
  ctx: WorkforceActorContext,
  employeeId: string,
  input: {
    outletId: string;
    isPrimary: boolean;
    assignmentType: AssignmentType;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    reason?: string | null;
  }
) {
  await assertEmployeeInScope(ctx, employeeId);

  if (
    ctx.accessibleOutletIds !== null &&
    !ctx.accessibleOutletIds.includes(input.outletId)
  ) {
    throw new WorkforceError(
      "Target outlet is outside your authorized scope",
      403
    );
  }

  const outlet = await prisma.restaurantOutlet.findFirst({
    where: { id: input.outletId, restaurantId: ctx.restaurantId },
    select: { id: true, name: true },
  });
  if (!outlet) {
    throw new WorkforceError("Outlet not found in this restaurant", 404);
  }

  const existing = await prisma.employeeOutletAssignment.findUnique({
    where: {
      employeeId_outletId: { employeeId, outletId: input.outletId },
    },
  });

  return prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.employeeOutletAssignment.updateMany({
        where: {
          employeeId,
          restaurantId: ctx.restaurantId,
          isPrimary: true,
          outletId: { not: input.outletId },
        },
        data: { isPrimary: false, assignmentType: "TEMPORARY" },
      });

      const latestRec = await tx.employmentRecord.findFirst({
        where: { employeeId },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      });
      if (latestRec) {
        await tx.employmentRecord.update({
          where: { id: latestRec.id },
          data: { primaryOutletId: input.outletId },
        });
      }
    }

    const assignment = await tx.employeeOutletAssignment.upsert({
      where: {
        employeeId_outletId: { employeeId, outletId: input.outletId },
      },
      update: {
        isPrimary: input.isPrimary,
        assignmentType: input.isPrimary ? "PRIMARY" : input.assignmentType,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.isPrimary ? null : input.effectiveTo ?? null,
      },
      create: {
        restaurantId: ctx.restaurantId,
        employeeId,
        outletId: input.outletId,
        isPrimary: input.isPrimary,
        assignmentType: input.isPrimary ? "PRIMARY" : input.assignmentType,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.isPrimary ? null : input.effectiveTo ?? null,
      },
      include: {
        outlet: { select: { id: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        restaurantId: ctx.restaurantId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        action: existing
          ? "OUTLET_ASSIGNMENT_UPDATED"
          : "OUTLET_ASSIGNMENT_GRANTED",
        entityType: "EmployeeOutletAssignment",
        entityId: employeeId,
        previousValues: existing
          ? sanitizeAuditPayload({
              outletId: existing.outletId,
              isPrimary: existing.isPrimary,
              assignmentType: existing.assignmentType,
              effectiveFrom: existing.effectiveFrom.toISOString(),
              effectiveTo: existing.effectiveTo?.toISOString() || null,
            })
          : null,
        newValues: sanitizeAuditPayload({
          outletId: assignment.outletId,
          outletName: outlet.name,
          isPrimary: assignment.isPrimary,
          assignmentType: assignment.assignmentType,
          effectiveFrom: assignment.effectiveFrom.toISOString(),
          effectiveTo: assignment.effectiveTo?.toISOString() || null,
          reason: input.reason?.trim() || null,
        }),
      },
    });

    return assignment;
  });
}

export async function endOutletAssignment(
  ctx: WorkforceActorContext,
  employeeId: string,
  input: {
    outletId: string;
    effectiveTo: Date;
    reason?: string | null;
    resolution?: "CANCEL_SHIFTS" | "KEEP_SHIFTS";
  }
) {
  await assertEmployeeInScope(ctx, employeeId);

  if (
    ctx.accessibleOutletIds !== null &&
    !ctx.accessibleOutletIds.includes(input.outletId)
  ) {
    throw new WorkforceError(
      "Outlet is outside your authorized scope",
      403
    );
  }

  const assignment = await prisma.employeeOutletAssignment.findUnique({
    where: {
      employeeId_outletId: { employeeId, outletId: input.outletId },
    },
    include: { outlet: { select: { id: true, name: true } } },
  });

  if (!assignment) {
    throw new WorkforceError("Outlet assignment not found", 404);
  }

  if (assignment.isPrimary) {
    throw new WorkforceError(
      "Cannot end the primary outlet assignment directly. Change the primary outlet first.",
      400,
      "CANNOT_END_PRIMARY_OUTLET"
    );
  }

  const impact = await previewSchedulingImpact({
    restaurantId: ctx.restaurantId,
    employeeId,
    effectiveDate: input.effectiveTo,
    outletId: input.outletId,
  });

  if (impact.requiresResolution && !input.resolution) {
    throw new WorkforceError(
      `Ending this outlet assignment affects ${impact.count} future published shift(s) at ${assignment.outlet.name}.`,
      409,
      "AFFECTS_PUBLISHED_SHIFTS",
      impact
    );
  }

  if (impact.requiresResolution && input.resolution === "KEEP_SHIFTS") {
    throw new WorkforceError(
      `Employee cannot remain scheduled at ${assignment.outlet.name} after their outlet assignment ends. Cancel/unassign affected shifts to proceed.`,
      409,
      "POLICY_REQUIRES_UNASSIGN",
      impact
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.employeeOutletAssignment.update({
      where: {
        employeeId_outletId: { employeeId, outletId: input.outletId },
      },
      data: {
        effectiveTo: input.effectiveTo,
      },
      include: {
        outlet: { select: { id: true, name: true } },
      },
    });

    let cancelledShiftsCount = 0;
    if (impact.requiresResolution && input.resolution === "CANCEL_SHIFTS") {
      const startOfDay = new Date(input.effectiveTo);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const del = await tx.shiftAssignment.deleteMany({
        where: {
          restaurantId: ctx.restaurantId,
          employeeId,
          outletId: input.outletId,
          shiftDate: { gte: startOfDay },
          roster: { status: "PUBLISHED" },
        },
      });
      cancelledShiftsCount = del.count;
    }

    await tx.auditLog.create({
      data: {
        restaurantId: ctx.restaurantId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        action: "OUTLET_ASSIGNMENT_ENDED",
        entityType: "EmployeeOutletAssignment",
        entityId: employeeId,
        previousValues: sanitizeAuditPayload({
          outletId: assignment.outletId,
          outletName: assignment.outlet.name,
          effectiveTo: assignment.effectiveTo?.toISOString() || null,
        }),
        newValues: sanitizeAuditPayload({
          outletId: updated.outletId,
          outletName: assignment.outlet.name,
          effectiveTo: updated.effectiveTo?.toISOString() || null,
          reason: input.reason?.trim() || null,
          cancelledShiftsCount,
        }),
      },
    });

    return { assignment: updated, cancelledShiftsCount };
  });
}
