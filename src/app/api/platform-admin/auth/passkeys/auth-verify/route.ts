import { NextRequest, NextResponse } from "next/server";
import { verifyPlatformPasskeyAuthResponse } from "@/core/auth/webauthn";
import { setPlatformSession } from "@/core/auth/session";
import { trackPlatformSession } from "@/core/auth/sessions";
import { createPlatformTrustedDevice } from "@/core/auth/trusted-devices";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { response, expectedChallenge, trustDevice } = body;

    if (!response || !expectedChallenge) {
      return NextResponse.json({ error: "Missing verification payload" }, { status: 400 });
    }

    const result = await verifyPlatformPasskeyAuthResponse(response, expectedChallenge, req);
    const { platformUser } = result;

    await setPlatformSession({
      userId: platformUser.id,
      email: platformUser.email,
      name: platformUser.name,
      role: "PLATFORM_ADMIN",
      tokenVersion: platformUser.tokenVersion,
    });

    await trackPlatformSession(platformUser.id, req.headers);

    if (trustDevice) {
      await createPlatformTrustedDevice(platformUser.id, req.headers, 30);
    }

    return NextResponse.json({
      success: true,
      user: { name: platformUser.name, email: platformUser.email },
    });
  } catch (error: any) {
    console.error("Platform Passkey Auth Verify Error:", error);
    return NextResponse.json({ error: error?.message || "Passkey authentication failed" }, { status: 401 });
  }
}
