import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { prisma } from "@/core/database/client";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";
import { logSecurityAudit } from "@/core/auth/security-audit";

export async function POST(req: NextRequest) {
  try {
    await ensureTwoFactorTables();
    const session = await getTenantSession();
    if (!session?.activeRestaurantId || !session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify Owner or Admin role
    const { isUserAdminOrOwner } = await import("@/core/auth/user-roles");
    const isAdmin = await isUserAdminOrOwner(session.userId, session.activeRestaurantId);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Only Owners or Admins can perform emergency security actions" }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    const orgId = session.activeRestaurantId;

    if (action === "SIGN_OUT_ALL_USERS") {
      // 1. Revoke all user sessions for this restaurant
      await prisma.userSession.updateMany({
        where: { organizationId: orgId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 2. Increment tokenVersion for all members of this restaurant to instantly invalidate JWTs
      const members = await prisma.restaurantMembership.findMany({
        where: { restaurantId: orgId },
        select: { userId: true },
      });
      const userIds = members.map((m) => m.userId);

      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { tokenVersion: { increment: 1 } },
      });

      await logSecurityAudit({
        organizationId: orgId,
        userId: session.userId,
        userEmail: session.email,
        event: "EMERGENCY_GLOBAL_LOGOUT",
        reqHeaders: req.headers,
      });

      return NextResponse.json({
        success: true,
        message: "Successfully signed out all restaurant users and invalidated active sessions.",
      });
    }

    if (action === "REVOKE_ALL_TRUSTED_DEVICES") {
      await prisma.trustedDevice.updateMany({
        where: { organizationId: orgId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await logSecurityAudit({
        organizationId: orgId,
        userId: session.userId,
        userEmail: session.email,
        event: "EMERGENCY_REVOKE_TRUSTED_DEVICES",
        reqHeaders: req.headers,
      });

      return NextResponse.json({
        success: true,
        message: "Successfully revoked all trusted devices organization-wide.",
      });
    }

    if (action === "REQUIRE_MFA_IMMEDIATELY") {
      await prisma.restaurantSecurityPolicy.upsert({
        where: { restaurantId: orgId },
        update: {
          enforceImmediateMfa: true,
          requireMfaRoles: JSON.stringify(["OWNER", "ADMIN", "MANAGER", "CASHIER", "STAFF"]),
        },
        create: {
          restaurantId: orgId,
          enforceImmediateMfa: true,
          requireMfaRoles: JSON.stringify(["OWNER", "ADMIN", "MANAGER", "CASHIER", "STAFF"]),
        },
      });

      await logSecurityAudit({
        organizationId: orgId,
        userId: session.userId,
        userEmail: session.email,
        event: "MFA_POLICY_CHANGED",
        reqHeaders: req.headers,
        metadata: { immediateEnforcement: true },
      });

      return NextResponse.json({
        success: true,
        message: "Emergency MFA required immediately for all team members.",
      });
    }

    return NextResponse.json({ error: "Unknown emergency action" }, { status: 400 });
  } catch (error: any) {
    console.error("Emergency Action Error:", error);
    return NextResponse.json({ error: error?.message || "Emergency action failed" }, { status: 500 });
  }
}
