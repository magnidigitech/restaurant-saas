import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";
import { z } from "zod";

const moduleStatusSchema = z.object({
  moduleId: z.string().min(1),
  enabled: z.boolean(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: restaurantId } = await params;
    const body = await req.json();
    const result = moduleStatusSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { moduleId, enabled } = result.data;

    // Check if restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      if (enabled) {
        // Enable module
        await tx.restaurantModule.upsert({
          where: {
            restaurantId_moduleId: {
              restaurantId,
              moduleId,
            },
          },
          update: {
            status: "ACTIVE",
          },
          create: {
            restaurantId,
            moduleId,
            status: "ACTIVE",
            enabledBy: session.userId,
          },
        });

        // Query default Restaurant Owner role for this tenant
        const ownerRole = await tx.role.findFirst({
          where: {
            restaurantId,
            name: "Restaurant Owner",
          },
        });

        if (ownerRole) {
          // Fetch permissions for this module
          const permissions = await tx.permission.findMany({
            where: { moduleId },
          });

          // Link all permissions to the owner role
          for (const perm of permissions) {
            await tx.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: ownerRole.id,
                  permissionId: perm.id,
                },
              },
              update: {},
              create: {
                roleId: ownerRole.id,
                permissionId: perm.id,
              },
            });
          }

          // Link access grant for owner membership to this module
          const memberships = await tx.restaurantMembership.findMany({
            where: {
              restaurantId,
              accessGrants: {
                some: {
                  roleId: ownerRole.id,
                },
              },
            },
          });

          for (const mem of memberships) {
            // Find existing grant or create a new active one
            const existingGrant = await tx.accessGrant.findFirst({
              where: {
                membershipId: mem.id,
                moduleId,
              },
            });

            if (existingGrant) {
              await tx.accessGrant.update({
                where: { id: existingGrant.id },
                data: { status: "ACTIVE" },
              });
            } else {
              await tx.accessGrant.create({
                data: {
                  restaurantId,
                  membershipId: mem.id,
                  moduleId,
                  roleId: ownerRole.id,
                  status: "ACTIVE",
                },
              });
            }
          }
        }
      } else {
        // Disable module
        await tx.restaurantModule.update({
          where: {
            restaurantId_moduleId: {
              restaurantId,
              moduleId,
            },
          },
          data: {
            status: "INACTIVE",
          },
        });

        // Set access grants to revoked
        await tx.accessGrant.updateMany({
          where: {
            restaurantId,
            moduleId,
          },
          data: {
            status: "REVOKED",
          },
        });
      }

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          restaurantId,
          userId: session.userId,
          userEmail: session.email,
          action: enabled ? "MODULE_ENABLED" : "MODULE_DISABLED",
          entityType: "RestaurantModule",
          entityId: moduleId,
          newValues: JSON.stringify({ moduleId, enabled }),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Modify Restaurant Module Error:", error);
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
  }
}
