import { NextRequest, NextResponse } from "next/server";
import { getShiftActorContext, checkRosterOutletAccess } from "@/modules/shifts/authHelper";
import { ShiftService } from "@/modules/shifts/service";
import { z } from "zod";

const updateRosterSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const auth = await getShiftActorContext("shifts:view_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const outletCheck = await checkRosterOutletAccess(auth.ctx, params.id);
    if (!outletCheck.ok) {
      return NextResponse.json({ error: outletCheck.error }, { status: outletCheck.status });
    }

    const roster: any = await ShiftService.getRosterById(auth.ctx.restaurantId, params.id);
    if (!auth.ctx.canManageRoster) {
      if (roster.status === "DRAFT" || roster.status === "ARCHIVED") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { draftRevisionJson: _draft, ...safeRoster } = roster;
      if (Array.isArray(safeRoster.assignments)) {
        safeRoster.assignments = auth.ctx.employeeId
          ? safeRoster.assignments.filter((a: any) => a.employeeId === auth.ctx.employeeId)
          : [];
      }
      return NextResponse.json({ roster: safeRoster });
    }

    return NextResponse.json({ roster });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const auth = await getShiftActorContext("shifts:manage_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const outletCheck = await checkRosterOutletAccess(auth.ctx, params.id);
    if (!outletCheck.ok) {
      return NextResponse.json({ error: outletCheck.error }, { status: outletCheck.status });
    }

    const body = await req.json();
    const result = updateRosterSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const roster = await ShiftService.updateRoster(auth.ctx.restaurantId, params.id, result.data as any);
    return NextResponse.json({ success: true, roster });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const auth = await getShiftActorContext("shifts:manage_roster");
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const outletCheck = await checkRosterOutletAccess(auth.ctx, params.id);
    if (!outletCheck.ok) {
      return NextResponse.json({ error: outletCheck.error }, { status: outletCheck.status });
    }

    await ShiftService.deleteRoster(auth.ctx.restaurantId, params.id);
    return NextResponse.json({ success: true, message: "Roster deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
