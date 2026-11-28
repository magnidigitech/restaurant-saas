import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export interface InventoryActorContext {
  userId: string;
  userEmail: string;
  userName: string;
  restaurantId: string;
  membershipId: string;
  isAdmin: boolean;
  canViewInventory: boolean;
  canManageInventory: boolean;
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
 * Resolves the current tenant actor's Inventory permissions and authorized outlet scope.
 */
export async function getInventoryActorContext(options?: {
  requireView?: boolean;
  requireManage?: boolean;
  outletId?: string | null;
}): Promise<
  | { ok: true; ctx: InventoryActorContext }
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
      moduleKey: "inventory",
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

  let canViewInventory = isAdmin;
  let canManageInventory = isAdmin;
  let accessibleOutletIds: string[] | null = isAdmin ? null : [];

  if (!isAdmin) {
    const outletSet = new Set<string>();
    let hasGlobalGrant = false;

    const relevantGrants = membership.accessGrants.filter(
      (g) => g.moduleId === "inventory"
    );

    for (const grant of relevantGrants) {
      const permIds = grant.role.permissions.map((p) => p.permissionId);
      if (permIds.includes("inventory:view_items")) canViewInventory = true;
      if (permIds.includes("inventory:manage_items")) {
        canManageInventory = true;
        canViewInventory = true;
      }

      if (!grant.outletId) {
        hasGlobalGrant = true;
      } else {
        outletSet.add(grant.outletId);
      }
    }

    accessibleOutletIds = hasGlobalGrant ? null : Array.from(outletSet);
  }

  if (options?.requireManage && !canManageInventory) {
    return { ok: false, status: 403, error: "Missing inventory management permission" };
  }
  if (options?.requireView !== false && !canViewInventory) {
    return { ok: false, status: 403, error: "Missing inventory view permission" };
  }

  if (
    options?.outletId &&
    accessibleOutletIds !== null &&
    !accessibleOutletIds.includes(options.outletId)
  ) {
    return {
      ok: false,
      status: 403,
      error: "Outlet is outside your authorized inventory scope",
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
      canViewInventory,
      canManageInventory,
      accessibleOutletIds,
    },
  };
}

export function assertInventoryOutletInScope(
  ctx: InventoryActorContext,
  outletId: string
): { ok: true } | { ok: false; status: number; error: string } {
  if (ctx.accessibleOutletIds === null) return { ok: true };
  if (ctx.accessibleOutletIds.includes(outletId)) return { ok: true };
  return {
    ok: false,
    status: 403,
    error: "Outlet is outside your authorized inventory scope",
  };
}
