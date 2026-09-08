import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { prisma } from "@/core/database/client";
import { logSecurityAudit } from "@/core/auth/security-audit";

export async function GET() {
  try {
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const passkeys = await prisma.passkey.findMany({
      where: {
        userId: session.userId,
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
    return NextResponse.json({ error: "Failed to list passkeys" }, { status: 500 });
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
      return NextResponse.json({ error: "Passkey ID is required" }, { status: 400 });
    }

    const passkey = await prisma.passkey.findUnique({
      where: { id },
    });

    if (!passkey || passkey.userId !== session.userId) {
      return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
    }

    await prisma.passkey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await logSecurityAudit({
      organizationId: session.activeRestaurantId,
      userId: session.userId,
      userEmail: session.email,
      event: "PASSKEY_REVOKED",
      reqHeaders: req.headers,
      metadata: { passkeyId: id, name: passkey.name },
    });

    return NextResponse.json({ success: true, message: "Passkey removed successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to remove passkey" }, { status: 500 });
  }
}
