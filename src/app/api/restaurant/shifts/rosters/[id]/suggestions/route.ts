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
      { moduleKey: "shifts", permissionKey: "shifts:manage_roster" },
      session.tokenVersion
    );
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { searchParams } = new URL(req.url);
    const shiftDate = searchParams.get("shiftDate");
    const startTime = searchParams.get("startTime") || "09:00";
    const endTime = searchParams.get("endTime") || "17:00";
    const departmentId = searchParams.get("departmentId") || undefined;

    if (!shiftDate) {
      return NextResponse.json({ error: "shiftDate query param required" }, { status: 400 });
    }

    const suggestions = await ShiftService.getSmartEmployeeSuggestions(
      session.activeRestaurantId,
      rosterId,
      shiftDate,
      startTime,
      endTime,
      departmentId
    );

    return NextResponse.json(suggestions);
  } catch (error: any) {
    console.error("GET Smart Staff Suggestions Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
