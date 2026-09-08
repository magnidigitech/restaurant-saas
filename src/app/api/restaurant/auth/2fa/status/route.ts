import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";

export async function GET(_req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId: session.userId },
      include: {
        _count: {
          select: {
            recoveryCodes: {
              where: { usedAt: null },
            },
          },
        },
      },
    });

    return NextResponse.json({
      enabled: Boolean(twoFactor?.enabled),
      verifiedAt: twoFactor?.verifiedAt || null,
      remainingRecoveryCodes: twoFactor?._count.recoveryCodes || 0,
    });
  } catch (error: any) {
    console.error("2FA Status API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
