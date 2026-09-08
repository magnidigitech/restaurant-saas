import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { setTenantSession } from "@/core/auth/session";
import { isRateLimited } from "@/core/auth/rate-limiter";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";
import {
  verify2FAChallenge,
  decryptTotpSecret,
  verifyTotpCode,
  verifyRecoveryCodeMatch,
} from "@/core/auth/two-factor";

export async function POST(req: NextRequest) {
  try {
    await ensureTwoFactorTables();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    // Strict rate limiting on OTP verification: 5 attempts per IP/challenge per 10 minutes
    if (isRateLimited(`2fa_challenge:${ip}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please wait 10 minutes before trying again." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { challengeToken, code, isRecoveryCode } = body;

    if (!challengeToken || typeof challengeToken !== "string") {
      return NextResponse.json({ error: "Missing or invalid challenge token" }, { status: 400 });
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Authentication code is required" }, { status: 400 });
    }

    // 1. Verify Challenge Token
    const payload = await verify2FAChallenge(challengeToken);
    if (!payload) {
      return NextResponse.json(
        { error: "Verification session has expired. Please sign in again." },
        { status: 401 }
      );
    }

    // 2. Load User and 2FA configuration
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        twoFactorAuth: true,
      },
    });

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return NextResponse.json({ error: "Invalid user session. Please sign in again." }, { status: 401 });
    }

    // 3. Confirm Restaurant Membership is still active
    const membership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: payload.restaurantId,
          userId: user.id,
        },
      },
      include: {
        restaurant: true,
      },
    });

    if (!membership || membership.status !== "ACTIVE" || membership.restaurant.status !== "ACTIVE") {
      return NextResponse.json({ error: "Access to this restaurant workspace is unavailable" }, { status: 403 });
    }

    const userAgent = req.headers.get("user-agent") || "unknown";

    // 4. Case A: Recovery Code Verification
    if (isRecoveryCode) {
      const unusedCodes = await prisma.twoFactorRecoveryCode.findMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
      });

      let matchedCodeId: string | null = null;
      for (const item of unusedCodes) {
        if (verifyRecoveryCodeMatch(code, item.codeHash)) {
          matchedCodeId = item.id;
          break;
        }
      }

      if (!matchedCodeId) {
        return NextResponse.json(
          { error: "Invalid or previously used recovery code. Please check your backup sheet." },
          { status: 400 }
        );
      }

      // Mark the recovery code as consumed
      await prisma.$transaction([
        prisma.twoFactorRecoveryCode.update({
          where: { id: matchedCodeId },
          data: { usedAt: new Date() },
        }),
        prisma.auditLog.create({
          data: {
            restaurantId: payload.restaurantId,
            userId: user.id,
            userEmail: user.email,
            action: "RECOVERY_CODE_USED",
            entityType: "UserTwoFactor",
            entityId: user.id,
            ipAddress: ip,
            userAgent,
          },
        }),
      ]);

      // Issue full tenant session cookie
      await setTenantSession({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: "RESTAURANT_USER",
        activeRestaurantId: payload.restaurantId,
        activeRestaurantSubdomain: payload.subdomain,
        tokenVersion: user.tokenVersion,
      });

      return NextResponse.json({
        success: true,
        user: { name: user.name, email: user.email },
        usedRecoveryCode: true,
      });
    }

    // 5. Case B: TOTP 6-digit Code Verification
    if (!user.twoFactorAuth || !user.twoFactorAuth.enabled || !user.twoFactorAuth.secretEncrypted) {
      return NextResponse.json({ error: "Two-factor authentication is not configured" }, { status: 400 });
    }

    let secret: string;
    try {
      secret = decryptTotpSecret(user.twoFactorAuth.secretEncrypted);
    } catch (e) {
      return NextResponse.json({ error: "Security credential error" }, { status: 500 });
    }

    const isValid = await verifyTotpCode(secret, code);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid 6-digit authenticator code. Please check your authenticator app and try again." },
        { status: 400 }
      );
    }

    // Log successful 2FA verification
    await prisma.auditLog.create({
      data: {
        restaurantId: payload.restaurantId,
        userId: user.id,
        userEmail: user.email,
        action: "2FA_VERIFICATION_SUCCESS",
        entityType: "UserTwoFactor",
        entityId: user.id,
        ipAddress: ip,
        userAgent,
      },
    });

    // Issue full tenant session cookie
    await setTenantSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: "RESTAURANT_USER",
      activeRestaurantId: payload.restaurantId,
      activeRestaurantSubdomain: payload.subdomain,
      tokenVersion: user.tokenVersion,
    });

    return NextResponse.json({
      success: true,
      user: { name: user.name, email: user.email },
    });
  } catch (error: any) {
    console.error("2FA Challenge API Error:", error);
    return NextResponse.json({ error: "Failed to verify authentication challenge" }, { status: 500 });
  }
}
