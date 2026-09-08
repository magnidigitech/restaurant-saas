import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { setPlatformSession } from "@/core/auth/session";
import { isRateLimited } from "@/core/auth/rate-limiter";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";
import { isPlatformDeviceTrusted } from "@/core/auth/trusted-devices";
import { trackPlatformSession } from "@/core/auth/sessions";
import { signPlatform2FAChallenge } from "@/core/auth/two-factor";
import * as bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    await ensureTwoFactorTables();

    // Rate Limiting
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    if (isRateLimited(`platform_login:${ip}`, 10, 5 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many login attempts. Please wait a few minutes." }, { status: 429 });
    }

    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { email, password } = result.data;

    // Find Platform User
    const platformUser = await prisma.platformUser.findUnique({
      where: { email },
      include: {
        twoFactorAuth: true,
        passkeys: {
          where: { revokedAt: null },
        },
      },
    });

    if (!platformUser) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, platformUser.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const hasTotp = !!platformUser.twoFactorAuth?.enabled;
    const hasPasskeys = platformUser.passkeys.length > 0;
    const mfaActive = hasTotp || hasPasskeys;

    // Check if current device has an active 30-day trust
    const isTrusted = await isPlatformDeviceTrusted(platformUser.id);

    if (mfaActive && !isTrusted) {
      const challengeToken = await signPlatform2FAChallenge({
        platformUserId: platformUser.id,
        email: platformUser.email,
        name: platformUser.name,
        tokenVersion: platformUser.tokenVersion,
      });

      return NextResponse.json({
        requiresTwoFactor: true,
        challengeToken,
        hasPasskeys,
        hasTotp,
        user: { name: platformUser.name, email: platformUser.email },
      });
    }

    // Set Platform Admin session cookie
    await setPlatformSession({
      userId: platformUser.id,
      email: platformUser.email,
      name: platformUser.name,
      role: "PLATFORM_ADMIN",
      tokenVersion: platformUser.tokenVersion,
    });

    // Track active Platform Session
    await trackPlatformSession(platformUser.id, req.headers);

    return NextResponse.json({
      success: true,
      user: { name: platformUser.name, email: platformUser.email },
    });
  } catch (error: any) {
    console.error("Platform Login API Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
