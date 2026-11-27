import { prisma } from "@/core/database/client";
import { ChecklistType, ChecklistStatus, ItemPriority, Prisma } from "@prisma/client";

export class ChecklistError extends Error {
  status: number;
  code: string;
  details?: Record<string, any>;

  constructor(
    message: string,
    status = 400,
    code = "CHECKLIST_ERROR",
    details?: Record<string, any>
  ) {
    super(message);
    this.name = "ChecklistError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ResponseHistoryEntry {
  at: string;
  actorId: string;
  actorName: string;
  action: "SAVED" | "RESUBMITTED" | "RETURNED" | "CARRIED_FORWARD";
  recordedValue?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  isOutOfRange?: boolean;
  isCompleted?: boolean;
  reason?: string | null;
  carryForwardOwner?: string | null;
  carryForwardNote?: string | null;
}

export interface ChecklistTemplateItemInput {
  title: string;
  description?: string;
  sectionName?: string;
  roleRequired?: string;
  priority?: ItemPriority;
  isRequired?: boolean;
  requiresValueInput?: boolean;
  valueInputLabel?: string;
  minValue?: number | null;
  maxValue?: number | null;
  unit?: string;
  requiresPhoto?: boolean;
}

export const DEFAULT_CHECKLIST_TEMPLATES: Array<{
  name: string;
  type: ChecklistType;
  description: string;
  estimatedMinutes: number;
  items: ChecklistTemplateItemInput[];
}> = [
    {
      name: "Morning Kitchen Opening",
      type: "OPENING",
      description: "Standard kitchen prep and safety checks before opening hours.",
      estimatedMinutes: 25,
      items: [
        {
          title: "Turn on exhaust hoods & gas lines",
          description: "Check pilot lights and ventilation airflow.",
          sectionName: "Equipment & Utilities",
          roleRequired: "Line Cook",
          priority: "CRITICAL",
          isRequired: true,
        },
        {
          title: "Verify walk-in fridge temperature",
          description: "Record temperature reading (target 1–5 °C).",
          sectionName: "Cold Chain & Food Safety",
          roleRequired: "Line Cook",
          priority: "CRITICAL",
          isRequired: true,
          requiresValueInput: true,
          valueInputLabel: "Walk-in Fridge Temp",
          minValue: 1,
          maxValue: 5,
          unit: "°C",
          requiresPhoto: true,
        },
        {
          title: "Calibrate prep line sanitizer buckets",
          description: "Test sanitizer concentration strips.",
          sectionName: "Sanitation",
          roleRequired: "Prep Cook",
          priority: "HIGH",
          isRequired: true,
          requiresValueInput: true,
          valueInputLabel: "Sanitizer PPM",
          minValue: 150,
          maxValue: 400,
          unit: "ppm",
        },
        {
          title: "Prep mise-en-place stations",
          description: "Stock containers, cutting boards, and utensils.",
          sectionName: "Prep & Line",
          roleRequired: "Line Cook",
          priority: "MEDIUM",
          isRequired: true,
        },
      ],
    },
    {
      name: "FOH & Bar Closing Duty",
      type: "CLOSING",
      description: "End-of-day shutdown, cash drawer, and dining area reset.",
      estimatedMinutes: 30,
      items: [
        {
          title: "Close POS batch & reconcile cash drawer",
          description: "Verify cash count matches Z-report.",
          sectionName: "Cash & POS",
          roleRequired: "Shift Manager",
          priority: "CRITICAL",
          isRequired: true,
          requiresValueInput: true,
          valueInputLabel: "Drawer Variance",
          unit: "INR",
        },
        {
          title: "Clean & sanitize espresso machine and bar taps",
          description: "Backflush group heads and soak steam wands.",
          sectionName: "Bar Shutdown",
          roleRequired: "Bartender",
          priority: "HIGH",
          isRequired: true,
          requiresPhoto: true,
        },
        {
          title: "Wipe tables, booths, and sanitize menus",
          description: "Reset table settings for morning shift.",
          sectionName: "Dining Room",
          roleRequired: "Server",
          priority: "MEDIUM",
          isRequired: true,
        },
        {
          title: "Lock exterior doors & arm security alarm",
          description: "Verify back delivery door is deadbolted.",
          sectionName: "Security",
          roleRequired: "Shift Manager",
          priority: "CRITICAL",
          isRequired: true,
        },
      ],
    },
    {
      name: "Fridge & Freezer Temperature Log",
      type: "FOOD_SAFETY",
      description: "Mandatory food safety temperature compliance check.",
      estimatedMinutes: 10,
      items: [
        {
          title: "Main Walk-In Cooler Temp",
          description: "Target 1 to 4 °C.",
          sectionName: "Cold Storage",
          roleRequired: "Line Cook",
          priority: "CRITICAL",
          isRequired: true,
          requiresValueInput: true,
          valueInputLabel: "Cooler Temp",
          minValue: 1,
          maxValue: 4,
          unit: "°C",
          requiresPhoto: true,
        },
        {
          title: "Deep Freezer Temp",
          description: "Target -22 to -16 °C.",
          sectionName: "Cold Storage",
          roleRequired: "Line Cook",
          priority: "CRITICAL",
          isRequired: true,
          requiresValueInput: true,
          valueInputLabel: "Freezer Temp",
          minValue: -22,
          maxValue: -16,
          unit: "°C",
        },
        {
          title: "Salad Prep Chiller Temp",
          description: "Target 1 to 5 °C.",
          sectionName: "Prep Line",
          roleRequired: "Prep Cook",
          priority: "HIGH",
          isRequired: true,
          requiresValueInput: true,
          valueInputLabel: "Prep Chiller Temp",
          minValue: 1,
          maxValue: 5,
          unit: "°C",
        },
      ],
    },
  ];

function evaluateOutOfRange(
  recordedValue: string | null | undefined,
  minValue: number | null | undefined,
  maxValue: number | null | undefined
): boolean {
  if (recordedValue === null || recordedValue === undefined || recordedValue.trim() === "") {
    return false;
  }
  if (minValue === null || minValue === undefined) {
    if (maxValue === null || maxValue === undefined) return false;
  }
  const num = Number(recordedValue.trim());
  if (Number.isNaN(num)) {
    return true;
  }
  if (minValue !== null && minValue !== undefined && num < minValue) {
    return true;
  }
  if (maxValue !== null && maxValue !== undefined && num > maxValue) {
    return true;
  }
  return false;
}

function appendHistory(
  existing: Prisma.JsonValue | null | undefined,
  entry: ResponseHistoryEntry
): Prisma.InputJsonValue {
  const arr = Array.isArray(existing) ? [...(existing as unknown as ResponseHistoryEntry[])] : [];
  arr.push(entry);
  return arr as unknown as Prisma.InputJsonValue;
}

function getMissingEvidenceForItem(item: {
  title: string;
  isRequired: boolean;
  isCompleted: boolean;
  requiresValueInput: boolean;
  valueInputLabel: string | null;
  inputValue: string | null;
  requiresPhoto: boolean;
  photoUrl: string | null;
  reviewStatus: string;
}) {
  const missing: string[] = [];
  if (item.isRequired && !item.isCompleted) {
    missing.push("mark task complete");
  }
  if (item.requiresValueInput && (!item.inputValue || !item.inputValue.trim())) {
    missing.push(`enter ${item.valueInputLabel || "reading"}`);
  }
  if (item.requiresPhoto && !item.photoUrl) {
    missing.push("upload required photo");
  }
  if (item.reviewStatus === "RETURNED") {
    missing.push("address supervisor return feedback and save");
  }
  return missing;
}

async function writeChecklistAudit(params: {
  restaurantId: string;
  userId: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      restaurant: { connect: { id: params.restaurantId } },
      userId: params.userId,
      userEmail: params.userEmail || "system@restobird.com",
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      previousValues: params.previousValues ? JSON.stringify(params.previousValues) : null,
      newValues: params.newValues ? JSON.stringify(params.newValues) : null,
    },
  });
}

export class ChecklistService {
  static async ensureDefaultTemplates(restaurantId: string) {
    const existingCount = await prisma.shiftChecklistTemplate.count({
      where: { restaurantId },
    });
    if (existingCount > 0) return;

    for (const tmpl of DEFAULT_CHECKLIST_TEMPLATES) {
      await prisma.shiftChecklistTemplate.create({
        data: {
          restaurantId,
          name: tmpl.name,
          type: tmpl.type,
          description: tmpl.description,
          estimatedMinutes: tmpl.estimatedMinutes,
          items: {
            create: tmpl.items.map((item, idx) => ({
              title: item.title,
              description: item.description,
              sectionName: item.sectionName || "General",
              roleRequired: item.roleRequired,
              priority: item.priority || "MEDIUM",
              sortOrder: idx,
              isRequired: item.isRequired ?? true,
              requiresValueInput: item.requiresValueInput ?? false,
              valueInputLabel: item.valueInputLabel,
              minValue: item.minValue ?? null,
              maxValue: item.maxValue ?? null,
              unit: item.unit ?? null,
              requiresPhoto: item.requiresPhoto ?? false,
            })),
          },
        },
      });
    }
  }

  static async getTemplates(restaurantId: string) {
    await this.ensureDefaultTemplates(restaurantId);
    return prisma.shiftChecklistTemplate.findMany({
      where: { restaurantId, isActive: true },
      include: {
        department: true,
        items: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createTemplate(
    restaurantId: string,
    data: {
      name: string;
      type: ChecklistType;
      departmentId?: string;
      description?: string;
      estimatedMinutes?: number;
      items: ChecklistTemplateItemInput[];
    }
  ) {
    return prisma.shiftChecklistTemplate.create({
      data: {
        restaurantId,
        name: data.name,
        type: data.type,
        departmentId: data.departmentId,
        description: data.description,
        estimatedMinutes: data.estimatedMinutes ?? 20,
        items: {
          create: data.items.map((item, idx) => ({
            title: item.title,
            description: item.description,
            sectionName: item.sectionName || "General",
            roleRequired: item.roleRequired,
            priority: item.priority || "MEDIUM",
            sortOrder: idx,
            isRequired: item.isRequired ?? true,
            requiresValueInput: item.requiresValueInput ?? false,
            valueInputLabel: item.valueInputLabel,
            minValue: item.minValue ?? null,
            maxValue: item.maxValue ?? null,
            unit: item.unit ?? null,
            requiresPhoto: item.requiresPhoto ?? false,
          })),
        },
      },
      include: {
        department: true,
        items: { orderBy: { sortOrder: "asc" } },
      },
    });
  }

  static async updateTemplate(
    templateId: string,
    restaurantId: string,
    data: {
      name: string;
      type: ChecklistType;
      departmentId?: string;
      description?: string;
      estimatedMinutes?: number;
      items: ChecklistTemplateItemInput[];
    }
  ) {
    const existing = await prisma.shiftChecklistTemplate.findFirst({
      where: { id: templateId, restaurantId },
    });
    if (!existing) throw new ChecklistError("Template not found", 404, "TEMPLATE_NOT_FOUND");

    // Assigned executions snapshot item fields onto ShiftChecklistItemExecution,
    // so editing a template never alters already-assigned checklists.
    await prisma.$transaction([
      prisma.shiftChecklistItem.deleteMany({
        where: { templateId },
      }),
      prisma.shiftChecklistTemplate.update({
        where: { id: templateId },
        data: {
          name: data.name,
          type: data.type,
          departmentId: data.departmentId || null,
          description: data.description,
          estimatedMinutes: data.estimatedMinutes ?? 20,
          items: {
            create: data.items.map((item, idx) => ({
              title: item.title,
              description: item.description,
              sectionName: item.sectionName || "General",
              roleRequired: item.roleRequired,
              priority: item.priority || "MEDIUM",
              sortOrder: idx,
              isRequired: item.isRequired ?? true,
              requiresValueInput: item.requiresValueInput ?? false,
              valueInputLabel: item.valueInputLabel,
              minValue: item.minValue ?? null,
              maxValue: item.maxValue ?? null,
              unit: item.unit ?? null,
              requiresPhoto: item.requiresPhoto ?? false,
            })),
          },
        },
      }),
    ]);

    return prisma.shiftChecklistTemplate.findUnique({
      where: { id: templateId },
      include: { department: true, items: { orderBy: { sortOrder: "asc" } } },
    });
  }

  static async duplicateTemplate(templateId: string, restaurantId: string) {
    const existing = await prisma.shiftChecklistTemplate.findFirst({
      where: { id: templateId, restaurantId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!existing) throw new ChecklistError("Template not found", 404, "TEMPLATE_NOT_FOUND");

    return prisma.shiftChecklistTemplate.create({
      data: {
        restaurantId,
        name: `${existing.name} (Copy)`,
        type: existing.type,
        departmentId: existing.departmentId,
        description: existing.description,
        estimatedMinutes: existing.estimatedMinutes,
        items: {
          create: existing.items.map((item, idx) => ({
            title: item.title,
            description: item.description,
            sectionName: item.sectionName,
            roleRequired: item.roleRequired,
            priority: item.priority,
            sortOrder: idx,
            isRequired: item.isRequired,
            requiresValueInput: item.requiresValueInput,
            valueInputLabel: item.valueInputLabel,
            minValue: item.minValue,
            maxValue: item.maxValue,
            unit: item.unit,
            requiresPhoto: item.requiresPhoto,
          })),
        },
      },
      include: { department: true, items: { orderBy: { sortOrder: "asc" } } },
    });
  }

  static async deleteTemplate(templateId: string, restaurantId: string) {
    const existing = await prisma.shiftChecklistTemplate.findFirst({
      where: { id: templateId, restaurantId },
    });
    if (!existing) throw new ChecklistError("Template not found", 404, "TEMPLATE_NOT_FOUND");

    return prisma.shiftChecklistTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });
  }

  static async getExecutions(
    restaurantId: string,
    filters: {
      outletId?: string;
      accessibleOutletIds?: string[] | null;
      assignedEmployeeId?: string;
      onlyOwnEmployeeId?: string;
      status?: ChecklistStatus;
      date?: string;
      shiftAssignmentId?: string;
    }
  ) {
    const where: Prisma.ShiftChecklistExecutionWhereInput = { restaurantId };

    if (filters.onlyOwnEmployeeId) {
      where.assignedEmployeeId = filters.onlyOwnEmployeeId;
    } else if (filters.assignedEmployeeId) {
      where.assignedEmployeeId = filters.assignedEmployeeId;
    }

    if (filters.outletId) {
      if (
        filters.accessibleOutletIds &&
        !filters.accessibleOutletIds.includes(filters.outletId) &&
        !filters.onlyOwnEmployeeId
      ) {
        throw new ChecklistError("Outlet is outside your authorized scope", 403, "OUTLET_FORBIDDEN");
      }
      where.outletId = filters.outletId;
    } else if (filters.accessibleOutletIds && !filters.onlyOwnEmployeeId) {
      where.outletId = { in: filters.accessibleOutletIds };
    }

    if (filters.status) where.status = filters.status;
    if (filters.shiftAssignmentId) where.shiftAssignmentId = filters.shiftAssignmentId;

    if (filters.date) {
      const start = new Date(`${filters.date}T00:00:00.000Z`);
      const end = new Date(`${filters.date}T23:59:59.999Z`);
      if (!Number.isNaN(start.getTime())) {
        where.OR = [
          { dueAt: { gte: start, lte: end } },
          { dueAt: null, executionDate: { gte: start, lte: end } },
        ];
      }
    }

    return prisma.shiftChecklistExecution.findMany({
      where,
      include: {
        template: true,
        outlet: { select: { id: true, name: true, timezone: true } },
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        verifiedBy: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        items: {
          include: { templateItem: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ dueAt: "asc" }, { executionDate: "desc" }],
    });
  }

  static async getExecutionById(executionId: string, restaurantId: string) {
    const execution = await prisma.shiftChecklistExecution.findFirst({
      where: { id: executionId, restaurantId },
      include: {
        template: true,
        outlet: { select: { id: true, name: true, timezone: true } },
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        verifiedBy: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        items: {
          include: { templateItem: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!execution) {
      throw new ChecklistError("Checklist execution not found", 404, "EXECUTION_NOT_FOUND");
    }
    return execution;
  }

  static async startExecution(
    restaurantId: string,
    data: {
      templateId: string;
      outletId: string;
      assignedEmployeeId?: string;
      shiftAssignmentId?: string;
      stationName?: string;
      dueAt?: string;
      allowCarryForwardExceptions?: boolean;
      actorUserId?: string;
      actorEmail?: string;
    }
  ) {
    const [template, outlet] = await Promise.all([
      prisma.shiftChecklistTemplate.findFirst({
        where: { id: data.templateId, restaurantId, isActive: true },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      }),
      prisma.restaurantOutlet.findFirst({
        where: { id: data.outletId, restaurantId },
      }),
    ]);

    if (!template) throw new ChecklistError("Template not found", 404, "TEMPLATE_NOT_FOUND");
    if (!outlet) throw new ChecklistError("Outlet not found", 404, "OUTLET_NOT_FOUND");

    let resolvedAssigneeId = data.assignedEmployeeId || null;
    if (data.shiftAssignmentId) {
      const shift = await prisma.shiftAssignment.findFirst({
        where: { id: data.shiftAssignmentId, outletId: data.outletId },
      });
      if (!shift) {
        throw new ChecklistError(
          "Shift assignment not found for this outlet",
          404,
          "SHIFT_NOT_FOUND"
        );
      }
      if (!resolvedAssigneeId) {
        resolvedAssigneeId = shift.employeeId;
      }
    }

    const execution = await prisma.shiftChecklistExecution.create({
      data: {
        restaurantId,
        templateId: data.templateId,
        title: template.name,
        type: template.type,
        executionDate: data.dueAt ? new Date(data.dueAt) : new Date(),
        outletId: data.outletId,
        assignedEmployeeId: resolvedAssigneeId,
        shiftAssignmentId: data.shiftAssignmentId || null,
        stationName: data.stationName || null,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        allowCarryForwardExceptions: data.allowCarryForwardExceptions ?? false,
        status: resolvedAssigneeId ? "IN_PROGRESS" : "PENDING",
        items: {
          create: template.items.map((item, idx) => ({
            templateItem: { connect: { id: item.id } },
            sortOrder: item.sortOrder ?? idx,
            title: item.title,
            description: item.description,
            sectionName: item.sectionName || "General",
            isRequired: item.isRequired,
            requiresValueInput: item.requiresValueInput,
            valueInputLabel: item.valueInputLabel,
            minValue: item.minValue,
            maxValue: item.maxValue,
            unit: item.unit,
            requiresPhoto: item.requiresPhoto,
            isCompleted: false,
            isOutOfRange: false,
            reviewStatus: "NONE",
            responseHistory: [],
          })),
        },
      },
      include: {
        template: true,
        outlet: { select: { id: true, name: true, timezone: true } },
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        items: { include: { templateItem: true }, orderBy: { sortOrder: "asc" } },
      },
    });

    if (data.actorUserId) {
      await writeChecklistAudit({
        restaurantId,
        userId: data.actorUserId,
        action: "CHECKLIST_ASSIGNED",
        entityType: "ShiftChecklistExecution",
        entityId: execution.id,
        newValues: {
          templateId: execution.templateId,
          outletId: execution.outletId,
          assignedEmployeeId: execution.assignedEmployeeId,
          shiftAssignmentId: execution.shiftAssignmentId,
          stationName: execution.stationName,
        },
      });
    }

    return execution;
  }

  static async syncAssigneeForShift(
    shiftAssignmentId: string,
    newEmployeeId: string | null,
    actorUserId?: string,
    actorEmail?: string
  ) {
    const executions = await prisma.shiftChecklistExecution.findMany({
      where: {
        shiftAssignmentId,
        status: { not: "VERIFIED" },
      },
      select: { id: true, restaurantId: true, assignedEmployeeId: true, status: true },
    });

    if (executions.length === 0) return 0;

    for (const exec of executions) {
      await prisma.shiftChecklistExecution.update({
        where: { id: exec.id },
        data: {
          assignedEmployeeId: newEmployeeId,
          status: exec.status === "PENDING" && newEmployeeId ? "IN_PROGRESS" : exec.status,
          version: { increment: 1 },
        },
      });

      if (actorUserId) {
        await writeChecklistAudit({
          restaurantId: exec.restaurantId,
          userId: actorUserId,
          action: "CHECKLIST_SHIFT_REASSIGNED",
          entityType: "ShiftChecklistExecution",
          entityId: exec.id,
          previousValues: { assignedEmployeeId: exec.assignedEmployeeId },
          newValues: { assignedEmployeeId: newEmployeeId, shiftAssignmentId },
        });
      }
    }

    return executions.length;
  }

  static async assignStaff(
    executionId: string,
    restaurantId: string,
    assignedEmployeeId: string,
    options?: {
      expectedVersion?: number;
      actorUserId?: string;
      actorEmail?: string;
    }
  ) {
    const existing = await prisma.shiftChecklistExecution.findFirst({
      where: { id: executionId, restaurantId },
    });
    if (!existing) throw new ChecklistError("Execution not found", 404, "EXECUTION_NOT_FOUND");
    if (existing.status === "VERIFIED") {
      throw new ChecklistError("Cannot reassign a verified checklist", 409, "ALREADY_VERIFIED");
    }
    if (
      options?.expectedVersion !== undefined &&
      existing.version !== options.expectedVersion
    ) {
      throw new ChecklistError(
        "Checklist was modified by another user. Refresh and try again.",
        409,
        "CONFLICT"
      );
    }

    const updated = await prisma.shiftChecklistExecution.update({
      where: { id: executionId },
      data: {
        assignedEmployeeId,
        status: existing.status === "PENDING" ? "IN_PROGRESS" : existing.status,
        version: { increment: 1 },
      },
      include: {
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
    });

    if (options?.actorUserId) {
      await writeChecklistAudit({
        restaurantId,
        userId: options.actorUserId,
        action: "CHECKLIST_REASSIGNED",
        entityType: "ShiftChecklistExecution",
        entityId: executionId,
        previousValues: { assignedEmployeeId: existing.assignedEmployeeId },
        newValues: { assignedEmployeeId },
      });
    }

    return updated;
  }

  static async updateItemExecution(
    itemExecutionId: string,
    restaurantId: string,
    data: {
      status?: string;
      isCompleted?: boolean;
      recordedValue?: string | null;
      notes?: string | null;
      photoUrl?: string | null;
      completedById?: string;
      actorId: string;
      actorName: string;
      expectedVersion?: number;
    }
  ) {
    const item = await prisma.shiftChecklistItemExecution.findFirst({
      where: {
        id: itemExecutionId,
        execution: { restaurantId },
      },
      include: { execution: true, templateItem: true },
    });

    if (!item) throw new ChecklistError("Checklist item not found", 404, "ITEM_NOT_FOUND");
    if (item.execution.status === "VERIFIED") {
      throw new ChecklistError(
        "Checklist is already signed off and locked.",
        409,
        "ALREADY_VERIFIED"
      );
    }
    if (data.expectedVersion !== undefined && item.version !== data.expectedVersion) {
      throw new ChecklistError(
        "This task was updated elsewhere. Refresh to load the latest response.",
        409,
        "CONFLICT"
      );
    }

    const nextRecordedValue =
      data.recordedValue !== undefined ? data.recordedValue : item.inputValue;
    const nextNotes = data.notes !== undefined ? data.notes : item.notes;
    const nextPhotoUrl = data.photoUrl !== undefined ? data.photoUrl : item.photoUrl;

    let nextCompleted = item.isCompleted;
    if (data.isCompleted !== undefined) {
      nextCompleted = data.isCompleted;
    } else if (data.status === "COMPLETED") {
      nextCompleted = true;
    } else if (data.status === "PENDING") {
      nextCompleted = false;
    }

    const isOutOfRange = evaluateOutOfRange(nextRecordedValue, item.minValue, item.maxValue);
    const nextReviewStatus =
      item.reviewStatus === "RETURNED" && nextCompleted ? "RESUBMITTED" : item.reviewStatus;

    const historyEntry: ResponseHistoryEntry = {
      at: new Date().toISOString(),
      actorId: data.actorId,
      actorName: data.actorName,
      action: item.reviewStatus === "RETURNED" ? "RESUBMITTED" : "SAVED",
      recordedValue: nextRecordedValue,
      notes: nextNotes,
      photoUrl: nextPhotoUrl,
      isOutOfRange,
      isCompleted: nextCompleted,
    };

    const [updatedItem] = await prisma.$transaction([
      prisma.shiftChecklistItemExecution.update({
        where: { id: itemExecutionId },
        data: {
          isCompleted: nextCompleted,
          inputValue: nextRecordedValue,
          notes: nextNotes,
          photoUrl: nextPhotoUrl,
          isOutOfRange,
          reviewStatus: nextReviewStatus,
          completedByEmployee:
            nextCompleted && data.completedById
              ? { connect: { id: data.completedById } }
              : nextCompleted
                ? undefined
                : { disconnect: true },
          completedAt: nextCompleted ? new Date() : null,
          responseHistory: appendHistory(item.responseHistory, historyEntry),
          version: { increment: 1 },
        },
        include: { templateItem: true },
      }),
      prisma.shiftChecklistExecution.update({
        where: { id: item.executionId },
        data: {
          status:
            item.execution.status === "PENDING" || item.execution.status === "COMPLETED"
              ? "IN_PROGRESS"
              : item.execution.status,
          version: { increment: 1 },
        },
      }),
    ]);

    return updatedItem;
  }

  static async submitExecution(
    executionId: string,
    restaurantId: string,
    data: {
      employeeId?: string | null;
      handoverNotes?: string;
      expectedVersion?: number;
      actorUserId: string;
      actorEmail: string;
    }
  ) {
    const execution = await prisma.shiftChecklistExecution.findFirst({
      where: { id: executionId, restaurantId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    if (!execution) throw new ChecklistError("Execution not found", 404, "EXECUTION_NOT_FOUND");
    if (execution.status === "VERIFIED") {
      throw new ChecklistError("Checklist is already verified.", 409, "ALREADY_VERIFIED");
    }
    if (
      data.expectedVersion !== undefined &&
      execution.version !== data.expectedVersion
    ) {
      throw new ChecklistError(
        "Checklist changed since you loaded it. Refresh and retry.",
        409,
        "CONFLICT"
      );
    }

    const missingItems: Array<{ itemId: string; title: string; missing: string[] }> = [];
    for (const item of execution.items) {
      const missing = getMissingEvidenceForItem(item);
      if (missing.length > 0) {
        missingItems.push({ itemId: item.id, title: item.title, missing });
      }
    }

    if (missingItems.length > 0) {
      const summary = missingItems
        .map((m) => `${m.title} (${m.missing.join(", ")})`)
        .join("; ");
      throw new ChecklistError(
        `Cannot submit checklist. Missing required items: ${summary}`,
        400,
        "MISSING_EVIDENCE",
        { missingItems }
      );
    }

    const updated = await prisma.shiftChecklistExecution.update({
      where: { id: executionId },
      data: {
        status: "COMPLETED",
        submittedAt: new Date(),
        submittedByEmployeeId: data.employeeId || execution.assignedEmployeeId,
        handoverNotes:
          data.handoverNotes !== undefined ? data.handoverNotes : execution.handoverNotes,
        version: { increment: 1 },
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    await writeChecklistAudit({
      restaurantId,
      userId: data.actorUserId,
      action: "CHECKLIST_SUBMITTED",
      entityType: "ShiftChecklistExecution",
      entityId: executionId,
      newValues: {
        status: "COMPLETED",
        submittedByEmployeeId: updated.submittedByEmployeeId,
        flaggedCount: execution.items.filter((i) => i.isOutOfRange).length,
      },
    });

    return updated;
  }

  static async returnItemForCorrection(
    executionId: string,
    itemExecutionId: string,
    restaurantId: string,
    data: {
      returnReason: string;
      actorUserId: string;
      actorEmail: string;
      actorName: string;
      expectedVersion?: number;
    }
  ) {
    if (!data.returnReason || !data.returnReason.trim()) {
      throw new ChecklistError("A return reason is required", 400, "REASON_REQUIRED");
    }

    const item = await prisma.shiftChecklistItemExecution.findFirst({
      where: { id: itemExecutionId, executionId, execution: { restaurantId } },
      include: { execution: true },
    });
    if (!item) throw new ChecklistError("Checklist item not found", 404, "ITEM_NOT_FOUND");
    if (item.execution.status === "VERIFIED") {
      throw new ChecklistError("Cannot return an item on a verified checklist", 409, "ALREADY_VERIFIED");
    }
    if (data.expectedVersion !== undefined && item.version !== data.expectedVersion) {
      throw new ChecklistError("Task changed concurrently. Refresh and retry.", 409, "CONFLICT");
    }

    const historyEntry: ResponseHistoryEntry = {
      at: new Date().toISOString(),
      actorId: data.actorUserId,
      actorName: data.actorName,
      action: "RETURNED",
      reason: data.returnReason.trim(),
      recordedValue: item.inputValue,
      notes: item.notes,
      photoUrl: item.photoUrl,
      isOutOfRange: item.isOutOfRange,
    };

    const [updatedItem] = await prisma.$transaction([
      prisma.shiftChecklistItemExecution.update({
        where: { id: itemExecutionId },
        data: {
          reviewStatus: "RETURNED",
          returnReason: data.returnReason.trim(),
          isCompleted: false,
          responseHistory: appendHistory(item.responseHistory, historyEntry),
          version: { increment: 1 },
        },
      }),
      prisma.shiftChecklistExecution.update({
        where: { id: executionId },
        data: {
          status: "IN_PROGRESS",
          version: { increment: 1 },
        },
      }),
    ]);

    await writeChecklistAudit({
      restaurantId,
      userId: data.actorUserId,
      action: "CHECKLIST_ITEM_RETURNED",
      entityType: "ShiftChecklistItemExecution",
      entityId: itemExecutionId,
      newValues: {
        executionId,
        title: item.title,
        returnReason: data.returnReason.trim(),
      },
    });

    return updatedItem;
  }

  static async verifyExecution(
    executionId: string,
    restaurantId: string,
    data: {
      verifiedById?: string | null;
      actorUserId: string;
      actorEmail: string;
      actorName: string;
      handoverNotes?: string;
      allowCarryForwardExceptions?: boolean;
      carryForwardOwner?: string;
      carryForwardNote?: string;
      expectedVersion?: number;
    }
  ) {
    const existing = await prisma.shiftChecklistExecution.findFirst({
      where: { id: executionId, restaurantId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });
    if (!existing) throw new ChecklistError("Execution not found", 404, "EXECUTION_NOT_FOUND");

    // Idempotent sign-off: safe to retry
    if (existing.status === "VERIFIED") {
      return { execution: existing, alreadyVerified: true };
    }

    if (
      data.expectedVersion !== undefined &&
      existing.version !== data.expectedVersion
    ) {
      throw new ChecklistError(
        "Checklist was modified concurrently. Refresh before signing off.",
        409,
        "CONFLICT"
      );
    }

    const returnedItems = existing.items.filter((i) => i.reviewStatus === "RETURNED");
    if (returnedItems.length > 0) {
      throw new ChecklistError(
        `Cannot sign off while tasks are returned for correction: ${returnedItems
          .map((i) => i.title)
          .join(", ")}`,
        400,
        "OPEN_RETURNED_ITEMS",
        { items: returnedItems.map((i) => i.title) }
      );
    }

    const exceptionItems = existing.items.filter(
      (i) => i.isOutOfRange || getMissingEvidenceForItem(i).length > 0
    );

    const allowCarryForward =
      data.allowCarryForwardExceptions ?? existing.allowCarryForwardExceptions;

    if (exceptionItems.length > 0) {
      if (!allowCarryForward) {
        throw new ChecklistError(
          `Open exceptions block sign-off: ${exceptionItems
            .map((i) => i.title)
            .join(", ")}. Resolve them or enable carry-forward with an owner and note.`,
          400,
          "OPEN_EXCEPTIONS",
          { items: exceptionItems.map((i) => i.title) }
        );
      }

      if (!data.carryForwardOwner?.trim() || !data.carryForwardNote?.trim()) {
        throw new ChecklistError(
          "Carrying forward open exceptions requires both a carry-forward owner and a handover note.",
          400,
          "CARRY_FORWARD_DETAILS_REQUIRED"
        );
      }

      for (const excItem of exceptionItems) {
        await prisma.shiftChecklistItemExecution.update({
          where: { id: excItem.id },
          data: {
            carryForwardOwner: data.carryForwardOwner.trim(),
            carryForwardNote: data.carryForwardNote.trim(),
            responseHistory: appendHistory(excItem.responseHistory, {
              at: new Date().toISOString(),
              actorId: data.actorUserId,
              actorName: data.actorName,
              action: "CARRIED_FORWARD",
              carryForwardOwner: data.carryForwardOwner.trim(),
              carryForwardNote: data.carryForwardNote.trim(),
              recordedValue: excItem.inputValue,
              isOutOfRange: excItem.isOutOfRange,
            }),
            version: { increment: 1 },
          },
        });
      }
    }

    const verified = await prisma.shiftChecklistExecution.update({
      where: { id: executionId },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        ...(data.verifiedById ? { verifiedBy: { connect: { id: data.verifiedById } } } : {}),
        allowCarryForwardExceptions: allowCarryForward,
        handoverNotes:
          data.handoverNotes !== undefined ? data.handoverNotes : existing.handoverNotes,
        version: { increment: 1 },
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });

    await writeChecklistAudit({
      restaurantId,
      userId: data.actorUserId,
      action: "CHECKLIST_VERIFIED",
      entityType: "ShiftChecklistExecution",
      entityId: executionId,
      newValues: {
        status: "VERIFIED",
        verifiedById: data.verifiedById || null,
        carriedForwardCount: exceptionItems.length,
      },
    });

    return { execution: verified, alreadyVerified: false };
  }
}
