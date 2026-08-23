import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    let targetModuleIds: string[] = [];
    const UNIFIED_MODULE_MAP: Record<string, string[]> = {
      inventory: ["inventory", "vendor_management", "purchase_management"],
      attendance: ["attendance", "leave_management"],
      workforce: ["workforce", "hr_onboarding"],
      shifts: ["shifts", "shift_management"],
      payroll: ["payroll"],
      pos: ["pos"],
      finance: ["finance"],
      analytics: ["analytics"],
      vault: ["vault"],
      catering: ["catering"],
      operations: ["operations"],
      masterdata: ["masterdata"],
      rbac: ["rbac"],
    };

    const MODULE_META: Record<string, { name: string; desc: string }> = {
      inventory: { name: "Inventory & Stock Control", desc: "Track real-time stock levels, adjustments, recipes, and wastage." },
      vendor_management: { name: "Vendor Management", desc: "Manage raw material vendors and supplier lists." },
      purchase_management: { name: "Purchase Management", desc: "Generate and approve Purchase Orders for vendor shipments." },
      attendance: { name: "Attendance", desc: "Track employee check-in, clock-out details and kiosk punch PINs." },
      leave_management: { name: "Leave Management", desc: "Manage employee paid leaves, sick leaves and approvals." },
      workforce: { name: "Workforce & HR", desc: "Manage employee profiles, onboarding tasks and legal documents." },
      hr_onboarding: { name: "HR Onboarding", desc: "Manage employee profiles, onboarding tasks and legal documents." },
      shifts: { name: "Shift Management", desc: "Manage schedules, rosters, templates and swaps." },
      shift_management: { name: "Shift Management", desc: "Manage schedules, rosters, templates and swaps." },
      payroll: { name: "Payroll & Compensation", desc: "Process monthly salaries, calculate deductions, tip pools and generate payslips." },
      pos: { name: "Point of Sale (POS)", desc: "Digital table order taking, menu catalog, kitchen ticketing, and bill settlement." },
      finance: { name: "Finance & P&L Tracker", desc: "Automated expense aggregation from payroll & POs, revenue tracker, and upcoming bills reminder." },
      vault: { name: "Secrets Vault & 2FA", desc: "Enterprise zero-knowledge secret storage, password generator, 2FA TOTP authenticator." },
      analytics: { name: "Analytics & Menu Engineering", desc: "Menu engineering matrix, food cost variance and profitability reports." },
      catering: { name: "Catering & Event Management", desc: "Manage end-to-end catering events, menu packages, guest pax pricing." },
      operations: { name: "Operations & Checklists", desc: "Opening/closing checklists and SOP temp audits." },
      masterdata: { name: "Master Data Settings", desc: "Multi-outlet profiles and tax rates." },
      rbac: { name: "Role Based Access Controls", desc: "Security roles and permissions." },
    };

    if (UNIFIED_MODULE_MAP[moduleId]) {
      targetModuleIds = UNIFIED_MODULE_MAP[moduleId];
    } else {
      const matchedEntry = Object.values(UNIFIED_MODULE_MAP).find((subs) => subs.includes(moduleId));
      targetModuleIds = matchedEntry ? matchedEntry : [moduleId];
    }

    await prisma.$transaction(async (tx) => {
      for (const mId of targetModuleIds) {
        // Ensure base module entry exists in Module table
        await tx.module.upsert({
          where: { id: mId },
          update: {},
          create: {
            id: mId,
            name: MODULE_META[mId]?.name || mId.toUpperCase(),
            description: MODULE_META[mId]?.desc || `${mId} module`,
            status: "ACTIVE",
            availability: "GENERAL",
          },
        });

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
