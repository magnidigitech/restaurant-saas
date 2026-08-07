import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import * as bcrypt from "bcryptjs";
import { z } from "zod";
import { createHash } from "node:crypto";

const activateSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = activateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { token, name, password } = result.data;

    // Hash the token
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    // Resolve invitation using tokenHash
    const invitation = await prisma.staffInvitation.findUnique({
      where: { tokenHash },
      include: {
        restaurant: true,
      },
    });

    if (!invitation || invitation.status !== "SENT") {
      return NextResponse.json({ error: "Invalid or already accepted invitation token" }, { status: 400 });
    }

    if (new Date() > invitation.expiresAt) {
      // Mark as expired
      await prisma.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Invitation token has expired" }, { status: 400 });
    }

    // Run activation in transaction
    await prisma.$transaction(async (tx) => {
      // Update invitation state
      await tx.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Find or create User
      let user = await tx.user.findUnique({
        where: { email: invitation.email },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: invitation.email,
            name,
            passwordHash,
          },
        });
      } else {
        await tx.user.update({
          where: { id: user.id },
          data: {
            name,
            passwordHash,
          },
        });
      }

      // Find or create RestaurantMembership
      let membership = await tx.restaurantMembership.findUnique({
        where: {
          restaurantId_userId: {
            restaurantId: invitation.restaurantId,
            userId: user.id,
          },
        },
      });

      if (!membership) {
        membership = await tx.restaurantMembership.create({
          data: {
            restaurantId: invitation.restaurantId,
            userId: user.id,
            status: "ACTIVE",
          },
        });
      } else {
        await tx.restaurantMembership.update({
          where: { id: membership.id },
          data: { status: "ACTIVE" },
        });
      }

      // Assign AccessGrants if invitation specified a role
      if (invitation.roleId) {
        const rolePermissions = await tx.rolePermission.findMany({
          where: { roleId: invitation.roleId },
          include: { permission: true },
        });

        const moduleIds = [...new Set(rolePermissions.map((rp) => rp.permission.moduleId))];

        for (const moduleId of moduleIds) {
          const existingGrant = await tx.accessGrant.findFirst({
            where: {
              restaurantId: invitation.restaurantId,
              membershipId: membership.id,
              moduleId,
              roleId: invitation.roleId,
            },
          });

          if (!existingGrant) {
            await tx.accessGrant.create({
              data: {
                restaurantId: invitation.restaurantId,
                membershipId: membership.id,
                moduleId,
                roleId: invitation.roleId,
                outletId: invitation.outletId || null,
                status: "ACTIVE",
              },
            });
          }
        }
      }

      // Audit entry
      await tx.auditLog.create({
        data: {
          restaurantId: invitation.restaurantId,
          userId: user.id,
          userEmail: user.email,
          action: "USER_ACTIVATED",
          entityType: "User",
          entityId: user.id,
          newValues: JSON.stringify({ email: user.email, status: "ACTIVE" }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Activation API Error:", error);
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
  }
}
