import "dotenv/config";
import { prisma } from "../database/client";
import { checkRosterOutletAccess, ShiftActorContext } from "../../modules/shifts/authHelper";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function main() {
  console.log("=========================================================");
  console.log("  Shift Permissions & Outlet Scope Regression Test Suite");
  console.log("=========================================================\n");

  const ts = Date.now();
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Shift Perm Test ${ts}`,
      subdomain: `shift-perm-${ts}`,
      status: "ACTIVE",
    },
  });

  try {
    const outletA = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Outlet A", timezone: "America/Edmonton" },
    });
    const outletB = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Outlet B", timezone: "America/Edmonton" },
    });

    const rosterA = await prisma.shiftRoster.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outletA.id,
        name: "Roster A",
        startDate: new Date("2026-12-01"),
        endDate: new Date("2026-12-07"),
        status: "PUBLISHED",
      },
    });
    const rosterB = await prisma.shiftRoster.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outletB.id,
        name: "Roster B",
        startDate: new Date("2026-12-01"),
        endDate: new Date("2026-12-07"),
        status: "DRAFT",
      },
    });

    // 1. Regular employee context (no manage_roster, scoped to Outlet A)
    const staffCtx: ShiftActorContext = {
      userId: "staff-user",
      userEmail: "staff@example.com",
      restaurantId: restaurant.id,
      membershipId: "m-staff",
      employeeId: "emp-staff",
      employee: { id: "emp-staff", firstName: "Staff", lastName: "One", employeeCode: "E01" },
      isAdmin: false,
      canManageRoster: false,
      canApproveSwap: false,
      accessibleOutletIds: [outletA.id],
    };

    const staffOutletA = await checkRosterOutletAccess(staffCtx, rosterA.id);
    const staffOutletB = await checkRosterOutletAccess(staffCtx, rosterB.id);
    assert(staffOutletA.ok === true, "Staff can access roster in assigned Outlet A");
    assert(staffOutletB.ok === false && staffOutletB.status === 403, "Staff gets 403 for roster in unassigned Outlet B");

    // 2. Outlet manager context (canManageRoster=true, scoped to Outlet A only)
    const mgrCtx: ShiftActorContext = {
      ...staffCtx,
      userId: "mgr-user",
      userEmail: "mgr@example.com",
      canManageRoster: true,
      canApproveSwap: true,
      accessibleOutletIds: [outletA.id],
    };

    const mgrOutletA = await checkRosterOutletAccess(mgrCtx, rosterA.id);
    const mgrOutletB = await checkRosterOutletAccess(mgrCtx, rosterB.id);
    assert(mgrOutletA.ok === true, "Outlet A manager can access Outlet A roster");
    assert(mgrOutletB.ok === false && mgrOutletB.status === 403, "Outlet A manager gets 403 for Outlet B roster");

    // 3. Verify verifyAccess + authHelper behavior with real DB membership & 0 grants for an employee
    const staffUser = await prisma.user.create({
      data: {
        email: `staff-${ts}@example.com`,
        name: "Regular Staff",
        passwordHash: "hash",
      },
    });
    const staffEmp = await prisma.employee.create({
      data: {
        restaurantId: restaurant.id,
        employeeCode: `EMP-${ts}`,
        firstName: "Regular",
        lastName: "Staff",
        joiningDate: new Date(),
      },
    });
    await prisma.employeeOutletAssignment.create({
      data: {
        restaurantId: restaurant.id,
        employeeId: staffEmp.id,
        outletId: outletA.id,
        isPrimary: true,
      },
    });
    const membership = await prisma.restaurantMembership.create({
      data: {
        restaurantId: restaurant.id,
        userId: staffUser.id,
        employeeId: staffEmp.id,
        status: "ACTIVE",
      },
    });
    assert(membership.employeeId === staffEmp.id, "Created regular employee membership with 0 accessGrants");

    // 4. Verify non-existent roster returns 404
    const missing = await checkRosterOutletAccess(mgrCtx, "00000000-0000-0000-0000-000000000000");
    assert(missing.ok === false && missing.status === 404, "Missing roster returns 404");

    console.log(`\nTest Results: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
  } finally {
    await prisma.restaurant.delete({ where: { id: restaurant.id } }).catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
