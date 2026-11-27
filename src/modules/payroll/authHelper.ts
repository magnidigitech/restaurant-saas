import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";

export interface PayrollActorContext {
  userId: string;
  userEmail: string;
  userName: string;
  restaurantId: string;
  membershipId: string;
  employeeId: string | null;
  isAdmin: boolean;
  canViewPayroll: boolean;
  canRunPayroll: boolean;
  canApprovePayroll: boolean;
  accessibleOutletIds: string[] | null;
}

const ADMIN_ROLE_NAMES = [
  "Restaurant Owner",
  "Admin",
  "Owner",
  "Super Admin",
  "General Manager",
];

export async function getPayrollActorContext(options?: {
  requireView?: boolean;
  requireRun?: boolean;
  requireApprove?: boolean;
  outletId?: string | null;
}): Promise<
  | { ok: true; ctx: PayrollActorContext }
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
          outletAssignments: { select: { outletId: true } },
        },
      },
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

  const activeEmployeeId =
    membership.employee && !membership.employee.archivedAt
      ? membership.employee.id
      : null;

  let canViewPayroll = isAdmin;
  let canRunPayroll = isAdmin;
  let canApprovePayroll = isAdmin;
  let accessibleOutletIds: string[] | null = isAdmin ? null : [];

  if (!isAdmin) {
    const outletSet = new Set<string>();
    let hasGlobalGrant = false;

    const relevantGrants = membership.accessGrants.filter(
      (g) => g.moduleId === "payroll"
    );

    for (const grant of relevantGrants) {
      const permIds = grant.role.permissions.map((p) => p.permissionId);
      if (permIds.includes("payroll:view_payroll")) canViewPayroll = true;
      if (permIds.includes("payroll:run_payroll")) {
        canRunPayroll = true;
        canViewPayroll = true;
      }
      if (permIds.includes("payroll:approve_payroll")) {
        canApprovePayroll = true;
        canViewPayroll = true;
      }

      if (!grant.outletId) {
        hasGlobalGrant = true;
      } else {
        outletSet.add(grant.outletId);
      }
    }

    accessibleOutletIds = hasGlobalGrant ? null : Array.from(outletSet);
  }

  if (options?.requireApprove && !canApprovePayroll) {
    return { ok: false, status: 403, error: "Missing payroll approval permission" };
  }
  if (options?.requireRun && !canRunPayroll) {
    return { ok: false, status: 403, error: "Missing payroll execution permission" };
  }
  if (options?.requireView && !canViewPayroll) {
    return { ok: false, status: 403, error: "Missing payroll view permission" };
  }

  if (!canViewPayroll && !canRunPayroll && !canApprovePayroll && !activeEmployeeId) {
    return { ok: false, status: 403, error: "Missing payroll or employee access" };
  }

  if (
    options?.outletId &&
    (canViewPayroll || canRunPayroll || canApprovePayroll) &&
    accessibleOutletIds !== null &&
    !accessibleOutletIds.includes(options.outletId)
  ) {
    return {
      ok: false,
      status: 403,
      error: "Outlet is outside your authorized payroll scope",
    };
  }

  // An outlet-scoped manager cannot access tenant-wide (outletId: null) payroll runs
  if (
    options?.outletId === null &&
    (canViewPayroll || canRunPayroll || canApprovePayroll) &&
    accessibleOutletIds !== null
  ) {
    return {
      ok: false,
      status: 403,
      error: "Tenant-wide payroll runs require global payroll access",
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
      canViewPayroll,
      canRunPayroll,
      canApprovePayroll,
      accessibleOutletIds,
    },
  };
}
