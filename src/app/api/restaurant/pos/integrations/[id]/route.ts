import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { disconnectIntegration } from "@/modules/pos-integrations/service";
import { prisma } from "@/core/database/client";

export async function DELETE(
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
      { requiredRoles: ["OWNER", "MANAGER", "ADMIN"] },
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") === "DELETE" ? "DELETE" : "DEACTIVATE";

    const result = await disconnectIntegration(session.activeRestaurantId, id, action);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Disconnect POS Integration Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disconnect integration" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
      { requiredRoles: ["OWNER", "MANAGER", "ADMIN"] },
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { id } = await params;
    const body = await req.json();

    const integration = await prisma.posIntegration.findFirst({
      where: { id, restaurantId: session.activeRestaurantId },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const updated = await prisma.posIntegration.update({
      where: { id },
      data: {
        status: body.status || undefined,
        providerLocationId: body.providerLocationId !== undefined ? body.providerLocationId : undefined,
        providerLocationName: body.providerLocationName !== undefined ? body.providerLocationName : undefined,
        environment: body.environment || undefined,
      },
    });

    return NextResponse.json({ success: true, integration: updated });
  } catch (error: any) {
    console.error("Update POS Integration Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update integration" },
      { status: 500 }
    );
  }
}
