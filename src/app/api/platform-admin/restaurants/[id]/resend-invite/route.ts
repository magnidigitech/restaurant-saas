import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "node:crypto";

// POST /api/platform-admin/restaurants/[id]/resend-invite
// Generates a fresh invitation token and returns the full activation URL
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        invitations: {
          where: { status: "SENT" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const newToken = uuidv4();
    const newTokenHash = createHash("sha256").update(newToken).digest("hex");

    if (restaurant.invitations.length > 0) {
      // Update the existing pending invitation with a fresh token
      await prisma.staffInvitation.update({
        where: { id: restaurant.invitations[0].id },
        data: {
          tokenHash: newTokenHash,
          status: "SENT",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
        },
      });
    } else {
      return NextResponse.json({ error: "No pending invitation found for this restaurant" }, { status: 404 });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        restaurantId: id,
        userId: session.userId,
        userEmail: session.email,
        action: "INVITE_RESENT",
        entityType: "StaffInvitation",
        entityId: restaurant.invitations[0].id,
        newValues: JSON.stringify({ email: restaurant.invitations[0].email }),
      },
    });

    return NextResponse.json({
      success: true,
      token: newToken,
      subdomain: restaurant.subdomain,
    });
  } catch (error: any) {
    console.error("Resend Invite Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
