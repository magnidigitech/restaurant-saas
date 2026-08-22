import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";
import { logAudit } from "@/core/audit/logger";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "node:crypto";

const createRestaurantSchema = z.object({
  name: z.string().min(2),
  subdomain: z.string().min(2).regex(/^[a-z0-9-]+$/),
  subscriptionPlanId: z.string().min(1),
  enabledModules: z.array(z.string()),
  maxOutlets: z.number().int().min(1),
  maxEmployees: z.number().int().min(1),
  maxAdminUsers: z.number().int().min(1),
  storageQuotaGb: z.number().int().min(1),
  primaryAdminName: z.string().min(2),
  primaryAdminEmail: z.string().email(),
});

// GET /api/platform-admin/restaurants - List all restaurants
export async function GET(req: NextRequest) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurants = await prisma.restaurant.findMany({
      include: {
        branding: true,
        subscriptions: {
          include: {
            plan: true,
          },
        },
        modules: {
          include: {
            module: true,
          },
        },
        memberships: {
          include: {
            user: {
              select: { id: true, email: true, name: true, createdAt: true, tokenVersion: true },
            },
          },
        },
        invitations: {
          select: { id: true, email: true, status: true, expiresAt: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            outlets: true,
            employees: true,
            memberships: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ restaurants });
  } catch (error: any) {
    console.error("List Restaurants Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/platform-admin/restaurants - Onboard new restaurant
export async function POST(req: NextRequest) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = createRestaurantSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    // Check if subdomain is already taken
    const existing = await prisma.restaurant.findUnique({
      where: { subdomain: data.subdomain },
    });
    if (existing) {
      return NextResponse.json({ error: "Subdomain is already taken" }, { status: 400 });
    }

    // Check if email already registered globally (we can check or just create a user)
    let user = await prisma.user.findUnique({
      where: { email: data.primaryAdminEmail },
    });

    // Run creation inside a single Postgres transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Create Restaurant
      const restaurant = await tx.restaurant.create({
        data: {
          name: data.name,
          subdomain: data.subdomain,
          status: "ACTIVE",
        },
      });

      // 2. Create Branding
      await tx.restaurantBranding.create({
        data: {
          restaurantId: restaurant.id,
          applicationName: data.name,
        },
      });

      // 3. Create Subscription
      await tx.restaurantSubscription.create({
        data: {
          restaurantId: restaurant.id,
          planId: data.subscriptionPlanId,
          status: "ACTIVE",
          billingPeriod: "MONTHLY",
          startDate: new Date(),
        },
      });

      // 4. Create RestaurantModules
      const dbModules = await tx.module.findMany({ select: { id: true } });
      const validModuleIds = new Set(dbModules.map((m) => m.id));
      const validEnabledModules = Array.from(
        new Set((data.enabledModules || []).filter((mKey) => validModuleIds.has(mKey)))
      );

      for (const moduleKey of validEnabledModules) {
        await tx.restaurantModule.create({
          data: {
            restaurantId: restaurant.id,
            moduleId: moduleKey,
            status: "ACTIVE",
            enabledBy: session.userId,
          },
        });
      }

      // 5. Upsert User (in case email is already registered)
      if (!user) {
        user = await tx.user.create({
          data: {
            email: data.primaryAdminEmail,
            name: data.primaryAdminName,
            passwordHash: "$2a$10$PlaceholderPasswordHashWillBeUpdatedOnActivation123456", // placeholder
          },
        });
      }

      // 6. Create Membership
      const membership = await tx.restaurantMembership.create({
        data: {
          restaurantId: restaurant.id,
          userId: user.id,
          status: "PENDING_INVITE",
        },
      });

      // 7. Create Restaurant Owner Role
      const role = await tx.role.create({
        data: {
          restaurantId: restaurant.id,
          name: "Restaurant Owner",
          description: "Owner role with full operational privileges over enabled modules.",
        },
      });

      // Fetch all permissions for enabled modules
      const permissions = await tx.permission.findMany({
        where: {
          moduleId: {
            in: validEnabledModules,
          },
        },
      });

      // Link all permissions to the Restaurant Owner role
      for (const perm of permissions) {
        await tx.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }

      // 8. Grant access to all enabled modules for the owner
      for (const moduleKey of validEnabledModules) {
        await tx.accessGrant.create({
          data: {
            restaurantId: restaurant.id,
            membershipId: membership.id,
            moduleId: moduleKey,
            roleId: role.id,
            status: "ACTIVE",
          },
        });
      }

      // 9. Generate StaffInvitation
      const inviteToken = uuidv4();
      const inviteTokenHash = createHash("sha256")
        .update(inviteToken)
        .digest("hex");

      const invitation = await tx.staffInvitation.create({
        data: {
          restaurantId: restaurant.id,
          email: data.primaryAdminEmail,
          roleId: role.id,
          tokenHash: inviteTokenHash,
          status: "SENT",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
        },
      });

      // 10. Write Audit Log
      await tx.auditLog.create({
        data: {
          restaurantId: restaurant.id,
          userId: session.userId,
          userEmail: session.email,
          action: "RESTAURANT_CREATED",
          entityType: "Restaurant",
          entityId: restaurant.id,
          newValues: JSON.stringify({
            name: restaurant.name,
            subdomain: restaurant.subdomain,
            plan: data.subscriptionPlanId,
            modules: data.enabledModules,
          }),
        },
      });

      return { restaurant, invitation, inviteToken };
    });

    return NextResponse.json({
      success: true,
      restaurant: transaction.restaurant,
      restaurantId: transaction.restaurant.id,
      subdomain: transaction.restaurant.subdomain,
      invitationToken: transaction.inviteToken,
      activationUrl: `/activate?token=${transaction.inviteToken}&subdomain=${transaction.restaurant.subdomain}`,
    });
  } catch (error: any) {
    console.error("Create Restaurant Error:", error);
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
  }
}
