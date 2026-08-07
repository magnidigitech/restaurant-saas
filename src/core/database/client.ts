import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!process.env.DATABASE_URL) {
  if (!isBuildPhase) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }
}

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/restaurant_saas?schema=public";

export function createPrismaClient() {
  const pool = new Pool({
    connectionString,
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

if (!globalForPrisma.prisma || !(globalForPrisma.prisma as any).vendorItem || !(globalForPrisma.prisma as any).purchaseOrder) {
  globalForPrisma.prisma = createPrismaClient();
}

export const prisma = globalForPrisma.prisma;
export { connectionString };
