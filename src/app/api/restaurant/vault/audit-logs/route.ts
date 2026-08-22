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
    const limit = parseInt(searchParams.get("limit") || "50");

    let auditLogs: any[] = [];
    if ((prisma as any).vaultAuditLog) {
      auditLogs = await (prisma as any).vaultAuditLog.findMany({
        where: { restaurantId: session.activeRestaurantId },
        include: {
          vaultItem: { select: { id: true, title: true, itemType: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } else {
      auditLogs = await prisma.$queryRawUnsafe(
        `SELECT id, action, details, user_email as "userEmail", created_at as "createdAt",
         json_build_object('name', user_email, 'email', user_email) as user
         FROM vault_audit_logs
         WHERE restaurant_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        session.activeRestaurantId,
        limit
      );
    }

    return NextResponse.json({ success: true, auditLogs });
  } catch (error: any) {
    console.error("List Vault Audit Logs Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
