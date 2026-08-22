import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { generatePnLStatement } from "@/core/finance/pnlEngine";

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const outletId = searchParams.get("outletId") || undefined;

    // Default to current month if not specified
    const now = new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endDate = endDateParam
      ? new Date(endDateParam)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const pnl = await generatePnLStatement(
      session.activeRestaurantId,
      startDate,
      endDate,
      outletId
    );

    return NextResponse.json({ success: true, pnl });
  } catch (error: any) {
    console.error("Finance PnL Statement Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
