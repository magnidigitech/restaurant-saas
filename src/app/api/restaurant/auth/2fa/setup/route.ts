import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";
import {
  generateTotpSecret,
  generateTotpUri,
  generateQrCodeDataUrl,
  encryptTotpSecret,
  formatManualKey,
} from "@/core/auth/two-factor";

export async function POST(req: NextRequest) {
  try {
    await ensureTwoFactorTables();
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate new secret & URI
    const secret = generateTotpSecret();
    const uri = generateTotpUri(user.email, secret);
    const qrCode = await generateQrCodeDataUrl(uri);
    const manualKey = formatManualKey(secret);

    // Encrypt before database storage
    const encryptedSecret = encryptTotpSecret(secret);

    // Upsert unverified 2FA record
    await (prisma as any).twoFactorAuth.upsert({
      where: { userId: user.id },
      update: {
        secretEncrypted: encryptedSecret,
        enabled: false,
        verifiedAt: null,
      },
      create: {
        userId: user.id,
        secretEncrypted: encryptedSecret,
        enabled: false,
      },
    });

    // Audit log
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    await prisma.auditLog.create({
      data: {
        restaurantId: session.activeRestaurantId || null,
        userId: user.id,
        userEmail: user.email,
        action: "2FA_SETUP_STARTED",
        entityType: "UserTwoFactor",
        entityId: user.id,
        ipAddress: ip,
        userAgent,
      },
    });

    return NextResponse.json({
      qrCode,
      manualKey,
      secret, // For manual entry
      issuer: "Resto Bird",
    });
  } catch (error: any) {
    console.error("2FA Setup API Error:", error?.message || error);
    return NextResponse.json({ error: error?.message || "Failed to initialize 2FA setup" }, { status: 500 });
  }
}
