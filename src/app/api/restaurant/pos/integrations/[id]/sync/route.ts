import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { executeSync } from "@/modules/pos-integrations/service";
import { prisma } from "@/core/database/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      { requiredRoles: ["OWNER", "MANAGER", "ADMIN", "STAFF"] },
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { id } = await params;

    // Verify integration belongs to this restaurant
    const integration = await prisma.posIntegration.findFirst({
      where: { id, restaurantId: session.activeRestaurantId },
    });

    if (!integration) {
      return NextResponse.json({ error: "POS integration not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const since = body.since ? new Date(body.since) : undefined;

    const result = await executeSync(id, since);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Execute POS Sync Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to synchronize orders from POS" },
      { status: 500 }
    );
  }
}
