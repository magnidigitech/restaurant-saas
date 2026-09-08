import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { revokeTrustedDevice } from "@/core/auth/trusted-devices";
import { logSecurityAudit } from "@/core/auth/security-audit";
import { prisma } from "@/core/database/client";

export async function GET() {
  try {
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const devices = await prisma.trustedDevice.findMany({
      where: {
        userId: session.userId,
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
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 });
    }

    const success = await revokeTrustedDevice(id, session.userId);
    if (!success) {
      return NextResponse.json({ error: "Device not found or not owned by user" }, { status: 404 });
    }

    await logSecurityAudit({
      organizationId: session.activeRestaurantId,
      userId: session.userId,
      userEmail: session.email,
      event: "TRUSTED_DEVICE_REVOKED",
      reqHeaders: req.headers,
      metadata: { deviceId: id },
    });

    return NextResponse.json({ success: true, message: "Device trust revoked" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to revoke device" }, { status: 500 });
  }
}
