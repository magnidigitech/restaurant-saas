import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { ShiftService } from "@/modules/shifts/service";
import { RosterStatus } from "@prisma/client";
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
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      { moduleKey: "shifts", permissionKey: "shifts:manage_roster" },
      session.tokenVersion
    );
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await req.json();
    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const roster = await ShiftService.updateRoster(session.activeRestaurantId, rosterId, {
      status: parsed.data.status,
    });

    return NextResponse.json({ success: true, roster });
  } catch (error: any) {
    console.error("Update Roster Status Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
