import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";
import {
  decryptTotpSecret,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "@/core/auth/two-factor";

export async function POST(req: NextRequest) {
  try {
    await ensureTwoFactorTables();
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Authentication code is required" }, { status: 400 });
    }

    // Retrieve two factor auth record
    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId: session.userId },
    });

    if (!twoFactor || !twoFactor.secretEncrypted) {
      return NextResponse.json(
        { error: "Two-factor authentication has not been initialized. Please start setup again." },
        { status: 400 }
      );
    }

    // Decrypt and verify code
    let secret: string;
    try {
      secret = decryptTotpSecret(twoFactor.secretEncrypted);
    } catch (e) {
      return NextResponse.json({ error: "Failed to read security configuration" }, { status: 500 });
    }

    const isValid = await verifyTotpCode(secret, token);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid 6-digit code. Please verify the time on your device and enter the latest code." },
        { status: 400 }
      );
    }

    // Generate 8 recovery codes
    const plainRecoveryCodes = generateRecoveryCodes(8);

    // Transaction: enable 2FA and store hashed recovery codes
    await prisma.$transaction(async (tx) => {
      // 1. Update 2FA status
      await tx.twoFactorAuth.update({
        where: { userId: session.userId },
        data: {
          enabled: true,
          verifiedAt: new Date(),
        },
      });

      // 2. Remove any previous recovery codes for this user
      await tx.twoFactorRecoveryCode.deleteMany({
        where: { userId: session.userId },
      });

      // 3. Insert hashed recovery codes
      for (const code of plainRecoveryCodes) {
        await tx.twoFactorRecoveryCode.create({
          data: {
            twoFactorAuthId: twoFactor.id,
            userId: session.userId,
            codeHash: hashRecoveryCode(code),
          },
        });
      }

      // 4. Audit Log
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";
      await tx.auditLog.create({
        data: {
          restaurantId: session.activeRestaurantId || null,
          userId: session.userId,
          userEmail: session.email,
          action: "2FA_ENABLED",
          entityType: "UserTwoFactor",
          entityId: session.userId,
          ipAddress: ip,
          userAgent,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication successfully enabled",
      recoveryCodes: plainRecoveryCodes,
    });
  } catch (error: any) {
    console.error("2FA Verify API Error:", error);
    return NextResponse.json({ error: "Failed to verify authentication code" }, { status: 500 });
  }
}
