import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import * as bcrypt from "bcryptjs";
import { decryptTotpSecret, verifyTotpCode } from "@/core/auth/two-factor";

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { password, token } = body;

    if (!password && !token) {
      return NextResponse.json(
        { error: "Password or current authenticator code is required to disable 2FA" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { twoFactorAuth: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.twoFactorAuth?.enabled) {
      return NextResponse.json({ error: "Two-factor authentication is not currently active" }, { status: 400 });
    }

    let isAuthorized = false;

    // Check password if provided
    if (password) {
      isAuthorized = await bcrypt.compare(password, user.passwordHash);
    }

    // Or check TOTP token if provided
    if (!isAuthorized && token && user.twoFactorAuth.secretEncrypted) {
      try {
        const secret = decryptTotpSecret(user.twoFactorAuth.secretEncrypted);
        isAuthorized = await verifyTotpCode(secret, token);
      } catch (err) {
        // Ignore decipher error, isAuthorized remains false
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Invalid password or authentication code. Verification failed." },
        { status: 401 }
      );
    }

    // Disable 2FA in transaction
    await prisma.$transaction(async (tx) => {
      await tx.twoFactorAuth.update({
        where: { userId: session.userId },
        data: {
          enabled: false,
          verifiedAt: null,
          secretEncrypted: null,
        },
      });

      await tx.twoFactorRecoveryCode.deleteMany({
        where: { userId: session.userId },
      });

      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";
      await tx.auditLog.create({
        data: {
          restaurantId: session.activeRestaurantId || null,
          userId: session.userId,
          userEmail: session.email,
          action: "2FA_DISABLED",
          entityType: "UserTwoFactor",
          entityId: session.userId,
          ipAddress: ip,
          userAgent,
        },
      });
    });

    return NextResponse.json({ success: true, message: "Two-factor authentication has been disabled." });
  } catch (error: any) {
    console.error("2FA Disable API Error:", error);
    return NextResponse.json({ error: "Failed to disable two-factor authentication" }, { status: 500 });
  }
}
