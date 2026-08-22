import { prisma } from "@/core/database/client";

export const DEFAULT_CHECKLIST_TEMPLATES = [
  {
    name: "Morning Opening Checklist",
    type: "OPENING" as const,
    estimatedMinutes: 25,
    description: "Daily pre-service readiness, equipment calibration, and cash float verification.",
    items: [
      { title: "Disarm security alarm & unlock staff entrance", priority: "HIGH" as const, roleRequired: "Shift Supervisor", sortOrder: 1 },
      { title: "Turn on dining room HVAC & ambient lighting", priority: "MEDIUM" as const, roleRequired: "Shift Supervisor", sortOrder: 2 },
      { title: "Verify POS cash drawer float ($200.00 base)", priority: "HIGH" as const, roleRequired: "Cashier / Front", requiresValueInput: true, valueInputLabel: "Verified Float ($)", sortOrder: 3 },
      { title: "Power on kitchen exhaust hoods & make line coolers", priority: "CRITICAL" as const, roleRequired: "Line Cook", sortOrder: 4 },
      { title: "Record walk-in refrigerator temp (Must be ≤ 4°C)", priority: "CRITICAL" as const, roleRequired: "Line Cook", requiresValueInput: true, valueInputLabel: "Walk-in Temp (°C)", sortOrder: 5 },
      { title: "Record deep freezer temp (Must be ≤ -18°C)", priority: "CRITICAL" as const, roleRequired: "Line Cook", requiresValueInput: true, valueInputLabel: "Freezer Temp (°C)", sortOrder: 6 },
      { title: "Calibrate espresso machine & run test grouphead shot", priority: "MEDIUM" as const, roleRequired: "Barista / Bartender", sortOrder: 7 },
      { title: "Fill front & bar ice bins with fresh scoops", priority: "MEDIUM" as const, roleRequired: "Barista / Bartender", sortOrder: 8 },
      { title: "Prepare 3-compartment sink sanitizer buckets (200-400 PPM)", priority: "HIGH" as const, roleRequired: "Dishwasher / Prep", requiresValueInput: true, valueInputLabel: "Sanitizer PPM", sortOrder: 9 },
      { title: "Unlock customer entrance & flip sign to OPEN", priority: "HIGH" as const, roleRequired: "Shift Supervisor", sortOrder: 10 },
    ],
  },
  {
    name: "Night Closing & Sanitization",
    type: "CLOSING" as const,
    estimatedMinutes: 35,
    description: "End-of-day kitchen shutdown, POS Z-report cash drop, and deep sanitization.",
    items: [
      { title: "Lock main entrance doors & flip sign to CLOSED", priority: "HIGH" as const, roleRequired: "Shift Supervisor", sortOrder: 1 },
      { title: "Run POS End-of-Day Z-Report & reconcile cash drawer", priority: "CRITICAL" as const, roleRequired: "Shift Supervisor", requiresValueInput: true, valueInputLabel: "Actual Cash Count ($)", sortOrder: 2 },
      { title: "Drop reconciled register cash envelope in safe", priority: "CRITICAL" as const, roleRequired: "Shift Supervisor", sortOrder: 3 },
      { title: "Scrape, scrub, and degrease flat top grill & charbroiler", priority: "HIGH" as const, roleRequired: "Line Cook", sortOrder: 4 },
      { title: "Filter and cover deep fryer vats & turn off gas valves", priority: "CRITICAL" as const, roleRequired: "Line Cook", sortOrder: 5 },
      { title: "Wrap, date, and label all prep line inserts with masking tape", priority: "HIGH" as const, roleRequired: "Line Cook", sortOrder: 6 },
      { title: "Backflush espresso machine with Cafiza cleaning powder", priority: "MEDIUM" as const, roleRequired: "Barista / Bartender", sortOrder: 7 },
      { title: "Wipe down bar taps, rinse drain trays & cover spouts", priority: "MEDIUM" as const, roleRequired: "Barista / Bartender", sortOrder: 8 },
      { title: "Empty all trash cans, replace liners & carry bags to dumpster", priority: "HIGH" as const, roleRequired: "Dishwasher / Prep", sortOrder: 9 },
      { title: "Sweep and mop back-of-house kitchen floors with degreaser", priority: "HIGH" as const, roleRequired: "Dishwasher / Prep", sortOrder: 10 },
      { title: "Verify walk-in doors are tightly latched & set building alarm", priority: "CRITICAL" as const, roleRequired: "Shift Supervisor", sortOrder: 11 },
    ],
  },
  {
    name: "HACCP Food Safety & Temperature Audit",
    type: "FOOD_SAFETY" as const,
    estimatedMinutes: 15,
    description: "Crucial health code compliance for cold chain and hot-holding units.",
    items: [
      { title: "Walk-in Cooler 1 (Meat & Dairy)", priority: "CRITICAL" as const, roleRequired: "Kitchen Staff", requiresValueInput: true, valueInputLabel: "Temp (°C) [≤ 4°C]", sortOrder: 1 },
      { title: "Walk-in Cooler 2 (Produce & Prep)", priority: "CRITICAL" as const, roleRequired: "Kitchen Staff", requiresValueInput: true, valueInputLabel: "Temp (°C) [≤ 4°C]", sortOrder: 2 },
      { title: "Walk-in Deep Freezer", priority: "CRITICAL" as const, roleRequired: "Kitchen Staff", requiresValueInput: true, valueInputLabel: "Temp (°C) [≤ -18°C]", sortOrder: 3 },
      { title: "Hot Holding Steam Table (Soup / Gravies)", priority: "CRITICAL" as const, roleRequired: "Line Cook", requiresValueInput: true, valueInputLabel: "Temp (°C) [≥ 60°C]", sortOrder: 4 },
      { title: "Dishwasher High-Temp Final Rinse Cycle", priority: "HIGH" as const, roleRequired: "Dishwasher / Supervisor", requiresValueInput: true, valueInputLabel: "Rinse Temp (°C) [≥ 82°C]", sortOrder: 5 },
    ],
  },
  {
    name: "Mid-Shift Restock & Restroom Check",
    type: "MID_DAY" as const,
    estimatedMinutes: 15,
    description: "Peak-hour transition, supply restocking, and customer restroom sanitation check.",
    items: [
      { title: "Check & restock guest restrooms (Soap, paper towels, tissue)", priority: "HIGH" as const, roleRequired: "Front / Server", sortOrder: 1 },
      { title: "Wipe down dining room condiments & refill cutlery holders", priority: "MEDIUM" as const, roleRequired: "Server / Busser", sortOrder: 2 },
      { title: "Restock line cooler with prepped ingredients from walk-in", priority: "HIGH" as const, roleRequired: "Prep Cook", sortOrder: 3 },
      { title: "Sweep dining room floor & empty busser trash bins", priority: "MEDIUM" as const, roleRequired: "Busser / Runner", sortOrder: 4 },
    ],
  },
];

export class ChecklistService {
  /**
   * Ensures industry standard checklist templates exist for the restaurant.
   */
  static async ensureDefaultTemplates(restaurantId: string) {
    const existingCount = await prisma.shiftChecklistTemplate.count({
      where: { restaurantId },
    });

    if (existingCount === 0) {
      for (const tpl of DEFAULT_CHECKLIST_TEMPLATES) {
        await prisma.shiftChecklistTemplate.create({
          data: {
            restaurantId,
            name: tpl.name,
            type: tpl.type,
            estimatedMinutes: tpl.estimatedMinutes,
            description: tpl.description,
            items: {
              create: tpl.items.map((it: any) => ({
                title: it.title,
                priority: it.priority,
                roleRequired: it.roleRequired,
                requiresValueInput: !!it.requiresValueInput,
                valueInputLabel: it.valueInputLabel || null,
                sortOrder: it.sortOrder,
              })),
            },
          },
        });
      }
    }
  }

  /**
   * Fetches all checklist templates for a restaurant.
   */
  static async getTemplates(restaurantId: string) {
    await this.ensureDefaultTemplates(restaurantId);
    return prisma.shiftChecklistTemplate.findMany({
      where: { restaurantId, isActive: true },
      include: {
        department: true,
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Creates a new custom checklist template.
   */
  static async createTemplate(restaurantId: string, data: {
    name: string;
    type: "OPENING" | "CLOSING" | "MID_DAY" | "FOOD_SAFETY" | "WEEKLY_MAINTENANCE" | "CUSTOM";
    departmentId?: string;
    description?: string;
    estimatedMinutes?: number;
    items: Array<{
      title: string;
      description?: string;
      roleRequired?: string;
      priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      requiresValueInput?: boolean;
      valueInputLabel?: string;
      requiresPhoto?: boolean;
    }>;
  }) {
    return prisma.shiftChecklistTemplate.create({
      data: {
        restaurantId,
        name: data.name,
        type: data.type,
        departmentId: data.departmentId || null,
        description: data.description || null,
        estimatedMinutes: data.estimatedMinutes || 20,
        items: {
          create: data.items.map((it, idx) => ({
            title: it.title,
            description: it.description || null,
            roleRequired: it.roleRequired || null,
            priority: it.priority || "MEDIUM",
            requiresValueInput: it.requiresValueInput || false,
            valueInputLabel: it.valueInputLabel || null,
            requiresPhoto: it.requiresPhoto || false,
            sortOrder: idx + 1,
          })),
        },
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        department: true,
      },
    });
  }

  /**
   * Updates an existing SOP checklist template and recreates its steps.
   */
  static async updateTemplate(
    templateId: string,
    restaurantId: string,
    data: {
      name: string;
      type: "OPENING" | "CLOSING" | "MID_DAY" | "FOOD_SAFETY" | "WEEKLY_MAINTENANCE" | "CUSTOM";
      departmentId?: string;
      description?: string;
      estimatedMinutes?: number;
      items: Array<{
        title: string;
        description?: string;
        roleRequired?: string;
        priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
        requiresValueInput?: boolean;
        valueInputLabel?: string;
        requiresPhoto?: boolean;
      }>;
    }
  ) {
    const existing = await prisma.shiftChecklistTemplate.findFirst({
      where: { id: templateId, restaurantId },
    });
    if (!existing) throw new Error("Template not found");

    return prisma.$transaction(async (tx) => {
      // Delete old items
      await tx.shiftChecklistItem.deleteMany({
        where: { templateId },
      });

      // Update template with new items
      return tx.shiftChecklistTemplate.update({
        where: { id: templateId },
        data: {
          name: data.name,
          type: data.type,
          departmentId: data.departmentId || null,
          description: data.description || null,
          estimatedMinutes: data.estimatedMinutes || 20,
          items: {
            create: data.items.map((it, idx) => ({
              title: it.title,
              description: it.description || null,
              roleRequired: it.roleRequired || null,
              priority: it.priority || "MEDIUM",
              requiresValueInput: it.requiresValueInput || false,
              valueInputLabel: it.valueInputLabel || null,
              requiresPhoto: it.requiresPhoto || false,
              sortOrder: idx + 1,
            })),
          },
        },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          department: true,
        },
      });
    });
  }

  /**
   * Duplicates an existing SOP template and its items.
   */
  static async duplicateTemplate(templateId: string, restaurantId: string) {
    const original = await prisma.shiftChecklistTemplate.findFirst({
      where: { id: templateId, restaurantId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!original) throw new Error("Template not found");

    return prisma.shiftChecklistTemplate.create({
      data: {
        restaurantId,
        name: `${original.name} (Copy)`,
        type: original.type,
        departmentId: original.departmentId,
        description: original.description,
        estimatedMinutes: original.estimatedMinutes,
        items: {
          create: original.items.map((it) => ({
            title: it.title,
            description: it.description,
            roleRequired: it.roleRequired,
            priority: it.priority,
            requiresValueInput: it.requiresValueInput,
            valueInputLabel: it.valueInputLabel,
            requiresPhoto: it.requiresPhoto,
            sortOrder: it.sortOrder,
          })),
        },
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        department: true,
      },
    });
  }

  /**
   * Deactivates (soft-deletes) an SOP checklist template.
   */
  static async deleteTemplate(templateId: string, restaurantId: string) {
    const tpl = await prisma.shiftChecklistTemplate.findFirst({
      where: { id: templateId, restaurantId },
    });
    if (!tpl) throw new Error("Template not found");

    return prisma.shiftChecklistTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });
  }

  /**
   * Fetches active & scheduled executions for a given date and outlet.
   */
  static async getExecutions(restaurantId: string, dateStr: string, outletId?: string) {
    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    const where: any = {
      restaurantId,
      executionDate: { gte: startOfDay, lte: endOfDay },
    };
    if (outletId) where.outletId = outletId;

    const executions = await prisma.shiftChecklistExecution.findMany({
      where,
      include: {
        template: true,
        assignedEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workerType: true,
          },
        },
        verifiedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
        items: {
          include: {
            completedByEmployee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return executions.map((exec) => {
      const totalItems = exec.items.length;
      const completedItems = exec.items.filter((i) => i.isCompleted).length;
      const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      return {
        ...exec,
        totalItems,
        completedItems,
        progressPercent,
      };
    });
  }

  /**
   * Starts a new checklist execution from a template or creates a fresh shift task list.
   */
  static async startExecution(restaurantId: string, data: {
    templateId: string;
    outletId: string;
    executionDate: string;
    assignedEmployeeId?: string;
    shiftAssignmentId?: string;
    notes?: string;
  }) {
    const template = await prisma.shiftChecklistTemplate.findFirst({
      where: { id: data.templateId, restaurantId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    if (!template) throw new Error("Template not found");

    const execDate = new Date(data.executionDate);

    return prisma.shiftChecklistExecution.create({
      data: {
        restaurantId,
        outletId: data.outletId,
        templateId: template.id,
        title: template.name,
        type: template.type,
        executionDate: execDate,
        status: "PENDING",
        assignedEmployeeId: data.assignedEmployeeId || null,
        shiftAssignmentId: data.shiftAssignmentId || null,
        notes: data.notes || null,
        items: {
          create: template.items.map((it) => ({
            templateItemId: it.id,
            title: it.title,
            description: it.description,
            roleRequired: it.roleRequired,
            priority: it.priority,
            sortOrder: it.sortOrder,
            isCompleted: false,
          })),
        },
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        template: true,
        assignedEmployee: true,
      },
    });
  }

  /**
   * Toggles an individual checklist item completion or updates value/notes.
   */
  static async updateItemExecution(itemId: string, data: {
    isCompleted?: boolean;
    completedByEmployeeId?: string;
    inputValue?: string;
    photoUrl?: string;
    notes?: string;
  }) {
    const item = await prisma.shiftChecklistItemExecution.findUnique({
      where: { id: itemId },
      include: { execution: true },
    });

    if (!item) throw new Error("Checklist item not found");

    const updatedItem = await prisma.shiftChecklistItemExecution.update({
      where: { id: itemId },
      data: {
        ...(data.isCompleted !== undefined && {
          isCompleted: data.isCompleted,
          completedAt: data.isCompleted ? new Date() : null,
          completedByEmployeeId: data.isCompleted ? data.completedByEmployeeId || null : null,
        }),
        ...(data.inputValue !== undefined && { inputValue: data.inputValue }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });

    // Auto-update execution status
    const allItems = await prisma.shiftChecklistItemExecution.findMany({
      where: { executionId: item.executionId },
    });
    const completedCount = allItems.filter((i) => i.isCompleted).length;

    let newStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED" = "IN_PROGRESS";
    if (completedCount === 0) newStatus = "PENDING";
    else if (completedCount === allItems.length) {
      newStatus = item.execution.status === "VERIFIED" ? "VERIFIED" : "COMPLETED";
    }

    await prisma.shiftChecklistExecution.update({
      where: { id: item.executionId },
      data: { status: newStatus },
    });

    return updatedItem;
  }

  /**
   * Supervisor verification and digital sign-off.
   */
  static async verifyExecution(executionId: string, supervisorEmployeeId: string, notes?: string) {
    return prisma.shiftChecklistExecution.update({
      where: { id: executionId },
      data: {
        status: "VERIFIED",
        verifiedByEmployeeId: supervisorEmployeeId,
        verifiedAt: new Date(),
        ...(notes && { notes }),
      },
      include: {
        verifiedBy: true,
        items: true,
      },
    });
  }

  /**
   * Assigns an on-duty shift employee to a checklist.
   */
  static async assignStaff(executionId: string, employeeId: string | null) {
    return prisma.shiftChecklistExecution.update({
      where: { id: executionId },
      data: {
        assignedEmployeeId: employeeId,
      },
      include: {
        assignedEmployee: true,
      },
    });
  }
}
