import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext } from "@/modules/shifts/authHelper";
import { ShiftService } from "@/modules/shifts/service";
import { z } from "zod";

const createSwapSchema = z.object({
  assignmentId: z.string().uuid(),
  requesterEmployeeId: z.string().uuid().optional(),
  targetEmployeeId: z.string().uuid().optional(),
  targetAssignmentId: z.string().uuid().optional(),
  reason: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getShiftActorContext("shifts:view_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") as any) || undefined;
    const requestedEmployeeId = searchParams.get("employeeId") || undefined;

    // Self-service: regular staff only see swaps involving themselves
    const employeeId = auth.ctx.canApproveSwap || auth.ctx.canManageRoster
      ? requestedEmployeeId
      : auth.ctx.employeeId || "__NONE__";

    const swaps = await ShiftService.getSwapRequests(auth.ctx.restaurantId, {
      status,
      employeeId,
    });

    return NextResponse.json({
      swaps,
      currentEmployeeId: auth.ctx.employeeId,
      canApproveSwap: auth.ctx.canApproveSwap,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getShiftActorContext("shifts:view_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const result = createSwapSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const requesterEmployeeId = result.data.requesterEmployeeId || auth.ctx.employeeId;
    if (!requesterEmployeeId) {
      return NextResponse.json({ error: "No employee record linked to current user" }, { status: 400 });
    }

    if (
      requesterEmployeeId !== auth.ctx.employeeId &&
      !auth.ctx.canManageRoster
    ) {
      return NextResponse.json(
        { error: "Forbidden: You can only request swaps for your own shifts." },
        { status: 403 }
      );
    }

    const swap = await ShiftService.createSwapRequest(auth.ctx.restaurantId, {
      assignmentId: result.data.assignmentId,
      requesterEmployeeId,
      targetEmployeeId: result.data.targetEmployeeId,
      targetAssignmentId: result.data.targetAssignmentId,
      reason: result.data.reason,
    });
    return NextResponse.json({ success: true, swap });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
