import { prisma } from "../src/core/database/client";
import { ensureTwoFactorTables } from "../src/core/database/ensure-tables";

async function main() {
  await ensureTwoFactorTables();
  const email = process.argv[2]?.trim();

  if (!email) {
    console.log(`
======================================================
Resto Bird — Emergency 2FA Reset Utility
======================================================
Usage:
  npx tsx scripts/reset-2fa.ts <user-email>

Example:
  npx tsx scripts/reset-2fa.ts hari@bahubali.com
======================================================
`);

    // List users who have 2FA enabled
    try {
      const active2faUsers = await prisma.twoFactorAuth.findMany({
        where: { enabled: true },
        include: { user: { select: { email: true, name: true } } },
      });

      if (active2faUsers.length === 0) {
        console.log("ℹ️ No users currently have 2FA enabled.");
      } else {
        console.log("Users with active 2FA:");
        active2faUsers.forEach((u) => {
          console.log(` - ${u.user.email} (${u.user.name})`);
        });
      }
    } catch {
      // Ignore if table query fails
    }
    process.exit(0);
  }

  // Find user
  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
    },
    include: {
      twoFactorAuth: true,
    },
  });

  if (!user) {
    console.error(`❌ Error: User with email "${email}" not found.`);
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (${user.email})`);

  // Clear 2FA state
  await prisma.$transaction(async (tx) => {
    // Delete recovery codes
    await tx.twoFactorRecoveryCode.deleteMany({
      where: { userId: user.id },
    });

    // Reset 2FA configuration
    await tx.twoFactorAuth.upsert({
      where: { userId: user.id },
      update: {
        enabled: false,
        secretEncrypted: null,
        verifiedAt: null,
      },
      create: {
        userId: user.id,
        enabled: false,
      },
    });

    // Write audit log
    await tx.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        action: "2FA_RESET_EMERGENCY_CLI",
        entityType: "UserTwoFactor",
        entityId: user.id,
      },
    });
  });

  console.log(`
✅ SUCCESS: Two-Factor Authentication has been completely reset for:
   ${user.email}

The user can now sign in using just their email and password,
and can set up a new authenticator app from Settings > Security.
`);
}

main()
  .catch((e) => {
    console.error("Failed to reset 2FA:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
