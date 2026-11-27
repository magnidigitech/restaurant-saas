import { NextRequest, NextResponse } from "next/server";
import { getLeaveActorContext } from "@/modules/leaves/authHelper";
import {
  createLeaveRequest,
  getLeaveBalances,
  LeaveError,
  listLeaveRequests,
} from "@/modules/leaves/service";
import { z } from "zod";

const createLeaveSchema = z.object({
  employeeId: z.string().optional(),
  leaveType: z.enum([
    "CASUAL",
    "SICK",
    "ANNUAL",
    "UNPAID",
    "MATERNITY_PATERNITY",
  ]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  totalDays: z.number().min(0.25).default(1),
  isPartialDay: z.boolean().optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  hoursRequested: z.number().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  attachmentName: z.string().optional().nullable(),
  reason: z.string().min(1, "Reason is required"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;

    const auth = await getLeaveActorContext({ outletId });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const status = searchParams.get("status") || undefined;
    const leaveType = searchParams.get("leaveType") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const leaves = await listLeaveRequests(auth.ctx, {
      status,
      leaveType,
      employeeId,
      outletId,
      startDate,
      endDate,
    });

    const balances = auth.ctx.employeeId
      ? await getLeaveBalances(auth.ctx.restaurantId, auth.ctx.employeeId)
      : null;

    return NextResponse.json({
      success: true,
      leaves,
      balances,
      permissions: {
        canApproveLeaves: auth.ctx.canApproveLeaves,
        canRequestLeave: auth.ctx.canRequestLeave,
        employeeId: auth.ctx.employeeId,
      },
    });
  } catch (error: any) {
    if (error instanceof LeaveError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("List Leaves Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getLeaveActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const result = createLeaveSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid leave payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const leave = await createLeaveRequest(auth.ctx, result.data);
    return NextResponse.json({ success: true, leave }, { status: 201 });
  } catch (error: any) {
    if (error instanceof LeaveError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Create Leave Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
