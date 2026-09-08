import { NextRequest, NextResponse } from "next/server";
import { getPlatformSession } from "@/core/auth/session";
import { prisma } from "@/core/database/client";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";
import {
  generateTotpSecret,
  encryptTotpSecret,
  generateTotpUri,
  generateQrCodeDataUrl,
  formatManualKey,
} from "@/core/auth/two-factor";

export async function POST(req: NextRequest) {
  try {
    await ensureTwoFactorTables();
    const session = await getPlatformSession();
    if (!session?.userId || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const platformUser = await prisma.platformUser.findUnique({
      where: { id: session.userId },
    });

    if (!platformUser) {
      return NextResponse.json({ error: "Super Admin account not found" }, { status: 404 });
    }

    // Generate secret
    const secret = generateTotpSecret();
    const secretEncrypted = encryptTotpSecret(secret);

    await prisma.platformTwoFactorAuth.upsert({
      where: { platformUserId: platformUser.id },
      update: {
        secretEncrypted,
        enabled: false,
        verifiedAt: null,
      },
      create: {
        platformUserId: platformUser.id,
        secretEncrypted,
        enabled: false,
      },
    });

    const otpauthUrl = generateTotpUri(platformUser.email, secret);
    const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUrl);
    const manualKey = formatManualKey(secret);

    return NextResponse.json({
      success: true,
      qrCode: qrCodeDataUrl,
      manualKey,
      otpauthUrl,
    });
  } catch (error: any) {
    console.error("Platform 2FA Setup Error:", error);
    return NextResponse.json({ error: "Failed to initialize 2FA" }, { status: 500 });
  }
}
