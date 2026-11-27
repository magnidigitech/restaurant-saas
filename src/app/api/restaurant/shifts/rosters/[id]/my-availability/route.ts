import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext } from "@/modules/shifts/authHelper";
import { ShiftService } from "@/modules/shifts/service";
import { prisma } from "@/core/database/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rosterId } = await params;
    const auth = await getShiftActorContext("shifts:view_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const requestedEmpId = searchParams.get("employeeId");
    const targetEmployeeId =
      requestedEmpId && auth.ctx.canManageRoster ? requestedEmpId : auth.ctx.employeeId;

    if (!targetEmployeeId) {
      return NextResponse.json({ error: "No employee record linked to current user" }, { status: 404 });
    }

    const data = await ShiftService.getRosterAvailability(auth.ctx.restaurantId, rosterId, {
      employeeId: targetEmployeeId,
    });

    if (data.roster?.status === "DRAFT" && !auth.ctx.canManageRoster) {
      return NextResponse.json(
        { error: "This roster period is currently in draft mode and is not yet open for employee availability." },
        { status: 403 }
      );
    }

    const recurring = await prisma.shiftAvailability.findMany({
      where: { restaurantId: auth.ctx.restaurantId, employeeId: targetEmployeeId },
      orderBy: { dayOfWeek: "asc" },
    });

    return NextResponse.json({
      employee: auth.ctx.employee,
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
    const auth = await getShiftActorContext("shifts:view_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const { action, employeeId: requestedEmpId, dateAvailabilities, notes } = body;

    // Only managers may submit on behalf of another employee
    if (requestedEmpId && requestedEmpId !== auth.ctx.employeeId && !auth.ctx.canManageRoster) {
      return NextResponse.json({ error: "Forbidden: cannot modify another employee's availability" }, { status: 403 });
    }

    const targetEmployeeId = requestedEmpId || auth.ctx.employeeId;
    if (!targetEmployeeId) {
      return NextResponse.json({ error: "No employee record linked to user" }, { status: 404 });
    }

    if (action === "apply_recurring") {
      const updated = await ShiftService.applyRecurringAvailabilityToRoster(
        auth.ctx.restaurantId,
        rosterId,
        targetEmployeeId
      );
      return NextResponse.json({ success: true, updated });
    }

    if (action === "submit") {
      const submission = await ShiftService.submitEmployeeAvailability(
        auth.ctx.restaurantId,
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
        auth.ctx.restaurantId,
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
