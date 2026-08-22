import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { ChecklistService } from "@/modules/operations/checklistService";
import { prisma } from "@/core/database/client";
import { z } from "zod";

const startExecutionSchema = z.object({
  templateId: z.string().uuid(),
  outletId: z.string().uuid(),
  executionDate: z.string().optional(),
  assignedEmployeeId: z.string().uuid().optional().nullable(),
  shiftAssignmentId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
});

const patchActionSchema = z.object({
  action: z.enum(["UPDATE_ITEM", "VERIFY_CHECKLIST", "ASSIGN_STAFF"]),
  // For UPDATE_ITEM
  itemId: z.string().uuid().optional(),
  isCompleted: z.boolean().optional(),
  completedByEmployeeId: z.string().uuid().optional().nullable(),
  inputValue: z.string().optional(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
  // For VERIFY_CHECKLIST
  executionId: z.string().uuid().optional(),
  supervisorEmployeeId: z.string().uuid().optional(),
  verificationNotes: z.string().optional(),
  // For ASSIGN_STAFF
  assignedEmployeeId: z.string().uuid().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const outletId = searchParams.get("outletId") || undefined;

    // Fetch executions
    const executions = await ChecklistService.getExecutions(
      session.activeRestaurantId,
      dateStr,
      outletId
    );

    // Also fetch today's active shift assignments so supervisor can easily assign staff
    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    const shiftAssignments = await prisma.shiftAssignment.findMany({
      where: {
        restaurantId: session.activeRestaurantId,
        shiftDate: { gte: startOfDay, lte: endOfDay },
        ...(outletId && { outletId }),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workerType: true,
            employmentRecords: {
              where: { status: "ACTIVE" },
              include: {
                department: true,
                designation: true,
              },
              take: 1,
            },
          },
        },
        template: true,
      },
    });

    return NextResponse.json({
      success: true,
      date: dateStr,
      executions,
      shiftAssignments,
    });
  } catch (error: any) {
    console.error("Get Shift Checklists Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load checklists" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = startExecutionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;
    const execution = await ChecklistService.startExecution(session.activeRestaurantId, {
      templateId: data.templateId,
      outletId: data.outletId,
      executionDate: data.executionDate || new Date().toISOString().split("T")[0],
      assignedEmployeeId: data.assignedEmployeeId || undefined,
      shiftAssignmentId: data.shiftAssignmentId || undefined,
      notes: data.notes,
    });

    return NextResponse.json({ success: true, execution });
  } catch (error: any) {
    console.error("Start Checklist Error:", error);
    return NextResponse.json({ error: error.message || "Failed to start checklist" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = patchActionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    if (data.action === "UPDATE_ITEM") {
      if (!data.itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });
      const updated = await ChecklistService.updateItemExecution(data.itemId, {
        isCompleted: data.isCompleted,
        completedByEmployeeId: data.completedByEmployeeId || undefined,
        inputValue: data.inputValue,
        photoUrl: data.photoUrl,
        notes: data.notes,
      });
      return NextResponse.json({ success: true, item: updated });
    }

    if (data.action === "VERIFY_CHECKLIST") {
      if (!data.executionId) return NextResponse.json({ error: "executionId is required" }, { status: 400 });
      // Find employee ID for current user if not provided
      let supervisorId = data.supervisorEmployeeId;
      if (!supervisorId) {
        const emp = await prisma.employee.findFirst({
          where: {
            restaurantId: session.activeRestaurantId,
            memberships: { some: { userId: session.userId } },
          },
        });
        if (emp) supervisorId = emp.id;
      }

      if (!supervisorId) {
        // Fallback to first active supervisor/manager
        const fallbackEmp = await prisma.employee.findFirst({
          where: { restaurantId: session.activeRestaurantId },
        });
        if (fallbackEmp) supervisorId = fallbackEmp.id;
      }

      if (!supervisorId) return NextResponse.json({ error: "Supervisor employee profile not found" }, { status: 400 });

      const verified = await ChecklistService.verifyExecution(
        data.executionId,
        supervisorId,
        data.verificationNotes
      );
      return NextResponse.json({ success: true, execution: verified });
    }

    if (data.action === "ASSIGN_STAFF") {
      if (!data.executionId) return NextResponse.json({ error: "executionId is required" }, { status: 400 });
      const assigned = await ChecklistService.assignStaff(
        data.executionId,
        data.assignedEmployeeId || null
      );
      return NextResponse.json({ success: true, execution: assigned });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("Checklist Action Error:", error);
    return NextResponse.json({ error: error.message || "Action failed" }, { status: 500 });
  }
}
