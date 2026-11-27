import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext } from "@/modules/shifts/authHelper";
import { ShiftService } from "@/modules/shifts/service";
import { z } from "zod";

const patchSwapSchema = z.object({
  action: z.enum(["ACCEPT_PEER", "DECLINE_PEER", "MANAGER_REVIEW"]).optional(),
  status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]).optional(),
  reviewNotes: z.string().optional(),
});

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    const result = patchSwapSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    // Peer acceptance / decline by the target coworker
    if (result.data.action === "ACCEPT_PEER" || result.data.action === "DECLINE_PEER") {
      const auth = await getShiftActorContext("shifts:view_roster");
      if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!auth.ctx.employeeId) {
        return NextResponse.json({ error: "No employee record linked to current user" }, { status: 403 });
      }

      const swap = await ShiftService.respondToSwapAsPeer(
        auth.ctx.restaurantId,
        params.id,
        auth.ctx.employeeId,
        result.data.action === "ACCEPT_PEER",
        result.data.reviewNotes
      );
      return NextResponse.json({ success: true, swap });
    }

    // Manager review (Approve / Reject / Cancel)
    const auth = await getShiftActorContext("shifts:approve_swap");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!result.data.status) {
      return NextResponse.json({ error: "Missing review status" }, { status: 400 });
    }

    const swap = await ShiftService.reviewSwapRequest(auth.ctx.restaurantId, params.id, {
      status: result.data.status as any,
      reviewNotes: result.data.reviewNotes,
      reviewedBy: auth.ctx.userId,
      reviewedByEmail: auth.ctx.userEmail,
    });
    return NextResponse.json({ success: true, swap });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
