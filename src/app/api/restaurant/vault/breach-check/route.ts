import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { checkPasswordBreach } from "@/core/vault/breachScanner";

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { password } = await req.json();
    if (!password) {
      return NextResponse.json({ isBreached: false, breachCount: 0 });
    }

    const result = await checkPasswordBreach(password);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Breach Check Error:", error);
    return NextResponse.json({ isBreached: false, breachCount: 0 });
  }
}
