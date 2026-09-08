import { NextRequest, NextResponse } from "next/server";
import { getPlatformSession } from "@/core/auth/session";
import { prisma } from "@/core/database/client";
import { getPlatformPasskeyRegistrationOptions, verifyPlatformPasskeyRegistrationResponse } from "@/core/auth/webauthn";

export async function GET() {
  try {
    const session = await getPlatformSession();
    if (!session?.userId || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const passkeys = await prisma.platformPasskey.findMany({
      where: {
        platformUserId: session.userId,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        deviceType: true,
        backedUp: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ passkeys });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to list platform passkeys" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getPlatformSession();
    if (!session?.userId || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Passkey ID is required" }, { status: 400 });
    }

    const passkey = await prisma.platformPasskey.findUnique({
      where: { id },
    });

    if (!passkey || passkey.platformUserId !== session.userId) {
      return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
    }

    await prisma.platformPasskey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: "Passkey removed" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to remove passkey" }, { status: 500 });
  }
}
