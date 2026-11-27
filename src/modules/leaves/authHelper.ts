import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export interface LeaveActorContext {
  userId: string;
  userEmail: string;
  restaurantId: string;
  membershipId: string;
  employeeId: string | null;
  isAdmin: boolean;
  canViewLeaves: boolean;
  canRequestLeave: boolean;
  canApproveLeaves: boolean;
  accessibleOutletIds: string[] | null;
}

const ADMIN_ROLE_NAMES = [
  "Restaurant Owner",
  "Admin",
  "Owner",
  "Super Admin",
  "General Manager",
];

export async function getLeaveActorContext(options?: {
  requireApprove?: boolean;
  outletId?: string;
}): Promise<
  | { ok: true; ctx: LeaveActorContext }
  | { ok: false; status: number; error: string }
> {
  const session = await getTenantSession();
  if (!session || !session.activeRestaurantId) {
    return { ok: false, status: 401, error: "Unauthorized" };
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
      employee: { select: { id: true, archivedAt: true } },
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

  let canViewLeaves = isAdmin;
  let canRequestLeave = isAdmin || Boolean(membership.employeeId);
  let canApproveLeaves = isAdmin;
  let accessibleOutletIds: string[] | null = isAdmin ? null : [];

  if (!isAdmin) {
    const outletSet = new Set<string>();
    let hasGlobalGrant = false;

    const relevantGrants = membership.accessGrants.filter(
      (g) =>
        g.moduleId === "leave_management" ||
        g.moduleId === "attendance" ||
        g.moduleId === "shifts"
    );

    for (const grant of relevantGrants) {
      const permIds = grant.role.permissions.map((p) => p.permissionId);
      if (
        permIds.includes("leaves:view") ||
        permIds.includes("leaves:request") ||
        permIds.includes("leaves:approve") ||
        permIds.includes("attendance:view")
      ) {
        canViewLeaves = true;
      }
      if (permIds.includes("leaves:request")) {
        canRequestLeave = true;
      }
      if (permIds.includes("leaves:approve") || permIds.includes("attendance:manage")) {
        canApproveLeaves = true;
      }

      if (
        grant.moduleId === "leave_management" ||
        grant.moduleId === "attendance"
      ) {
        if (!grant.outletId) {
          hasGlobalGrant = true;
        } else {
          outletSet.add(grant.outletId);
        }
      }
    }

    accessibleOutletIds = hasGlobalGrant ? null : Array.from(outletSet);
  }

  if (options?.requireApprove && !canApproveLeaves) {
    return {
      ok: false,
      status: 403,
      error: "Missing leave approval permission",
    };
  }

  if (!canViewLeaves && !canRequestLeave && !canApproveLeaves) {
    return {
      ok: false,
      status: 403,
      error: "Missing leave permission",
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
      canViewLeaves,
      canRequestLeave,
      canApproveLeaves,
      accessibleOutletIds,
    },
  };
}
