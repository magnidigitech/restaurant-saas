import { NextRequest, NextResponse } from "next/server";
import { getPlatformSession } from "@/core/auth/session";
import { verifyPlatformPasskeyRegistrationResponse } from "@/core/auth/webauthn";

export async function POST(req: NextRequest) {
  try {
    const session = await getPlatformSession();
    if (!session?.userId || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { response, deviceName } = body;

    if (!response) {
      return NextResponse.json({ error: "Passkey response is required" }, { status: 400 });
    }

    const verification = await verifyPlatformPasskeyRegistrationResponse(
      session.userId,
      response,
      deviceName,
      req
    );

    return NextResponse.json({ success: true, verified: verification.verified });
  } catch (error: any) {
    console.error("Platform Passkey Register Verify Error:", error);
    return NextResponse.json({ error: error?.message || "Passkey registration failed" }, { status: 400 });
  }
}
