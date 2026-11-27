import { prisma } from "@/core/database/client";
import { randomUUID } from "crypto";
import {
  EmploymentStatus,
  OnboardingStatus,
  TaskStatus,
  TaskType,
  WorkerType,
} from "@prisma/client";
import { sanitizeAuditPayload } from "@/modules/workforce/service";

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  PENDING: "Invited",
  IN_PROGRESS: "In Progress",
  PENDING_APPROVAL: "Submitted",
  REJECTED: "Changes Requested",
  APPROVED: "Approved",
};

export const ONBOARDING_NEXT_ACTIONS: Record<OnboardingStatus, string> = {
  PENDING: "Awaiting Candidate",
  IN_PROGRESS: "In Progress",
  PENDING_APPROVAL: "Review & Approve",
  REJECTED: "Awaiting Corrections",
  APPROVED: "Completed",
};

export class OnboardingError extends Error {
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

function normalizeProgress(p: any) {
  const effectiveTask = {
    id: p.taskId,
    title: p.taskTitle ?? p.task?.title ?? "Onboarding Task",
    description: p.taskDescription ?? p.task?.description ?? null,
    isRequired: p.isRequired ?? p.task?.isRequired ?? true,
    requiresDoc: p.requiresDoc ?? p.task?.requiresDoc ?? false,
    taskType: (p.taskType ?? p.task?.taskType ?? "CHECKBOX") as TaskType,
    sortOrder: p.sortOrder ?? p.task?.sortOrder ?? 0,
    fieldConfig: p.fieldConfig ?? p.task?.fieldConfig ?? null,
  };
  return {
    ...p,
    task: effectiveTask,
  };
}

function validateSessionOutletScope(
  session: any,
  accessibleOutletIds: string[] | null | undefined
) {
  if (!accessibleOutletIds) return;
  const outletIds = new Set<string>();
  if (session.intendedOutletId) outletIds.add(session.intendedOutletId);
  for (const r of session.employee?.employmentRecords || []) {
    if (r.primaryOutletId) outletIds.add(r.primaryOutletId);
  }
  for (const a of session.employee?.outletAssignments || []) {
    outletIds.add(a.outletId);
  }

  // If employee/session has outlet bindings, at least one must intersect
  if (outletIds.size > 0) {
    const allowed = Array.from(outletIds).some((id) =>
      accessibleOutletIds.includes(id)
    );
    if (!allowed) {
      throw new OnboardingError(
        "Onboarding session is outside your authorized outlet scope",
        403,
        "OUTLET_SCOPE_DENIED"
      );
    }
  } else if (accessibleOutletIds.length === 0) {
    throw new OnboardingError(
      "Onboarding session is outside your authorized outlet scope",
      403,
      "OUTLET_SCOPE_DENIED"
    );
  }
}

function validatePortalLinkState(session: any) {
  if (!session) {
    throw new OnboardingError(
      "Onboarding portal link is invalid",
      404,
      "INVALID_TOKEN"
    );
  }
  if (session.revokedAt) {
    throw new OnboardingError(
      "This onboarding invitation has been revoked. Please contact your manager.",
      403,
      "LINK_REVOKED"
    );
  }
  if (session.tokenExpiresAt && new Date(session.tokenExpiresAt) < new Date()) {
    throw new OnboardingError(
      "This onboarding invitation link has expired. Please request a new invitation.",
      410,
      "LINK_EXPIRED"
    );
  }
}

export const HROnboardingService = {
  // ── Templates ─────────────────────────────────────────────────────────
  async getTemplates(restaurantId: string) {
    return prisma.onboardingTemplate.findMany({
      where: { restaurantId, archivedAt: null },
      include: {
        tasks: { orderBy: { sortOrder: "asc" } },
        _count: { select: { onboardings: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getOrCreateDefaultTemplate(restaurantId: string) {
    let template = await prisma.onboardingTemplate.findFirst({
      where: { restaurantId, isDefault: true, archivedAt: null },
    });
    if (!template) {
      template = await prisma.onboardingTemplate.findFirst({
        where: { restaurantId, archivedAt: null },
      });
    }
    if (!template) {
      template = await HROnboardingService.createTemplate(restaurantId, {
        name: "General Staff Onboarding",
        description: "Standard onboarding checklist for new restaurant hires",
        isDefault: true,
        tasks: [
          {
            title: "Personal & Contact Verification",
            description:
              "Verify full legal name, phone number, address, and emergency contact details.",
            isRequired: true,
            taskType: "FORM_INPUT",
          },
          {
            title: "Government ID Proof Upload",
            description: "Upload copy of Government ID, Work Permit, or Passport.",
            isRequired: true,
            requiresDoc: true,
            taskType: "DOCUMENT",
          },
          {
            title: "Kitchen Hygiene & Food Safety Code",
            description:
              "Acknowledge and agree to restaurant food safety and hygiene protocols.",
            isRequired: true,
            taskType: "CHECKBOX",
          },
        ],
      });
    }
    return template;
  },

  async getTemplateById(restaurantId: string, id: string) {
    const template = await prisma.onboardingTemplate.findFirst({
      where: { id, restaurantId },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!template) throw new OnboardingError("Template not found", 404);
    return template;
  },

  async createTemplate(
    restaurantId: string,
    data: {
      name: string;
      description?: string;
      roleName?: string;
      isDefault?: boolean;
      tasks?: {
        title: string;
        description?: string;
        isRequired?: boolean;
        sortOrder?: number;
        requiresDoc?: boolean;
        taskType?: string;
        fieldConfig?: string;
      }[];
    }
  ) {
    return prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.onboardingTemplate.updateMany({
          where: { restaurantId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const template = await tx.onboardingTemplate.create({
        data: {
          restaurantId,
          name: data.name,
          description: data.description,
          roleName: data.roleName || null,
          isDefault: data.isDefault ?? false,
        },
      });
      if (data.tasks && data.tasks.length > 0) {
        await tx.onboardingTask.createMany({
          data: data.tasks.map((t, i) => ({
            templateId: template.id,
            title: t.title,
            description: t.description,
            isRequired: t.isRequired ?? true,
            sortOrder: t.sortOrder ?? i,
            requiresDoc: t.requiresDoc ?? false,
            taskType: (t.taskType as TaskType) ?? "CHECKBOX",
            fieldConfig: t.fieldConfig || null,
          })),
        });
      }
      return tx.onboardingTemplate.findUnique({
        where: { id: template.id },
        include: { tasks: { orderBy: { sortOrder: "asc" } } },
      });
    });
  },

  async updateTemplate(
    restaurantId: string,
    id: string,
    data: { name?: string; description?: string; roleName?: string; isDefault?: boolean }
  ) {
    await prisma.onboardingTemplate.findFirstOrThrow({
      where: { id, restaurantId },
    });
    if (data.isDefault) {
      await prisma.onboardingTemplate.updateMany({
        where: { restaurantId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return prisma.onboardingTemplate.update({ where: { id }, data });
  },

  async archiveTemplate(restaurantId: string, id: string) {
    await prisma.onboardingTemplate.findFirstOrThrow({
      where: { id, restaurantId },
    });
    return prisma.onboardingTemplate.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  },

  // ── Tasks ──────────────────────────────────────────────────────────────
  async addTask(
    restaurantId: string,
    templateId: string,
    data: {
      title: string;
      description?: string;
      isRequired?: boolean;
      sortOrder?: number;
      requiresDoc?: boolean;
      taskType?: string;
      fieldConfig?: string;
    }
  ) {
    await prisma.onboardingTemplate.findFirstOrThrow({
      where: { id: templateId, restaurantId },
    });
    return prisma.onboardingTask.create({
      data: {
        templateId,
        title: data.title,
        description: data.description,
        isRequired: data.isRequired ?? true,
        sortOrder: data.sortOrder ?? 0,
        requiresDoc: data.requiresDoc ?? false,
        taskType: (data.taskType as TaskType) ?? "CHECKBOX",
        fieldConfig: data.fieldConfig || null,
      },
    });
  },

  async updateTask(
    restaurantId: string,
    taskId: string,
    data: {
      title?: string;
      description?: string;
      isRequired?: boolean;
      sortOrder?: number;
      requiresDoc?: boolean;
      taskType?: string;
      fieldConfig?: string;
    }
  ) {
    const task = await prisma.onboardingTask.findFirstOrThrow({
      where: { id: taskId, template: { restaurantId } },
    });
    return prisma.onboardingTask.update({
      where: { id: task.id },
      data: {
        ...data,
        taskType: data.taskType ? (data.taskType as TaskType) : undefined,
      },
    });
  },

  async deleteTask(restaurantId: string, taskId: string) {
    const task = await prisma.onboardingTask.findFirstOrThrow({
      where: { id: taskId, template: { restaurantId } },
    });
    return prisma.onboardingTask.delete({ where: { id: task.id } });
  },

  async reorderTasks(
    restaurantId: string,
    templateId: string,
    orderedTaskIds: string[]
  ) {
    await prisma.onboardingTemplate.findFirstOrThrow({
      where: { id: templateId, restaurantId },
    });
    await prisma.$transaction(
      orderedTaskIds.map((taskId, index) =>
        prisma.onboardingTask.updateMany({
          where: { id: taskId, templateId },
          data: { sortOrder: index + 1 },
        })
      )
    );
  },

  // ── Sessions ───────────────────────────────────────────────────────────
  async getSessions(
    restaurantId: string,
    filters?: { status?: string; employeeId?: string; outletId?: string; search?: string },
    accessibleOutletIds?: string[] | null
  ) {
    if (
      filters?.outletId &&
      accessibleOutletIds &&
      !accessibleOutletIds.includes(filters.outletId)
    ) {
      throw new OnboardingError(
        "Outlet is outside your authorized scope",
        403,
        "OUTLET_SCOPE_DENIED"
      );
    }

    const sessions = await prisma.employeeOnboarding.findMany({
      where: {
        restaurantId,
        ...(filters?.status && filters.status !== "ALL"
          ? { status: filters.status as OnboardingStatus }
          : {}),
        ...(filters?.employeeId ? { employeeId: filters.employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            personalEmail: true,
            phone: true,
            employmentRecords: {
              orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
              take: 1,
              select: {
                primaryOutletId: true,
                primaryOutlet: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
              },
            },
            outletAssignments: {
              select: { outletId: true },
            },
          },
        },
        template: { select: { id: true, name: true, roleName: true } },
        progresses: {
          select: {
            id: true,
            status: true,
            isRequired: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const [outlets, departments, designations] = await Promise.all([
      prisma.restaurantOutlet.findMany({
        where: { restaurantId },
        select: { id: true, name: true },
      }),
      prisma.department.findMany({
        where: { restaurantId },
        select: { id: true, name: true },
      }),
      prisma.designation.findMany({
        where: { restaurantId },
        select: { id: true, name: true },
      }),
    ]);

    const outletMap = new Map(outlets.map((o) => [o.id, o]));
    const deptMap = new Map(departments.map((d) => [d.id, d]));
    const desigMap = new Map(designations.map((d) => [d.id, d]));

    const now = new Date();
    const searchLower = filters?.search?.trim().toLowerCase() || "";

    return sessions
      .filter((s) => {
        // Outlet scope check
        if (accessibleOutletIds) {
          const ids = new Set<string>();
          if (s.intendedOutletId) ids.add(s.intendedOutletId);
          for (const r of s.employee.employmentRecords) {
            if (r.primaryOutletId) ids.add(r.primaryOutletId);
          }
          for (const a of s.employee.outletAssignments) {
            ids.add(a.outletId);
          }
          if (ids.size > 0) {
            const ok = Array.from(ids).some((id) =>
              accessibleOutletIds.includes(id)
            );
            if (!ok) return false;
          } else if (accessibleOutletIds.length === 0) {
            return false;
          }
        }

        if (filters?.outletId) {
          const effectiveOutletId =
            s.intendedOutletId ||
            s.employee.employmentRecords[0]?.primaryOutletId ||
            null;
          if (effectiveOutletId !== filters.outletId) return false;
        }

        if (searchLower) {
          const fullName =
            `${s.employee.firstName} ${s.employee.lastName}`.toLowerCase();
          const code = s.employee.employeeCode.toLowerCase();
          const tpl = s.template.name.toLowerCase();
          if (
            !fullName.includes(searchLower) &&
            !code.includes(searchLower) &&
            !tpl.includes(searchLower)
          ) {
            return false;
          }
        }

        return true;
      })
      .map((s) => {
        const rec = s.employee.employmentRecords[0];
        const intendedOutlet = s.intendedOutletId
          ? outletMap.get(s.intendedOutletId) || null
          : rec?.primaryOutlet || null;
        const intendedDepartment = s.intendedDepartmentId
          ? deptMap.get(s.intendedDepartmentId) || null
          : rec?.department || null;
        const intendedDesignation = s.intendedDesignationId
          ? desigMap.get(s.intendedDesignationId) || null
          : rec?.designation || null;

        const totalCount = s.progresses.length;
        const completedCount = s.progresses.filter((p) =>
          ["COMPLETED", "WAIVED"].includes(p.status)
        ).length;
        const isExpired = Boolean(
          s.tokenExpiresAt && new Date(s.tokenExpiresAt) < now
        );
        const isRevoked = Boolean(s.revokedAt);

        return {
          ...s,
          statusLabel: ONBOARDING_STATUS_LABELS[s.status] || s.status,
          nextAction: ONBOARDING_NEXT_ACTIONS[s.status] || "Review",
          intendedOutlet,
          intendedDepartment,
          intendedDesignation,
          isExpired,
          isRevoked,
          progressSummary: {
            totalCount,
            completedCount,
            percent:
              totalCount > 0
                ? Math.round((completedCount / totalCount) * 100)
                : 0,
          },
        };
      });
  },

  async getSessionById(
    restaurantId: string,
    sessionId: string,
    accessibleOutletIds?: string[] | null
  ) {
    const session = await prisma.employeeOnboarding.findFirst({
      where: {
        id: sessionId,
        restaurantId,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            personalEmail: true,
            phone: true,
            workerType: true,
            employmentRecords: {
              orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
              take: 1,
              include: {
                department: true,
                designation: true,
                primaryOutlet: true,
              },
            },
            outletAssignments: {
              select: { outletId: true },
            },
          },
        },
        template: {
          include: { tasks: { orderBy: { sortOrder: "asc" } } },
        },
        progresses: {
          include: { task: true, fileUpload: true },
          orderBy: { createdAt: "asc" },
        },
        uploads: true,
      },
    });

    if (!session) {
      throw new OnboardingError("Onboarding session not found", 404);
    }

    validateSessionOutletScope(session, accessibleOutletIds);

    const normalizedProgresses = session.progresses
      .map(normalizeProgress)
      .sort((a, b) => a.task.sortOrder - b.task.sortOrder);

    const [intendedOutlet, intendedDepartment, intendedDesignation, appRole] =
      await Promise.all([
        session.intendedOutletId
          ? prisma.restaurantOutlet.findUnique({
              where: { id: session.intendedOutletId },
              select: { id: true, name: true },
            })
          : null,
        session.intendedDepartmentId
          ? prisma.department.findUnique({
              where: { id: session.intendedDepartmentId },
              select: { id: true, name: true },
            })
          : null,
        session.intendedDesignationId
          ? prisma.designation.findUnique({
              where: { id: session.intendedDesignationId },
              select: { id: true, name: true },
            })
          : null,
        session.appRoleId
          ? prisma.role.findUnique({
              where: { id: session.appRoleId },
              select: { id: true, name: true },
            })
          : null,
      ]);

    // Detect potential existing employee match (for duplicate prevention on approval)
    let existingEmployeeMatch: {
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string;
    } | null = null;
    if (session.status !== "APPROVED" && (session.employee.personalEmail || session.employee.phone)) {
      const orConds: any[] = [];
      if (session.employee.personalEmail) {
        orConds.push({
          personalEmail: {
            equals: session.employee.personalEmail,
            mode: "insensitive",
          },
        });
      }
      if (session.employee.phone) {
        orConds.push({ phone: session.employee.phone });
      }
      if (orConds.length > 0) {
        existingEmployeeMatch = await prisma.employee.findFirst({
          where: {
            restaurantId,
            archivedAt: null,
            id: { not: session.employeeId },
            OR: orConds,
          },
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        });
      }
    }

    return {
      ...session,
      statusLabel: ONBOARDING_STATUS_LABELS[session.status] || session.status,
      nextAction: ONBOARDING_NEXT_ACTIONS[session.status] || "Review",
      intendedOutlet:
        intendedOutlet ||
        session.employee.employmentRecords[0]?.primaryOutlet ||
        null,
      intendedDepartment:
        intendedDepartment ||
        session.employee.employmentRecords[0]?.department ||
        null,
      intendedDesignation:
        intendedDesignation ||
        session.employee.employmentRecords[0]?.designation ||
        null,
      appRole,
      existingEmployeeMatch,
      isExpired: Boolean(
        session.tokenExpiresAt && new Date(session.tokenExpiresAt) < new Date()
      ),
      isRevoked: Boolean(session.revokedAt),
      progresses: normalizedProgresses,
    };
  },

  async getSessionByToken(accessToken: string) {
    const session = await prisma.employeeOnboarding.findFirst({
      where: { accessToken },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            personalEmail: true,
          },
        },
        restaurant: { include: { branding: true } },
        template: {
          select: { id: true, name: true, description: true, roleName: true },
        },
        progresses: {
          include: { task: true, fileUpload: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    validatePortalLinkState(session);

    const normalizedProgresses = session!.progresses
      .map(normalizeProgress)
      .sort((a, b) => a.task.sortOrder - b.task.sortOrder);

    return {
      ...session!,
      statusLabel:
        ONBOARDING_STATUS_LABELS[session!.status] || session!.status,
      progresses: normalizedProgresses,
    };
  },

  async startOnboarding(
    restaurantId: string,
    params: {
      employeeId?: string;
      candidate?: {
        firstName: string;
        lastName: string;
        personalEmail?: string;
        phone?: string;
      };
      templateId: string;
      intendedOutletId?: string | null;
      intendedDepartmentId?: string | null;
      intendedDesignationId?: string | null;
      intendedStartDate?: Date | null;
      intendedEmploymentStatus?: EmploymentStatus;
      intendedWorkerType?: WorkerType;
      provisionAppAccess?: boolean;
      appRoleId?: string | null;
      expiresInDays?: number;
      actor?: { userId: string; userEmail: string };
    }
  ) {
    const template = await prisma.onboardingTemplate.findFirst({
      where: { id: params.templateId, restaurantId, archivedAt: null },
    });
    if (!template) {
      throw new OnboardingError("Onboarding template not found", 404);
    }

    if (params.intendedOutletId) {
      const outlet = await prisma.restaurantOutlet.findFirst({
        where: { id: params.intendedOutletId, restaurantId },
      });
      if (!outlet) {
        throw new OnboardingError("Intended outlet not found", 404);
      }
    }

    const expiresInDays = params.expiresInDays ?? 7;
    const tokenExpiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000
    );

    return prisma.$transaction(async (tx) => {
      let employeeId = params.employeeId;
      if (!employeeId) {
        if (!params.candidate?.firstName || !params.candidate?.lastName) {
          throw new OnboardingError(
            "Select an existing employee or provide candidate first and last name",
            400
          );
        }
        const countTotal = await tx.employee.count({ where: { restaurantId } });
        let nextNum = countTotal + 1;
        let employeeCode = `EMP-${String(nextNum).padStart(5, "0")}`;
        while (
          await tx.employee.findUnique({
            where: { restaurantId_employeeCode: { restaurantId, employeeCode } },
          })
        ) {
          nextNum++;
          employeeCode = `EMP-${String(nextNum).padStart(5, "0")}`;
        }
        const createdEmp = await tx.employee.create({
          data: {
            restaurantId,
            employeeCode,
            firstName: params.candidate.firstName.trim(),
            lastName: params.candidate.lastName.trim(),
            personalEmail: params.candidate.personalEmail?.trim() || null,
            phone: params.candidate.phone?.trim() || null,
            joiningDate: params.intendedStartDate || new Date(),
            workerType: params.intendedWorkerType || "FULL_TIME",
          },
        });
        employeeId = createdEmp.id;
      } else {
        await tx.employee.findFirstOrThrow({
          where: { id: employeeId, restaurantId },
        });
      }

      const session = await tx.employeeOnboarding.create({
        data: {
          restaurantId,
          employeeId,
          templateId: params.templateId,
          status: "PENDING",
          tokenExpiresAt,
          intendedOutletId: params.intendedOutletId || null,
          intendedDepartmentId: params.intendedDepartmentId || null,
          intendedDesignationId: params.intendedDesignationId || null,
          intendedStartDate: params.intendedStartDate || null,
          intendedEmploymentStatus:
            params.intendedEmploymentStatus || "PROBATION",
          intendedWorkerType: params.intendedWorkerType || "FULL_TIME",
          provisionAppAccess: Boolean(params.provisionAppAccess),
          appRoleId: params.appRoleId || null,
        },
      });

      // Snapshot template tasks onto progress rows so later template edits don't alter assigned tasks
      const tasks = await tx.onboardingTask.findMany({
        where: { templateId: params.templateId },
        orderBy: { sortOrder: "asc" },
      });
      if (tasks.length > 0) {
        await tx.onboardingTaskProgress.createMany({
          data: tasks.map((t) => ({
            onboardingId: session.id,
            taskId: t.id,
            status: "PENDING" as const,
            taskTitle: t.title,
            taskDescription: t.description,
            taskType: t.taskType,
            isRequired: t.isRequired,
            requiresDoc: t.requiresDoc,
            sortOrder: t.sortOrder,
            fieldConfig: t.fieldConfig,
          })),
        });
      }

      if (params.actor) {
        await tx.auditLog.create({
          data: {
            restaurantId,
            userId: params.actor.userId,
            userEmail: params.actor.userEmail,
            action: "ONBOARDING_INVITED",
            entityType: "EmployeeOnboarding",
            entityId: session.id,
            newValues: sanitizeAuditPayload({
              employeeId,
              templateId: params.templateId,
              intendedOutletId: params.intendedOutletId || null,
              intendedEmploymentStatus:
                params.intendedEmploymentStatus || "PROBATION",
              tokenExpiresAt: tokenExpiresAt.toISOString(),
            }),
          },
        });
      }

      return session;
    });
  },

  async resendInvitation(
    restaurantId: string,
    sessionId: string,
    actor: { userId: string; userEmail: string },
    accessibleOutletIds?: string[] | null
  ) {
    const existing = await HROnboardingService.getSessionById(
      restaurantId,
      sessionId,
      accessibleOutletIds
    );
    if (existing.status === "APPROVED") {
      throw new OnboardingError("Cannot resend invitation for approved session", 400);
    }

    const newToken = randomUUID();
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await prisma.employeeOnboarding.update({
      where: { id: sessionId },
      data: {
        accessToken: newToken,
        tokenExpiresAt: newExpiry,
        revokedAt: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId,
        userId: actor.userId,
        userEmail: actor.userEmail,
        action: "ONBOARDING_INVITE_RESENT",
        entityType: "EmployeeOnboarding",
        entityId: sessionId,
        newValues: sanitizeAuditPayload({
          tokenExpiresAt: newExpiry.toISOString(),
        }),
      },
    });

    return updated;
  },

  async revokeInvitation(
    restaurantId: string,
    sessionId: string,
    actor: { userId: string; userEmail: string },
    reason?: string,
    accessibleOutletIds?: string[] | null
  ) {
    await HROnboardingService.getSessionById(
      restaurantId,
      sessionId,
      accessibleOutletIds
    );

    const updated = await prisma.employeeOnboarding.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId,
        userId: actor.userId,
        userEmail: actor.userEmail,
        action: "ONBOARDING_INVITE_REVOKED",
        entityType: "EmployeeOnboarding",
        entityId: sessionId,
        newValues: sanitizeAuditPayload({
          reason: reason?.trim() || null,
          revokedAt: updated.revokedAt?.toISOString(),
        }),
      },
    });

    return updated;
  },

  async updateTaskProgress(
    restaurantId: string,
    sessionId: string,
    taskId: string,
    data: {
      status: TaskStatus;
      notes?: string;
      reviewNote?: string;
      fileUploadId?: string;
      responseValue?: string;
    },
    accessibleOutletIds?: string[] | null
  ) {
    const session = await HROnboardingService.getSessionById(
      restaurantId,
      sessionId,
      accessibleOutletIds
    );
    if (
      !["PENDING", "IN_PROGRESS", "PENDING_APPROVAL", "REJECTED"].includes(
        session.status
      )
    ) {
      throw new OnboardingError(
        "Cannot update tasks for this session in its current state",
        400
      );
    }

    const progress = await prisma.onboardingTaskProgress.findFirstOrThrow({
      where: { onboardingId: sessionId, taskId },
    });

    return prisma.onboardingTaskProgress.update({
      where: { id: progress.id },
      data: {
        status: data.status,
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.reviewNote !== undefined && { reviewNote: data.reviewNote }),
        ...(data.responseValue !== undefined && {
          responseValue: data.responseValue,
        }),
        ...(data.fileUploadId !== undefined && {
          fileUploadId: data.fileUploadId,
        }),
        completedAt: data.status === "COMPLETED" ? new Date() : null,
      },
    });
  },

  async updateTaskProgressByToken(
    accessToken: string,
    taskId: string,
    data: {
      status: TaskStatus;
      notes?: string;
      fileUploadId?: string;
      responseValue?: string;
    }
  ) {
    const session = await prisma.employeeOnboarding.findFirst({
      where: { accessToken },
    });
    validatePortalLinkState(session);

    if (!["PENDING", "IN_PROGRESS", "REJECTED"].includes(session!.status)) {
      throw new OnboardingError(
        "This onboarding submission is already under review or approved",
        400
      );
    }

    const progress = await prisma.onboardingTaskProgress.findFirst({
      where: { onboardingId: session!.id, taskId },
      include: { task: true },
    });
    if (!progress) {
      throw new OnboardingError("Task not found in this onboarding session", 404);
    }

    const normalized = normalizeProgress(progress);

    if (data.status === "COMPLETED") {
      const tType = normalized.task.taskType;
      if (tType === "DOCUMENT" || normalized.task.requiresDoc) {
        const fid = data.fileUploadId ?? progress.fileUploadId;
        if (!fid) {
          throw new OnboardingError(
            `Please upload a file for "${normalized.task.title}"`,
            400
          );
        }
        const upload = await prisma.employeeFileUpload.findFirst({
          where: { id: fid, restaurantId: session!.restaurantId },
        });
        if (!upload) {
          throw new OnboardingError("Uploaded file not found", 400);
        }
      } else if (tType === "SIGNATURE" || tType === "FORM_INPUT" || tType === "DATE") {
        const val = (data.responseValue ?? progress.responseValue ?? "").trim();
        if (!val) {
          throw new OnboardingError(
            `Please complete "${normalized.task.title}" before marking done`,
            400
          );
        }
      }
    }

    // Preserve submission history on updates/resubmissions
    const existingHistory = Array.isArray(progress.submissionHistory)
      ? (progress.submissionHistory as any[])
      : [];
    const nextHistory =
      progress.responseValue || progress.fileUploadId
        ? [
            ...existingHistory,
            {
              at: new Date().toISOString(),
              status: progress.status,
              hadFile: Boolean(progress.fileUploadId),
              hadResponse: Boolean(progress.responseValue),
            },
          ].slice(-10)
        : existingHistory;

    return prisma.$transaction(async (tx) => {
      if (session!.status === "PENDING") {
        await tx.employeeOnboarding.update({
          where: { id: session!.id },
          data: { status: "IN_PROGRESS", startedAt: session!.startedAt || new Date() },
        });
      }

      return tx.onboardingTaskProgress.update({
        where: { id: progress.id },
        data: {
          status: data.status,
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.responseValue !== undefined && {
            responseValue: data.responseValue,
          }),
          ...(data.fileUploadId !== undefined && {
            fileUploadId: data.fileUploadId,
          }),
          submissionHistory: nextHistory,
          completedAt: data.status === "COMPLETED" ? new Date() : null,
        },
      });
    });
  },

  async submitForApproval(restaurantId: string, sessionId: string) {
    const session = await prisma.employeeOnboarding.findFirst({
      where: { id: sessionId, restaurantId },
      include: {
        template: { include: { tasks: true } },
        progresses: { include: { task: true } },
      },
    });
    if (!session) {
      throw new OnboardingError("Onboarding session not found", 404);
    }

    if (!["PENDING", "IN_PROGRESS", "REJECTED"].includes(session.status)) {
      throw new OnboardingError(
        "Only Invited, In Progress, or Changes Requested sessions can be submitted",
        400
      );
    }

    const normalized = session.progresses.map(normalizeProgress);
    const missingTasks = normalized.filter((p) => {
      if (!p.task.isRequired) return false;
      if (!["COMPLETED", "WAIVED"].includes(p.status)) return true;
      if (p.status === "WAIVED") return false;
      if ((p.task.taskType === "DOCUMENT" || p.task.requiresDoc) && !p.fileUploadId) {
        return true;
      }
      if (
        ["SIGNATURE", "FORM_INPUT", "DATE"].includes(p.task.taskType) &&
        !(p.responseValue || "").trim()
      ) {
        return true;
      }
      return false;
    });

    if (missingTasks.length > 0) {
      throw new OnboardingError(
        `${missingTasks.length} required task(s) still need attention before submission`,
        400,
        "MISSING_REQUIRED_TASKS",
        {
          missingTasks: missingTasks.map((m) => ({
            taskId: m.taskId,
            title: m.task.title,
          })),
        }
      );
    }

    return prisma.employeeOnboarding.update({
      where: { id: sessionId },
      data: { status: "PENDING_APPROVAL", submittedAt: new Date() },
    });
  },

  async submitByToken(accessToken: string) {
    const session = await prisma.employeeOnboarding.findFirst({
      where: { accessToken },
    });
    validatePortalLinkState(session);
    return HROnboardingService.submitForApproval(
      session!.restaurantId,
      session!.id
    );
  },

  async requestCorrections(
    restaurantId: string,
    sessionId: string,
    actor: { userId: string; userEmail: string },
    params: {
      reviewNotes: string;
      taskCorrections?: Array<{ taskId: string; note: string }>;
    },
    accessibleOutletIds?: string[] | null
  ) {
    const session = await HROnboardingService.getSessionById(
      restaurantId,
      sessionId,
      accessibleOutletIds
    );
    if (session.status !== "PENDING_APPROVAL") {
      throw new OnboardingError(
        "Only submitted sessions awaiting review can have corrections requested",
        400
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (params.taskCorrections && params.taskCorrections.length > 0) {
        for (const tc of params.taskCorrections) {
          await tx.onboardingTaskProgress.updateMany({
            where: { onboardingId: sessionId, taskId: tc.taskId },
            data: {
              status: "REJECTED",
              reviewNote: tc.note,
              completedAt: null,
            },
          });
        }
      }

      const updated = await tx.employeeOnboarding.update({
        where: { id: sessionId },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewedBy: actor.userId,
          reviewNotes: params.reviewNotes,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          userId: actor.userId,
          userEmail: actor.userEmail,
          action: "ONBOARDING_CHANGES_REQUESTED",
          entityType: "EmployeeOnboarding",
          entityId: sessionId,
          newValues: sanitizeAuditPayload({
            outcome: "CHANGES_REQUESTED",
            correctionsCount: params.taskCorrections?.length || 0,
            reviewNotes: params.reviewNotes,
          }),
        },
      });

      return updated;
    });

    return result;
  },

  async approveOnboarding(
    restaurantId: string,
    sessionId: string,
    actor: { userId: string; userEmail: string },
    options?: {
      reviewNotes?: string;
      existingEmployeeResolution?: "USE_EXISTING" | "KEEP_SEPARATE";
      matchedEmployeeId?: string;
      accessibleOutletIds?: string[] | null;
    }
  ) {
    const session = await HROnboardingService.getSessionById(
      restaurantId,
      sessionId,
      options?.accessibleOutletIds
    );

    // Idempotent retry safety: if already approved, return existing outcome without duplicating records
    if (session.status === "APPROVED") {
      return {
        onboarding: session,
        employeeId: session.approvedEmployeeId || session.employeeId,
        alreadyApproved: true,
      };
    }

    if (session.status !== "PENDING_APPROVAL") {
      throw new OnboardingError(
        "Only submitted sessions awaiting approval can be approved",
        400
      );
    }

    if (
      session.existingEmployeeMatch &&
      !options?.existingEmployeeResolution
    ) {
      throw new OnboardingError(
        `An existing employee (${session.existingEmployeeMatch.firstName} ${session.existingEmployeeMatch.lastName}, ${session.existingEmployeeMatch.employeeCode}) matches this candidate's email or phone. Confirm whether to link the existing profile or keep separate.`,
        409,
        "EXISTING_EMPLOYEE_MATCH",
        { existingEmployeeMatch: session.existingEmployeeMatch }
      );
    }

    const targetEmployeeId =
      options?.existingEmployeeResolution === "USE_EXISTING" &&
      session.existingEmployeeMatch
        ? session.existingEmployeeMatch.id
        : session.employeeId;

    const effectiveFrom = session.intendedStartDate
      ? new Date(session.intendedStartDate)
      : new Date();
    const empStatus: EmploymentStatus =
      session.intendedEmploymentStatus || "PROBATION";
    const workerType: WorkerType = session.intendedWorkerType || "FULL_TIME";

    const approved = await prisma.$transaction(async (tx) => {
      // Lock/check inside transaction for concurrency safety
      const fresh = await tx.employeeOnboarding.findUniqueOrThrow({
        where: { id: sessionId },
      });
      if (fresh.status === "APPROVED") {
        return {
          onboarding: fresh,
          employeeId: fresh.approvedEmployeeId || targetEmployeeId,
          alreadyApproved: true,
        };
      }

      // Close any open employment record on target employee
      const latestRec = await tx.employmentRecord.findFirst({
        where: { employeeId: targetEmployeeId, effectiveTo: null },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      });
      if (latestRec) {
        await tx.employmentRecord.update({
          where: { id: latestRec.id },
          data: { effectiveTo: effectiveFrom },
        });
      }

      await tx.employmentRecord.create({
        data: {
          restaurantId,
          employeeId: targetEmployeeId,
          departmentId:
            session.intendedDepartmentId ?? latestRec?.departmentId ?? null,
          designationId:
            session.intendedDesignationId ?? latestRec?.designationId ?? null,
          primaryOutletId:
            session.intendedOutletId ?? latestRec?.primaryOutletId ?? null,
          employmentType: workerType,
          effectiveFrom,
          status: empStatus,
          notes: "Activated from Digital Onboarding",
        },
      });

      const primaryOutletId =
        session.intendedOutletId ?? latestRec?.primaryOutletId ?? null;
      if (primaryOutletId) {
        await tx.employeeOutletAssignment.updateMany({
          where: {
            employeeId: targetEmployeeId,
            restaurantId,
            isPrimary: true,
            outletId: { not: primaryOutletId },
          },
          data: { isPrimary: false, assignmentType: "TEMPORARY" },
        });

        await tx.employeeOutletAssignment.upsert({
          where: {
            employeeId_outletId: {
              employeeId: targetEmployeeId,
              outletId: primaryOutletId,
            },
          },
          update: {
            isPrimary: true,
            assignmentType: "PRIMARY",
            effectiveFrom,
            effectiveTo: null,
          },
          create: {
            restaurantId,
            employeeId: targetEmployeeId,
            outletId: primaryOutletId,
            isPrimary: true,
            assignmentType: "PRIMARY",
            effectiveFrom,
          },
        });
      }

      // Optional app access provisioning (when explicitly enabled + email + role provided)
      if (
        session.provisionAppAccess &&
        session.employee.personalEmail &&
        session.appRoleId
      ) {
        const emailLower = session.employee.personalEmail.toLowerCase();
        let user = await tx.user.findUnique({ where: { email: emailLower } });
        if (!user) {
          user = await tx.user.create({
            data: {
              email: emailLower,
              name: `${session.employee.firstName} ${session.employee.lastName}`.trim(),
              passwordHash: randomUUID(), // user activates via set-password / invite
            },
          });
        }

        const membership = await tx.restaurantMembership.upsert({
          where: { restaurantId_userId: { restaurantId, userId: user.id } },
          update: { employeeId: targetEmployeeId, status: "ACTIVE" },
          create: {
            restaurantId,
            userId: user.id,
            employeeId: targetEmployeeId,
            status: "ACTIVE",
          },
        });

        const existingGrant = await tx.accessGrant.findFirst({
          where: {
            membershipId: membership.id,
            roleId: session.appRoleId,
            outletId: primaryOutletId,
          },
        });
        if (!existingGrant) {
          await tx.accessGrant.create({
            data: {
              restaurantId,
              membershipId: membership.id,
              moduleId: "shifts",
              roleId: session.appRoleId,
              outletId: primaryOutletId,
              status: "ACTIVE",
            },
          });
        }
      }

      const updatedOnboarding = await tx.employeeOnboarding.update({
        where: { id: sessionId },
        data: {
          status: "APPROVED",
          approvedEmployeeId: targetEmployeeId,
          reviewedAt: new Date(),
          reviewedBy: actor.userId,
          reviewNotes: options?.reviewNotes || null,
        },
      });

      await tx.auditLog.create({
        data: {
          restaurantId,
          userId: actor.userId,
          userEmail: actor.userEmail,
          action: "ONBOARDING_APPROVED",
          entityType: "EmployeeOnboarding",
          entityId: sessionId,
          newValues: sanitizeAuditPayload({
            outcome: "APPROVED",
            employeeId: targetEmployeeId,
            intendedEmploymentStatus: empStatus,
            intendedOutletId: primaryOutletId,
            effectiveFrom: effectiveFrom.toISOString(),
            provisionAppAccess: session.provisionAppAccess,
            reviewNotes: options?.reviewNotes || null,
          }),
        },
      });

      return {
        onboarding: updatedOnboarding,
        employeeId: targetEmployeeId,
        alreadyApproved: false,
      };
    });

    return approved;
  },

  async rejectOnboarding(
    restaurantId: string,
    sessionId: string,
    reviewedBy: string,
    reviewNotes: string,
    actorEmail = "manager@restobird.com"
  ) {
    return HROnboardingService.requestCorrections(
      restaurantId,
      sessionId,
      { userId: reviewedBy, userEmail: actorEmail },
      { reviewNotes }
    );
  },

  async deleteSession(restaurantId: string, sessionId: string) {
    await prisma.employeeOnboarding.findFirstOrThrow({
      where: { id: sessionId, restaurantId },
    });
    return prisma.employeeOnboarding.delete({
      where: { id: sessionId },
    });
  },
};
