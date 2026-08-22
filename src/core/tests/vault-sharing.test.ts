import { prisma } from "@/core/database/client";
import assert from "node:assert";

async function runVaultSharingTests() {
  console.log("=========================================================");
  console.log("  Vault Secrets Sharing & Access Grants Engine Tests");
  console.log("=========================================================");

  let totalTests = 0;

  // Find or create test restaurant
  let restaurant = await prisma.restaurant.findFirst({
    where: { subdomain: "magni" },
  });

  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: "Test Restaurant",
        subdomain: "magni",
        status: "ACTIVE",
      },
    });
  }

  const restaurantId = restaurant.id;

  // Find or create test user
  let testUser = await prisma.user.findFirst({
    where: { email: "vault-tester@example.com" },
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        name: "Vault Test User",
        email: "vault-tester@example.com",
        passwordHash: "dummy-hash",
      },
    });
  }

  // Find or create recipient user
  let recipientUser = await prisma.user.findFirst({
    where: { email: "vault-recipient@example.com" },
  });

  if (!recipientUser) {
    recipientUser = await prisma.user.create({
      data: {
        name: "Vault Recipient User",
        email: "vault-recipient@example.com",
        passwordHash: "dummy-hash",
      },
    });
  }

  // Find or create role
  let testRole = await prisma.role.findFirst({
    where: { restaurantId, name: "Kitchen Lead" },
  });

  if (!testRole) {
    testRole = await prisma.role.create({
      data: {
        restaurantId,
        name: "Kitchen Lead",
      },
    });
  }

  // Find or create department
  let testDept = await prisma.department.findFirst({
    where: { restaurantId, name: "Culinary & Kitchen" },
  });

  if (!testDept) {
    testDept = await prisma.department.create({
      data: {
        restaurantId,
        name: "Culinary & Kitchen",
        code: "CULINARY",
      },
    });
  }

  console.log("\n── Section 1: Create Vault Item ──");
  const vaultItem = await prisma.vaultItem.create({
    data: {
      restaurantId,
      authorId: testUser.id,
      title: "Supplier Portal Credentials",
      itemType: "LOGIN",
      websiteUrl: "https://supplier.example.com",
      encryptedData: "test-ciphertext-base64",
      iv: "test-iv-base64",
      authTag: "test-authtag-base64",
      tags: ["suppliers", "login"],
    },
  });

  assert(!!vaultItem.id, `Created vault secret item ID: ${vaultItem.id}`);
  totalTests++;

  console.log("\n── Section 2: Share Secret with Team Member (User ID) ──");
  const userShare = await prisma.vaultItemShare.create({
    data: {
      vaultItemId: vaultItem.id,
      recipientId: recipientUser.id,
      permission: "READ_ONLY",
    },
    include: {
      recipient: { select: { id: true, name: true, email: true } },
    },
  });

  assert(!!userShare.id, `Created user access grant ID: ${userShare.id}`);
  assert(userShare.recipient?.id === recipientUser.id, "Recipient user linked correctly");
  assert(userShare.permission === "READ_ONLY", "Permission set to READ_ONLY");
  totalTests += 3;

  console.log("\n── Section 3: Update Existing Share Permission (CAN_EDIT) ──");
  const updatedUserShare = await prisma.vaultItemShare.update({
    where: { id: userShare.id },
    data: { permission: "CAN_EDIT" },
    include: { recipient: true },
  });

  assert(updatedUserShare.permission === "CAN_EDIT", "Permission upgraded to CAN_EDIT");
  totalTests++;

  console.log("\n── Section 4: Share Secret with Role & Department ──");
  const roleShare = await prisma.vaultItemShare.create({
    data: {
      vaultItemId: vaultItem.id,
      roleId: testRole.id,
      permission: "AUTOFILL_ONLY",
    },
    include: { role: true },
  });

  assert(!!roleShare.id, `Created role access grant ID: ${roleShare.id}`);
  assert(roleShare.role?.name === "Kitchen Lead", "Role linked correctly");
  totalTests += 2;

  const deptShare = await prisma.vaultItemShare.create({
    data: {
      vaultItemId: vaultItem.id,
      departmentId: testDept.id,
      permission: "READ_ONLY",
    },
    include: { department: true },
  });

  assert(!!deptShare.id, `Created department access grant ID: ${deptShare.id}`);
  assert(deptShare.department?.name === "Culinary & Kitchen", "Department linked correctly");
  totalTests += 2;

  console.log("\n── Section 5: Query Vault Item with All Active Grants ──");
  const itemWithShares = await prisma.vaultItem.findUnique({
    where: { id: vaultItem.id },
    include: {
      shares: {
        include: {
          recipient: true,
          role: true,
          department: true,
        },
      },
    },
  });

  assert(itemWithShares?.shares.length === 3, "Vault item has all 3 active access grants");
  totalTests++;

  console.log("\n── Section 6: Revoke Access Grant ──");
  await prisma.vaultItemShare.delete({
    where: { id: userShare.id },
  });

  const remainingShares = await prisma.vaultItemShare.findMany({
    where: { vaultItemId: vaultItem.id },
  });

  assert(remainingShares.length === 2, "Grant revoked cleanly, 2 remaining grants");
  totalTests++;

  // Cleanup
  await prisma.vaultItem.delete({ where: { id: vaultItem.id } });

  console.log("\n=========================================================");
  console.log(`  Test Results: ${totalTests} Passed, 0 Failed`);
  console.log("=========================================================\n");
}

runVaultSharingTests().catch((err) => {
  console.error("Vault sharing test failed:", err);
  process.exit(1);
});
