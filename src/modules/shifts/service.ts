import { prisma } from "@/core/database/client";
import { RosterStatus, ShiftAssignmentStatus, SwapRequestStatus, DateAvailabilityType, AvailabilitySubmissionStatus } from "@prisma/client";

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function calculateShiftDurationHours(startTime: string, endTime: string, breakMinutes: number = 0): number {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) {
    end += 24 * 60; // Overnight shift spanning past midnight
  }
  const grossMinutes = end - start;
  const netMinutes = Math.max(0, grossMinutes - breakMinutes);
  return netMinutes / 60;
}

function parseNormalizedDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) return dateInput;
  if (!dateInput) return new Date();

  if (typeof dateInput === "string" && dateInput.includes("/")) {
    const parts = dateInput.split("/");
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[2].length === 4) {
        // DD/MM/YYYY -> YYYY-MM-DD
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        const d = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }

  const d = new Date(dateInput);
  if (!isNaN(d.getTime())) return d;
  return new Date();
}

async function getRosterRawHelper(restaurantId: string, rosterId: string) {
  try {
    const roster = await prisma.shiftRoster.findFirst({ where: { id: rosterId, restaurantId } });
    if (roster) return roster;
  } catch {
    // Fallback if DMMF enum deserializer is stale in long-running dev servers
  }
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT r.id, r.restaurant_id as "restaurantId", r.outlet_id as "outletId", r.name, r.start_date as "startDate", r.end_date as "endDate", r.status::text as status, r.availability_deadline as "availabilityDeadline", r.notes, o.name as "outletName" FROM "shift_rosters" r LEFT JOIN "restaurant_outlets" o ON r.outlet_id = o.id WHERE r.id = $1 AND r.restaurant_id = $2`,
    rosterId,
    restaurantId
  );
  if (!rows.length) throw new Error("Shift roster not found");
  return {
    ...rows[0],
    outlet: { name: rows[0].outletName },
  };
}

async function validateShiftAssignmentConstraints(
  restaurantId: string,
  employeeId: string,
  shiftDateInput: Date | string,
  startTime: string,
  endTime: string,
  breakMinutes: number = 0,
  excludeAssignmentId?: string
) {
  const targetDate = new Date(shiftDateInput);
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // 1. Check for overlapping or identical shifts on the same day for this employee
  const existingSameDayShifts = await prisma.shiftAssignment.findMany({
    where: {
      restaurantId,
      employeeId,
      shiftDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { not: ShiftAssignmentStatus.CANCELLED },
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
    },
  });

  const newStartMin = timeToMinutes(startTime);
  let newEndMin = timeToMinutes(endTime);
  if (newEndMin <= newStartMin) newEndMin += 24 * 60;

  for (const existing of existingSameDayShifts) {
    const exStartMin = timeToMinutes(existing.startTime);
    let exEndMin = timeToMinutes(existing.endTime);
    if (exEndMin <= exStartMin) exEndMin += 24 * 60;

    // Overlap condition: startA < endB && endA > startB
    if (newStartMin < exEndMin && newEndMin > exStartMin) {
      throw new Error(
        `Shift conflict: Employee is already scheduled for an overlapping shift (${existing.startTime} - ${existing.endTime}) on this date`
      );
    }
  }

  // 2. Check Daily Working Hours Limit (Max 14 hours / day)
  const newShiftHours = calculateShiftDurationHours(startTime, endTime, breakMinutes);
  const existingDailyHours = existingSameDayShifts.reduce((acc, s) => {
    return acc + calculateShiftDurationHours(s.startTime, s.endTime, s.breakMinutes);
  }, 0);

  if (existingDailyHours + newShiftHours > 14) {
    throw new Error(
      `Daily working hours limit exceeded: Cannot exceed 14.0 hours in a single day (attempted ${(existingDailyHours + newShiftHours).toFixed(1)} hrs)`
    );
  }

  // 3. Check Weekly Working Hours Limit (Max 48 hours / week)
  const dayOfWeek = targetDate.getUTCDay();
  const diffToMonday = targetDate.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(targetDate);
  weekStart.setUTCDate(diffToMonday);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const weeklyShifts = await prisma.shiftAssignment.findMany({
    where: {
      restaurantId,
      employeeId,
      shiftDate: {
        gte: weekStart,
        lte: weekEnd,
      },
      status: { not: ShiftAssignmentStatus.CANCELLED },
      id: excludeAssignmentId ? { not: excludeAssignmentId } : undefined,
    },
  });

  const existingWeeklyHours = weeklyShifts.reduce((acc, s) => {
    return acc + calculateShiftDurationHours(s.startTime, s.endTime, s.breakMinutes);
  }, 0);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true, workerType: true, weeklyHoursLimit: true },
  });

  let maxWeeklyHours = 48.0;
  if (employee) {
    if (employee.weeklyHoursLimit && employee.weeklyHoursLimit > 0) {
      maxWeeklyHours = employee.weeklyHoursLimit;
    } else {
      switch (employee.workerType) {
        case "PART_TIME":
          maxWeeklyHours = 20.0;
          break;
        case "INTERN":
          maxWeeklyHours = 20.0;
          break;
        case "TEMPORARY":
          maxWeeklyHours = 25.0;
          break;
        case "CONTRACT":
        case "CONSULTANT":
          maxWeeklyHours = 40.0;
          break;
        case "FULL_TIME":
        default:
          maxWeeklyHours = 48.0;
          break;
      }
    }
  }

  if (existingWeeklyHours + newShiftHours > maxWeeklyHours) {
    const workerLabel = employee?.weeklyHoursLimit && employee.weeklyHoursLimit > 0
      ? `Custom Limit: ${employee.weeklyHoursLimit}h`
      : employee?.workerType ? employee.workerType.replace("_", " ") : "Standard";
    throw new Error(
      `Weekly working hours limit exceeded: ${employee?.firstName || "Employee"} is set to max ${maxWeeklyHours.toFixed(1)} hrs/week (${workerLabel}), but this shift would schedule ${(existingWeeklyHours + newShiftHours).toFixed(1)} total hours this week`
    );
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
    return prisma.shiftTemplate.create({
      data: {
        restaurantId,
        name: data.name,
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
    await prisma.shiftTemplate.findFirstOrThrow({ where: { id, restaurantId } });
    return prisma.shiftTemplate.update({
      where: { id },
      data,
    });
  },

  async deleteTemplate(restaurantId: string, id: string) {
    await prisma.shiftTemplate.findFirstOrThrow({ where: { id, restaurantId } });
    return prisma.shiftTemplate.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  },

  // ── Rosters ────────────────────────────────────────────────────────────────
  // ── Rosters ────────────────────────────────────────────────────────────────
  async getRosters(restaurantId: string, outletId?: string) {
    try {
      const where: any = { restaurantId };
      if (outletId) where.outletId = outletId;

      return await prisma.shiftRoster.findMany({
        where,
        include: {
          outlet: { select: { id: true, name: true } },
          _count: { select: { assignments: true } },
        },
        orderBy: { startDate: "desc" },
      });
    } catch {
      // Fallback raw query for long-running dev servers with stale Prisma Client enum cache
      const sql = outletId
        ? `SELECT r.id, r.name, r.outlet_id as "outletId", r.start_date as "startDate", r.end_date as "endDate", r.status::text as status, r.notes, o.name as "outletName" FROM "shift_rosters" r LEFT JOIN "restaurant_outlets" o ON r.outlet_id = o.id WHERE r.restaurant_id = $1 AND r.outlet_id = $2 ORDER BY r.start_date DESC`
        : `SELECT r.id, r.name, r.outlet_id as "outletId", r.start_date as "startDate", r.end_date as "endDate", r.status::text as status, r.notes, o.name as "outletName" FROM "shift_rosters" r LEFT JOIN "restaurant_outlets" o ON r.outlet_id = o.id WHERE r.restaurant_id = $1 ORDER BY r.start_date DESC`;
      const params = outletId ? [restaurantId, outletId] : [restaurantId];
      const rows: any[] = await prisma.$queryRawUnsafe(sql, ...params);
      return rows.map((r) => ({
        ...r,
        outlet: { name: r.outletName },
        _count: { assignments: 0 },
      }));
    }
  },

  async getRosterById(restaurantId: string, id: string) {
    try {
      const roster = await prisma.shiftRoster.findFirst({
        where: { id, restaurantId },
        include: {
          outlet: { select: { id: true, name: true } },
          assignments: {
            include: {
              employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, profilePhotoUrl: true } },
              template: { select: { id: true, name: true, color: true } },
            },
            orderBy: { shiftDate: "asc" },
          },
        },
      });
      if (roster) return roster;
    } catch {
      // Fallback
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT r.id, r.name, r.outlet_id as "outletId", r.start_date as "startDate", r.end_date as "endDate", r.status::text as status, r.notes, o.name as "outletName" FROM "shift_rosters" r LEFT JOIN "restaurant_outlets" o ON r.outlet_id = o.id WHERE r.id = $1 AND r.restaurant_id = $2`,
      id,
      restaurantId
    );
    if (!rows.length) throw new Error("Shift roster not found");
    const assignments = await this.getAssignments(restaurantId, { rosterId: id });
    return {
      ...rows[0],
      outlet: { name: rows[0].outletName },
      assignments,
    };
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
    }
  ) {
    await prisma.restaurantOutlet.findFirstOrThrow({
      where: { id: data.outletId, restaurantId },
    });

    return prisma.shiftRoster.create({
      data: {
        restaurantId,
        outletId: data.outletId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        availabilityDeadline: data.availabilityDeadline ? new Date(data.availabilityDeadline) : null,
        departments: data.departments ? data.departments : undefined,
        notes: data.notes,
        status: RosterStatus.DRAFT,
      },
      include: {
        outlet: { select: { id: true, name: true } },
      },
    });
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
    }
  ) {
    if (data.status) {
      await prisma.$executeRawUnsafe(
        `UPDATE "shift_rosters" SET "status" = $1::"RosterStatus", "updated_at" = NOW() WHERE "id" = $2 AND "restaurant_id" = $3`,
        data.status,
        id,
        restaurantId
      );
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    if (Object.keys(updateData).length > 0) {
      await prisma.shiftRoster.update({
        where: { id },
        data: updateData,
      });
    }

    return this.getRosterById(restaurantId, id);
  },

  async publishRoster(restaurantId: string, id: string, publishedBy: string) {
    await prisma.shiftRoster.findFirstOrThrow({ where: { id, restaurantId } });
    return prisma.shiftRoster.update({
      where: { id },
      data: {
        status: RosterStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedBy,
      },
    });
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
    }
  ) {
    const where: any = { restaurantId };
    if (params.rosterId) where.rosterId = params.rosterId;
    if (params.outletId) where.outletId = params.outletId;
    if (params.employeeId) where.employeeId = params.employeeId;
    if (params.startDate || params.endDate) {
      where.shiftDate = {};
      if (params.startDate) where.shiftDate.gte = new Date(params.startDate);
      if (params.endDate) where.shiftDate.lte = new Date(params.endDate);
    }

    return prisma.shiftAssignment.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, profilePhotoUrl: true } },
        outlet: { select: { id: true, name: true } },
        template: { select: { id: true, name: true, color: true } },
        roster: { select: { id: true, name: true } },
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
      status?: ShiftAssignmentStatus;
      notes?: string;
    }
  ) {
    await prisma.employee.findFirstOrThrow({
      where: { id: data.employeeId, restaurantId, archivedAt: null },
    });
    await prisma.restaurantOutlet.findFirstOrThrow({
      where: { id: data.outletId, restaurantId },
    });

    // Enforce Overlapping Shift & Working Hours Validation
    await validateShiftAssignmentConstraints(
      restaurantId,
      data.employeeId,
      data.shiftDate,
      data.startTime,
      data.endTime,
      data.breakMinutes ?? 0
    );

    return prisma.shiftAssignment.create({
      data: {
        restaurantId,
        rosterId: data.rosterId || null,
        templateId: data.templateId || null,
        employeeId: data.employeeId,
        outletId: data.outletId,
        shiftDate: new Date(data.shiftDate),
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes: data.breakMinutes ?? 0,
        status: data.status ?? ShiftAssignmentStatus.SCHEDULED,
        notes: data.notes,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        template: { select: { id: true, name: true, color: true } },
        outlet: { select: { id: true, name: true } },
      },
    });
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
      status?: ShiftAssignmentStatus;
      notes?: string;
    }>
  ) {
    for (const item of assignments) {
      await validateShiftAssignmentConstraints(
        restaurantId,
        item.employeeId,
        item.shiftDate,
        item.startTime,
        item.endTime,
        item.breakMinutes ?? 0
      );
    }

    return prisma.$transaction(
      assignments.map((item) =>
        prisma.shiftAssignment.create({
          data: {
            restaurantId,
            rosterId: item.rosterId || null,
            templateId: item.templateId || null,
            employeeId: item.employeeId,
            outletId: item.outletId,
            shiftDate: new Date(item.shiftDate),
            startTime: item.startTime,
            endTime: item.endTime,
            breakMinutes: item.breakMinutes ?? 0,
            status: item.status ?? ShiftAssignmentStatus.SCHEDULED,
            notes: item.notes,
          },
        })
      )
    );
  },

  async updateAssignment(
    restaurantId: string,
    id: string,
    data: {
      templateId?: string | null;
      shiftDate?: Date | string;
      startTime?: string;
      endTime?: string;
      breakMinutes?: number;
      status?: ShiftAssignmentStatus;
      notes?: string | null;
    }
  ) {
    const existing = await prisma.shiftAssignment.findFirstOrThrow({ where: { id, restaurantId } });

    const targetDate = data.shiftDate || existing.shiftDate;
    const targetStart = data.startTime || existing.startTime;
    const targetEnd = data.endTime || existing.endTime;
    const targetBreak = data.breakMinutes !== undefined ? data.breakMinutes : existing.breakMinutes;

    if (data.startTime || data.endTime || data.shiftDate) {
      await validateShiftAssignmentConstraints(
        restaurantId,
        existing.employeeId,
        targetDate,
        targetStart,
        targetEnd,
        targetBreak,
        id
      );
    }

    return prisma.shiftAssignment.update({
      where: { id },
      data: {
        ...data,
        shiftDate: data.shiftDate ? new Date(data.shiftDate) : undefined,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        template: { select: { id: true, name: true, color: true } },
      },
    });
  },

  async deleteAssignment(restaurantId: string, id: string) {
    await prisma.shiftAssignment.findFirstOrThrow({ where: { id, restaurantId } });
    return prisma.shiftAssignment.delete({ where: { id } });
  },

  // ── Employee Availability ──────────────────────────────────────────────────
  async getAvailability(restaurantId: string, employeeId: string) {
    await prisma.employee.findFirstOrThrow({ where: { id: employeeId, restaurantId } });
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
    await prisma.employee.findFirstOrThrow({ where: { id: employeeId, restaurantId } });

    return prisma.$transaction(
      availabilities.map((item) =>
        prisma.shiftAvailability.upsert({
          where: {
            employeeId_dayOfWeek: {
              employeeId,
              dayOfWeek: item.dayOfWeek,
            },
          },
          update: {
            isAvailable: item.isAvailable,
            preferredStartTime: item.preferredStartTime,
            preferredEndTime: item.preferredEndTime,
            notes: item.notes,
          },
          create: {
            restaurantId,
            employeeId,
            dayOfWeek: item.dayOfWeek,
            isAvailable: item.isAvailable,
            preferredStartTime: item.preferredStartTime,
            preferredEndTime: item.preferredEndTime,
            notes: item.notes,
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
            outlet: { select: { name: true } },
            template: { select: { name: true, color: true } },
          },
        },
        targetAssignment: {
          include: {
            outlet: { select: { name: true } },
            template: { select: { name: true, color: true } },
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
    });

    if (data.targetAssignmentId) {
      await prisma.shiftAssignment.findFirstOrThrow({
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
        reason: data.reason,
        status: SwapRequestStatus.PENDING,
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
    }
  ) {
    const swap = await prisma.shiftSwapRequest.findFirstOrThrow({
      where: { id, restaurantId },
      include: {
        requesterAssignment: true,
        targetAssignment: true,
      },
    });

    if (swap.status !== SwapRequestStatus.PENDING) {
      throw new Error(`Swap request is already ${swap.status}`);
    }

    if (data.status === SwapRequestStatus.APPROVED) {
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
        } else if (swap.targetEmployeeId) {
          await tx.shiftAssignment.update({
            where: { id: swap.assignmentId },
            data: { employeeId: swap.targetEmployeeId },
          });
        }

        return tx.shiftSwapRequest.update({
          where: { id },
          data: {
            status: SwapRequestStatus.APPROVED,
            reviewNotes: data.reviewNotes,
            reviewedBy: data.reviewedBy,
            reviewedAt: new Date(),
          },
        });
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
  async getRosterAvailability(restaurantId: string, rosterId: string, filters?: { departmentId?: string; employeeId?: string }) {
    const roster = await getRosterRawHelper(restaurantId, rosterId);

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
          select: {
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { firstName: "asc" }
    });

    const employeeIds = employees.map(e => e.id);

    let dateAvailabilities: any[] = [];
    let submissions: any[] = [];
    let approvedLeaves: any[] = [];

    try {
      if ((prisma as any).rosterDateAvailability) {
        dateAvailabilities = await prisma.rosterDateAvailability.findMany({
          where: { rosterId, employeeId: { in: employeeIds } }
        });
      } else {
        throw new Error("rosterDateAvailability model undefined");
      }
    } catch {
      dateAvailabilities = await prisma.$queryRawUnsafe(
        `SELECT id, restaurant_id as "restaurantId", roster_id as "rosterId", employee_id as "employeeId", date, type::text as type, available_from as "availableFrom", available_until as "availableUntil", notes FROM "roster_date_availabilities" WHERE roster_id = $1`,
        rosterId
      );
    }

    try {
      if ((prisma as any).rosterEmployeeSubmission) {
        submissions = await prisma.rosterEmployeeSubmission.findMany({
          where: { rosterId, employeeId: { in: employeeIds } }
        });
      } else {
        throw new Error("rosterEmployeeSubmission model undefined");
      }
    } catch {
      submissions = await prisma.$queryRawUnsafe(
        `SELECT id, restaurant_id as "restaurantId", roster_id as "rosterId", employee_id as "employeeId", status::text as status, submitted_at as "submittedAt", notes FROM "roster_employee_submissions" WHERE roster_id = $1`,
        rosterId
      );
    }

    try {
      approvedLeaves = await prisma.leaveRequest.findMany({
        where: {
          restaurantId,
          employeeId: { in: employeeIds },
          status: "APPROVED",
          startDate: { lte: roster.endDate },
          endDate: { gte: roster.startDate }
        }
      });
    } catch {
      approvedLeaves = [];
    }

    const startDate = new Date(roster.startDate);
    const endDate = new Date(roster.endDate);
    const dateList: string[] = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      dateList.push(curr.toISOString().split("T")[0]);
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    const result = employees.map(emp => {
      const empAvailMap: Record<string, any> = {};
      const empSubmission = submissions.find(s => s.employeeId === emp.id);

      dateList.forEach(dStr => {
        const found = dateAvailabilities.find(a => a.employeeId === emp.id && new Date(a.date).toISOString().split("T")[0] === dStr);

        const isOnLeave = approvedLeaves.some(l => {
          const lStart = new Date(l.startDate).toISOString().split("T")[0];
          const lEnd = new Date(l.endDate).toISOString().split("T")[0];
          return l.employeeId === emp.id && dStr >= lStart && dStr <= lEnd;
        });

        if (isOnLeave) {
          empAvailMap[dStr] = {
            type: "LEAVE",
            isAvailable: false,
            label: "Leave (Approved)",
            availableFrom: null,
            availableUntil: null
          };
        } else if (found) {
          empAvailMap[dStr] = {
            type: found.type,
            isAvailable: found.type === "AVAILABLE" || found.type === "SPECIFIC_TIME",
            label: found.type === "SPECIFIC_TIME"
              ? `${found.availableFrom || ''} - ${found.availableUntil || ''}`
              : found.type.replace("_", " "),
            availableFrom: found.availableFrom,
            availableUntil: found.availableUntil,
            notes: found.notes
          };
        } else {
          empAvailMap[dStr] = {
            type: "NOT_UPDATED",
            isAvailable: false,
            label: "Not Updated",
            availableFrom: null,
            availableUntil: null
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
          designation: primaryRecord?.designation?.name || "Staff"
        },
        submissionStatus: empSubmission?.status || "DRAFT",
        submittedAt: empSubmission?.submittedAt || null,
        days: empAvailMap
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
    const roster = await getRosterRawHelper(restaurantId, rosterId);
    if (roster.status === "AVAILABILITY_LOCKED" || roster.status === "COMPLETED") {
      throw new Error("Availability modifications are locked for this roster period.");
    }

    const validItems = (dateAvailabilities || []).filter(item => item.type && (item.type as string) !== "NOT_UPDATED");
    if (validItems.length === 0) return [];

    try {
      if ((prisma as any).rosterDateAvailability) {
        return await prisma.$transaction(
          validItems.map((item) => {
            const dateObj = new Date(item.date);
            dateObj.setUTCHours(0, 0, 0, 0);
            return prisma.rosterDateAvailability.upsert({
              where: {
                rosterId_employeeId_date: {
                  rosterId,
                  employeeId,
                  date: dateObj
                }
              },
              update: {
                type: item.type as any,
                availableFrom: item.availableFrom || null,
                availableUntil: item.availableUntil || null,
                notes: item.notes || null
              },
              create: {
                restaurantId,
                rosterId,
                employeeId,
                date: dateObj,
                type: item.type as any,
                availableFrom: item.availableFrom || null,
                availableUntil: item.availableUntil || null,
                notes: item.notes || null
              }
            });
          })
        );
      }
    } catch {
      // Fallback to raw SQL if Prisma Client JS definition is cached
    }

    for (const item of validItems) {
      const dateObj = new Date(item.date);
      dateObj.setUTCHours(0, 0, 0, 0);
      await prisma.$executeRawUnsafe(
        `INSERT INTO "roster_date_availabilities" ("id", "restaurant_id", "roster_id", "employee_id", "date", "type", "available_from", "available_until", "notes", "created_at", "updated_at")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4::timestamp, $5::"DateAvailabilityType", $6, $7, $8, NOW(), NOW())
         ON CONFLICT ("roster_id", "employee_id", "date")
         DO UPDATE SET "type" = EXCLUDED.type, "available_from" = EXCLUDED.available_from, "available_until" = EXCLUDED.available_until, "notes" = EXCLUDED.notes, "updated_at" = NOW()`,
        restaurantId,
        rosterId,
        employeeId,
        dateObj,
        item.type,
        item.availableFrom || null,
        item.availableUntil || null,
        item.notes || null
      );
    }
    return { success: true };
  },

  async applyRecurringAvailabilityToRoster(restaurantId: string, rosterId: string, employeeId: string) {
    const roster = await getRosterRawHelper(restaurantId, rosterId);
    const recurring = await prisma.shiftAvailability.findMany({ where: { restaurantId, employeeId } });

    const startDate = new Date(roster.startDate);
    const endDate = new Date(roster.endDate);

    const itemsToUpsert: any[] = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      const dayOfWeek = curr.getUTCDay();
      const match = recurring.find(r => r.dayOfWeek === dayOfWeek);

      const dateObj = new Date(curr);
      dateObj.setUTCHours(0, 0, 0, 0);

      const type = match ? (match.isAvailable ? (match.preferredStartTime && match.preferredEndTime ? "SPECIFIC_TIME" : "AVAILABLE") : "NOT_AVAILABLE") : "AVAILABLE";

      itemsToUpsert.push({
        date: dateObj,
        type,
        availableFrom: match?.preferredStartTime || null,
        availableUntil: match?.preferredEndTime || null,
        notes: match?.notes || null
      });
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    return this.saveRosterDateAvailabilities(restaurantId, rosterId, employeeId, itemsToUpsert);
  },

  async submitEmployeeAvailability(restaurantId: string, rosterId: string, employeeId: string, notes?: string) {
    const roster = await getRosterRawHelper(restaurantId, rosterId);
    if (roster.status === "AVAILABILITY_LOCKED" || roster.status === "COMPLETED") {
      throw new Error("Availability for this roster period is locked and cannot be submitted.");
    }

    try {
      if ((prisma as any).rosterEmployeeSubmission) {
        return await prisma.rosterEmployeeSubmission.upsert({
          where: {
            rosterId_employeeId: { rosterId, employeeId }
          },
          update: {
            status: "SUBMITTED",
            submittedAt: new Date(),
            notes: notes || null
          },
          create: {
            restaurantId,
            rosterId,
            employeeId,
            status: "SUBMITTED",
            submittedAt: new Date(),
            notes: notes || null
          }
        });
      }
    } catch {
      // Fallback
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "roster_employee_submissions" ("id", "restaurant_id", "roster_id", "employee_id", "status", "submitted_at", "notes", "created_at", "updated_at")
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'SUBMITTED', NOW(), $4, NOW(), NOW())
       ON CONFLICT ("roster_id", "employee_id")
       DO UPDATE SET "status" = 'SUBMITTED', "submitted_at" = NOW(), "notes" = EXCLUDED.notes, "updated_at" = NOW()`,
      restaurantId,
      rosterId,
      employeeId,
      notes || null
    );

    return { status: "SUBMITTED", submittedAt: new Date() };
  },

  async getSmartEmployeeSuggestions(
    restaurantId: string,
    rosterId: string,
    shiftDateStr: string,
    startTime: string,
    endTime: string,
    departmentId?: string
  ) {
    const roster = await getRosterRawHelper(restaurantId, rosterId);

    const shiftDate = parseNormalizedDate(shiftDateStr);
    const targetDateStr = shiftDate.toISOString().split("T")[0];
    const shiftDateZero = new Date(shiftDate);
    shiftDateZero.setUTCHours(0, 0, 0, 0);

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
        employmentRecords: {
          select: {
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } }
          }
        }
      }
    });

    const employeeIds = employees.map(e => e.id);

    const dayOfWeek = shiftDate.getUTCDay();
    const diffToMonday = shiftDate.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(shiftDate);
    weekStart.setUTCDate(diffToMonday);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    let availabilities: any[] = [];
    let approvedLeaves: any[] = [];
    let existingAssignments: any[] = [];

    try {
      if ((prisma as any).rosterDateAvailability) {
        availabilities = await prisma.rosterDateAvailability.findMany({
          where: { rosterId, employeeId: { in: employeeIds } }
        });
      } else {
        throw new Error("rosterDateAvailability undefined");
      }
    } catch {
      availabilities = await prisma.$queryRawUnsafe(
        `SELECT id, restaurant_id as "restaurantId", roster_id as "rosterId", employee_id as "employeeId", date, type::text as type, available_from as "availableFrom", available_until as "availableUntil", notes FROM "roster_date_availabilities" WHERE roster_id = $1`,
        rosterId
      );
    }

    try {
      approvedLeaves = await prisma.leaveRequest.findMany({
        where: {
          restaurantId,
          employeeId: { in: employeeIds },
          status: "APPROVED",
          startDate: { lte: shiftDateZero },
          endDate: { gte: shiftDateZero }
        }
      });
    } catch {
      approvedLeaves = [];
    }

    try {
      existingAssignments = await prisma.shiftAssignment.findMany({
        where: {
          restaurantId,
          employeeId: { in: employeeIds },
          shiftDate: { gte: weekStart, lte: weekEnd },
          status: { not: ShiftAssignmentStatus.CANCELLED }
        }
      });
    } catch {
      existingAssignments = [];
    }

    const shiftDuration = calculateShiftDurationHours(startTime, endTime, 0);

    const recommended: any[] = [];
    const partiallyAvailable: any[] = [];
    const unavailable: any[] = [];

    employees.forEach(emp => {
      const dept = emp.employmentRecords?.[0]?.department;
      const desig = emp.employmentRecords?.[0]?.designation;

      const empWeeklyShifts = existingAssignments.filter(a => a.employeeId === emp.id);
      const weeklyHoursAssigned = empWeeklyShifts.reduce((acc, s) => {
        return acc + calculateShiftDurationHours(s.startTime, s.endTime, s.breakMinutes);
      }, 0);
      const weeklyShiftCount = empWeeklyShifts.length;

      let maxWeeklyHours = 48.0;
      if (emp.weeklyHoursLimit && emp.weeklyHoursLimit > 0) {
        maxWeeklyHours = emp.weeklyHoursLimit;
      } else if (emp.workerType === "PART_TIME" || emp.workerType === "INTERN") {
        maxWeeklyHours = 20.0;
      } else if (emp.workerType === "TEMPORARY") {
        maxWeeklyHours = 25.0;
      } else if (emp.workerType === "CONTRACT") {
        maxWeeklyHours = 40.0;
      }

      const sameDayShifts = empWeeklyShifts.filter(s => {
        return new Date(s.shiftDate).toISOString().split("T")[0] === targetDateStr;
      });

      let hasOverlap = false;
      const newStartMin = timeToMinutes(startTime);
      let newEndMin = timeToMinutes(endTime);
      if (newEndMin <= newStartMin) newEndMin += 24 * 60;

      for (const s of sameDayShifts) {
        const exStartMin = timeToMinutes(s.startTime);
        let exEndMin = timeToMinutes(s.endTime);
        if (exEndMin <= exStartMin) exEndMin += 24 * 60;
        if (newStartMin < exEndMin && newEndMin > exStartMin) {
          hasOverlap = true;
          break;
        }
      }

      const isOnLeave = approvedLeaves.some(l => l.employeeId === emp.id);
      const avail = availabilities.find(a => {
        const aDateStr = new Date(a.date).toISOString().split("T")[0];
        return a.employeeId === emp.id && aDateStr === targetDateStr;
      });

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
        availabilityType: avail?.type || (isOnLeave ? "LEAVE" : "NOT_UPDATED"),
        availableFrom: avail?.availableFrom || null,
        availableUntil: avail?.availableUntil || null,
        reason: ""
      };

      if (isOnLeave) {
        empData.reason = "Employee is on approved leave for this date.";
        unavailable.push(empData);
      } else if (hasOverlap) {
        empData.reason = "Employee has an overlapping shift assigned on this date.";
        unavailable.push(empData);
      } else if (avail?.type === "NOT_AVAILABLE") {
        empData.reason = "Employee marked as Not Available on this date.";
        unavailable.push(empData);
      } else if (weeklyHoursAssigned + shiftDuration > maxWeeklyHours) {
        empData.reason = `Weekly hours limit (${maxWeeklyHours}h) would be exceeded (${(weeklyHoursAssigned + shiftDuration).toFixed(1)}h).`;
        unavailable.push(empData);
      } else if (avail?.type === "SPECIFIC_TIME") {
        const availStartMin = avail.availableFrom ? timeToMinutes(avail.availableFrom) : 0;
        let availEndMin = avail.availableUntil ? timeToMinutes(avail.availableUntil) : 24 * 60;
        if (availEndMin <= availStartMin) availEndMin += 24 * 60;

        if (newStartMin >= availStartMin && newEndMin <= availEndMin) {
          recommended.push(empData);
        } else {
          empData.reason = `Available only between ${avail.availableFrom || ''} - ${avail.availableUntil || ''} (Shift: ${startTime} - ${endTime}).`;
          partiallyAvailable.push(empData);
        }
      } else {
        if (avail?.type === "AVAILABLE") {
          recommended.push(empData);
        } else {
          empData.reason = "Availability not explicitly updated yet.";
          partiallyAvailable.push(empData);
        }
      }
    });

    recommended.sort((a, b) => a.weeklyHoursAssigned - b.weeklyHoursAssigned || a.weeklyShiftCount - b.weeklyShiftCount);

    return {
      recommended,
      partiallyAvailable,
      unavailable
    };
  }
};
