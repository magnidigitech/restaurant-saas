import { prisma } from "../database/client";

export interface VerificationResult {
  authorized: boolean;
  status: number;
  error?: string;
  membershipId?: string;
  membershipStatus?: string;
  restaurantStatus?: string;
}

export async function verifyAccess(
  userId: string,
  restaurantId: string,
  options: {
    moduleKey?: string;
    permissionKey?: string;
    outletId?: string;
  },
  tokenVersion?: number
): Promise<VerificationResult> {
  // 0. Verify User existence & session version validity
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return {
      authorized: false,
      status: 403,
      error: "User record not found or deactivated",
    };
  }

  if (tokenVersion !== undefined && user.tokenVersion !== tokenVersion) {
    return {
      authorized: false,
      status: 401,
      error: "Session has been invalidated (password or role changed)",
    };
  }

  // 1. Resolve membership
  const membership = await prisma.restaurantMembership.findUnique({
    where: {
      restaurantId_userId: {
        restaurantId,
        userId,
      },
    },
    include: {
      restaurant: true,
    },
  });

  if (!membership) {
    return {
      authorized: false,
      status: 403,
      error: "User is not a member of this restaurant",
    };
  }

  if (membership.status !== "ACTIVE") {
    return {
      authorized: false,
      status: 403,
      error: "User membership is not active",
      membershipStatus: membership.status,
    };
  }

  // 2. Verify Restaurant Status
  if (membership.restaurant.status === "SUSPENDED") {
    return {
      authorized: false,
      status: 403,
      error: "Restaurant subscription is suspended",
      restaurantStatus: "SUSPENDED",
    };
  }

  if (membership.restaurant.status === "DEACTIVATED") {
    return {
      authorized: false,
      status: 403,
      error: "Restaurant is deactivated",
      restaurantStatus: "DEACTIVATED",
    };
  }

  const { moduleKey, permissionKey, outletId } = options;

  if (moduleKey) {
    const moduleKeys =
      moduleKey === "shifts" || moduleKey === "shift_management"
        ? ["shifts", "shift_management"]
        : [moduleKey];

    // 3. Verify Restaurant Module Entitlement
    const entitlement = await prisma.restaurantModule.findFirst({
      where: {
        restaurantId,
        moduleId: { in: moduleKeys },
        status: "ACTIVE",
      },
    });

    if (!entitlement) {
      return {
        authorized: false,
        status: 403,
        error: `Module '${moduleKey}' is not enabled for this restaurant`,
      };
    }

    // 4. Verify User Module Access (Active Access Grants)
    const grants = await prisma.accessGrant.findMany({
      where: {
        membershipId: membership.id,
        moduleId: { in: moduleKeys },
        status: "ACTIVE",
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (grants.length === 0) {
      // Check if user has an active Restaurant Owner role or has zero restricted grants
      const hasAdminRole = await prisma.accessGrant.findFirst({
        where: {
          membershipId: membership.id,
          status: "ACTIVE",
          role: { name: { in: ["Restaurant Owner", "Admin", "Owner"] } },
        },
      });

      if (!hasAdminRole) {
        const totalUserGrants = await prisma.accessGrant.count({
          where: { membershipId: membership.id, status: "ACTIVE" },
        });

        if (totalUserGrants > 0) {
          return {
            authorized: false,
            status: 403,
            error: `User has no access grants for module '${moduleKey}'`,
          };
        }
      }
    }

    // 5. Verify Action Permission & Outlet Scope
    if (permissionKey && grants.length > 0) {
      let permissionFound = false;

      for (const grant of grants) {
        // If the grant is restricted to a specific outlet, and an outlet context was provided,
        // make sure the outlet matches. If no outlet context was provided, or if the grant is
        // restaurant-wide (outletId is null), we accept it.
        if (outletId && grant.outletId && grant.outletId !== outletId) {
          continue; // Restricted grant doesn't match target outlet
        }

        const permissions = grant.role.permissions.map((rp) => rp.permissionId);
        if (permissions.includes(permissionKey)) {
          permissionFound = true;
          break;
        }
      }

      if (!permissionFound) {
        return {
          authorized: false,
          status: 403,
          error: `User is missing required permission: '${permissionKey}'`,
        };
      }
    }
  }

  return {
    authorized: true,
    status: 200,
    membershipId: membership.id,
  };
}
