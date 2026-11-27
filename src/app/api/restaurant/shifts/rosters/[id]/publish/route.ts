import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext } from "@/modules/shifts/authHelper";
import { ShiftService } from "@/modules/shifts/service";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const auth = await getShiftActorContext("shifts:manage_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    let expectedVersion: number | undefined;
    try {
      const body = await req.json();
      if (typeof body?.expectedVersion === "number") {
        expectedVersion = body.expectedVersion;
      }
    } catch {
      // empty body allowed when version not passed
    }

    const roster = await ShiftService.publishRoster(
      auth.ctx.restaurantId,
      params.id,
      { userId: auth.ctx.userId, userEmail: auth.ctx.userEmail },
      expectedVersion
    );
    return NextResponse.json({ success: true, roster });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}
