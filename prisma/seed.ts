import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/restaurant_saas?schema=public";
const pool = new Pool({ connectionString, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding all 12 operational and security modules...");

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
      description: "Track employee check-in, clock-out details and kiosk punch PINs.",
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
      name: "Payroll & Compensation",
      description: "Process monthly salaries, calculate deductions, tip pools and generate payslips.",
      status: "ACTIVE",
      sortOrder: 5,
      availability: "GENERAL",
    },
    {
      id: "inventory",
      name: "Inventory & Stock Control",
      description: "Track real-time stock levels, adjustments, recipes, and wastage.",
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
    {
      id: "finance",
      name: "Finance & P&L Tracker",
      description: "Automated expense aggregation from payroll & POs, revenue tracker, 15 standard accounting categories, and upcoming bills reminder.",
      status: "ACTIVE",
      sortOrder: 9,
      availability: "GENERAL",
    },
    {
      id: "vault",
      name: "Secrets Vault & 2FA",
      description: "Enterprise zero-knowledge secret storage, password generator, 2FA TOTP authenticator, and granular role/team sharing.",
      status: "ACTIVE",
      sortOrder: 10,
      availability: "GENERAL",
    },
    {
      id: "pos",
      name: "Point of Sale (POS)",
      description: "Digital table order taking, menu catalog, kitchen ticketing, and bill settlement.",
      status: "ACTIVE",
      sortOrder: 11,
      availability: "GENERAL",
    },
    {
      id: "analytics",
      name: "Analytics & Menu Engineering",
      description: "Menu engineering matrix (Stars, Plowhorses, Puzzles, Dogs), food cost variance and profitability reports.",
      status: "ACTIVE",
      sortOrder: 12,
      availability: "GENERAL",
    },
    {
      id: "catering",
      name: "Catering & Event Management",
      description: "Manage end-to-end catering events, menu packages, guest pax pricing, recipe autofill, raw ingredient scaling, advance deposits, and invoices.",
      status: "ACTIVE",
      sortOrder: 13,
      availability: "GENERAL",
    },
    {
      id: "shifts",
      name: "Shift Management",
      description: "Manage schedules, rosters, templates and swaps.",
      status: "ACTIVE",
      sortOrder: 14,
      availability: "GENERAL",
    },
    {
      id: "workforce",
      name: "Workforce & HR",
      description: "Manage employee profiles, onboarding tasks and legal documents.",
      status: "ACTIVE",
      sortOrder: 15,
      availability: "GENERAL",
    },
    {
      id: "operations",
      name: "Operations & Checklists",
      description: "Opening/closing checklists and SOP temp audits.",
      status: "ACTIVE",
      sortOrder: 16,
      availability: "GENERAL",
    },
    {
      id: "masterdata",
      name: "Master Data Settings",
      description: "Multi-outlet profiles and tax rates.",
      status: "ACTIVE",
      sortOrder: 17,
      availability: "GENERAL",
    },
    {
      id: "rbac",
      name: "Role Based Access Controls",
      description: "Security roles and permissions.",
      status: "ACTIVE",
      sortOrder: 18,
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

  console.log("Seeding permissions across all 13 modules...");
  const permissions = [
    // HR Onboarding
    { id: "hr:view_employees", moduleId: "hr_onboarding", name: "View Employees", description: "Read staff directory" },
    { id: "hr:manage_onboarding", moduleId: "hr_onboarding", name: "Manage Onboarding", description: "Onboard new employees" },
    { id: "hr:approve_onboarding", moduleId: "hr_onboarding", name: "Approve Onboarding", description: "Approve legal checks" },
    
    // Shifts
    { id: "shifts:view_roster", moduleId: "shift_management", name: "View Roster", description: "View scheduling calendars & shift rosters" },
    { id: "shifts:update_availability", moduleId: "shift_management", name: "Submit Availability", description: "Specify weekly availability and preferred working hours" },
    { id: "shifts:request_swap", moduleId: "shift_management", name: "Request Shift Swap", description: "Request shift trades with eligible co-workers" },
    { id: "shifts:approve_swap", moduleId: "shift_management", name: "Approve Shift Swap", description: "Authorize employee shift trade requests" },
    { id: "shifts:manage_roster", moduleId: "shift_management", name: "Manage Roster", description: "Create weekly schedules, assign shifts & publish rosters" },
    { id: "shifts:manage_templates", moduleId: "shift_management", name: "Manage Shift Templates", description: "Configure standard shift presets and break policies" },

    // Attendance
    { id: "attendance:punch", moduleId: "attendance", name: "Punch Clock In / Out", description: "Clock in, clock out, and track break times" },
    { id: "attendance:view_my_attendance", moduleId: "attendance", name: "View My Attendance", description: "View personal timesheet history & total hours worked" },
    { id: "attendance:view", moduleId: "attendance", name: "View Team Attendance", description: "View live attendance board and team punch records" },
    { id: "attendance:manage", moduleId: "attendance", name: "Manage Timesheets", description: "Edit, adjust and rectify time punches & PINs" },
    { id: "attendance:kiosk_access", moduleId: "attendance", name: "Kiosk Clock Access", description: "Access shared kiosk mode for PIN-based attendance clocking" },

    // Leave Management
    { id: "leaves:view", moduleId: "leave_management", name: "View Leaves", description: "View leave requests and balance" },
    { id: "leaves:request", moduleId: "leave_management", name: "Submit Leave Request", description: "Apply for paid, sick or casual leaves" },
    { id: "leaves:approve", moduleId: "leave_management", name: "Approve Leaves", description: "Authorize employee leave requests" },

    // Payroll
    { id: "payroll:view_payroll", moduleId: "payroll", name: "View Payroll", description: "Read salary data and payslips" },
    { id: "payroll:run_payroll", moduleId: "payroll", name: "Run Payroll", description: "Execute monthly payouts & calculate wages" },
    { id: "payroll:approve_payroll", moduleId: "payroll", name: "Approve Payroll", description: "Authorize salary disbursement" },

    // Inventory
    { id: "inventory:view_items", moduleId: "inventory", name: "View Items", description: "View stock items and levels" },
    { id: "inventory:manage_items", moduleId: "inventory", name: "Manage Items", description: "Adjust stock, log wastage and stocktakes" },
    { id: "inventory:manage_recipes", moduleId: "inventory", name: "Manage Recipes", description: "Create recipes, ingredients and calculate plate costs" },

    // Vendor Management
    { id: "inventory:manage_vendors", moduleId: "vendor_management", name: "Manage Vendors", description: "Onboard and edit raw material suppliers" },
    { id: "vendors:view", moduleId: "vendor_management", name: "View Vendors", description: "Access vendor contact details and catalogs" },

    // Purchase Management
    { id: "inventory:create_po", moduleId: "purchase_management", name: "Create Purchase Orders", description: "Draft purchase orders" },
    { id: "inventory:approve_po", moduleId: "purchase_management", name: "Approve Purchase Orders", description: "Approve and authorize procurement" },
    { id: "inventory:receive_po", moduleId: "purchase_management", name: "Receive Shipments", description: "Receive inventory and verify deliveries" },

    // Finance & P&L Tracker
    { id: "finance:view", moduleId: "finance", name: "View Financials", description: "View P&L, revenue breakdown and runway stats" },
    { id: "finance:manage_transactions", moduleId: "finance", name: "Manage Transactions", description: "Add and edit manual revenue and expense records" },
    { id: "finance:manage_bills", moduleId: "finance", name: "Manage Upcoming Bills", description: "Add and schedule vendor/credit card bill payments" },
    { id: "finance:approve_payments", moduleId: "finance", name: "Approve Payments", description: "Mark bills paid and reconcile financial statements" },

    // Zero-Knowledge Vault
    { id: "vault:view", moduleId: "vault", name: "Access Vault", description: "View credentials, software keys and TOTP codes" },
    { id: "vault:manage_items", moduleId: "vault", name: "Manage Secrets", description: "Create, edit and archive encrypted credentials" },
    { id: "vault:share", moduleId: "vault", name: "Share Secrets", description: "Grant and revoke credential sharing across roles and teams" },

    // POS
    { id: "pos:view", moduleId: "pos", name: "Access POS", description: "Access Point of Sale terminal and menu" },
    { id: "pos:take_orders", moduleId: "pos", name: "Take Orders", description: "Create and modify table orders" },
    { id: "pos:settle_bills", moduleId: "pos", name: "Settle Bills", description: "Process payments, cash/card and discounts" },

    // Analytics
    { id: "analytics:view", moduleId: "analytics", name: "View Analytics", description: "Access menu engineering matrix and food cost variance" },
    { id: "analytics:export", moduleId: "analytics", name: "Export Reports", description: "Download financial and operational analytics" },

    // Catering
    { id: "catering:view", moduleId: "catering", name: "View Catering", description: "Access catering dashboard, event orders & invoices" },
    { id: "catering:manage_orders", moduleId: "catering", name: "Manage Catering Orders", description: "Create, edit, and update status of catering events" },
    { id: "catering:manage_packages", moduleId: "catering", name: "Manage Menu Packages", description: "Define custom event items & link recipe items" },
    { id: "catering:approve_deposit", moduleId: "catering", name: "Approve Deposits & Billing", description: "Record advance payments and balance settlements" },

    // Module Aliases
    { id: "shifts:view", moduleId: "shifts", name: "View Shifts", description: "View shift rosters" },
    { id: "shifts:manage", moduleId: "shifts", name: "Manage Shifts", description: "Manage rosters and templates" },
    { id: "workforce:view", moduleId: "workforce", name: "View Workforce", description: "View staff directory" },
    { id: "workforce:manage", moduleId: "workforce", name: "Manage Workforce", description: "Manage employees and onboarding" },
    { id: "operations:view", moduleId: "operations", name: "View Operations", description: "View checklists and temp logs" },
    { id: "operations:manage", moduleId: "operations", name: "Manage Operations", description: "Manage SOP templates and audits" },
    { id: "masterdata:view", moduleId: "masterdata", name: "View Master Data", description: "View outlet settings and tax rates" },
    { id: "masterdata:manage", moduleId: "masterdata", name: "Manage Master Data", description: "Configure tax rates and outlets" },
    { id: "rbac:view", moduleId: "rbac", name: "View RBAC", description: "View roles and permissions" },
    { id: "rbac:manage", moduleId: "rbac", name: "Manage RBAC", description: "Create roles and grant permissions" },
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

  console.log("Auto-enabling catering module for existing restaurants...");
  const restaurants = await prisma.restaurant.findMany({ select: { id: true } });
  const cateringPerms = await prisma.permission.findMany({ where: { moduleId: "catering" } });

  for (const rest of restaurants) {
    await prisma.restaurantModule.upsert({
      where: {
        restaurantId_moduleId: {
          restaurantId: rest.id,
          moduleId: "catering",
        },
      },
      update: { status: "ACTIVE" },
      create: {
        restaurantId: rest.id,
        moduleId: "catering",
        status: "ACTIVE",
      },
    });

    const roles = await prisma.role.findMany({
      where: { restaurantId: rest.id },
    });

    for (const role of roles) {
      for (const perm of cateringPerms) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
    }
  }

  console.log("Seeding sample recipes & catering packages across all restaurants...");
  for (const rest of restaurants) {
    // Seed Sample Recipes
    const sampleRecipes = [
      { name: "Royal Hyderabadi Dum Biryani", type: "DISH", yieldQuantity: 10, yieldUnit: "PIECES", sellingPrice: 18.00, costPerUnit: 5.50 },
      { name: "Paneer Butter Masala", type: "DISH", yieldQuantity: 10, yieldUnit: "PIECES", sellingPrice: 14.00, costPerUnit: 4.00 },
      { name: "Chicken 65 Starter", type: "DISH", yieldQuantity: 10, yieldUnit: "PIECES", sellingPrice: 12.00, costPerUnit: 3.50 },
      { name: "Tandoori Butter Naan", type: "SUB_RECIPE", yieldQuantity: 10, yieldUnit: "PIECES", sellingPrice: 4.00, costPerUnit: 1.00 },
      { name: "Gulab Jamun with Ice Cream", type: "DISH", yieldQuantity: 10, yieldUnit: "PIECES", sellingPrice: 6.00, costPerUnit: 1.50 },
      { name: "Fresh Mint Lassi Cooler", type: "DISH", yieldQuantity: 10, yieldUnit: "PIECES", sellingPrice: 5.00, costPerUnit: 1.20 },
    ];

    for (const rec of sampleRecipes) {
      await prisma.recipe.upsert({
        where: {
          restaurantId_name: {
            restaurantId: rest.id,
            name: rec.name,
          },
        },
        update: {},
        create: {
          restaurantId: rest.id,
          name: rec.name,
          type: rec.type as any,
          yieldQuantity: rec.yieldQuantity,
          yieldUnit: rec.yieldUnit as any,
          sellingPrice: rec.sellingPrice,
          costPerUnit: rec.costPerUnit,
          totalCost: rec.costPerUnit * rec.yieldQuantity,
        },
      });
    }

    // Seed Sample Catering Package
    await prisma.cateringPackage.upsert({
      where: {
        restaurantId_name: {
          restaurantId: rest.id,
          name: "Grand Royal Feast Package",
        },
      },
      update: {},
      create: {
        restaurantId: rest.id,
        name: "Grand Royal Feast Package",
        description: "Includes Welcome Drink, Chicken 65, Dum Biryani, Naan & Gulab Jamun",
        category: "Buffet",
        pricePerPax: 42.00,
        suggestedPax: 100,
        items: {
          create: [
            { itemName: "Fresh Mint Lassi Cooler", category: "Beverages", unitPrice: 5.00, portionQtyPerPax: 1 },
            { itemName: "Chicken 65 Starter", category: "Starters & Appetizers", unitPrice: 10.00, portionQtyPerPax: 1 },
            { itemName: "Royal Hyderabadi Dum Biryani", category: "Main Course", unitPrice: 18.00, portionQtyPerPax: 1 },
            { itemName: "Tandoori Butter Naan", category: "Breads & Rice", unitPrice: 4.00, portionQtyPerPax: 1 },
            { itemName: "Gulab Jamun with Ice Cream", category: "Desserts", unitPrice: 5.00, portionQtyPerPax: 1 },
          ],
        },
      },
    });
  }

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
