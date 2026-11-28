import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext } from "@/modules/shifts/authHelper";
import { prisma } from "@/core/database/client";
import { ShiftService } from "@/modules/shifts/service";
import { z } from "zod";

const createAssignmentSchema = z.object({
  rosterId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  outletId: z.string().uuid(),
  shiftDate: z.string(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  breakMinutes: z.number().min(0).optional(),
  roleName: z.string().nullable().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  notes: z.string().optional(),
  overrideHoursLimit: z.boolean().optional(),
  overrideReason: z.string().optional(),
  expectedVersion: z.number().int().optional(),
});

const bulkCreateSchema = z.object({
  assignments: z.array(createAssignmentSchema),
  overrideHoursLimit: z.boolean().optional(),
});

const updateAssignmentSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  templateId: z.string().uuid().nullable().optional(),
  shiftDate: z.string().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  breakMinutes: z.number().min(0).optional(),
  roleName: z.string().nullable().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  notes: z.string().nullable().optional(),
  overrideHoursLimit: z.boolean().optional(),
  overrideReason: z.string().optional(),
  expectedVersion: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getShiftActorContext("shifts:view_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const rosterId = searchParams.get("rosterId") || undefined;
    const outletId = searchParams.get("outletId") || undefined;
    const requestedEmployeeId = searchParams.get("employeeId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    if (
      outletId &&
      auth.ctx.accessibleOutletIds &&
      !auth.ctx.accessibleOutletIds.includes(outletId)
    ) {
      return NextResponse.json({ error: "Forbidden for this outlet" }, { status: 403 });
    }

    // Self-service enforcement: regular employees only see their own published shifts
    if (!auth.ctx.canManageRoster) {
      if (!auth.ctx.employeeId) {
        return NextResponse.json({ assignments: [] });
      }
      const assignments = await ShiftService.getAssignments(auth.ctx.restaurantId, {
        rosterId,
        outletId,
        employeeId: auth.ctx.employeeId,
        startDate,
        endDate,
        publishedOnly: true,
      });
      return NextResponse.json({ assignments });
    }

    const assignments = await ShiftService.getAssignments(auth.ctx.restaurantId, {
      rosterId,
      outletId,
      employeeId: requestedEmployeeId,
      startDate,
      endDate,
    });

    const filtered = auth.ctx.accessibleOutletIds
      ? assignments.filter((a) => auth.ctx.accessibleOutletIds!.includes(a.outletId))
      : assignments;

    return NextResponse.json({ assignments: filtered });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const outletId = body?.outletId || body?.assignments?.[0]?.outletId;
    const auth = await getShiftActorContext("shifts:manage_roster", outletId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const actor = { userId: auth.ctx.userId, userEmail: auth.ctx.userEmail };

    if (body.assignments && Array.isArray(body.assignments)) {
      const bulkResult = bulkCreateSchema.safeParse(body);
      if (!bulkResult.success) {
        return NextResponse.json({ error: "Invalid payload", details: bulkResult.error.flatten() }, { status: 400 });
      }
      if (auth.ctx.accessibleOutletIds) {
        const outOfScope = bulkResult.data.assignments.some(
          (a) => !auth.ctx.accessibleOutletIds!.includes(a.outletId)
        );
        if (outOfScope) {
          return NextResponse.json({ error: "Forbidden for this outlet" }, { status: 403 });
        }
      }
      const created = await ShiftService.bulkCreateAssignments(
        auth.ctx.restaurantId,
        bulkResult.data.assignments as any,
        actor
      );
      return NextResponse.json({ success: true, count: created.length });
    }

    const singleResult = createAssignmentSchema.safeParse(body);
    if (!singleResult.success) {
      return NextResponse.json({ error: "Invalid payload", details: singleResult.error.flatten() }, { status: 400 });
    }

    const assignment = await ShiftService.createAssignment(
      auth.ctx.restaurantId,
      singleResult.data as any,
      actor
    );
    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const result = updateAssignmentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const auth = await getShiftActorContext("shifts:manage_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const existing = await prisma.shiftAssignment.findFirst({
      where: { id: result.data.id, restaurantId: auth.ctx.restaurantId },
      select: { outletId: true },
    });
    if (
      existing &&
      auth.ctx.accessibleOutletIds &&
      !auth.ctx.accessibleOutletIds.includes(existing.outletId)
    ) {
      return NextResponse.json({ error: "Forbidden for this outlet" }, { status: 403 });
    }

    const assignment = await ShiftService.updateAssignment(
      auth.ctx.restaurantId,
      result.data.id,
      result.data as any,
      { userId: auth.ctx.userId, userEmail: auth.ctx.userEmail }
    );
    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getShiftActorContext("shifts:manage_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing assignment id" }, { status: 400 });

    const existing = await prisma.shiftAssignment.findFirst({
      where: { id, restaurantId: auth.ctx.restaurantId },
      select: { outletId: true },
    });
    if (
      existing &&
      auth.ctx.accessibleOutletIds &&
      !auth.ctx.accessibleOutletIds.includes(existing.outletId)
    ) {
      return NextResponse.json({ error: "Forbidden for this outlet" }, { status: 403 });
    }

    await ShiftService.deleteAssignment(auth.ctx.restaurantId, id);
    return NextResponse.json({ success: true, message: "Assignment removed" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
