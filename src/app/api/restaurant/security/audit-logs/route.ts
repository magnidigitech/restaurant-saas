import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { prisma } from "@/core/database/client";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";

export async function GET(req: NextRequest) {
  try {
    await ensureTwoFactorTables();
    const session = await getTenantSession();
    if (!session?.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || "25"), 100);

    const logs = await prisma.securityAuditLog.findMany({
      where: {
        organizationId: session.activeRestaurantId,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 });
  }
}
