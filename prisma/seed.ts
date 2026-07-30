import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL || "postgresql://app_user:password@localhost:5432/restaurant_saas";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding modules...");
  
  const modules = [
    {
      id: "hr_onboarding",
      name: "HR Onboarding",
      description: "Manage employee profiles, onboarding tasks and legal documents.",
      status: "ACTIVE",
      sortOrder: 1,
      availability: "GENERAL",
    },
    {
      id: "shift_management",
      name: "Shift Management",
      description: "Manage schedules, rosters, templates and swaps.",
      status: "ACTIVE",
      sortOrder: 2,
      availability: "GENERAL",
    },
    {
      id: "attendance",
      name: "Attendance",
      description: "Track employee check-in and clock-out details.",
      status: "ACTIVE",
      sortOrder: 3,
      availability: "GENERAL",
    },
    {
      id: "leave_management",
      name: "Leave Management",
      description: "Manage employee paid leaves, sick leaves and approvals.",
      status: "ACTIVE",
      sortOrder: 4,
      availability: "GENERAL",
    },
    {
      id: "payroll",
      name: "Payroll",
      description: "Process monthly salaries, calculate deductions and generate payslips.",
      status: "ACTIVE",
      sortOrder: 5,
      availability: "GENERAL",
    },
    {
      id: "inventory",
      name: "Inventory",
      description: "Track real-time branch stock level, adjustments and wastage.",
      status: "ACTIVE",
      sortOrder: 6,
      availability: "GENERAL",
    },
    {
      id: "vendor_management",
      name: "Vendor Management",
      description: "Manage raw material vendors and supplier lists.",
      status: "ACTIVE",
      sortOrder: 7,
      availability: "GENERAL",
    },
    {
      id: "purchase_management",
      name: "Purchase Management",
      description: "Generate and approve Purchase Orders for vendor shipments.",
      status: "ACTIVE",
      sortOrder: 8,
      availability: "GENERAL",
    },
  ];

  for (const mod of modules) {
    await prisma.module.upsert({
      where: { id: mod.id },
      update: mod,
      create: mod,
    });
  }
  
  console.log("Seeding permissions...");
  const permissions = [
    // hr permissions
    { id: "hr:view_employees", moduleId: "hr_onboarding", name: "View Employees", description: "Read staff directory" },
    { id: "hr:manage_onboarding", moduleId: "hr_onboarding", name: "Manage Onboarding", description: "Onboard new employees" },
    { id: "hr:approve_onboarding", moduleId: "hr_onboarding", name: "Approve Onboarding", description: "Approve legal checks" },
    // shifts permissions
    { id: "shifts:view_roster", moduleId: "shift_management", name: "View Roster", description: "View scheduling calendars" },
    { id: "shifts:manage_roster", moduleId: "shift_management", name: "Manage Roster", description: "Create weekly schedules" },
    { id: "shifts:approve_swap", moduleId: "shift_management", name: "Approve Swap", description: "Approve employee shift trades" },
    // inventory permissions
    { id: "inventory:view_items", moduleId: "inventory", name: "View Items", description: "View raw stocks" },
    { id: "inventory:manage_items", moduleId: "inventory", name: "Manage Items", description: "Adjust stock and logs" },
    { id: "inventory:create_po", moduleId: "inventory", name: "Create PO", description: "Draft purchase orders" },
    { id: "inventory:approve_po", moduleId: "inventory", name: "Approve PO", description: "Approve purchase logs" },
    { id: "inventory:manage_vendors", moduleId: "inventory", name: "Manage Vendors", description: "Onboard suppliers" },
    // payroll permissions
    { id: "payroll:view_payroll", moduleId: "payroll", name: "View Payroll", description: "Read salary data" },
    { id: "payroll:run_payroll", moduleId: "payroll", name: "Run Payroll", description: "Execute monthly payouts" },
    { id: "payroll:approve_payroll", moduleId: "payroll", name: "Approve Payroll", description: "Finalize payouts" },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: perm,
      create: perm,
    });
  }

  console.log("Seeding subscription plans...");
  const plans = [
    {
      id: "std-plan",
      name: "Standard",
      maxOutlets: 2,
      maxEmployees: 30,
      maxAdminUsers: 3,
      storageQuotaGb: 5,
      priceMonthly: 49.00,
    },
    {
      id: "ent-plan",
      name: "Enterprise",
      maxOutlets: 10,
      maxEmployees: 200,
      maxAdminUsers: 10,
      storageQuotaGb: 50,
      priceMonthly: 199.00,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }

  console.log("Seeding Platform Super Admin...");
  const passwordHash = await bcrypt.hash("superadmin123", 10);
  await prisma.platformUser.upsert({
    where: { email: "admin@platform.com" },
    update: { passwordHash },
    create: {
      email: "admin@platform.com",
      name: "Platform Super Admin",
      passwordHash,
    },
  });

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
