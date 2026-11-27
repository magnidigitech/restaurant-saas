import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export interface OperationsActorContext {
  userId: string;
  userEmail: string;
  userName: string;
  restaurantId: string;
  membershipId: string;
  employeeId: string | null;
  isAdmin: boolean;
  canViewOperations: boolean;
  canManageOperations: boolean;
  canCompleteOwnChecklists: boolean;
  accessibleOutletIds: string[] | null;
}

const ADMIN_ROLE_NAMES = [
  "Restaurant Owner",
  "Admin",
  "Owner",
  "Super Admin",
  "General Manager",
];

export async function getOperationsActorContext(options?: {
  requireManage?: boolean;
  outletId?: string;
}): Promise<
  | { ok: true; ctx: OperationsActorContext }
  | { ok: false; status: number; error: string }
> {
  const session = await getTenantSession();
  if (!session || !session.activeRestaurantId) {
    return { ok: false, status: 401, error: "Unauthorized tenant session" };
  }

  const restaurantId = session.activeRestaurantId;
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
      restaurantId_userId: { restaurantId, userId: session.userId },
    },
    include: {
      user: { select: { name: true, email: true } },
      employee: {
        select: {
          id: true,
          archivedAt: true,
          firstName: true,
          lastName: true,
          outletAssignments: {
            select: { outletId: true },
          },
        },
      },
      accessGrants: {
        where: { status: "ACTIVE" },
        include: {
          role: { include: { permissions: true } },
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

  const activeEmployeeId =
    membership.employee && !membership.employee.archivedAt
      ? membership.employee.id
      : null;

  let canViewOperations = isAdmin;
  let canManageOperations = isAdmin;
  const canCompleteOwnChecklists = isAdmin || Boolean(activeEmployeeId);
  let accessibleOutletIds: string[] | null = isAdmin ? null : [];

  if (!isAdmin) {
    const outletSet = new Set<string>();
    let hasGlobalGrant = false;

    const relevantGrants = membership.accessGrants.filter(
      (g) => g.moduleId === "operations" || g.moduleId === "shifts"
    );

    for (const grant of relevantGrants) {
      const permIds = grant.role.permissions.map((p) => p.permissionId);
      if (permIds.includes("operations:view") || permIds.includes("shifts:view")) {
        canViewOperations = true;
      }
      if (permIds.includes("operations:manage") || permIds.includes("shifts:manage")) {
        canManageOperations = true;
        canViewOperations = true;
      }

      if (grant.moduleId === "operations" || grant.moduleId === "shifts") {
        if (!grant.outletId) {
          hasGlobalGrant = true;
        } else {
          outletSet.add(grant.outletId);
        }
      }
    }

    if (activeEmployeeId && membership.employee?.outletAssignments) {
      for (const oa of membership.employee.outletAssignments) {
        outletSet.add(oa.outletId);
      }
    }

    accessibleOutletIds = hasGlobalGrant ? null : Array.from(outletSet);
  }

  if (options?.requireManage && !canManageOperations) {
    return {
      ok: false,
      status: 403,
      error: "Missing operations management permission",
    };
  }

  if (!canViewOperations && !canManageOperations && !canCompleteOwnChecklists) {
    return {
      ok: false,
      status: 403,
      error: "Missing operations permission",
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

  const userName =
    membership.user?.name ||
    (membership.employee
      ? `${membership.employee.firstName} ${membership.employee.lastName}`.trim()
      : "") ||
    session.email ||
    "User";

  return {
    ok: true,
    ctx: {
      userId: session.userId,
      userEmail: membership.user?.email || session.email || "system@restobird.com",
      userName,
      restaurantId,
      membershipId: membership.id,
      employeeId: activeEmployeeId,
      isAdmin,
      canViewOperations,
      canManageOperations,
      canCompleteOwnChecklists,
      accessibleOutletIds,
    },
  };
}
