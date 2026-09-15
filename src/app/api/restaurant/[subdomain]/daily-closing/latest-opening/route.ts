import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

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
    const outletId = searchParams.get("outletId");

    if (!outletId) {
      return NextResponse.json({ error: "outletId query parameter is required" }, { status: 400 });
    }

    // Get latest submitted or approved closing for this outlet
    const latestClosing = await prisma.dailyCashClosing.findFirst({
      where: {
        restaurantId: session.activeRestaurantId,
        outletId,
        status: { in: ["SUBMITTED", "APPROVED"] },
      },
      orderBy: { closingDate: "desc" },
    });

    const carriedOpeningCash = latestClosing ? Number(latestClosing.tomorrowOpeningCash) : 0;

    return NextResponse.json({
      success: true,
      outletId,
      openingTillCash: carriedOpeningCash,
      lastClosingDate: latestClosing ? latestClosing.closingDate : null,
    });
  } catch (error: any) {
    console.error("Get Latest Opening Till Cash Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
