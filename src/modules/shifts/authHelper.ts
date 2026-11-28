import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export interface ShiftActorContext {
  userId: string;
  userEmail: string;
  restaurantId: string;
  membershipId: string;
  employeeId: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
  } | null;
  isAdmin: boolean;
  canManageRoster: boolean;
  canApproveSwap: boolean;
  accessibleOutletIds: string[] | null; // null = unrestricted (all outlets)
}

export async function getShiftActorContext(
  requiredPermission: "shifts:view_roster" | "shifts:manage_roster" | "shifts:approve_swap" = "shifts:view_roster",
  outletId?: string
): Promise<
  | { ok: true; ctx: ShiftActorContext }
  | { ok: false; status: number; error: string }
> {
  const session = await getTenantSession();
  if (!session || !session.activeRestaurantId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const access = await verifyAccess(
    session.userId,
    session.activeRestaurantId,
    {
      moduleKey: "shifts",
      permissionKey: requiredPermission,
      outletId,
    },
    session.tokenVersion
  );

  if (!access.authorized) {
    return { ok: false, status: access.status, error: access.error || "Forbidden" };
  }

  const membership = await prisma.restaurantMembership.findUnique({
    where: {
      restaurantId_userId: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
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

  if (!membership) {
    return { ok: false, status: 403, error: "Membership not found" };
  }

  const isAdmin =
    session.role === "PLATFORM_ADMIN" ||
    membership.accessGrants.some((g) =>
      ["Restaurant Owner", "Admin", "Owner", "Super Admin", "General Manager"].includes(
        g.role?.name || ""
      )
    ) ||
    (!membership.employeeId && membership.accessGrants.length === 0);

  const shiftGrants = membership.accessGrants.filter(
    (g) => g.moduleId === "shifts" || g.moduleId === "shift_management"
  );

  let canManageRoster = isAdmin;
  let canApproveSwap = isAdmin;
  let accessibleOutletIds: string[] | null = isAdmin ? null : [];

  if (!isAdmin) {
    const outletSet = new Set<string>();
    let hasGlobalGrant = false;

    for (const grant of shiftGrants) {
      const permIds = grant.role.permissions.map((p) => p.permissionId);
      if (permIds.includes("shifts:manage_roster")) canManageRoster = true;
      if (permIds.includes("shifts:approve_swap")) canApproveSwap = true;

      if (!grant.outletId) {
        hasGlobalGrant = true;
      } else {
        outletSet.add(grant.outletId);
      }
    }

    if (hasGlobalGrant) {
      accessibleOutletIds = null;
    } else if (outletSet.size > 0) {
      accessibleOutletIds = Array.from(outletSet);
    } else if (membership.employeeId) {
      // Fall back to employee's assigned outlets for self-service viewing
      const empOutlets = await prisma.employeeOutletAssignment.findMany({
        where: { employeeId: membership.employeeId, restaurantId: session.activeRestaurantId },
        select: { outletId: true },
      });
      accessibleOutletIds = empOutlets.map((o) => o.outletId);
    }
  }

  const activeEmployee =
    membership.employee && !membership.employee.archivedAt
      ? {
          id: membership.employee.id,
          firstName: membership.employee.firstName,
          lastName: membership.employee.lastName,
          employeeCode: membership.employee.employeeCode,
        }
      : null;

  if (requiredPermission === "shifts:manage_roster" && !canManageRoster) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: missing 'shifts:manage_roster' permission",
    };
  }

  if (requiredPermission === "shifts:approve_swap" && !canApproveSwap) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: missing 'shifts:approve_swap' permission",
    };
  }

  if (outletId && accessibleOutletIds !== null && !accessibleOutletIds.includes(outletId)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden for this outlet",
    };
  }

  return {
    ok: true,
    ctx: {
      userId: session.userId,
      userEmail: session.email || "system@restobird.com",
      restaurantId: session.activeRestaurantId,
      membershipId: membership.id,
      employeeId: activeEmployee?.id || null,
      employee: activeEmployee,
      isAdmin,
      canManageRoster,
      canApproveSwap,
      accessibleOutletIds,
    },
  };
}

/**
 * Verifies that a roster belongs to the actor's restaurant and an accessible outlet.
 */
export async function checkRosterOutletAccess(
  ctx: ShiftActorContext,
  rosterId: string
): Promise<{ ok: true; outletId: string } | { ok: false; status: number; error: string }> {
  const roster = await prisma.shiftRoster.findFirst({
    where: { id: rosterId, restaurantId: ctx.restaurantId },
    select: { outletId: true },
  });
  if (!roster) {
    return { ok: false, status: 404, error: "Roster not found" };
  }
  if (ctx.accessibleOutletIds !== null && !ctx.accessibleOutletIds.includes(roster.outletId)) {
    return { ok: false, status: 403, error: "Forbidden for this outlet" };
  }
  return { ok: true, outletId: roster.outletId };
}
