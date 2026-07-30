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
let prismaInstance: PrismaClient;

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/restaurant_saas?schema=public";

if (!globalForPrisma.prisma) {
  const pool = new Pool({
    connectionString,
    max: 15, // conservative pool size appropriate for PgBouncer
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  const adapter = new PrismaPg(pool);
  globalForPrisma.prisma = new PrismaClient({ adapter });
}

prismaInstance = globalForPrisma.prisma;

export const prisma = prismaInstance;
export { connectionString };
