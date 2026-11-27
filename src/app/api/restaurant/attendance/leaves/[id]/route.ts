import { NextRequest, NextResponse } from "next/server";
import { getLeaveActorContext } from "@/modules/leaves/authHelper";
import {
  LeaveError,
  previewLeaveShiftImpact,
  reviewLeaveRequest,
} from "@/modules/leaves/service";
import { z } from "zod";

const reviewLeaveSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
  managerNotes: z.string().optional(),
  resolutions: z
    .array(
      z.object({
        assignmentId: z.string().min(1),
        action: z.enum(["UNASSIGN", "REASSIGN"]),
        replacementEmployeeId: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getLeaveActorContext({ requireApprove: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const impact = await previewLeaveShiftImpact(auth.ctx, id);
    return NextResponse.json({ success: true, ...impact });
  } catch (error: any) {
    if (error instanceof LeaveError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getLeaveActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await req.json();
    const result = reviewLeaveSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid review payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const outcome = await reviewLeaveRequest(auth.ctx, id, result.data);
    return NextResponse.json({ success: true, ...outcome });
  } catch (error: any) {
    if (error instanceof LeaveError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    console.error("Review Leave Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
