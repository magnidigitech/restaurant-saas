import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { setTenantSession } from "@/core/auth/session";
import { isRateLimited } from "@/core/auth/rate-limiter";
import { validateCsrf } from "@/core/auth/csrf";
import { sign2FAChallenge } from "@/core/auth/two-factor";
import { isCurrentDeviceTrusted } from "@/core/auth/trusted-devices";
import { trackUserSession } from "@/core/auth/sessions";
import { logSecurityAudit } from "@/core/auth/security-audit";
import * as bcrypt from "bcryptjs";
import { z } from "zod";

const tenantLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  subdomain: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    // 1. CSRF Protection
    if (!validateCsrf(req)) {
      return NextResponse.json({ error: "Forbidden: CSRF check failed" }, { status: 403 });
    }

    // 2. Rate Limiting
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (isRateLimited(`login:${ip}`)) {
      return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const result = tenantLoginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { email, password, subdomain } = result.data;

    // Verify restaurant status and subdomain match
    const restaurant = await prisma.restaurant.findUnique({
      where: { subdomain },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (restaurant.status === "SUSPENDED") {
      return NextResponse.json({ error: "Restaurant access suspended" }, { status: 403 });
    }

    if (restaurant.status === "DEACTIVATED") {
      return NextResponse.json({ error: "Restaurant deactivated" }, { status: 403 });
    }

    // Find User
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await logSecurityAudit({
        organizationId: restaurant.id,
        userId: user.id,
        userEmail: user.email,
        event: "LOGIN_FAILED",
        reqHeaders: req.headers,
        metadata: { reason: "Bad password" },
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Validate Membership
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

    // Check organization MFA policy
    const policy = await prisma.restaurantSecurityPolicy.findUnique({
      where: { restaurantId: restaurant.id },
    });

    let requiredByPolicy = false;
    if (policy) {
      try {
        const requiredRoles: string[] = JSON.parse(policy.requireMfaRoles);
        const { getUserRoleNames } = await import("@/core/auth/user-roles");
        const userRoles = await getUserRoleNames(user.id, restaurant.id);
        
        if (Array.isArray(requiredRoles)) {
          const match = userRoles.some((r) =>
            requiredRoles.some((req) => req.toLowerCase() === r.toLowerCase())
          );
          if (match) requiredByPolicy = true;
        }
        if (policy.enforceImmediateMfa) {
          requiredByPolicy = true;
        }
      } catch (e) {}
    }

    // Check for Two-Factor Authentication safely
    let twoFactor = null;
    try {
      if ((prisma as any).twoFactorAuth) {
        twoFactor = await (prisma as any).twoFactorAuth.findUnique({
          where: { userId: user.id },
        });
      }
    } catch (twoFactorErr) {
      console.warn("Could not query TwoFactorAuth:", twoFactorErr);
    }

    // Has user registered passkeys?
    const hasPasskeys = await prisma.passkey.count({
      where: { userId: user.id, revokedAt: null },
    });

    const mfaConfigured = !!twoFactor?.enabled || hasPasskeys > 0;

    // Check if current device is trusted (Trusted Device Bypass)
    const isTrusted = await isCurrentDeviceTrusted(user.id, restaurant.id);

    // Require 2FA challenge if:
    // (a) user has 2FA configured OR policy mandates it
    // AND device is not currently trusted
    if ((mfaConfigured || requiredByPolicy) && !isTrusted) {
      const challengeToken = await sign2FAChallenge({
        userId: user.id,
        email: user.email,
        name: user.name,
        restaurantId: restaurant.id,
        subdomain,
        tokenVersion: user.tokenVersion,
      });

      return NextResponse.json({
        requiresTwoFactor: true,
        challengeToken,
        hasPasskeys: hasPasskeys > 0,
        hasTotp: !!twoFactor?.enabled,
        requiredByPolicy,
        user: {
          name: user.name,
          email: user.email,
        },
      });
    }

    // Save session payload including tokenVersion
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

    // Audit Log
    await logSecurityAudit({
      organizationId: restaurant.id,
      userId: user.id,
      userEmail: user.email,
      event: "LOGIN_SUCCESS",
      reqHeaders: req.headers,
      metadata: { method: isTrusted ? "TRUSTED_DEVICE" : "PASSWORD" },
    });

    return NextResponse.json({ success: true, user: { name: user.name, email: user.email } });
  } catch (error: any) {
    console.error("Tenant Login API Error:", error?.message || error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
