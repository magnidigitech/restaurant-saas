import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import * as bcrypt from "bcryptjs";
import { z } from "zod";
import { createHash } from "node:crypto";

const activateSchema = z.object({
  token: z.string().min(1),
  name: z.string().optional(),
  password: z.string().min(6),
});

// GET /api/restaurant/activate?token=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing invitation token" }, { status: 400 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invitation = await prisma.staffInvitation.findUnique({
      where: { tokenHash },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation link." }, { status: 404 });
    }

    if (invitation.status === "ACCEPTED") {
      return NextResponse.json(
        {
          error: "This invitation link has already been used and activated.",
          alreadyActivated: true,
          subdomain: invitation.restaurant.subdomain,
        },
        { status: 400 }
      );
    }

    if (invitation.status !== "SENT" || new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: "This invitation link has expired." }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      restaurantName: invitation.restaurant.name,
      subdomain: invitation.restaurant.subdomain,
    });
  } catch (err: any) {
    console.error("Error verifying invite token:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

      // Compute display name if not explicitly provided
      let resolvedName = name?.trim();
      if (!resolvedName) {
        if (user?.name) {
          resolvedName = user.name;
        } else {
          const rawPrefix = invitation.email.split("@")[0].replace(/[._-]/g, " ");
          resolvedName = rawPrefix
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        }
      }

      if (!user) {
        user = await tx.user.create({
          data: {
            email: invitation.email,
            name: resolvedName,
            passwordHash,
          },
        });
      } else {
        await tx.user.update({
          where: { id: user.id },
          data: {
            name: resolvedName,
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

      // Find matching employee profile by email in this restaurant if exists
      const matchingEmployee = await tx.employee.findFirst({
        where: {
          restaurantId: invitation.restaurantId,
          personalEmail: { equals: invitation.email, mode: "insensitive" },
          archivedAt: null,
        },
      });

      if (!membership) {
        membership = await tx.restaurantMembership.create({
          data: {
            restaurantId: invitation.restaurantId,
            userId: user.id,
            employeeId: matchingEmployee?.id || null,
            status: "ACTIVE",
          },
        });
      } else {
        await tx.restaurantMembership.update({
          where: { id: membership.id },
          data: {
            status: "ACTIVE",
            ...(matchingEmployee && !membership.employeeId ? { employeeId: matchingEmployee.id } : {}),
          },
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
