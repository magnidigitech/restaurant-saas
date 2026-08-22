import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";
import { z } from "zod";

const moduleStatusSchema = z.object({
  moduleId: z.string().min(1),
  enabled: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Platform Super Admin required" }, { status: 401 });
    }

    const { id: restaurantId } = await props.params;
    const body = await req.json().catch(() => ({}));
    const result = moduleStatusSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const moduleId = result.data.moduleId;
    const isEnabled =
      result.data.enabled !== undefined
        ? result.data.enabled
        : result.data.status === "ACTIVE";

    // Check if restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    let targetModuleIds: string[] = [moduleId];
    if (moduleId === "shifts" || moduleId === "shift_management") {
      targetModuleIds = ["shifts", "shift_management"];
    } else if (moduleId === "inventory" || moduleId === "vendor_management" || moduleId === "purchase_management") {
      targetModuleIds = ["inventory", "vendor_management", "purchase_management"];
    } else if (moduleId === "attendance" || moduleId === "leave_management") {
      targetModuleIds = ["attendance", "leave_management"];
    } else if (moduleId === "workforce" || moduleId === "hr_onboarding") {
      targetModuleIds = ["workforce", "hr_onboarding"];
    }

    await prisma.$transaction(async (tx) => {
      const dbModules = await tx.module.findMany({ select: { id: true } });
      const validModuleSet = new Set(dbModules.map((m) => m.id));
      const validTargetModuleIds = targetModuleIds.filter((mId) => validModuleSet.has(mId));

      for (const mId of validTargetModuleIds) {
        if (isEnabled) {
          // Enable module
          await tx.restaurantModule.upsert({
            where: {
              restaurantId_moduleId: {
                restaurantId,
                moduleId: mId,
              },
            },
            update: {
              status: "ACTIVE",
            },
            create: {
              restaurantId,
              moduleId: mId,
              status: "ACTIVE",
              enabledBy: session.userId,
            },
          });

          // Query default Restaurant Owner or any role for this tenant
          let ownerRole = await tx.role.findFirst({
            where: {
              restaurantId,
              name: "Restaurant Owner",
            },
          });

          if (!ownerRole) {
            ownerRole = await tx.role.findFirst({
              where: { restaurantId },
            });
          }

          if (!ownerRole) {
            ownerRole = await tx.role.create({
              data: {
                restaurantId,
                name: "Restaurant Owner",
                description: "Primary Restaurant Owner Role",
              },
            });
          }

          if (ownerRole) {
            // Fetch permissions for this module
            const permissions = await tx.permission.findMany({
              where: { moduleId: mId },
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
              },
            });

            for (const mem of memberships) {
              const existingGrant = await tx.accessGrant.findFirst({
                where: {
                  membershipId: mem.id,
                  moduleId: mId,
                },
              });

              if (existingGrant) {
                await tx.accessGrant.update({
                  where: { id: existingGrant.id },
                  data: { status: "ACTIVE", roleId: ownerRole.id },
                });
              } else {
                await tx.accessGrant.create({
                  data: {
                    restaurantId,
                    membershipId: mem.id,
                    moduleId: mId,
                    roleId: ownerRole.id,
                    status: "ACTIVE",
                  },
                });
              }
            }
          }
        } else {
          // Deactivate module
          await tx.restaurantModule.upsert({
            where: {
              restaurantId_moduleId: {
                restaurantId,
                moduleId: mId,
              },
            },
            update: {
              status: "INACTIVE",
            },
            create: {
              restaurantId,
              moduleId: mId,
              status: "INACTIVE",
              enabledBy: session.userId,
            },
          });

          await tx.accessGrant.updateMany({
            where: {
              membership: { restaurantId },
              moduleId: mId,
            },
            data: {
              status: "REVOKED",
            },
          });
        }
      }

      // Write Audit Log
      await tx.auditLog.create({
        data: {
          restaurantId,
          userId: session.userId,
          userEmail: session.email,
          action: isEnabled ? "MODULE_ENABLED" : "MODULE_DISABLED",
          entityType: "RestaurantModule",
          entityId: moduleId,
          newValues: JSON.stringify({ moduleId, enabled: isEnabled }),
        },
      });
    });

    return NextResponse.json({ success: true, enabled: isEnabled });
  } catch (error: any) {
    console.error("Modify Restaurant Module Error:", error);
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
  }
}
