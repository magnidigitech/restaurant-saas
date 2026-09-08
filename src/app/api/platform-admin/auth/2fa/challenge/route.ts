import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { setPlatformSession } from "@/core/auth/session";
import { isRateLimited } from "@/core/auth/rate-limiter";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";
import { createPlatformTrustedDevice } from "@/core/auth/trusted-devices";
import { trackPlatformSession } from "@/core/auth/sessions";
import {
  verifyPlatform2FAChallenge,
  decryptTotpSecret,
  verifyTotpCode,
  verifyRecoveryCodeMatch,
} from "@/core/auth/two-factor";

export async function POST(req: NextRequest) {
  try {
    await ensureTwoFactorTables();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    if (isRateLimited(`platform_2fa_challenge:${ip}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please wait 10 minutes." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { challengeToken, code, isRecoveryCode, trustDevice } = body;

    if (!challengeToken || typeof challengeToken !== "string") {
      return NextResponse.json({ error: "Missing or invalid challenge token" }, { status: 400 });
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Authentication code is required" }, { status: 400 });
    }

    const payload = await verifyPlatform2FAChallenge(challengeToken);
    if (!payload) {
      return NextResponse.json(
        { error: "Verification session has expired. Please sign in again." },
        { status: 401 }
      );
    }

    const platformUser = await prisma.platformUser.findUnique({
      where: { id: payload.platformUserId },
      include: {
        twoFactorAuth: true,
      },
    });

    if (!platformUser || platformUser.tokenVersion !== payload.tokenVersion) {
      return NextResponse.json({ error: "Invalid session. Please sign in again." }, { status: 401 });
    }

    // Case A: Recovery Code
    if (isRecoveryCode) {
      const unusedCodes = await prisma.platformTwoFactorRecoveryCode.findMany({
        where: {
          platformUserId: platformUser.id,
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
          { error: "Invalid or previously used recovery code." },
          { status: 400 }
        );
      }

      await prisma.platformTwoFactorRecoveryCode.update({
        where: { id: matchedCodeId },
        data: { usedAt: new Date() },
      });

      await setPlatformSession({
        userId: platformUser.id,
        email: platformUser.email,
        name: platformUser.name,
        role: "PLATFORM_ADMIN",
        tokenVersion: platformUser.tokenVersion,
      });

      await trackPlatformSession(platformUser.id, req.headers);

      if (trustDevice) {
        await createPlatformTrustedDevice(platformUser.id, req.headers, 30);
      }

      return NextResponse.json({
        success: true,
        user: { name: platformUser.name, email: platformUser.email },
        usedRecoveryCode: true,
      });
    }

    // Case B: TOTP 6-digit Code
    if (!platformUser.twoFactorAuth || !platformUser.twoFactorAuth.enabled || !platformUser.twoFactorAuth.secretEncrypted) {
      return NextResponse.json({ error: "Two-factor authentication is not configured" }, { status: 400 });
    }

    let secret: string;
    try {
      secret = decryptTotpSecret(platformUser.twoFactorAuth.secretEncrypted);
    } catch (e) {
      return NextResponse.json({ error: "Security credential error" }, { status: 500 });
    }

    const isValid = await verifyTotpCode(secret, code);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid 6-digit code. Please check your authenticator app and try again." },
        { status: 400 }
      );
    }

    await setPlatformSession({
      userId: platformUser.id,
      email: platformUser.email,
      name: platformUser.name,
      role: "PLATFORM_ADMIN",
      tokenVersion: platformUser.tokenVersion,
    });

    await trackPlatformSession(platformUser.id, req.headers);

    if (trustDevice) {
      await createPlatformTrustedDevice(platformUser.id, req.headers, 30);
    }

    return NextResponse.json({
      success: true,
      user: { name: platformUser.name, email: platformUser.email },
    });
  } catch (error: any) {
    console.error("Platform 2FA Challenge Error:", error);
    return NextResponse.json({ error: "Failed to verify challenge" }, { status: 500 });
  }
}
