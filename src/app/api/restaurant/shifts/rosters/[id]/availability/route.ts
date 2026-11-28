import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext, checkRosterOutletAccess } from "@/modules/shifts/authHelper";
import { ShiftService } from "@/modules/shifts/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rosterId } = await params;
    const auth = await getShiftActorContext("shifts:manage_roster");
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const outletCheck = await checkRosterOutletAccess(auth.ctx, rosterId);
    if (!outletCheck.ok) {
      return NextResponse.json({ error: outletCheck.error }, { status: outletCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;

    const data = await ShiftService.getRosterAvailability(auth.ctx.restaurantId, rosterId, {
      departmentId,
      employeeId,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET Roster Availability Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
