import { NextRequest, NextResponse } from "next/server";
import { getPlatformSession } from "@/core/auth/session";
import { prisma } from "@/core/database/client";
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
    const session = await getPlatformSession();
    if (!session?.userId || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Authentication code is required" }, { status: 400 });
    }

    const twoFactor = await prisma.platformTwoFactorAuth.findUnique({
      where: { platformUserId: session.userId },
    });

    if (!twoFactor || !twoFactor.secretEncrypted) {
      return NextResponse.json(
        { error: "Two-factor authentication has not been initialized. Please start setup again." },
        { status: 400 }
      );
    }

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

    const plainRecoveryCodes = generateRecoveryCodes(8);

    await prisma.$transaction(async (tx) => {
      await tx.platformTwoFactorAuth.update({
        where: { platformUserId: session.userId },
        data: {
          enabled: true,
          verifiedAt: new Date(),
        },
      });

      await tx.platformTwoFactorRecoveryCode.deleteMany({
        where: { platformUserId: session.userId },
      });

      for (const code of plainRecoveryCodes) {
        await tx.platformTwoFactorRecoveryCode.create({
          data: {
            platformTwoFactorId: twoFactor.id,
            platformUserId: session.userId,
            codeHash: hashRecoveryCode(code),
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication successfully enabled for Super Admin account",
      recoveryCodes: plainRecoveryCodes,
    });
  } catch (error: any) {
    console.error("Platform 2FA Verify API Error:", error);
    return NextResponse.json({ error: "Failed to verify authentication code" }, { status: 500 });
  }
}
