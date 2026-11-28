import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext, checkRosterOutletAccess } from "@/modules/shifts/authHelper";
import { ShiftService, DraftRevisionPayload } from "@/modules/shifts/service";
import { z } from "zod";

const draftItemSchema = z.object({
  draftId: z.string(),
  action: z.enum(["ADD", "UPDATE", "DELETE"]),
  targetAssignmentId: z.string().optional(),
  employeeId: z.string().uuid(),
  outletId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  shiftDate: z.string(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  breakMinutes: z.number().min(0).default(0),
  roleName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  overrideHoursLimit: z.boolean().optional(),
  overrideReason: z.string().nullable().optional(),
});

const saveRevisionSchema = z.object({
  expectedVersion: z.number().int().optional(),
  adds: z.array(draftItemSchema).default([]),
  updates: z.array(draftItemSchema).default([]),
  deletes: z.array(z.string()).default([]),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rosterId } = await params;
    const auth = await getShiftActorContext("shifts:manage_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const review = await ShiftService.getRosterReview(auth.ctx.restaurantId, rosterId);
    if (
      auth.ctx.accessibleOutletIds &&
      !auth.ctx.accessibleOutletIds.includes(review.roster.outlet?.id || "")
    ) {
      return NextResponse.json({ error: "Forbidden for this outlet" }, { status: 403 });
    }

    return NextResponse.json(review);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const parsed = saveRevisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid revision payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const revision: DraftRevisionPayload = {
      adds: parsed.data.adds,
      updates: parsed.data.updates,
      deletes: parsed.data.deletes,
    };

    const updated = await ShiftService.saveDraftRevision(
      auth.ctx.restaurantId,
      rosterId,
      revision,
      parsed.data.expectedVersion,
      { userId: auth.ctx.userId, userEmail: auth.ctx.userEmail }
    );

    return NextResponse.json({ success: true, roster: updated });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status });
  }
}
