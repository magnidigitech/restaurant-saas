import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext } from "@/modules/shifts/authHelper";
import { ShiftService } from "@/modules/shifts/service";
import { z } from "zod";

const createRosterSchema = z.object({
  outletId: z.string().uuid(),
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  availabilityDeadline: z.string().optional(),
  departments: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getShiftActorContext("shifts:view_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;

    if (
      outletId &&
      auth.ctx.accessibleOutletIds &&
      !auth.ctx.accessibleOutletIds.includes(outletId)
    ) {
      return NextResponse.json({ error: "Forbidden for this outlet" }, { status: 403 });
    }

    let rosters = await ShiftService.getRosters(auth.ctx.restaurantId, outletId);

    if (auth.ctx.accessibleOutletIds) {
      rosters = rosters.filter((r: any) => auth.ctx.accessibleOutletIds!.includes(r.outletId));
    }

    if (!auth.ctx.canManageRoster) {
      rosters = rosters.filter((r: any) => r.status !== "DRAFT" && r.status !== "ARCHIVED");
    }

    return NextResponse.json({
      rosters,
      permissions: {
        canManageRoster: auth.ctx.canManageRoster,
        canApproveSwap: auth.ctx.canApproveSwap,
        employeeId: auth.ctx.employeeId,
        accessibleOutletIds: auth.ctx.accessibleOutletIds,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = createRosterSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const auth = await getShiftActorContext("shifts:manage_roster", result.data.outletId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const roster = await ShiftService.createRoster(
      auth.ctx.restaurantId,
      result.data,
      { userId: auth.ctx.userId, userEmail: auth.ctx.userEmail }
    );
    return NextResponse.json({ success: true, roster });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
