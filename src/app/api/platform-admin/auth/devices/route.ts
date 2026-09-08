import { NextRequest, NextResponse } from "next/server";
import { getPlatformSession } from "@/core/auth/session";
import { revokePlatformTrustedDevice } from "@/core/auth/trusted-devices";
import { prisma } from "@/core/database/client";

export async function GET() {
  try {
    const session = await getPlatformSession();
    if (!session?.userId || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const devices = await prisma.platformTrustedDevice.findMany({
      where: {
        platformUserId: session.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { lastUsedAt: "desc" },
    });

    return NextResponse.json({ devices });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to list trusted devices" }, { status: 500 });
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
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 });
    }

    const success = await revokePlatformTrustedDevice(id, session.userId);
    if (!success) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Device trust revoked" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to revoke device" }, { status: 500 });
  }
}
