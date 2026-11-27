import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext } from "@/modules/shifts/authHelper";
import { ShiftService } from "@/modules/shifts/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rosterId } = await params;
    const auth = await getShiftActorContext("shifts:manage_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const shiftDate = searchParams.get("shiftDate");
    const startTime = searchParams.get("startTime") || "09:00";
    const endTime = searchParams.get("endTime") || "17:00";
    const departmentId = searchParams.get("departmentId") || undefined;
    const breakMinutes = parseInt(searchParams.get("breakMinutes") || "0", 10) || 0;

    if (!shiftDate) {
      return NextResponse.json({ error: "shiftDate query param required" }, { status: 400 });
    }

    const suggestions = await ShiftService.getSmartEmployeeSuggestions(
      auth.ctx.restaurantId,
      rosterId,
      shiftDate,
      startTime,
      endTime,
      departmentId,
      breakMinutes
    );

    return NextResponse.json(suggestions);
  } catch (error: any) {
    console.error("GET Smart Staff Suggestions Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
