import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/restaurant_saas?schema=public";
const pool = new Pool({ connectionString, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function resetAdminPassword() {
  const email = process.argv[2] || "admin@restobird.com";
  const newPassword = process.argv[3] || "Superadmin@123";

  console.log(`Resetting admin password for: ${email}...`);
  const passwordHash = await bcrypt.hash(newPassword, 10);

  const user = await prisma.platformUser.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      name: "Resto Bird Platform Admin",
      passwordHash,
    },
  });

  console.log(`Successfully set password for ${user.email} to: ${newPassword}`);
}

resetAdminPassword()
  .catch((e) => {
    console.error("Error resetting admin password:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
