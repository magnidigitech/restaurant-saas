import { NextRequest, NextResponse } from "next/server";
import { ChecklistService, ChecklistError } from "@/modules/operations/checklistService";
import { getOperationsActorContext } from "@/modules/operations/authHelper";
import { prisma } from "@/core/database/client";
import { ChecklistStatus } from "@prisma/client";
import { z } from "zod";

const startChecklistSchema = z.object({
  templateId: z.string().uuid(),
  outletId: z.string().uuid(),
  assignedEmployeeId: z.string().uuid().optional(),
  shiftAssignmentId: z.string().uuid().optional(),
  stationName: z.string().optional(),
  dueAt: z.string().optional(),
  allowCarryForwardExceptions: z.boolean().optional(),
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("UPDATE_ITEM"),
    itemExecutionId: z.string().uuid(),
    status: z.string().optional(),
    isCompleted: z.boolean().optional(),
    recordedValue: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    photoUrl: z.string().nullable().optional(),
    expectedVersion: z.number().int().optional(),
  }),
  z.object({
    action: z.literal("SUBMIT_CHECKLIST"),
    executionId: z.string().uuid(),
    handoverNotes: z.string().optional(),
    expectedVersion: z.number().int().optional(),
  }),
  z.object({
    action: z.literal("RETURN_ITEM"),
    executionId: z.string().uuid(),
    itemExecutionId: z.string().uuid(),
    returnReason: z.string().min(1),
    expectedVersion: z.number().int().optional(),
  }),
  z.object({
    action: z.literal("VERIFY_CHECKLIST"),
    executionId: z.string().uuid(),
    handoverNotes: z.string().optional(),
    allowCarryForwardExceptions: z.boolean().optional(),
    carryForwardOwner: z.string().optional(),
    carryForwardNote: z.string().optional(),
    expectedVersion: z.number().int().optional(),
  }),
  z.object({
    action: z.literal("ASSIGN_STAFF"),
    executionId: z.string().uuid(),
    assignedEmployeeId: z.string().uuid(),
    expectedVersion: z.number().int().optional(),
  }),
]);

function canAccessOutlet(accessibleOutletIds: string[] | null, outletId: string) {
  return accessibleOutletIds === null || accessibleOutletIds.includes(outletId);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getOperationsActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { ctx } = auth;

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;
    const statusParam = searchParams.get("status") as ChecklistStatus | null;
    const date = searchParams.get("date") || undefined;
    const shiftAssignmentId = searchParams.get("shiftAssignmentId") || undefined;

    if (!ctx.canViewOperations && !ctx.canManageOperations) {
      if (!ctx.employeeId) {
        return NextResponse.json({
          success: true,
          executions: [],
          actor: {
            canViewOperations: ctx.canViewOperations,
            canManageOperations: ctx.canManageOperations,
            employeeId: ctx.employeeId,
            accessibleOutletIds: ctx.accessibleOutletIds,
          },
        });
      }
      const executions = await ChecklistService.getExecutions(ctx.restaurantId, {
        outletId,
        onlyOwnEmployeeId: ctx.employeeId,
        status: statusParam || undefined,
        date,
        shiftAssignmentId,
      });
      return NextResponse.json({
        success: true,
        executions,
        actor: {
          canViewOperations: ctx.canViewOperations,
          canManageOperations: ctx.canManageOperations,
          employeeId: ctx.employeeId,
          accessibleOutletIds: ctx.accessibleOutletIds,
        },
      });
    }

    const executions = await ChecklistService.getExecutions(ctx.restaurantId, {
      outletId,
      accessibleOutletIds: ctx.accessibleOutletIds,
      assignedEmployeeId: employeeId,
      status: statusParam || undefined,
      date,
      shiftAssignmentId,
    });

    const outletFilter = outletId
      ? { outletId }
      : ctx.accessibleOutletIds
        ? { outletId: { in: ctx.accessibleOutletIds } }
        : {};

    const shiftDateFilter = date
      ? {
        shiftDate: {
          gte: new Date(`${date}T00:00:00.000Z`),
          lte: new Date(`${date}T23:59:59.999Z`),
        },
      }
      : {};

    const [shiftAssignments, employees] = ctx.canManageOperations
      ? await Promise.all([
        prisma.shiftAssignment.findMany({
          where: {
            restaurantId: ctx.restaurantId,
            ...outletFilter,
            ...shiftDateFilter,
          },
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeCode: true },
            },
            outlet: { select: { id: true, name: true, timezone: true } },
          },
          orderBy: { startTime: "asc" },
          take: 100,
        }),
        prisma.employee.findMany({
          where: {
            restaurantId: ctx.restaurantId,
            archivedAt: null,
            ...(outletId || ctx.accessibleOutletIds
              ? {
                outletAssignments: {
                  some: {
                    ...(outletId
                      ? { outletId }
                      : { outletId: { in: ctx.accessibleOutletIds! } }),
                  },
                },
              }
              : {}),
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
          orderBy: { firstName: "asc" },
        }),
      ])
      : [[], []];

    return NextResponse.json({
      success: true,
      executions,
      shiftAssignments,
      employees,
      actor: {
        canViewOperations: ctx.canViewOperations,
        canManageOperations: ctx.canManageOperations,
        employeeId: ctx.employeeId,
        accessibleOutletIds: ctx.accessibleOutletIds,
      },
    });
  } catch (error: any) {
    const status = error instanceof ChecklistError ? error.status : 500;
    return NextResponse.json(
      { error: error.message || "Failed to load checklists", code: error.code },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = startChecklistSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const auth = await getOperationsActorContext({
      requireManage: true,
      outletId: result.data.outletId,
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const execution = await ChecklistService.startExecution(auth.ctx.restaurantId, {
      ...result.data,
      actorUserId: auth.ctx.userId,
      actorEmail: auth.ctx.userEmail,
    });

    return NextResponse.json({ success: true, execution });
  } catch (error: any) {
    const status = error instanceof ChecklistError ? error.status : 500;
    return NextResponse.json(
      { error: error.message || "Failed to assign checklist", code: error.code },
      { status }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getOperationsActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { ctx } = auth;

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid checklist update payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    if (payload.action === "UPDATE_ITEM") {
      const item = await prisma.shiftChecklistItemExecution.findFirst({
        where: {
          id: payload.itemExecutionId,
          execution: { restaurantId: ctx.restaurantId },
        },
        include: { execution: { select: { outletId: true, assignedEmployeeId: true } } },
      });
      if (!item) {
        return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });
      }
      const isAssignee = Boolean(
        ctx.employeeId && item.execution.assignedEmployeeId === ctx.employeeId
      );
      const isScopedManager =
        ctx.canManageOperations &&
        canAccessOutlet(ctx.accessibleOutletIds, item.execution.outletId);

      if (!isAssignee && !isScopedManager) {
        return NextResponse.json(
          { error: "You are not permitted to update this checklist task" },
          { status: 403 }
        );
      }

      const updatedItem = await ChecklistService.updateItemExecution(
        payload.itemExecutionId,
        ctx.restaurantId,
        {
          status: payload.status,
          isCompleted: payload.isCompleted,
          recordedValue: payload.recordedValue,
          notes: payload.notes,
          photoUrl: payload.photoUrl,
          completedById: ctx.employeeId || undefined,
          actorId: ctx.userId,
          actorName: ctx.userName,
          expectedVersion: payload.expectedVersion,
        }
      );

      return NextResponse.json({ success: true, item: updatedItem });
    }

    if (payload.action === "SUBMIT_CHECKLIST") {
      const execution = await ChecklistService.getExecutionById(
        payload.executionId,
        ctx.restaurantId
      );
      const isAssignee = Boolean(
        ctx.employeeId && execution.assignedEmployeeId === ctx.employeeId
      );
      const isScopedManager =
        ctx.canManageOperations &&
        canAccessOutlet(ctx.accessibleOutletIds, execution.outletId);

      if (!isAssignee && !isScopedManager) {
        return NextResponse.json(
          { error: "You are not permitted to submit this checklist" },
          { status: 403 }
        );
      }

      const submitted = await ChecklistService.submitExecution(
        payload.executionId,
        ctx.restaurantId,
        {
          employeeId: ctx.employeeId,
          handoverNotes: payload.handoverNotes,
          expectedVersion: payload.expectedVersion,
          actorUserId: ctx.userId,
          actorEmail: ctx.userEmail,
        }
      );
      return NextResponse.json({ success: true, execution: submitted });
    }

    // Supervisor-only actions below
    if (!ctx.canManageOperations) {
      return NextResponse.json(
        { error: "Supervisor operations permission required" },
        { status: 403 }
      );
    }

    const execution = await ChecklistService.getExecutionById(
      payload.executionId,
      ctx.restaurantId
    );
    if (!canAccessOutlet(ctx.accessibleOutletIds, execution.outletId)) {
      return NextResponse.json(
        { error: "Outlet is outside your authorized scope" },
        { status: 403 }
      );
    }

    if (payload.action === "RETURN_ITEM") {
      const returned = await ChecklistService.returnItemForCorrection(
        payload.executionId,
        payload.itemExecutionId,
        ctx.restaurantId,
        {
          returnReason: payload.returnReason,
          actorUserId: ctx.userId,
          actorEmail: ctx.userEmail,
          actorName: ctx.userName,
          expectedVersion: payload.expectedVersion,
        }
      );
      return NextResponse.json({ success: true, item: returned });
    }

    if (payload.action === "VERIFY_CHECKLIST") {
      const result = await ChecklistService.verifyExecution(
        payload.executionId,
        ctx.restaurantId,
        {
          verifiedById: ctx.employeeId,
          actorUserId: ctx.userId,
          actorEmail: ctx.userEmail,
          actorName: ctx.userName,
          handoverNotes: payload.handoverNotes,
          allowCarryForwardExceptions: payload.allowCarryForwardExceptions,
          carryForwardOwner: payload.carryForwardOwner,
          carryForwardNote: payload.carryForwardNote,
          expectedVersion: payload.expectedVersion,
        }
      );
      return NextResponse.json({
        success: true,
        execution: result.execution,
        alreadyVerified: result.alreadyVerified,
      });
    }

    if (payload.action === "ASSIGN_STAFF") {
      const updated = await ChecklistService.assignStaff(
        payload.executionId,
        ctx.restaurantId,
        payload.assignedEmployeeId,
        {
          expectedVersion: payload.expectedVersion,
          actorUserId: ctx.userId,
          actorEmail: ctx.userEmail,
        }
      );
      return NextResponse.json({ success: true, execution: updated });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: any) {
    const status = error instanceof ChecklistError ? error.status : 500;
    return NextResponse.json(
      {
        error: error.message || "Failed to update checklist",
        code: error.code,
        details: error.details,
      },
      { status }
    );
  }
}
