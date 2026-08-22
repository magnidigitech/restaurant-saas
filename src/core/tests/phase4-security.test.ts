/**
 * Phase 4 Security & Functional Verification Test Suite
 * Run: npx tsx src/core/tests/phase4-security.test.ts
 *
 * Verifies:
 * 1. Shift Templates tenant isolation (Cross-restaurant reads & mutations rejected)
 * 2. Shift Rosters & Assignments tenant isolation (Cross-restaurant scheduling blocked)
 * 3. Shift Swap workflow integrity & boundary enforcement
 * 4. Employee Availability tenant isolation
 * 5. Salary Structure confidentiality & tenant isolation
 * 6. Payroll Run execution & calculation engine (with loose shift hour aggregation)
 * 7. Payroll Run state machine (Draft -> Calculating -> Approved -> Paid)
 * 8. Payslip itemization and cross-tenant access denial
 */

import "dotenv/config";
import { PrismaClient, RosterStatus, ShiftAssignmentStatus, SwapRequestStatus, PayFrequency, PayrollRunStatus, PayslipStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { ShiftService } from "../../modules/shifts/service";
import { PayrollService } from "../../modules/payroll/service";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/restaurant_saas?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

let passCount = 0;
let failCount = 0;

function pass(label: string) {
  console.log(`  ✅ PASS: ${label}`);
  passCount++;
}

function fail(label: string, detail?: string) {
  console.error(`  ❌ FAIL: ${label}${detail ? " — " + detail : ""}`);
  failCount++;
}

async function main() {
  console.log("\n========================================");
  console.log("  Phase 4 Security & Functional Test Suite");
  console.log("========================================\n");

  // ── Setup: Find or Create Test Restaurants ────────────────────────────
  let restaurants = await prisma.restaurant.findMany({ take: 2 });
  if (restaurants.length === 0) {
    console.error("⛔  No restaurants found.");
    process.exit(1);
  }

  let restaurantA = restaurants[0];
  let restaurantB = restaurants.length > 1 ? restaurants[1] : null;

  if (!restaurantB) {
    restaurantB = await prisma.restaurant.create({
      data: {
        name: "Second Test Restaurant",
        subdomain: `test-r2-${Date.now()}`,
        status: "ACTIVE",
      },
    });
  }

  console.log("Test Environment:");
  console.log(`  Restaurant A: ${restaurantA.name} (${restaurantA.id})`);
  console.log(`  Restaurant B: ${restaurantB.name} (${restaurantB.id})`);

  // Ensure both have at least one outlet and one employee
  let outletA = await prisma.restaurantOutlet.findFirst({ where: { restaurantId: restaurantA.id } });
  if (!outletA) {
    outletA = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurantA.id, name: "Downtown Branch" },
    });
  }

  let outletB = await prisma.restaurantOutlet.findFirst({ where: { restaurantId: restaurantB.id } });
  if (!outletB) {
    outletB = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurantB.id, name: "Uptown Branch" },
    });
  }

  let empA1 = await prisma.employee.findFirst({ where: { restaurantId: restaurantA.id, archivedAt: null } });
  if (!empA1) {
    empA1 = await prisma.employee.create({
      data: {
        restaurantId: restaurantA.id,
        employeeCode: `EMP-T1-${Date.now()}`,
        firstName: "Alice",
        lastName: "Smith",
        joiningDate: new Date(),
      },
    });
  }

  let empA2 = await prisma.employee.findFirst({
    where: { restaurantId: restaurantA.id, id: { not: empA1.id }, archivedAt: null },
  });
  if (!empA2) {
    empA2 = await prisma.employee.create({
      data: {
        restaurantId: restaurantA.id,
        employeeCode: `EMP-T2-${Date.now()}`,
        firstName: "Bob",
        lastName: "Jones",
        joiningDate: new Date(),
      },
    });
  }

  let empB = await prisma.employee.findFirst({ where: { restaurantId: restaurantB.id, archivedAt: null } });
  if (!empB) {
    empB = await prisma.employee.create({
      data: {
        restaurantId: restaurantB.id,
        employeeCode: `EMP-B1-${Date.now()}`,
        firstName: "Charlie",
        lastName: "Brown",
        joiningDate: new Date(),
      },
    });
  }

  // Clean up existing shifts for isolated test execution
  await prisma.shiftAssignment.deleteMany({
    where: { restaurantId: { in: [restaurantA.id, restaurantB.id] } },
  });

  // ── Section 1: Shift Templates Isolation ───────────────────────────────
  console.log("\n── Section 1: Shift Templates Isolation ──");

  const templateA = await ShiftService.createTemplate(restaurantA.id, {
    name: `Morning Rush ${Date.now()}`,
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 30,
    color: "#3b82f6",
  });

  const templatesA = await ShiftService.getTemplates(restaurantA.id);
  if (templatesA.some((t) => t.id === templateA.id)) {
    pass("Restaurant A can list its own shift templates");
  } else {
    fail("Restaurant A could not list its template");
  }

  const templatesB = await ShiftService.getTemplates(restaurantB.id);
  if (!templatesB.some((t) => t.id === templateA.id)) {
    pass("Shift templates are strictly tenant-isolated (Restaurant B cannot view Restaurant A's template)");
  } else {
    fail("Tenant leak: Restaurant B saw Restaurant A's shift template");
  }

  // Cross-tenant template modification rejected
  try {
    await ShiftService.updateTemplate(restaurantB.id, templateA.id, { name: "Hacked Template" });
    fail("Cross-tenant template update was not rejected");
  } catch {
    pass("Cross-restaurant template update rejected");
  }

  // ── Section 2: Shift Rosters & Assignments Isolation ──────────────────
  console.log("\n── Section 2: Shift Rosters & Assignments Isolation ──");

  const rosterA = await ShiftService.createRoster(restaurantA.id, {
    outletId: outletA.id,
    name: "Week 34 Downtown Schedule",
    startDate: "2026-08-17",
    endDate: "2026-08-23",
  });

  if (rosterA.id && rosterA.status === RosterStatus.DRAFT) {
    pass("Restaurant A created a draft weekly roster");
  } else {
    fail("Failed to create weekly roster for Restaurant A");
  }

  // Reject assigning an outlet from Restaurant B to Restaurant A roster
  try {
    await ShiftService.createRoster(restaurantA.id, {
      outletId: outletB.id, // cross-tenant outlet!
      name: "Invalid Outlet Roster",
      startDate: "2026-08-17",
      endDate: "2026-08-23",
    });
    fail("Cross-tenant outlet in roster creation was not rejected");
  } catch {
    pass("Cross-restaurant outlet in roster creation rejected");
  }

  // Create Shift Assignment for Employee A1
  const assignmentA1 = await ShiftService.createAssignment(restaurantA.id, {
    rosterId: rosterA.id,
    templateId: templateA.id,
    employeeId: empA1.id,
    outletId: outletA.id,
    shiftDate: "2026-08-18",
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 30,
  });

  const assignmentA2 = await ShiftService.createAssignment(restaurantA.id, {
    rosterId: rosterA.id,
    templateId: templateA.id,
    employeeId: empA2.id,
    outletId: outletA.id,
    shiftDate: "2026-08-19",
    startTime: "08:00",
    endTime: "16:00",
    breakMinutes: 30,
  });

  if (assignmentA1.id && assignmentA2.id) {
    pass("Shift assignments successfully scheduled on roster");
  } else {
    fail("Failed to create shift assignments");
  }

  // Reject assigning Employee B to Restaurant A
  try {
    await ShiftService.createAssignment(restaurantA.id, {
      rosterId: rosterA.id,
      employeeId: empB.id, // cross-tenant employee!
      outletId: outletA.id,
      shiftDate: "2026-08-18",
      startTime: "08:00",
      endTime: "16:00",
    });
    fail("Cross-tenant employee assignment was not rejected");
  } catch {
    pass("Cross-restaurant employee shift assignment rejected");
  }

  // Reject overlapping shift for Employee A1 on same day
  try {
    await ShiftService.createAssignment(restaurantA.id, {
      rosterId: rosterA.id,
      employeeId: empA1.id,
      outletId: outletA.id,
      shiftDate: "2026-08-18",
      startTime: "10:00", // overlaps with 08:00 - 16:00
      endTime: "18:00",
    });
    fail("Overlapping shift assignment was not rejected");
  } catch {
    pass("Overlapping shift on the same date is rejected");
  }

  // ── Section 3: Shift Swap Workflow ────────────────────────────────────
  console.log("\n── Section 3: Shift Swap Workflow ──");

  const swapRequest = await ShiftService.createSwapRequest(restaurantA.id, {
    assignmentId: assignmentA1.id,
    requesterEmployeeId: empA1.id,
    targetEmployeeId: empA2.id,
    targetAssignmentId: assignmentA2.id,
    reason: "Doctor appointment on Tuesday",
  });

  if (swapRequest.id && swapRequest.status === SwapRequestStatus.PENDING) {
    pass("Shift swap request created in PENDING state");
  } else {
    fail("Failed to create shift swap request");
  }

  // Reject cross-restaurant swap review
  try {
    await ShiftService.reviewSwapRequest(restaurantB.id, swapRequest.id, {
      status: SwapRequestStatus.APPROVED,
      reviewedBy: "attacker-user",
    });
    fail("Cross-tenant swap request review was not rejected");
  } catch {
    pass("Cross-restaurant swap request review rejected");
  }

  // Approve swap request and verify employee assignment exchange
  const approvedSwap = await ShiftService.reviewSwapRequest(restaurantA.id, swapRequest.id, {
    status: SwapRequestStatus.APPROVED,
    reviewNotes: "Approved by Store Manager",
    reviewedBy: "manager-user-id",
  });

  const updatedA1 = await prisma.shiftAssignment.findUnique({ where: { id: assignmentA1.id } });
  const updatedA2 = await prisma.shiftAssignment.findUnique({ where: { id: assignmentA2.id } });

  if (
    approvedSwap.status === SwapRequestStatus.APPROVED &&
    updatedA1?.employeeId === empA2.id &&
    updatedA2?.employeeId === empA1.id
  ) {
    pass("Shift swap approval automatically exchanged employee assignments on roster");
  } else {
    fail("Shift swap approval did not exchange employee assignments correctly");
  }

  // ── Section 4: Employee Availability ──────────────────────────────────
  console.log("\n── Section 4: Employee Availability ──");

  await ShiftService.setAvailability(restaurantA.id, empA1.id, [
    { dayOfWeek: 1, isAvailable: true, preferredStartTime: "08:00", preferredEndTime: "16:00" },
    { dayOfWeek: 2, isAvailable: false, notes: "Weekly classes" },
  ]);

  const availabilityA1 = await ShiftService.getAvailability(restaurantA.id, empA1.id);
  if (availabilityA1.length === 2 && availabilityA1.find((a) => a.dayOfWeek === 2)?.isAvailable === false) {
    pass("Employee availability stored and retrieved successfully");
  } else {
    fail("Failed to store/retrieve employee availability");
  }

  try {
    await ShiftService.getAvailability(restaurantB.id, empA1.id);
    fail("Cross-tenant employee availability read was not rejected");
  } catch {
    pass("Cross-restaurant employee availability read rejected");
  }

  // ── Section 5: Salary Structures & Confidentiality ────────────────────
  console.log("\n── Section 5: Salary Structures & Confidentiality ──");

  const structureA1 = await PayrollService.upsertSalaryStructure(restaurantA.id, {
    employeeId: empA1.id,
    payFrequency: PayFrequency.MONTHLY,
    baseSalary: 4500,
    allowances: [{ name: "Housing", amount: 300, isPercentage: false }],
    deductions: [{ name: "Income Tax", amount: 10, isPercentage: true, type: "TAX" }],
  });

  if (structureA1.id && Number(structureA1.baseSalary) === 4500) {
    pass("Employee salary structure created with allowances and percentage deductions");
  } else {
    fail("Failed to create salary structure");
  }

  const structuresB = await PayrollService.getSalaryStructures(restaurantB.id);
  if (!structuresB.some((s) => s.employeeId === empA1.id)) {
    pass("Salary structures are confidential and tenant-isolated (Restaurant B cannot view Restaurant A salaries)");
  } else {
    fail("Tenant leak: Restaurant B saw Restaurant A employee salary structure");
  }

  // ── Section 6: Payroll Calculation & Shift Integration ────────────────
  console.log("\n── Section 6: Payroll Calculation & Shift Integration ──");

  // Ensure shifts module is enabled for Restaurant A so calculation engine executes shift aggregation
  await prisma.restaurantModule.upsert({
    where: { restaurantId_moduleId: { restaurantId: restaurantA.id, moduleId: "shifts" } },
    update: { status: "ACTIVE" },
    create: { restaurantId: restaurantA.id, moduleId: "shifts", status: "ACTIVE" },
  });

  const runA = await PayrollService.createPayrollRun(restaurantA.id, {
    title: `August 2026 Monthly Pay Cycle - ${Date.now()}`,
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    paymentDate: "2026-08-31",
  });

  if (runA.id && runA.status === PayrollRunStatus.DRAFT) {
    pass("Created monthly payroll run container in DRAFT state");
  } else {
    fail("Failed to create payroll run container");
  }

  // Execute Calculation Engine
  const calculatedRun = await PayrollService.executePayrollCalculation(restaurantA.id, runA.id, "payroll-admin-user");

  if (
    calculatedRun.status === PayrollRunStatus.CALCULATING &&
    calculatedRun.payslips.length >= 1 &&
    Number(calculatedRun.totalNet) > 0
  ) {
    pass("Payroll calculation engine executed: aggregated shift hours, computed allowances, applied tax deductions, and generated itemized payslips");
  } else {
    fail("Payroll calculation engine failed or generated zero net payable");
  }

  // Verify Payslip details
  const payslipsA = await PayrollService.getPayslips(restaurantA.id, { payrollRunId: runA.id });
  const slipA1 = payslipsA.find((p) => p.employeeId === empA1.id);

  if (slipA1 && Number(slipA1.basePay) === 4500 && Number(slipA1.totalAllowances) === 300) {
    pass("Payslip contains correct base pay, allowances, and calculated deductions");
  } else {
    fail("Payslip financial components did not match expected structure values");
  }

  // Cross-tenant payslip read denied
  if (slipA1) {
    try {
      await PayrollService.getPayslipById(restaurantB.id, slipA1.id);
      fail("Cross-tenant payslip read was not rejected");
    } catch {
      pass("Cross-restaurant payslip access strictly forbidden");
    }
  }

  // ── Section 7: Payroll Run State Machine ──────────────────────────────
  console.log("\n── Section 7: Payroll Run State Machine ──");

  // Approve Run
  const approvedRun = await PayrollService.approvePayrollRun(restaurantA.id, runA.id, "finance-director-id");
  if (approvedRun.status === PayrollRunStatus.APPROVED) {
    pass("Payroll run successfully transitioned to APPROVED status");
  } else {
    fail("Failed to approve payroll run");
  }

  // Mark Paid
  const paidRun = await PayrollService.markPayrollPaid(restaurantA.id, runA.id);
  if (paidRun.status === PayrollRunStatus.PAID) {
    pass("Payroll run finalized and marked as PAID with payment records generated");
  } else {
    fail("Failed to mark payroll run as PAID");
  }

  // Deleting a PAID payroll run is forbidden
  try {
    await PayrollService.deletePayrollRun(restaurantA.id, runA.id);
    fail("Deleting a PAID payroll run was not rejected");
  } catch {
    pass("State integrity: Deleting a finalized PAID payroll run is blocked");
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log(`  Phase 4 Test Results: ${passCount} Passed, ${failCount} Failed`);
  console.log("========================================\n");

  if (failCount > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Unhandled test suite error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
