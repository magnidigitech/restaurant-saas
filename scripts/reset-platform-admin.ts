import { prisma } from "../src/core/database/client";
import * as bcrypt from "bcryptjs";

async function main() {
  const email = process.argv[2]?.trim() || "admin@platform.com";
  const newPassword = process.argv[3]?.trim() || "superadmin123";

  console.log(`Setting password for Platform Super Admin: ${email}`);

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const user = await prisma.platformUser.upsert({
    where: { email },
    update: {
      passwordHash,
    },
    create: {
      email,
      name: "Platform Super Admin",
      passwordHash,
    },
  });

  console.log(`\n✅ Successfully configured Platform Super Admin!`);
  console.log(`Email:    ${user.email}`);
  console.log(`Password: ${newPassword}\n`);
}

main()
  .catch((err) => {
    console.error("Error setting platform admin password:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
