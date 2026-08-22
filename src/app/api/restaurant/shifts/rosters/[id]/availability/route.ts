import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { ShiftService } from "@/modules/shifts/service";

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

    const access = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      { moduleKey: "shifts", permissionKey: "shifts:view_roster" },
      session.tokenVersion
    );
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;

    const data = await ShiftService.getRosterAvailability(session.activeRestaurantId, rosterId, {
      departmentId,
      employeeId,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET Roster Availability Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
