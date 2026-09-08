import { NextResponse } from "next/server";
import { getPlatformSession } from "@/core/auth/session";
import { prisma } from "@/core/database/client";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";

export async function GET() {
  try {
    await ensureTwoFactorTables();
    const session = await getPlatformSession();
    if (!session?.userId || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const twoFactor = await prisma.platformTwoFactorAuth.findUnique({
      where: { platformUserId: session.userId },
    });

    const unusedCodesCount = await prisma.platformTwoFactorRecoveryCode.count({
      where: {
        platformUserId: session.userId,
        usedAt: null,
      },
    });

    const passkeysCount = await prisma.platformPasskey.count({
      where: {
        platformUserId: session.userId,
        revokedAt: null,
      },
    });

    const trustedDevicesCount = await prisma.platformTrustedDevice.count({
      where: {
        platformUserId: session.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    const activeSessionsCount = await prisma.platformUserSession.count({
      where: {
        platformUserId: session.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    return NextResponse.json({
      enabled: !!twoFactor?.enabled,
      verifiedAt: twoFactor?.verifiedAt || null,
      remainingRecoveryCodes: unusedCodesCount,
      passkeysCount,
      trustedDevicesCount,
      activeSessionsCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to get platform security status" }, { status: 500 });
  }
}
