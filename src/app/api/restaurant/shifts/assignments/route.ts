import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
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
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  notes: z.string().optional(),
});

const bulkCreateSchema = z.object({
  assignments: z.array(createAssignmentSchema),
});

const updateAssignmentSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  shiftDate: z.string().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  breakMinutes: z.number().min(0).optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "shifts", permissionKey: "shifts:view_roster" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const { searchParams } = new URL(req.url);
    const rosterId = searchParams.get("rosterId") || undefined;
    const outletId = searchParams.get("outletId") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    // Check if requester is admin/manager or staff
    const membership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: session.activeRestaurantId,
          userId: session.userId,
        },
      },
      include: {
        accessGrants: {
          where: { status: "ACTIVE" },
          include: { role: true },
        },
      },
    });

    const isUserAdmin =
      session.role === "PLATFORM_ADMIN" ||
      (membership?.accessGrants?.some((g: any) =>
        ["Restaurant Owner", "Admin", "Owner", "Super Admin", "General Manager"].includes(g.role?.name || "")
      ) ?? false) ||
      (!membership?.employeeId && (membership?.accessGrants?.length || 0) === 0);

    // If staff user and roster is specified, verify roster is published before returning shifts
    if (!isUserAdmin && rosterId) {
      const roster = await prisma.shiftRoster.findFirst({
        where: { id: rosterId, restaurantId: session.activeRestaurantId },
      });
      if (roster && roster.status !== "PUBLISHED") {
        return NextResponse.json({ assignments: [] });
      }
    }

    const assignments = await ShiftService.getAssignments(session.activeRestaurantId, {
      rosterId,
      outletId,
      employeeId,
      startDate,
      endDate,
    });
    return NextResponse.json({ assignments });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "shifts", permissionKey: "shifts:manage_roster" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();

    if (body.assignments && Array.isArray(body.assignments)) {
      const bulkResult = bulkCreateSchema.safeParse(body);
      if (!bulkResult.success) return NextResponse.json({ error: "Invalid payload", details: bulkResult.error.flatten() }, { status: 400 });
      const created = await ShiftService.bulkCreateAssignments(session.activeRestaurantId, bulkResult.data.assignments as any);
      return NextResponse.json({ success: true, count: created.length });
    }

    const singleResult = createAssignmentSchema.safeParse(body);
    if (!singleResult.success) return NextResponse.json({ error: "Invalid payload", details: singleResult.error.flatten() }, { status: 400 });

    const assignment = await ShiftService.createAssignment(session.activeRestaurantId, singleResult.data as any);
    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "shifts", permissionKey: "shifts:manage_roster" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = updateAssignmentSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const assignment = await ShiftService.updateAssignment(session.activeRestaurantId, result.data.id, result.data as any);
    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "shifts", permissionKey: "shifts:manage_roster" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing assignment id" }, { status: 400 });

    await ShiftService.deleteAssignment(session.activeRestaurantId, id);
    return NextResponse.json({ success: true, message: "Assignment removed" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
