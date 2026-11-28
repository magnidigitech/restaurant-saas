import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext } from "@/modules/shifts/authHelper";
import { ShiftService } from "@/modules/shifts/service";
import { z } from "zod";

const setAvailabilitySchema = z.object({
  employeeId: z.string().uuid(),
  availabilities: z.array(
    z.object({
      dayOfWeek: z.number().min(0).max(6),
      isAvailable: z.boolean(),
      preferredStartTime: z.string().optional(),
      preferredEndTime: z.string().optional(),
      notes: z.string().optional(),
    })
  ),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getShiftActorContext("shifts:view_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    if (!employeeId) return NextResponse.json({ error: "Missing employeeId" }, { status: 400 });

    if (!auth.ctx.canManageRoster && employeeId !== auth.ctx.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const availability = await ShiftService.getAvailability(auth.ctx.restaurantId, employeeId);
    return NextResponse.json({ availability });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getShiftActorContext("shifts:manage_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const result = setAvailabilitySchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const availability = await ShiftService.setAvailability(
      auth.ctx.restaurantId,
      result.data.employeeId,
      result.data.availabilities
    );
    return NextResponse.json({ success: true, availability });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
