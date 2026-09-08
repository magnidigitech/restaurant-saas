import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { prisma } from "@/core/database/client";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";
import { logSecurityAudit } from "@/core/auth/security-audit";

export async function GET() {
  try {
    await ensureTwoFactorTables();
    const session = await getTenantSession();
    if (!session?.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let policy = await prisma.restaurantSecurityPolicy.findUnique({
      where: { restaurantId: session.activeRestaurantId },
    });

    if (!policy) {
      policy = await prisma.restaurantSecurityPolicy.create({
        data: {
          restaurantId: session.activeRestaurantId,
          requireMfaRoles: JSON.stringify(["OWNER", "ADMIN"]),
          allowedMethods: JSON.stringify(["PASSKEY", "TOTP", "RECOVERY_CODE"]),
          trustedDeviceDurationDays: 30,
          enforceImmediateMfa: false,
        },
      });
    }

    return NextResponse.json({
      policy: {
        ...policy,
        requireMfaRoles: JSON.parse(policy.requireMfaRoles),
        allowedMethods: JSON.parse(policy.allowedMethods),
      },
    });
  } catch (error: any) {
    console.error("Fetch Security Policy Error:", error);
    return NextResponse.json({ error: "Failed to load organization security policy" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await ensureTwoFactorTables();
    const session = await getTenantSession();
    if (!session?.activeRestaurantId || !session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is an OWNER or ADMIN
    const { isUserAdminOrOwner } = await import("@/core/auth/user-roles");
    const isAdmin = await isUserAdminOrOwner(session.userId, session.activeRestaurantId);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Only Owners or Admins can modify organization security policy" }, { status: 403 });
    }

    const body = await req.json();
    const { requireMfaRoles, allowedMethods, trustedDeviceDurationDays, enforceImmediateMfa } = body;

    const updated = await prisma.restaurantSecurityPolicy.upsert({
      where: { restaurantId: session.activeRestaurantId },
      update: {
        requireMfaRoles: requireMfaRoles ? JSON.stringify(requireMfaRoles) : undefined,
        allowedMethods: allowedMethods ? JSON.stringify(allowedMethods) : undefined,
        trustedDeviceDurationDays: typeof trustedDeviceDurationDays === "number" ? trustedDeviceDurationDays : undefined,
        enforceImmediateMfa: typeof enforceImmediateMfa === "boolean" ? enforceImmediateMfa : undefined,
      },
      create: {
        restaurantId: session.activeRestaurantId,
        requireMfaRoles: JSON.stringify(requireMfaRoles || ["OWNER", "ADMIN"]),
        allowedMethods: JSON.stringify(allowedMethods || ["PASSKEY", "TOTP", "RECOVERY_CODE"]),
        trustedDeviceDurationDays: trustedDeviceDurationDays || 30,
        enforceImmediateMfa: !!enforceImmediateMfa,
      },
    });

    await logSecurityAudit({
      organizationId: session.activeRestaurantId,
      userId: session.userId,
      userEmail: session.email,
      event: "MFA_POLICY_CHANGED",
      reqHeaders: req.headers,
      metadata: { requireMfaRoles, allowedMethods, trustedDeviceDurationDays, enforceImmediateMfa },
    });

    return NextResponse.json({
      success: true,
      policy: {
        ...updated,
        requireMfaRoles: JSON.parse(updated.requireMfaRoles),
        allowedMethods: JSON.parse(updated.allowedMethods),
      },
    });
  } catch (error: any) {
    console.error("Update Security Policy Error:", error);
    return NextResponse.json({ error: "Failed to update security policy" }, { status: 500 });
  }
}
