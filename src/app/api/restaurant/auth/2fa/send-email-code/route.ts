import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { isRateLimited } from "@/core/auth/rate-limiter";
import { verify2FAChallenge } from "@/core/auth/two-factor";
import { send2FAEmailCode } from "@/core/auth/two-factor-email";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    if (isRateLimited(`restaurant_2fa_send_email:${ip}`, 3, 2 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many email requests. Please wait 2 minutes before requesting another code." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { challengeToken } = body;

    if (!challengeToken || typeof challengeToken !== "string") {
      return NextResponse.json({ error: "Missing challenge token" }, { status: 400 });
    }

    const payload = await verify2FAChallenge(challengeToken);
    if (!payload) {
      return NextResponse.json(
        { error: "Verification session has expired. Please sign in again." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const key = `restaurant_2fa_email:${user.id}`;
    const mailRes = await send2FAEmailCode(user.email, user.name || user.email, key);

    if (!mailRes.success) {
      return NextResponse.json({ error: mailRes.error || "Failed to send email verification code" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${mailRes.destinationEmail}.`,
      destinationEmail: mailRes.destinationEmail,
    });
  } catch (error: any) {
    console.error("Send Restaurant 2FA Email Code Error:", error);
    return NextResponse.json({ error: "Failed to send verification code email" }, { status: 500 });
  }
}
