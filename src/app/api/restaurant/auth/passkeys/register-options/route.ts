import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { getPasskeyRegistrationOptions } from "@/core/auth/webauthn";
import { prisma } from "@/core/database/client";

export async function POST(req: NextRequest) {
  try {
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

    const options = await getPasskeyRegistrationOptions(user, req);
    return NextResponse.json(options);
  } catch (error: any) {
    console.error("Passkey Register Options Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate passkey options" }, { status: 500 });
  }
}
