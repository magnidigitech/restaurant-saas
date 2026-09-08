import { NextRequest, NextResponse } from "next/server";
import { verifyPasskeyAuthResponse } from "@/core/auth/webauthn";
import { setTenantSession } from "@/core/auth/session";
import { trackUserSession } from "@/core/auth/sessions";
import { createTrustedDevice } from "@/core/auth/trusted-devices";
import { logSecurityAudit } from "@/core/auth/security-audit";
import { prisma } from "@/core/database/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { response, expectedChallenge, subdomain, trustDevice } = body;

    if (!response || !expectedChallenge || !subdomain) {
      return NextResponse.json({ error: "Missing verification payload" }, { status: 400 });
    }

    // Verify Passkey
    const result = await verifyPasskeyAuthResponse(response, expectedChallenge, req);
    const { user, passkey } = result;

    // Verify restaurant membership
    const restaurant = await prisma.restaurant.findUnique({
      where: { subdomain },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant workspace not found" }, { status: 404 });
    }

    const membership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: restaurant.id,
          userId: user.id,
        },
      },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return NextResponse.json({ error: "User is not an active member of this restaurant" }, { status: 403 });
    }

    // Set Tenant Session Cookie
    await setTenantSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: "RESTAURANT_USER",
      activeRestaurantId: restaurant.id,
      activeRestaurantSubdomain: subdomain,
      tokenVersion: user.tokenVersion,
    });

    // Track active UserSession
    await trackUserSession(user.id, restaurant.id, req.headers);

    // If requested, register as trusted device
    if (trustDevice) {
      await createTrustedDevice(user.id, restaurant.id, req.headers, 30);
    }

    // Audit Log
    await logSecurityAudit({
      organizationId: restaurant.id,
      userId: user.id,
      userEmail: user.email,
      event: "PASSKEY_USED",
      reqHeaders: req.headers,
      metadata: { passkeyId: passkey.id, passkeyName: passkey.name },
    });

    return NextResponse.json({
      success: true,
      user: { name: user.name, email: user.email },
    });
  } catch (error: any) {
    console.error("Passkey Auth Verify Error:", error);
    return NextResponse.json({ error: error?.message || "Passkey authentication failed" }, { status: 401 });
  }
}
