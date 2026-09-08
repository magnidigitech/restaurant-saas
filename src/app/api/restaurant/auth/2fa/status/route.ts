import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";

export async function GET(_req: NextRequest) {
  try {
    await ensureTwoFactorTables();
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let twoFactor: any = null;
    try {
      if ((prisma as any).twoFactorAuth) {
        twoFactor = await (prisma as any).twoFactorAuth.findUnique({
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
      }
    } catch (dbErr: any) {
      console.warn("Could not query TwoFactorAuth in status route:", dbErr?.message);
    }

    return NextResponse.json({
      enabled: Boolean(twoFactor?.enabled),
      verifiedAt: twoFactor?.verifiedAt || null,
      remainingRecoveryCodes: twoFactor?._count?.recoveryCodes || 0,
    });
  } catch (error: any) {
    console.error("2FA Status API Error:", error?.message || error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
