import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { ShiftService } from "@/modules/shifts/service";
import { prisma } from "@/core/database/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rosterId } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find Employee associated with logged-in user
    const employee = await prisma.employee.findFirst({
      where: { restaurantId: session.activeRestaurantId, archivedAt: null },
    });

    if (!employee) {
      return NextResponse.json({ error: "No employee record linked to current user" }, { status: 404 });
    }

    const data = await ShiftService.getRosterAvailability(session.activeRestaurantId, rosterId, {
      employeeId: employee.id,
    });

    if (data.roster?.status === "DRAFT") {
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

      if (!isUserAdmin) {
        return NextResponse.json(
          { error: "This roster period is currently in draft mode and is not yet open for employee availability." },
          { status: 403 }
        );
      }
    }

    const recurring = await prisma.shiftAvailability.findMany({
      where: { restaurantId: session.activeRestaurantId, employeeId: employee.id },
      orderBy: { dayOfWeek: "asc" },
    });

    return NextResponse.json({
      employee,
      roster: data.roster,
      dates: data.dates,
      myAvailability: data.availabilities[0] || null,
      recurring,
    });
  } catch (error: any) {
    console.error("GET My Availability Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rosterId } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, employeeId: requestedEmpId, dateAvailabilities, notes } = body;

    let targetEmployeeId = requestedEmpId;

    if (!targetEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: { restaurantId: session.activeRestaurantId, archivedAt: null },
      });
      if (!employee) {
        return NextResponse.json({ error: "No employee record linked to user" }, { status: 404 });
      }
      targetEmployeeId = employee.id;
    }

    if (action === "apply_recurring") {
      const updated = await ShiftService.applyRecurringAvailabilityToRoster(
        session.activeRestaurantId,
        rosterId,
        targetEmployeeId
      );
      return NextResponse.json({ success: true, updated });
    }

    if (action === "submit") {
      const submission = await ShiftService.submitEmployeeAvailability(
        session.activeRestaurantId,
        rosterId,
        targetEmployeeId,
        notes
      );
      return NextResponse.json({ success: true, submission });
    }

    if (action === "save_dates") {
      if (!Array.isArray(dateAvailabilities)) {
        return NextResponse.json({ error: "dateAvailabilities array required" }, { status: 400 });
      }

      const updated = await ShiftService.saveRosterDateAvailabilities(
        session.activeRestaurantId,
        rosterId,
        targetEmployeeId,
        dateAvailabilities
      );
      return NextResponse.json({ success: true, updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST My Availability Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
