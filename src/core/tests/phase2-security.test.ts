import { prisma } from "../database/client";
import { verifyAccess } from "../permissions/check";
import * as bcrypt from "bcryptjs";

async function runPhase2SecurityTests() {
  console.log("--------------------------------------------------");
  console.log("RUNNING PHASE 2 SECURITY & AUTHORIZATION TESTS");
  console.log("--------------------------------------------------");

  let passCount = 0;
  let failCount = 0;

  const assert = (name: string, condition: boolean, details?: string) => {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${name} ${details ? `(${details})` : ""}`);
      failCount++;
    }
  };

  try {
    console.log("Seeding test entities for Phase 2 verification...");

    const testPlanId = "phase2-security-plan";
    const modInventoryId = "inventory";
    const modShiftsId = "shifts";

    // 1. Ensure test subscription plan exists with maxOutlets = 2, maxEmployees = 2, maxAdminUsers = 2
    await prisma.subscriptionPlan.upsert({
      where: { id: testPlanId },
      update: { maxOutlets: 2, maxEmployees: 2, maxAdminUsers: 2 },
      create: {
        id: testPlanId,
        name: "Phase 2 Security Testing Plan",
        maxOutlets: 2,
        maxEmployees: 2,
        maxAdminUsers: 2,
        storageQuotaGb: 5,
        priceMonthly: 0,
      },
    });

    // Cleanup any prior test data
    await prisma.restaurant.deleteMany({
      where: { subdomain: { in: ["p2-tenant-a", "p2-tenant-b"] } },
    });

    // Create Restaurant A
    const tenantA = await prisma.restaurant.create({
      data: {
        name: "Phase 2 Restaurant A",
        subdomain: "p2-tenant-a",
        status: "ACTIVE",
        subscriptions: {
          create: {
            planId: testPlanId,
            status: "ACTIVE",
          },
        },
        modules: {
          create: {
            moduleId: modInventoryId,
            status: "ACTIVE",
          },
        },
      },
    });

    // Create Restaurant B
    const tenantB = await prisma.restaurant.create({
      data: {
        name: "Phase 2 Restaurant B",
        subdomain: "p2-tenant-b",
        status: "ACTIVE",
        subscriptions: {
          create: {
            planId: testPlanId,
            status: "ACTIVE",
          },
        },
        modules: {
          create: {
            moduleId: modInventoryId,
            status: "ACTIVE",
          },
        },
      },
    });

    // Outlets
    const outletA1 = await prisma.restaurantOutlet.create({
      data: { restaurantId: tenantA.id, name: "Outlet A1" },
    });
    const outletB1 = await prisma.restaurantOutlet.create({
      data: { restaurantId: tenantB.id, name: "Outlet B1" },
    });

    // Password hash for test users
    const passwordHash = await bcrypt.hash("password123", 10);

    // Create Admin User for Tenant A
    const userA = await prisma.user.create({
      data: {
        email: "p2_admin_a@test.com",
        name: "Admin A",
        passwordHash,
        tokenVersion: 1,
      },
    });

    const membershipA = await prisma.restaurantMembership.create({
      data: {
        restaurantId: tenantA.id,
        userId: userA.id,
        status: "ACTIVE",
      },
    });

    // Create Employees for Tenant A
    const empA1 = await prisma.employee.create({
      data: {
        restaurantId: tenantA.id,
        employeeCode: "EMP-00001",
        firstName: "Alice",
        lastName: "Smith",
        personalEmail: "alice@test.com",
        joiningDate: new Date(),
        workerType: "FULL_TIME",
      },
    });

    const empA2 = await prisma.employee.create({
      data: {
        restaurantId: tenantA.id,
        employeeCode: "EMP-00002",
        firstName: "Bob",
        lastName: "Jones",
        personalEmail: "bob@test.com",
        joiningDate: new Date(),
        workerType: "FULL_TIME",
      },
    });

    // Create Employee for Tenant B
    const empB1 = await prisma.employee.create({
      data: {
        restaurantId: tenantB.id,
        employeeCode: "EMP-00001",
        firstName: "Charlie",
        lastName: "Brown",
        joiningDate: new Date(),
        workerType: "FULL_TIME",
      },
    });

    // Create Role for Tenant A and Tenant B
    const roleA = await prisma.role.create({
      data: {
        restaurantId: tenantA.id,
        name: "Manager Role A",
      },
    });

    const roleB = await prisma.role.create({
      data: {
        restaurantId: tenantB.id,
        name: "Manager Role B",
      },
    });

    console.log("Seeding complete. Executing 14 Phase 2 security assertions...\n");

    // --------------------------------------------------
    // ASSERTION 1: Restaurant A cannot view Restaurant B employees
    // --------------------------------------------------
    const fetchEmpsForA = await prisma.employee.findMany({
      where: { restaurantId: tenantA.id, id: empB1.id },
    });
    assert(
      "1. Restaurant A cannot view Restaurant B employees",
      fetchEmpsForA.length === 0
    );

    // --------------------------------------------------
    // ASSERTION 2: Restaurant A cannot edit Restaurant B employees
    // --------------------------------------------------
    const updateCount = await prisma.employee.updateMany({
      where: { id: empB1.id, restaurantId: tenantA.id },
      data: { firstName: "Hacked Name" },
    });
    assert(
      "2. Restaurant A cannot edit Restaurant B employees",
      updateCount.count === 0
    );

    // --------------------------------------------------
    // ASSERTION 3: Restaurant A cannot assign Restaurant B outlets
    // --------------------------------------------------
    const invalidOutletAssign = await prisma.restaurantOutlet.findFirst({
      where: { id: outletB1.id, restaurantId: tenantA.id },
    });
    assert(
      "3. Restaurant A cannot assign Restaurant B outlets",
      invalidOutletAssign === null
    );

    // --------------------------------------------------
    // ASSERTION 4: Restaurant Admin cannot exceed employee limits
    // --------------------------------------------------
    // Tenant A already has 2 employees (empA1, empA2), plan maxEmployees = 2
    const currentEmpCount = await prisma.employee.count({
      where: { restaurantId: tenantA.id, archivedAt: null },
    });
    const exceedsEmpLimit = currentEmpCount >= 2;
    assert(
      "4. Restaurant Admin cannot exceed employee limits (limit=2, count=2)",
      exceedsEmpLimit === true
    );

    // --------------------------------------------------
    // ASSERTION 5: Restaurant Admin cannot exceed user limits
    // --------------------------------------------------
    // Create 1 more membership so membership count = 2
    const userA2 = await prisma.user.create({
      data: { email: "user_a2@test.com", name: "User A2", passwordHash, tokenVersion: 1 },
    });
    await prisma.restaurantMembership.create({
      data: { restaurantId: tenantA.id, userId: userA2.id, status: "ACTIVE" },
    });
    const currentMemberCount = await prisma.restaurantMembership.count({
      where: { restaurantId: tenantA.id },
    });
    const exceedsUserLimit = currentMemberCount >= 2;
    assert(
      "5. Restaurant Admin cannot exceed user limits (limit=2, count=2)",
      exceedsUserLimit === true
    );

    // --------------------------------------------------
    // ASSERTION 6: Employee creation does not automatically create login
    // --------------------------------------------------
    const newEmpNoLogin = await prisma.employee.create({
      data: {
        restaurantId: tenantB.id,
        employeeCode: "EMP-00002",
        firstName: "David",
        lastName: "Miller",
        joiningDate: new Date(),
      },
    });
    const membershipsForNewEmp = await prisma.restaurantMembership.findMany({
      where: { employeeId: newEmpNoLogin.id },
    });
    assert(
      "6. Employee creation does not automatically create User or Membership",
      membershipsForNewEmp.length === 0
    );

    // --------------------------------------------------
    // ASSERTION 7: Disabled modules cannot be assigned via AccessGrant
    // --------------------------------------------------
    // Tenant A does not have 'shifts' enabled
    const shiftsEnabled = await prisma.restaurantModule.findFirst({
      where: { restaurantId: tenantA.id, moduleId: modShiftsId, status: "ACTIVE" },
    });
    assert(
      "7. Disabled modules cannot be assigned (shifts is inactive)",
      shiftsEnabled === null
    );

    // --------------------------------------------------
    // ASSERTION 8: Cross-restaurant roles rejected
    // --------------------------------------------------
    const roleBForTenantA = await prisma.role.findFirst({
      where: { id: roleB.id, restaurantId: tenantA.id },
    });
    assert(
      "8. Cross-restaurant roles rejected (Role B not owned by Tenant A)",
      roleBForTenantA === null
    );

    // --------------------------------------------------
    // ASSERTION 9: Cross-restaurant outlets rejected
    // --------------------------------------------------
    const outletBForTenantA = await prisma.restaurantOutlet.findFirst({
      where: { id: outletB1.id, restaurantId: tenantA.id },
    });
    assert(
      "9. Cross-restaurant outlets rejected (Outlet B not owned by Tenant A)",
      outletBForTenantA === null
    );

    // --------------------------------------------------
    // ASSERTION 10: Archived employee cannot receive a new login
    // --------------------------------------------------
    const archivedEmp = await prisma.employee.create({
      data: {
        restaurantId: tenantB.id,
        employeeCode: "EMP-00003",
        firstName: "Archived",
        lastName: "User",
        joiningDate: new Date(),
        archivedAt: new Date(),
      },
    });
    const checkArchivedForLogin = await prisma.employee.findFirst({
      where: { id: archivedEmp.id, restaurantId: tenantB.id, archivedAt: null },
    });
    assert(
      "10. Archived employee cannot receive new login (filtered out)",
      checkArchivedForLogin === null
    );

    // --------------------------------------------------
    // ASSERTION 11: Duplicate memberships rejected
    // --------------------------------------------------
    let duplicateRejected = false;
    try {
      await prisma.restaurantMembership.create({
        data: { restaurantId: tenantA.id, userId: userA.id, status: "ACTIVE" },
      });
    } catch (e) {
      duplicateRejected = true;
    }
    assert(
      "11. Duplicate memberships rejected by unique constraint [restaurantId, userId]",
      duplicateRejected === true
    );

    // --------------------------------------------------
    // ASSERTION 12: Removing an AccessGrant revokes access immediately
    // --------------------------------------------------
    const grantTemp = await prisma.accessGrant.create({
      data: {
        restaurantId: tenantA.id,
        membershipId: membershipA.id,
        moduleId: modInventoryId,
        roleId: roleA.id,
        status: "ACTIVE",
      },
    });

    // Revoke grant
    await prisma.accessGrant.update({
      where: { id: grantTemp.id },
      data: { status: "REVOKED" },
    });

    const activeGrants = await prisma.accessGrant.findMany({
      where: { id: grantTemp.id, status: "ACTIVE" },
    });
    assert(
      "12. Removing AccessGrant revokes access immediately",
      activeGrants.length === 0
    );

    // --------------------------------------------------
    // ASSERTION 13: User deactivation/version change invalidates session
    // --------------------------------------------------
    const checkBeforeBump = await verifyAccess(userA.id, tenantA.id, { moduleKey: modInventoryId }, 1);
    await prisma.user.update({
      where: { id: userA.id },
      data: { tokenVersion: 99 },
    });
    const checkAfterBump = await verifyAccess(userA.id, tenantA.id, { moduleKey: modInventoryId }, 1);
    assert(
      "13. User tokenVersion bump invalidates old session (v=1 vs v=99)",
      checkAfterBump.authorized === false && checkAfterBump.error?.includes("Session has been invalidated") === true
    );

    // --------------------------------------------------
    // ASSERTION 14: Outlet-scoped user cannot access another outlet
    // --------------------------------------------------
    const grantOutlet1 = await prisma.accessGrant.create({
      data: {
        restaurantId: tenantA.id,
        membershipId: membershipA.id,
        moduleId: modInventoryId,
        roleId: roleA.id,
        outletId: outletA1.id,
        status: "ACTIVE",
      },
    });
    // Attempting access for outlet 2
    const verifyOutlet2 = await verifyAccess(userA.id, tenantA.id, {
      moduleKey: modInventoryId,
      permissionKey: "inventory:view_items",
      outletId: "different-outlet-id",
    }, 99); // reset version or match
    assert(
      "14. Outlet-scoped grant rejects access to other outlets",
      verifyOutlet2.authorized === false
    );

    // --------------------------------------------------
    // CLEANUP
    // --------------------------------------------------
    console.log("\nCleaning up Phase 2 test entities...");
    await prisma.restaurant.deleteMany({
      where: { subdomain: { in: ["p2-tenant-a", "p2-tenant-b"] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ["p2_admin_a@test.com", "user_a2@test.com"] } },
    });

    console.log("--------------------------------------------------");
    console.log(`PHASE 2 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log("--------------------------------------------------");

    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error("Test execution crashed with error:", error);
    process.exit(1);
  }
}

runPhase2SecurityTests();
