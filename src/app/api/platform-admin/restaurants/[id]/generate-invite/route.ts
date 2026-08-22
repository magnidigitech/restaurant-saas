import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "node:crypto";
import { z } from "zod";

const generateInviteSchema = z.object({
  email: z.string().email().optional(),
  roleId: z.string().uuid().optional(),
});

// POST /api/platform-admin/restaurants/[id]/generate-invite
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Platform Super Admin privileges required" }, { status: 401 });
    }

    const { id: restaurantId } = await props.params;

    const body = await req.json().catch(() => ({}));
    const result = generateInviteSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        roles: true,
        invitations: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        memberships: {
          include: { user: true },
          take: 1,
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    // Clean up input email
    let targetEmail = result.data.email?.trim();
    if (!targetEmail || targetEmail === "No admin user") {
      if (restaurant.invitations.length > 0 && restaurant.invitations[0].email) {
        targetEmail = restaurant.invitations[0].email;
      } else if (restaurant.memberships.length > 0 && restaurant.memberships[0].user?.email) {
        targetEmail = restaurant.memberships[0].user.email;
      } else {
        targetEmail = `admin@${restaurant.subdomain}.com`;
      }
    }

    let roleId = result.data.roleId;
    if (!roleId) {
      const ownerRole = restaurant.roles.find((r) => r.name.toLowerCase().includes("owner") || r.name.toLowerCase().includes("admin")) || restaurant.roles[0];
      if (!ownerRole) {
        // Create an owner role if none exists
        const newRole = await prisma.role.create({
          data: {
            restaurantId,
            name: "Restaurant Owner",
            description: "Full administrative access",
          },
        });
        roleId = newRole.id;
      } else {
        roleId = ownerRole.id;
      }
    }

    const newToken = uuidv4();
    const newTokenHash = createHash("sha256").update(newToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    // Upsert invitation
    const invitation = await prisma.staffInvitation.upsert({
      where: {
        restaurantId_email: {
          restaurantId,
          email: targetEmail,
        },
      },
      update: {
        tokenHash: newTokenHash,
        status: "SENT",
        expiresAt,
        roleId,
      },
      create: {
        restaurantId,
        email: targetEmail,
        tokenHash: newTokenHash,
        status: "SENT",
        expiresAt,
        roleId,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        restaurantId,
        userId: session.userId,
        userEmail: session.email,
        action: "INVITE_GENERATED",
        entityType: "StaffInvitation",
        entityId: invitation.id,
        newValues: JSON.stringify({
          email: targetEmail,
          expiresAt: expiresAt.toISOString(),
          generatedBy: session.email,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      token: newToken,
      email: targetEmail,
      subdomain: restaurant.subdomain,
      activationUrl: `/activate?token=${newToken}&subdomain=${restaurant.subdomain}`,
    });
  } catch (error: any) {
    console.error("Generate Invite Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
