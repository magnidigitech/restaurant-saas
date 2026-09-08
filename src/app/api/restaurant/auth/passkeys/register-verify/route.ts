import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyPasskeyRegistrationResponse } from "@/core/auth/webauthn";
import { logSecurityAudit } from "@/core/auth/security-audit";

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { response, deviceName } = body;

    if (!response) {
      return NextResponse.json({ error: "Passkey response is required" }, { status: 400 });
    }

    const verification = await verifyPasskeyRegistrationResponse(
      session.userId,
      session.activeRestaurantId || "",
      response,
      deviceName,
      req
    );

    await logSecurityAudit({
      organizationId: session.activeRestaurantId,
      userId: session.userId,
      userEmail: session.email,
      event: "PASSKEY_REGISTERED",
      reqHeaders: req.headers,
      metadata: { deviceName: deviceName || "Passkey Device" },
    });

    return NextResponse.json({ success: true, verified: verification.verified });
  } catch (error: any) {
    console.error("Passkey Register Verify Error:", error);
    return NextResponse.json({ error: error?.message || "Passkey registration failed" }, { status: 400 });
  }
}
