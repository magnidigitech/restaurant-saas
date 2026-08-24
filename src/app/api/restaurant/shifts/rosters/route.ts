import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { ShiftService } from "@/modules/shifts/service";
import { z } from "zod";

import { prisma } from "@/core/database/client";

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
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "shifts", permissionKey: "shifts:view_roster" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;

    // Check if requester is an admin/manager
    const membership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: session.activeRestaurantId,
          userId: session.userId,
        },
      },
      include: {
        accessGrants: {
          where: { status: "ACTIVE" },
          include: { role: true },
        },
      },
    });

    const isUserAdmin =
      session.role === "PLATFORM_ADMIN" ||
      (membership?.accessGrants?.some((g: any) =>
        ["Restaurant Owner", "Admin", "Owner", "Super Admin", "General Manager"].includes(g.role?.name || "")
      ) ?? false) ||
      (!membership?.employeeId && (membership?.accessGrants?.length || 0) === 0);

    let rosters = await ShiftService.getRosters(session.activeRestaurantId, outletId);

    // Regular employees should only see rosters that are OPEN for availability or PUBLISHED/COMPLETED
    if (!isUserAdmin) {
      rosters = rosters.filter((r: any) => r.status !== "DRAFT" && r.status !== "ARCHIVED");
    }

    return NextResponse.json({ rosters });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "shifts", permissionKey: "shifts:manage_roster" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = createRosterSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const roster = await ShiftService.createRoster(session.activeRestaurantId, result.data);
    return NextResponse.json({ success: true, roster });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
