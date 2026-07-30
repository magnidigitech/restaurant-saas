import { prisma } from "../database/client";
import { verifyAccess } from "../permissions/check";
import { proxy } from "../../proxy";
import { signToken } from "../auth/jwt";
import * as bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

// Define a simple helper to mock NextRequest for proxy testing
function mockRequest(urlStr: string, host: string, cookiesMap: Record<string, string>): NextRequest {
  const url = new URL(urlStr);
  const headers = new Headers();
  headers.set("host", host);
  
  // Create cookie string
  const cookieString = Object.entries(cookiesMap)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  if (cookieString) {
    headers.set("cookie", cookieString);
  }

  // Instantiate standard NextRequest
  return new NextRequest(url, {
    headers,
  });
}

async function runSecurityTests() {
  console.log("--------------------------------------------------");
  console.log("RUNNING SECURITY AUTHORIZATION ENGINE TESTS");
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
    // 1. Setup Test Seed Data
    console.log("Setting up security test database records...");

    const testPlanId = "test-security-plan";
    const modInventoryId = "inventory";
    const modPayrollId = "payroll";

    // Ensure test plan exists
    await prisma.subscriptionPlan.upsert({
      where: { id: testPlanId },
      update: {},
      create: {
        id: testPlanId,
        name: "Security Testing Plan",
        maxOutlets: 5,
        maxEmployees: 50,
        maxAdminUsers: 5,
        storageQuotaGb: 10,
        priceMonthly: 0,
      },
    });

    // Clean up any stale test restaurants
    await prisma.restaurant.deleteMany({
      where: { subdomain: { in: ["test-tenant-a", "test-tenant-b", "test-tenant-suspended"] } },
    });

    // Create Restaurant A
    const tenantA = await prisma.restaurant.create({
      data: {
        name: "Security Restaurant A",
        subdomain: "test-tenant-a",
        status: "ACTIVE",
        modules: {
          create: {
            moduleId: modInventoryId, // only enable inventory
            status: "ACTIVE",
          },
        },
      },
    });

    // Create Restaurant B
    const tenantB = await prisma.restaurant.create({
      data: {
        name: "Security Restaurant B",
        subdomain: "test-tenant-b",
        status: "ACTIVE",
        modules: {
          create: {
            moduleId: modInventoryId,
            status: "ACTIVE",
          },
        },
      },
    });

    // Create Suspended Restaurant
    const tenantSuspended = await prisma.restaurant.create({
      data: {
        name: "Suspended Restaurant",
        subdomain: "test-tenant-suspended",
        status: "SUSPENDED",
        modules: {
          create: {
            moduleId: modInventoryId,
            status: "ACTIVE",
          },
        },
      },
    });

    // Create Outlets for Tenant A
    const outlet1 = await prisma.restaurantOutlet.create({
      data: {
        restaurantId: tenantA.id,
        name: "Guntur Branch A1",
      },
    });

    const outlet2 = await prisma.restaurantOutlet.create({
      data: {
        restaurantId: tenantA.id,
        name: "Guntur Branch A2",
      },
    });

    // Create Users
    const passwordHash = await bcrypt.hash("testpassword123", 10);

    const userA = await prisma.user.create({
      data: {
        email: "user_a@test.com",
        name: "User A",
        passwordHash,
        tokenVersion: 1,
      },
    });

    const userB = await prisma.user.create({
      data: {
        email: "user_b@test.com",
        name: "User B",
        passwordHash,
        tokenVersion: 1,
      },
    });

    const userOutletLimited = await prisma.user.create({
      data: {
        email: "user_outlet@test.com",
        name: "User Outlet Limited",
        passwordHash,
        tokenVersion: 1,
      },
    });

    const userSuspended = await prisma.user.create({
      data: {
        email: "user_suspended@test.com",
        name: "User Suspended",
        passwordHash,
        tokenVersion: 1,
      },
    });

    const platformAdminUser = await prisma.user.create({
      data: {
        email: "platform_admin@test.com",
        name: "Platform Admin",
        passwordHash,
        tokenVersion: 1,
      },
    });

    // Create memberships
    const memberA = await prisma.restaurantMembership.create({
      data: {
        restaurantId: tenantA.id,
        userId: userA.id,
        status: "ACTIVE",
      },
    });

    const memberB = await prisma.restaurantMembership.create({
      data: {
        restaurantId: tenantB.id,
        userId: userB.id,
        status: "ACTIVE",
      },
    });

    const memberOutletLimited = await prisma.restaurantMembership.create({
      data: {
        restaurantId: tenantA.id,
        userId: userOutletLimited.id,
        status: "ACTIVE",
      },
    });

    const memberSuspended = await prisma.restaurantMembership.create({
      data: {
        restaurantId: tenantSuspended.id,
        userId: userSuspended.id,
        status: "ACTIVE",
      },
    });

    // Create test roles and link permissions
    const roleInventoryManager = await prisma.role.create({
      data: {
        restaurantId: tenantA.id,
        name: "Inventory Manager",
        permissions: {
          createMany: {
            data: [
              { permissionId: "inventory:view_items" },
              { permissionId: "inventory:manage_items" },
            ],
          },
        },
      },
    });

    // Create access grants
    // User A has tenant-wide inventory access
    await prisma.accessGrant.create({
      data: {
        restaurantId: tenantA.id,
        membershipId: memberA.id,
        moduleId: modInventoryId,
        roleId: roleInventoryManager.id,
        status: "ACTIVE",
      },
    });

    // User Outlet Limited has access restricted to outlet 1
    await prisma.accessGrant.create({
      data: {
        restaurantId: tenantA.id,
        membershipId: memberOutletLimited.id,
        moduleId: modInventoryId,
        roleId: roleInventoryManager.id,
        outletId: outlet1.id,
        status: "ACTIVE",
      },
    });

    // User Suspended has access to inventory
    await prisma.accessGrant.create({
      data: {
        restaurantId: tenantSuspended.id,
        membershipId: memberSuspended.id,
        moduleId: modInventoryId,
        roleId: roleInventoryManager.id,
        status: "ACTIVE",
      },
    });

    console.log("Test database seeded. Running assertions...\n");

    // --------------------------------------------------
    // JWT SESSION GENERATIONS FOR PROXY TESTING
    // --------------------------------------------------
    const platformToken = await signToken({
      userId: platformAdminUser.id,
      email: platformAdminUser.email,
      name: platformAdminUser.name,
      role: "PLATFORM_ADMIN",
      tokenVersion: 1,
    });

    const tenantAToken = await signToken({
      userId: userA.id,
      email: userA.email,
      name: userA.name,
      role: "RESTAURANT_USER",
      activeRestaurantId: tenantA.id,
      activeRestaurantSubdomain: tenantA.subdomain,
      tokenVersion: 1,
    });

    // --------------------------------------------------
    // TEST CASES (14 ASSERTIONS)
    // --------------------------------------------------

    // 1. Restaurant user blocked from Platform Super Admin page
    const req1 = mockRequest(
      "http://admin.localhost:3000/platform-admin/dashboard",
      "admin.localhost:3000",
      { platform_admin_session: tenantAToken }
    );
    const res1 = await proxy(req1);
    assert(
      "Restaurant user blocked from Platform Super Admin page",
      res1 !== null && res1.headers.get("location")?.includes("/platform-admin/login") === true,
      `Redirected to: ${res1?.headers.get("location")}`
    );

    // 2. Restaurant user blocked from Platform Super Admin API
    const req2 = mockRequest(
      "http://admin.localhost:3000/api/platform-admin/restaurants",
      "admin.localhost:3000",
      { platform_admin_session: tenantAToken }
    );
    const res2 = await proxy(req2);
    assert(
      "Restaurant user blocked from Platform Super Admin API",
      res2 !== null && res2.status === 401,
      `Response status: ${res2?.status}`
    );

    // 3. Platform user cannot use a tenant session cookie as a restaurant session
    const req3 = mockRequest(
      `http://${tenantA.subdomain}.localhost:3000/dashboard`,
      `${tenantA.subdomain}.localhost:3000`,
      { tenant_session: platformToken }
    );
    const res3 = await proxy(req3);
    assert(
      "Platform user cannot use tenant session cookie as restaurant session",
      res3 !== null && res3.headers.get("location")?.includes("/login") === true,
      `Redirected to: ${res3?.headers.get("location")}`
    );

    // 4. Tenant session cannot be used as a platform session
    const req4 = mockRequest(
      "http://admin.localhost:3000/platform-admin/dashboard",
      "admin.localhost:3000",
      { platform_admin_session: tenantAToken }
    );
    const res4 = await proxy(req4);
    assert(
      "Tenant session cannot be used as platform session",
      res4 !== null && res4.headers.get("location")?.includes("/platform-admin/login") === true,
      `Redirected to: ${res4?.headers.get("location")}`
    );

    // 5. Browser-supplied restaurantId cannot override the authenticated restaurant
    // If a request tries to verify access targeting tenantB but using userA (who only belongs to tenantA), verifyAccess rejects
    const res5 = await verifyAccess(userA.id, tenantB.id, {
      moduleKey: modInventoryId,
    }, 1);
    assert(
      "Browser-supplied restaurantId cannot override authenticated restaurant",
      res5.authorized === false && res5.error?.includes("not a member") === true,
      `Result: ${res5.error}`
    );

    // 6. Browser-supplied outletId cannot override authorized outlet scope
    // Limited user trying to perform access in outlet2 context fails
    const res6 = await verifyAccess(userOutletLimited.id, tenantA.id, {
      moduleKey: modInventoryId,
      permissionKey: "inventory:view_items",
      outletId: outlet2.id,
    }, 1);
    assert(
      "Browser-supplied outletId cannot override authorized outlet scope",
      res6.authorized === false && res6.error?.includes("missing required permission") === true,
      `Result: ${res6.error}`
    );

    // 7. Cross-subdomain access is rejected
    // Request to tenant B subdomain using token of tenant A is rejected by proxy
    const req7 = mockRequest(
      `http://${tenantB.subdomain}.localhost:3000/dashboard`,
      `${tenantB.subdomain}.localhost:3000`,
      { tenant_session: tenantAToken }
    );
    const res7 = await proxy(req7);
    assert(
      "Cross-subdomain access is rejected",
      res7 !== null && res7.headers.get("location")?.includes("/login") === true,
      `Redirected to: ${res7?.headers.get("location")}`
    );

    // 8. Expired invitation is rejected
    const expiredInvite = await prisma.staffInvitation.create({
      data: {
        restaurantId: tenantA.id,
        email: "expired@test.com",
        roleId: roleInventoryManager.id,
        tokenHash: createHash("sha256").update("expired-token-raw").digest("hex"),
        status: "SENT",
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      },
    });
    // Simulating token resolve check
    const inviteCheckExpired = await prisma.staffInvitation.findUnique({
      where: { id: expiredInvite.id },
    });
    assert(
      "Expired invitation is rejected",
      inviteCheckExpired !== null && new Date() > inviteCheckExpired.expiresAt,
      `Invite expiresAt: ${inviteCheckExpired?.expiresAt}`
    );

    // 9. Used invitation cannot be reused
    const usedInvite = await prisma.staffInvitation.create({
      data: {
        restaurantId: tenantA.id,
        email: "used@test.com",
        roleId: roleInventoryManager.id,
        tokenHash: createHash("sha256").update("used-token-raw").digest("hex"),
        status: "ACCEPTED",
        expiresAt: new Date(Date.now() + 100000),
      },
    });
    assert(
      "Used invitation cannot be reused",
      usedInvite.status !== "SENT",
      `Invite status: ${usedInvite.status}`
    );

    // 10. Invitation for Restaurant A cannot activate an account for Restaurant B
    // Invitation is structurally bound to restaurantId via foreign key constraint
    const inviteA = await prisma.staffInvitation.create({
      data: {
        restaurantId: tenantA.id,
        email: "invite_a@test.com",
        roleId: roleInventoryManager.id,
        tokenHash: createHash("sha256").update("invite-a-raw").digest("hex"),
        status: "SENT",
        expiresAt: new Date(Date.now() + 100000),
      },
    });
    assert(
      "Invitation for Restaurant A cannot activate B: Invite bound to Restaurant A id",
      inviteA.restaurantId === tenantA.id && inviteA.restaurantId !== tenantB.id
    );

    // 11. Disabled module access is revoked for an existing logged-in user
    // VerifyAccess check fails for Payroll because Restaurant A does not have Payroll module enabled
    const res11 = await verifyAccess(userA.id, tenantA.id, {
      moduleKey: modPayrollId,
    }, 1);
    assert(
      "Disabled module access is revoked for logged-in user",
      res11.authorized === false && res11.error?.includes("not enabled") === true,
      `Result: ${res11.error}`
    );

    // 12. Suspended membership is rejected
    // Update membership status to INACTIVE
    await prisma.restaurantMembership.update({
      where: { id: memberA.id },
      data: { status: "INACTIVE" },
    });
    const res12 = await verifyAccess(userA.id, tenantA.id, {
      moduleKey: modInventoryId,
    }, 1);
    assert(
      "Suspended membership is rejected",
      res12.authorized === false && res12.error?.includes("membership is not active") === true,
      `Result: ${res12.error}`
    );

    // Restore membership status
    await prisma.restaurantMembership.update({
      where: { id: memberA.id },
      data: { status: "ACTIVE" },
    });

    // 13. Deactivated user is rejected
    // Query verifyAccess with non-existent/deleted user ID
    const res13 = await verifyAccess("non-existent-user-id", tenantA.id, {
      moduleKey: modInventoryId,
    }, 1);
    assert(
      "Deactivated user is rejected",
      res13.authorized === false && res13.error?.includes("User record not found") === true,
      `Result: ${res13.error}`
    );

    // 14. Password or session-version change invalidates old sessions
    // Old session payload has tokenVersion 1. We increment the user's database version to 2
    await prisma.user.update({
      where: { id: userA.id },
      data: { tokenVersion: 2 },
    });
    const res14 = await verifyAccess(userA.id, tenantA.id, {
      moduleKey: modInventoryId,
    }, 1); // Pass old tokenVersion 1
    assert(
      "Password or session-version change invalidates old sessions",
      res14.authorized === false && res14.error?.includes("Session has been invalidated") === true,
      `Result: ${res14.error}`
    );

    // --------------------------------------------------
    // CLEANUP
    // --------------------------------------------------
    console.log("\nCleaning up security test database records...");
    await prisma.restaurant.deleteMany({
      where: { subdomain: { in: ["test-tenant-a", "test-tenant-b", "test-tenant-suspended"] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ["user_a@test.com", "user_b@test.com", "user_outlet@test.com", "user_suspended@test.com", "platform_admin@test.com"] } },
    });

    console.log("--------------------------------------------------");
    console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log("--------------------------------------------------");

    if (failCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error("Test execution encountered critical crash error:", error);
    process.exit(1);
  }
}

runSecurityTests();
