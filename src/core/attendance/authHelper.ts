import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export interface AttendanceActorContext {
  userId: string;
  userEmail: string;
  restaurantId: string;
  membershipId: string;
  employeeId: string | null;
  isAdmin: boolean;
  canViewAttendance: boolean;
  canManageAttendance: boolean;
  canAccessKiosk: boolean;
  accessibleOutletIds: string[] | null; // null = all outlets
}

const ADMIN_ROLE_NAMES = [
  "Restaurant Owner",
  "Admin",
  "Owner",
  "Super Admin",
  "General Manager",
];

export async function getAttendanceActorContext(options?: {
  requireManage?: boolean;
  requireKiosk?: boolean;
  outletId?: string;
}): Promise<
  | { ok: true; ctx: AttendanceActorContext }
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

  let canViewAttendance = isAdmin;
  let canManageAttendance = isAdmin;
  let canAccessKiosk = isAdmin;
  let accessibleOutletIds: string[] | null = isAdmin ? null : [];

  if (!isAdmin) {
    const outletSet = new Set<string>();
    let hasGlobalGrant = false;

    const attGrants = membership.accessGrants.filter(
      (g) => g.moduleId === "attendance"
    );

    for (const grant of attGrants) {
      const permIds = grant.role.permissions.map((p) => p.permissionId);
      if (
        permIds.includes("attendance:view") ||
        permIds.includes("attendance:manage") ||
        permIds.includes("attendance:view_my_attendance")
      ) {
        canViewAttendance = true;
      }
      if (permIds.includes("attendance:manage")) {
        canManageAttendance = true;
      }
      if (
        permIds.includes("attendance:kiosk_access") ||
        permIds.includes("attendance:manage")
      ) {
        canAccessKiosk = true;
      }

      if (!grant.outletId) {
        hasGlobalGrant = true;
      } else {
        outletSet.add(grant.outletId);
      }
    }

    accessibleOutletIds = hasGlobalGrant ? null : Array.from(outletSet);
  }

  if (options?.requireManage && !canManageAttendance) {
    return {
      ok: false,
      status: 403,
      error: "Missing attendance management permission",
    };
  }
  if (options?.requireKiosk && !canAccessKiosk && !canManageAttendance) {
    return {
      ok: false,
      status: 403,
      error: "Missing kiosk access permission",
    };
  }
  if (!canViewAttendance && !canAccessKiosk && !canManageAttendance) {
    return {
      ok: false,
      status: 403,
      error: "Missing attendance permission",
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
      canViewAttendance,
      canManageAttendance,
      canAccessKiosk,
      accessibleOutletIds,
    },
  };
}
