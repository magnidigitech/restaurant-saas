import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { prisma } from "@/core/database/client";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";
import { logSecurityAudit } from "@/core/auth/security-audit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTwoFactorTables();
    const session = await getTenantSession();
    if (!session?.activeRestaurantId || !session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: targetUserId } = await context.params;

    if (!targetUserId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Check caller permission: must be OWNER or ADMIN
    const { isUserAdminOrOwner } = await import("@/core/auth/user-roles");
    const isAdmin = await isUserAdminOrOwner(session.userId, session.activeRestaurantId);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Only Owners or Admins can offboard team members" }, { status: 403 });
    }

    // Cannot offboard yourself via this endpoint
    if (targetUserId === session.userId) {
      return NextResponse.json({ error: "Cannot offboard your own account. Transfer ownership first." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, name: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const orgId = session.activeRestaurantId;

    // Atomic offboarding execution
    await prisma.$transaction(async (tx) => {
      // 1. Deactivate restaurant membership
      await tx.restaurantMembership.updateMany({
        where: { restaurantId: orgId, userId: targetUserId },
        data: { status: "INACTIVE" },
      });

      // 2. Revoke all active user sessions
      await tx.userSession.updateMany({
        where: { organizationId: orgId, userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 3. Revoke all trusted devices
      await tx.trustedDevice.updateMany({
        where: { organizationId: orgId, userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 4. Invalidate all passkeys for this organization
      await tx.passkey.updateMany({
        where: { organizationId: orgId, userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 5. Invalidate JWT tokens
      await tx.user.update({
        where: { id: targetUserId },
        data: { tokenVersion: { increment: 1 } },
      });
    });

    // 6. Security Audit Event
    await logSecurityAudit({
      organizationId: orgId,
      userId: targetUserId,
      userEmail: targetUser.email,
      event: "USER_OFFBOARDED",
      reqHeaders: req.headers,
      metadata: { offboardedBy: session.email, targetName: targetUser.name },
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${targetUser.name} (${targetUser.email}) has been completely offboarded. Sessions, trusted devices, and credentials revoked.`,
    });
  } catch (error: any) {
    console.error("Employee Offboarding Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to offboard employee" }, { status: 500 });
  }
}
