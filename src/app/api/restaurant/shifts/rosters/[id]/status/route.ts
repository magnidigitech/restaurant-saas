import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext, checkRosterOutletAccess } from "@/modules/shifts/authHelper";
import { ShiftService } from "@/modules/shifts/service";
import { z } from "zod";

const updateStatusSchema = z.object({
  status: z.enum([
    "DRAFT",
    "AVAILABILITY_OPEN",
    "AVAILABILITY_LOCKED",
    "ASSIGNMENT_IN_PROGRESS",
    "PUBLISHED",
    "COMPLETED",
    "ARCHIVED",
  ]),
  expectedVersion: z.number().int().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdateStatus(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdateStatus(req, params);
}

async function handleUpdateStatus(
  req: NextRequest,
  params: Promise<{ id: string }>
) {
  try {
    const { id: rosterId } = await params;
    const auth = await getShiftActorContext("shifts:manage_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const outletCheck = await checkRosterOutletAccess(auth.ctx, rosterId);
    if (!outletCheck.ok) {
      return NextResponse.json({ error: outletCheck.error }, { status: outletCheck.status });
    }

    const body = await req.json();
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const roster = await ShiftService.updateRoster(
      auth.ctx.restaurantId,
      rosterId,
      {
        status: parsed.data.status,
        expectedVersion: parsed.data.expectedVersion,
      },
      { userId: auth.ctx.userId, userEmail: auth.ctx.userEmail }
    );

    return NextResponse.json({ success: true, roster });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}
