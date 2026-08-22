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
  if (process.env.NODE_ENV !== "production" && typeof require !== "undefined" && require.cache) {
    Object.keys(require.cache).forEach((key) => {
      if (key.includes("@prisma/client") || key.includes(".prisma/client")) {
        delete require.cache[key];
      }
    });
  }
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export function getPrismaClient(requiredProp?: string | symbol): PrismaClient {
  const p = globalForPrisma.prisma as any;
  if (
    !p ||
    !p.userVaultProfile ||
    !p.vaultItem ||
    !p.attendanceRecord ||
    !p.timePunch ||
    !p.tipPoolRule ||
    !p.financialTransaction ||
    !p.upcomingBill ||
    !p.shiftChecklistTemplate ||
    !p.shiftChecklistExecution ||
    !p.cateringOrder ||
    !p.cateringPackage ||
    !p.recipe ||
    !p.rosterDateAvailability ||
    !p.rosterEmployeeSubmission ||
    (requiredProp && typeof requiredProp === "string" && !requiredProp.startsWith("$") && !requiredProp.startsWith("_") && !p[requiredProp])
  ) {
    try {
      globalForPrisma.prisma = createPrismaClient();
    } catch {
      // ignore
    }
  }
  return globalForPrisma.prisma!;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    let client = getPrismaClient(prop);
    let val = (client as any)[prop];
    if (val === undefined && typeof prop === "string" && !prop.startsWith("$") && !prop.startsWith("_")) {
      // Re-instantiate once more to ensure latest generated Prisma Client is loaded in long-running dev processes
      try {
        globalForPrisma.prisma = createPrismaClient();
        client = globalForPrisma.prisma;
        val = (client as any)[prop];
      } catch {
        // ignore
      }
    }
    if (typeof val === "function") {
      return val.bind(client);
    }
    return val;
  },
});

export { connectionString };
