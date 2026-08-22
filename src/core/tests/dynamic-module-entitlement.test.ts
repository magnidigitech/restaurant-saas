import { prisma } from "../database/client";

async function runDynamicModuleTest() {
  console.log("Running Dynamic Module Entitlements Test...");
  const modules = await prisma.module.findMany({
    orderBy: { sortOrder: "asc" },
  });
  if (modules.length < 12) {
    throw new Error(`Expected at least 12 modules, got ${modules.length}`);
  }

  const moduleKeys = modules.map((m) => m.id);
  console.log("Found modules:", moduleKeys);

  const perms = await prisma.permission.findMany();
  const permModuleIds = new Set(perms.map((p) => p.moduleId));
  if (!permModuleIds.has("catering")) {
    throw new Error("Expected catering permissions to exist.");
  }

  console.log("Dynamic Module Entitlement Test Passed.");
}

runDynamicModuleTest()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  });
