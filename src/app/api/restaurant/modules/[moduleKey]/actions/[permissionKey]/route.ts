import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ moduleKey: string; permissionKey: string }> }
) {
  try {
    const session = await getTenantSession();
    if (!session || session.role !== "RESTAURANT_USER" || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized session context" }, { status: 401 });
    }

    const { moduleKey, permissionKey } = await params;
    
    // Resolve outlet context if provided in query params
    const searchParams = req.nextUrl.searchParams;
    const outletId = searchParams.get("outletId") || undefined;

    const result = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {
        moduleKey,
        permissionKey,
        outletId,
      },
      session.tokenVersion
    );

    if (!result.authorized) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      authorized: true,
      message: `Access granted for action '${permissionKey}' in module '${moduleKey}'`,
    });
  } catch (error: any) {
    console.error("Action Check API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
