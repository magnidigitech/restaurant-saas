import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export interface PosActorContext {
  userId: string;
  userEmail: string;
  userName: string;
  restaurantId: string;
  membershipId: string;
  isAdmin: boolean;
  canViewPos: boolean;
  canTakeOrders: boolean;
  canManagePos: boolean;
  accessibleOutletIds: string[] | null;
}

const ADMIN_ROLE_NAMES = [
  "Restaurant Owner",
  "Admin",
  "Owner",
  "Super Admin",
  "General Manager",
];

/**
 * Resolves the current tenant actor's POS permissions and authorized outlet scope.
 * Enforces `pos:view`, `pos:take_orders`, `pos:settle_bills`, and outlet-scoped grants.
 */
export async function getPosActorContext(options?: {
  requireView?: boolean;
  requireTakeOrders?: boolean;
  requireManage?: boolean;
  outletId?: string | null;
}): Promise<
  | { ok: true; ctx: PosActorContext }
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
    {
      moduleKey: "pos",
      ...(options?.outletId ? { outletId: options.outletId } : {}),
    },
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
      accessGrants: {
        where: { status: "ACTIVE" },
        include: { role: { include: { permissions: true } } },
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

  let canViewPos = isAdmin;
  let canTakeOrders = isAdmin;
  let canManagePos = isAdmin;
  let accessibleOutletIds: string[] | null = isAdmin ? null : [];

  if (!isAdmin) {
    const outletSet = new Set<string>();
    let hasGlobalGrant = false;

    const relevantGrants = membership.accessGrants.filter(
      (g) => g.moduleId === "pos"
    );

    for (const grant of relevantGrants) {
      const permIds = grant.role.permissions.map((p) => p.permissionId);
      if (permIds.includes("pos:view")) canViewPos = true;
      if (permIds.includes("pos:take_orders")) {
        canTakeOrders = true;
        canViewPos = true;
      }
      if (permIds.includes("pos:settle_bills")) {
        canManagePos = true;
        canTakeOrders = true;
        canViewPos = true;
      }

      if (!grant.outletId) {
        hasGlobalGrant = true;
      } else {
        outletSet.add(grant.outletId);
      }
    }

    accessibleOutletIds = hasGlobalGrant ? null : Array.from(outletSet);
  }

  if (options?.requireManage && !canManagePos) {
    return { ok: false, status: 403, error: "Missing POS management permission" };
  }
  if (options?.requireTakeOrders && !canTakeOrders) {
    return { ok: false, status: 403, error: "Missing POS order entry permission" };
  }
  if (options?.requireView !== false && !canViewPos) {
    return { ok: false, status: 403, error: "Missing POS view permission" };
  }

  if (
    options?.outletId &&
    accessibleOutletIds !== null &&
    !accessibleOutletIds.includes(options.outletId)
  ) {
    return {
      ok: false,
      status: 403,
      error: "Outlet is outside your authorized POS scope",
    };
  }

  return {
    ok: true,
    ctx: {
      userId: session.userId,
      userEmail: membership.user.email,
      userName: membership.user.name,
      restaurantId,
      membershipId: membership.id,
      isAdmin,
      canViewPos,
      canTakeOrders,
      canManagePos,
      accessibleOutletIds,
    },
  };
}

export function assertPosOutletInScope(
  ctx: PosActorContext,
  outletId: string
): { ok: true } | { ok: false; status: number; error: string } {
  if (ctx.accessibleOutletIds === null) return { ok: true };
  if (ctx.accessibleOutletIds.includes(outletId)) return { ok: true };
  return {
    ok: false,
    status: 403,
    error: "Outlet is outside your authorized POS scope",
  };
}
