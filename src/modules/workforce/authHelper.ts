import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export interface WorkforceActorContext {
  userId: string;
  userEmail: string;
  restaurantId: string;
  membershipId: string;
  employeeId: string | null;
  isAdmin: boolean;
  canViewWorkforce: boolean;
  canManageWorkforce: boolean;
  canViewSensitive: boolean;
  canViewPayroll: boolean;
  canViewRoster: boolean;
  accessibleOutletIds: string[] | null; // null = unrestricted (all outlets)
}

const ADMIN_ROLE_NAMES = [
  "Restaurant Owner",
  "Admin",
  "Owner",
  "Super Admin",
  "General Manager",
];

export async function getWorkforceActorContext(options?: {
  requireManage?: boolean;
  allowRosterAccess?: boolean;
  outletId?: string;
}): Promise<
  | { ok: true; ctx: WorkforceActorContext }
  | { ok: false; status: number; error: string }
> {
  const session = await getTenantSession();
  if (!session || !session.activeRestaurantId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const restaurantId = session.activeRestaurantId;

  // Verify base membership / tokenVersion via verifyAccess
  const baseCheck = await verifyAccess(
    session.userId,
    restaurantId,
    options?.outletId ? { outletId: options.outletId } : {},
    session.tokenVersion
  );
  if (!baseCheck.authorized) {
    return {
      ok: false,
      status: baseCheck.status,
      error: baseCheck.error || "Forbidden",
    };
  }

  const membership = await prisma.restaurantMembership.findUnique({
    where: {
      restaurantId_userId: {
        restaurantId,
        userId: session.userId,
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          archivedAt: true,
        },
      },
      accessGrants: {
        where: { status: "ACTIVE" },
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return { ok: false, status: 403, error: "Membership is not active" };
  }

  const isAdmin =
    session.role === "PLATFORM_ADMIN" ||
    membership.accessGrants.some((g) =>
      ADMIN_ROLE_NAMES.includes(g.role?.name || "")
    ) ||
    (!membership.employeeId && membership.accessGrants.length === 0);

  let canViewWorkforce = isAdmin;
  let canManageWorkforce = isAdmin;
  let canViewSensitive = isAdmin;
  let canViewPayroll = isAdmin;
  let canViewRoster = isAdmin;
  let accessibleOutletIds: string[] | null = isAdmin ? null : [];

  if (!isAdmin) {
    const outletSet = new Set<string>();
    let hasGlobalGrant = false;

    const relevantGrants = membership.accessGrants.filter(
      (g) =>
        g.moduleId === "workforce" ||
        g.moduleId === "hr_onboarding" ||
        g.moduleId === "shifts" ||
        g.moduleId === "shift_management" ||
        g.moduleId === "payroll"
    );

    for (const grant of relevantGrants) {
      const permIds = grant.role.permissions.map((p) => p.permissionId);

      const isWorkforceGrant =
        grant.moduleId === "workforce" || grant.moduleId === "hr_onboarding";
      const isShiftGrant =
        grant.moduleId === "shifts" || grant.moduleId === "shift_management";
      const isPayrollGrant = grant.moduleId === "payroll";

      if (
        isWorkforceGrant &&
        (permIds.includes("workforce:view") ||
          permIds.includes("hr:view_employees") ||
          permIds.includes("workforce:manage") ||
          permIds.includes("hr:manage_onboarding"))
      ) {
        canViewWorkforce = true;
      }

      if (
        isWorkforceGrant &&
        (permIds.includes("workforce:manage") ||
          permIds.includes("hr:manage_onboarding"))
      ) {
        canManageWorkforce = true;
      }

      if (
        isWorkforceGrant &&
        (permIds.includes("workforce:manage") ||
          permIds.includes("hr:approve_onboarding"))
      ) {
        canViewSensitive = true;
      }

      if (
        isPayrollGrant &&
        (permIds.includes("payroll:view_payroll") ||
          permIds.includes("payroll:run_payroll") ||
          permIds.includes("payroll:approve_payroll"))
      ) {
        canViewPayroll = true;
      }

      if (
        isShiftGrant &&
        (permIds.includes("shifts:view_roster") ||
          permIds.includes("shifts:manage_roster"))
      ) {
        canViewRoster = true;
      }

      // Outlet scoping comes from workforce/hr/shift grants
      if (isWorkforceGrant || (options?.allowRosterAccess && isShiftGrant)) {
        if (!grant.outletId) {
          hasGlobalGrant = true;
        } else {
          outletSet.add(grant.outletId);
        }
      }
    }

    if (hasGlobalGrant) {
      accessibleOutletIds = null;
    } else {
      accessibleOutletIds = Array.from(outletSet);
    }
  }

  if (options?.requireManage && !canManageWorkforce) {
    return {
      ok: false,
      status: 403,
      error: "Missing workforce management permission",
    };
  }

  if (options?.allowRosterAccess) {
    if (!canViewWorkforce && !canViewRoster) {
      return {
        ok: false,
        status: 403,
        error: "Missing workforce or shift roster permission",
      };
    }
  } else if (!canViewWorkforce) {
    return {
      ok: false,
      status: 403,
      error: "Missing workforce view permission",
    };
  }

  if (
    options?.outletId &&
    accessibleOutletIds !== null &&
    !accessibleOutletIds.includes(options.outletId)
  ) {
    return {
      ok: false,
      status: 403,
      error: "Outlet is outside your authorized scope",
    };
  }

  const activeEmployeeId =
    membership.employee && !membership.employee.archivedAt
      ? membership.employee.id
      : null;

  return {
    ok: true,
    ctx: {
      userId: session.userId,
      userEmail: session.email || "system@restobird.com",
      restaurantId,
      membershipId: membership.id,
      employeeId: activeEmployeeId,
      isAdmin,
      canViewWorkforce,
      canManageWorkforce,
      canViewSensitive,
      canViewPayroll,
      canViewRoster,
      accessibleOutletIds,
    },
  };
}
