import { prisma } from "@/core/database/client";

// ─── Templates ─────────────────────────────────────────────────────────────

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

  async getTemplateById(restaurantId: string, id: string) {
    const template = await prisma.onboardingTemplate.findFirst({
      where: { id, restaurantId },
      include: { tasks: { orderBy: { sortOrder: "asc" } } },
    });
    if (!template) throw new Error("Template not found or access denied");
    return template;
  },

  async createTemplate(
    restaurantId: string,
    data: {
      name: string;
      description?: string;
      isDefault?: boolean;
      tasks?: { title: string; description?: string; isRequired?: boolean; sortOrder?: number; requiresDoc?: boolean; taskType?: string; fieldConfig?: string }[];
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
            taskType: (t.taskType as any) ?? "CHECKBOX",
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
    data: { name?: string; description?: string; isDefault?: boolean }
  ) {
    await prisma.onboardingTemplate.findFirstOrThrow({ where: { id, restaurantId } });
    if (data.isDefault) {
      await prisma.onboardingTemplate.updateMany({
        where: { restaurantId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return prisma.onboardingTemplate.update({ where: { id }, data });
  },

  async archiveTemplate(restaurantId: string, id: string) {
    await prisma.onboardingTemplate.findFirstOrThrow({ where: { id, restaurantId } });
    return prisma.onboardingTemplate.update({ where: { id }, data: { archivedAt: new Date() } });
  },

  // ── Tasks ──────────────────────────────────────────────────────────────
  async addTask(
    restaurantId: string,
    templateId: string,
    data: { title: string; description?: string; isRequired?: boolean; sortOrder?: number; requiresDoc?: boolean; taskType?: string; fieldConfig?: string }
  ) {
    await prisma.onboardingTemplate.findFirstOrThrow({ where: { id: templateId, restaurantId } });
    return prisma.onboardingTask.create({
      data: {
        templateId,
        title: data.title,
        description: data.description,
        isRequired: data.isRequired ?? true,
        sortOrder: data.sortOrder ?? 0,
        requiresDoc: data.requiresDoc ?? false,
        taskType: (data.taskType as any) ?? "CHECKBOX",
        fieldConfig: data.fieldConfig || null,
      },
    });
  },

  async updateTask(
    restaurantId: string,
    taskId: string,
    data: { title?: string; description?: string; isRequired?: boolean; sortOrder?: number; requiresDoc?: boolean; taskType?: string; fieldConfig?: string }
  ) {
    const task = await prisma.onboardingTask.findFirstOrThrow({
      where: { id: taskId, template: { restaurantId } },
    });
    return prisma.onboardingTask.update({
      where: { id: task.id },
      data: {
        ...data,
        taskType: data.taskType ? (data.taskType as any) : undefined,
      },
    });
  },

  async deleteTask(restaurantId: string, taskId: string) {
    const task = await prisma.onboardingTask.findFirstOrThrow({
      where: { id: taskId, template: { restaurantId } },
    });
    return prisma.onboardingTask.delete({ where: { id: task.id } });
  },

  async reorderTasks(restaurantId: string, templateId: string, orderedTaskIds: string[]) {
    await prisma.onboardingTemplate.findFirstOrThrow({ where: { id: templateId, restaurantId } });
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
    filters?: { status?: string; employeeId?: string }
  ) {
    return prisma.employeeOnboarding.findMany({
      where: {
        restaurantId,
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.employeeId && { employeeId: filters.employeeId }),
      },
      include: {
        employee: true,
        template: { select: { id: true, name: true } },
        progresses: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getSessionById(restaurantId: string, sessionId: string) {
    let session = await prisma.employeeOnboarding.findFirst({
      where: {
        OR: [
          { id: sessionId },
          { accessToken: sessionId },
        ],
        restaurantId,
      },
      include: {
        employee: true,
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
      session = await prisma.employeeOnboarding.findFirst({
        where: {
          OR: [
            { id: sessionId },
            { accessToken: sessionId },
          ],
        },
        include: {
          employee: true,
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
    }

    if (!session) throw new Error("Session not found or access denied");
    return session;
  },

  async getSessionByToken(accessToken: string) {
    const session = await prisma.employeeOnboarding.findFirst({
      where: { accessToken },
      include: {
        employee: true,
        restaurant: { include: { branding: true } },
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
    if (!session) throw new Error("Onboarding portal link invalid or expired");
    return session;
  },

  async startOnboarding(
    restaurantId: string,
    employeeId: string,
    templateId: string
  ) {
    // Ensure employee belongs to restaurant
    await prisma.employee.findFirstOrThrow({ where: { id: employeeId, restaurantId } });
    await prisma.onboardingTemplate.findFirstOrThrow({ where: { id: templateId, restaurantId } });

    return prisma.$transaction(async (tx) => {
      const session = await tx.employeeOnboarding.create({
        data: {
          restaurantId,
          employeeId,
          templateId,
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });

      // Auto-create task progress rows for all template tasks
      const tasks = await tx.onboardingTask.findMany({ where: { templateId } });
      if (tasks.length > 0) {
        await tx.onboardingTaskProgress.createMany({
          data: tasks.map((t) => ({
            onboardingId: session.id,
            taskId: t.id,
            status: "PENDING" as const,
          })),
        });
      }
      return session;
    });
  },

  async updateTaskProgress(
    restaurantId: string,
    sessionId: string,
    taskId: string,
    data: { status: "PENDING" | "COMPLETED" | "WAIVED" | "REJECTED"; notes?: string; fileUploadId?: string; responseValue?: string }
  ) {
    const session = await prisma.employeeOnboarding.findFirstOrThrow({
      where: { id: sessionId, restaurantId },
    });
    if (!["IN_PROGRESS", "REJECTED"].includes(session.status)) {
      throw new Error("Cannot update tasks for this session in its current state");
    }

    const progress = await prisma.onboardingTaskProgress.findFirstOrThrow({
      where: { onboardingId: sessionId, taskId },
    });

    return prisma.onboardingTaskProgress.update({
      where: { id: progress.id },
      data: {
        status: data.status,
        notes: data.notes,
        responseValue: data.responseValue ?? null,
        fileUploadId: data.fileUploadId ?? null,
        completedAt: data.status === "COMPLETED" ? new Date() : null,
      },
    });
  },

  async updateTaskProgressByToken(
    accessToken: string,
    taskId: string,
    data: { status: "PENDING" | "COMPLETED" | "WAIVED" | "REJECTED"; notes?: string; fileUploadId?: string; responseValue?: string }
  ) {
    const session = await prisma.employeeOnboarding.findFirstOrThrow({
      where: { accessToken },
    });
    if (!["IN_PROGRESS", "REJECTED"].includes(session.status)) {
      throw new Error("Cannot update tasks for this session in its current state");
    }

    const progress = await prisma.onboardingTaskProgress.findFirstOrThrow({
      where: { onboardingId: session.id, taskId },
    });

    return prisma.onboardingTaskProgress.update({
      where: { id: progress.id },
      data: {
        status: data.status,
        notes: data.notes,
        responseValue: data.responseValue ?? null,
        fileUploadId: data.fileUploadId ?? null,
        completedAt: data.status === "COMPLETED" ? new Date() : null,
      },
    });
  },

  async submitForApproval(restaurantId: string, sessionId: string) {
    const session = await prisma.employeeOnboarding.findFirstOrThrow({
      where: { id: sessionId, restaurantId },
      include: {
        template: { include: { tasks: true } },
        progresses: true,
      },
    });

    if (!["IN_PROGRESS", "REJECTED"].includes(session.status)) {
      throw new Error("Only IN_PROGRESS or REJECTED sessions can be submitted");
    }

    // Check all required tasks are completed or waived
    const requiredTaskIds = session.template.tasks
      .filter((t) => t.isRequired)
      .map((t) => t.id);

    const incompletedRequired = session.progresses.filter(
      (p) => requiredTaskIds.includes(p.taskId) && !["COMPLETED", "WAIVED"].includes(p.status)
    );

    if (incompletedRequired.length > 0) {
      throw new Error(
        `${incompletedRequired.length} required task(s) are not yet completed`
      );
    }

    return prisma.employeeOnboarding.update({
      where: { id: sessionId },
      data: { status: "PENDING_APPROVAL", submittedAt: new Date() },
    });
  },

  async approveOnboarding(restaurantId: string, sessionId: string, reviewedBy: string, reviewNotes?: string) {
    const session = await prisma.employeeOnboarding.findFirstOrThrow({
      where: { id: sessionId, restaurantId },
    });
    if (session.status !== "PENDING_APPROVAL") {
      throw new Error("Only PENDING_APPROVAL sessions can be approved");
    }
    return prisma.employeeOnboarding.update({
      where: { id: sessionId },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy, reviewNotes },
    });
  },

  async rejectOnboarding(restaurantId: string, sessionId: string, reviewedBy: string, reviewNotes: string) {
    const session = await prisma.employeeOnboarding.findFirstOrThrow({
      where: { id: sessionId, restaurantId },
    });
    if (session.status !== "PENDING_APPROVAL") {
      throw new Error("Only PENDING_APPROVAL sessions can be rejected");
    }
    return prisma.employeeOnboarding.update({
      where: { id: sessionId },
      data: { status: "REJECTED", reviewedAt: new Date(), reviewedBy, reviewNotes },
    });
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
