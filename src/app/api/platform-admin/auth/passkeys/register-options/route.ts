import { NextRequest, NextResponse } from "next/server";
import { getPlatformSession } from "@/core/auth/session";
import { getPlatformPasskeyRegistrationOptions } from "@/core/auth/webauthn";
import { prisma } from "@/core/database/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getPlatformSession();
    if (!session?.userId || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const platformUser = await prisma.platformUser.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true },
    });

    if (!platformUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const options = await getPlatformPasskeyRegistrationOptions(platformUser, req);
    return NextResponse.json(options);
  } catch (error: any) {
    console.error("Platform Passkey Register Options Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate passkey options" }, { status: 500 });
  }
}
