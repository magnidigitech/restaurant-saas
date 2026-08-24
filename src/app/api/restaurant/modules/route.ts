import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );

    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    // 1. Resolve membership for the user
    const membership = await prisma.restaurantMembership.findUnique({
      where: {
        restaurantId_userId: {
          restaurantId: session.activeRestaurantId,
          userId: session.userId,
        },
      },
      include: {
        accessGrants: {
          where: { status: "ACTIVE" },
          include: { role: true, module: true },
        },
      },
    });

    // Check if user has an Admin / Owner role
    const hasAdminRole =
      session.role === "PLATFORM_ADMIN" ||
      membership?.accessGrants.some((g) =>
        ["Restaurant Owner", "Admin", "Owner", "Super Admin", "General Manager"].includes(g.role?.name || "")
      );

    const totalGrants = membership?.accessGrants?.length || 0;

    // Retrieve modules enabled for this restaurant
    const tenantModules = await prisma.restaurantModule.findMany({
      where: {
        restaurantId: session.activeRestaurantId,
        status: "ACTIVE",
      },
      include: {
        module: true,
      },
    });

    let allowedModules = tenantModules;

    // If user has specific access grants and is NOT an admin/owner:
    if (!hasAdminRole && totalGrants > 0 && membership) {
      const allowedModuleIds = new Set<string>();
      for (const g of membership.accessGrants) {
        if (g.moduleId) {
          const modKey = g.moduleId.toLowerCase();
          allowedModuleIds.add(modKey);
          if (modKey === "shifts" || modKey === "shift_management") {
            allowedModuleIds.add("shifts");
            allowedModuleIds.add("shift_management");
          }
          if (modKey === "inventory") {
            allowedModuleIds.add("inventory");
            allowedModuleIds.add("vendor_management");
            allowedModuleIds.add("purchase_management");
          }
          if (modKey === "attendance" || modKey === "leave_management") {
            allowedModuleIds.add("attendance");
            allowedModuleIds.add("leave_management");
          }
          if (modKey === "workforce" || modKey === "hr_onboarding") {
            allowedModuleIds.add("workforce");
            allowedModuleIds.add("hr_onboarding");
          }
        }
      }

      allowedModules = tenantModules.filter((tm) =>
        allowedModuleIds.has(tm.module.id.toLowerCase())
      );
    } else if (!hasAdminRole && totalGrants === 0 && membership?.employeeId) {
      // Employee with no specific admin grants: only basic employee self-service modules
      const selfServiceKeys = new Set(["attendance", "shifts", "shift_management", "operations"]);
      allowedModules = tenantModules.filter((tm) =>
        selfServiceKeys.has(tm.module.id.toLowerCase())
      );
    }

    const isAdmin = hasAdminRole || (totalGrants === 0 && !membership?.employeeId);

    return NextResponse.json({
      isAdmin,
      role: membership?.accessGrants?.[0]?.role?.name || (isAdmin ? "Admin" : "Staff"),
      employeeId: membership?.employeeId || null,
      modules: allowedModules.map((tm) => ({
        key: tm.module.id,
        name: tm.module.name,
        description: tm.module.description,
        sortOrder: tm.module.sortOrder,
      })),
    });
  } catch (error: any) {
    console.error("List Tenant Modules Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
