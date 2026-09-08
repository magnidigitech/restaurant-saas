import { prisma } from "@/core/database/client";

/**
 * Retrieves role names associated with a user's active membership in a restaurant.
 */
export async function getUserRoleNames(userId: string, restaurantId: string): Promise<string[]> {
  const membership = await prisma.restaurantMembership.findUnique({
    where: {
      restaurantId_userId: {
        restaurantId,
        userId,
      },
    },
    include: {
      accessGrants: {
        where: { status: "ACTIVE" },
        include: { role: true },
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    return [];
  }

  const roleNames = new Set<string>();

  for (const grant of membership.accessGrants) {
    if (grant.role?.name) {
      roleNames.add(grant.role.name);
    }
  }

  // If the user has no explicit grants but is a member, or if role contains owner/admin keywords
  return Array.from(roleNames);
}

/**
 * Checks if a user has administrative privileges (Owner, Admin, Restaurant Owner) in a restaurant.
 */
export async function isUserAdminOrOwner(userId: string, restaurantId: string): Promise<boolean> {
  const membership = await prisma.restaurantMembership.findUnique({
    where: {
      restaurantId_userId: {
        restaurantId,
        userId,
      },
    },
    include: {
      accessGrants: {
        where: { status: "ACTIVE" },
        include: { role: true },
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") return false;

  // Check if any grant corresponds to Owner/Admin
  const hasAdminGrant = membership.accessGrants.some((g) => {
    const name = g.role?.name?.toLowerCase() || "";
    return name.includes("owner") || name.includes("admin") || name.includes("manager");
  });

  if (hasAdminGrant) return true;

  // Check if user has zero access grants (meaning root default creator/owner before grants existed)
  const totalGrants = await prisma.accessGrant.count({
    where: { restaurantId },
  });

  // If no grants exist in the restaurant at all, the first active member is effectively an owner
  if (totalGrants === 0) return true;

  return false;
}
