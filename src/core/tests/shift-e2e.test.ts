import { prisma } from "../database/client";
import { ShiftService } from "../../modules/shifts/service";
import { RosterStatus, SwapRequestStatus } from "@prisma/client";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function assertThrows(fn: () => Promise<any>, expectedSubstr: string, message: string) {
  try {
    await fn();
    console.error(`  ❌ FAIL (did not throw): ${message}`);
    failed++;
  } catch (err: any) {
    const msg = err?.message || "";
    if (msg.toLowerCase().includes(expectedSubstr.toLowerCase())) {
      console.log(`  ✅ PASS: ${message} ("${msg}")`);
      passed++;
    } else {
      console.error(`  ❌ FAIL (wrong error "${msg}", expected "${expectedSubstr}"): ${message}`);
      failed++;
    }
  }
}

async function run() {
  console.log("=========================================================");
  console.log("  Shift Scheduling Multi-Outlet E2E Integration Suite");
  console.log("=========================================================\n");

  const suffix = Date.now().toString(36);
  const restaurant = await prisma.restaurant.create({
    data: {
      name: `Test Shift Bistro ${suffix}`,
      subdomain: `test-shift-${suffix}`,
      status: "ACTIVE",
    },
  });

  try {
    // 1. Setup 2 Outlets (NY timezone, Monday workweek)
    const outletA = await prisma.restaurantOutlet.create({
      data: {
        restaurantId: restaurant.id,
        name: "Downtown Flagship",
        timezone: "America/New_York",
        workweekStartDay: 1,
        hardWeeklyHoursCap: 60,
        allowOvertimeOverride: true,
      },
    });
    const outletB = await prisma.restaurantOutlet.create({
      data: {
        restaurantId: restaurant.id,
        name: "Airport Express",
        timezone: "America/New_York",
        workweekStartDay: 1,
      },
    });

    // 2. Setup 2 Employees (Emp1 eligible for both outlets; Emp2 eligible ONLY for Outlet A)
    const emp1 = await prisma.employee.create({
      data: {
        restaurantId: restaurant.id,
        employeeCode: "E-01",
        firstName: "Alice",
        lastName: "Chef",
        joiningDate: new Date("2025-01-01"),
        workerType: "FULL_TIME",
      },
    });
    const emp2 = await prisma.employee.create({
      data: {
        restaurantId: restaurant.id,
        employeeCode: "E-02",
        firstName: "Bob",
        lastName: "Server",
        joiningDate: new Date("2025-01-01"),
        workerType: "PART_TIME",
        weeklyHoursLimit: 20,
      },
    });

    await prisma.employeeOutletAssignment.createMany({
      data: [
        { restaurantId: restaurant.id, employeeId: emp1.id, outletId: outletA.id, isPrimary: true, effectiveFrom: new Date("2025-01-01") },
        { restaurantId: restaurant.id, employeeId: emp1.id, outletId: outletB.id, isPrimary: false, effectiveFrom: new Date("2025-01-01") },
        { restaurantId: restaurant.id, employeeId: emp2.id, outletId: outletA.id, isPrimary: true, effectiveFrom: new Date("2025-01-01") },
      ],
    });

    // Approved leave for Emp2 on 2026-07-08
    await prisma.leaveRequest.create({
      data: {
        restaurantId: restaurant.id,
        employeeId: emp2.id,
        leaveType: "ANNUAL",
        startDate: new Date("2026-07-08T00:00:00.000Z"),
        endDate: new Date("2026-07-08T23:59:59.000Z"),
        totalDays: 1,
        status: "APPROVED",
        reason: "Family event",
      },
    });

    // 3. Create Template & Bi-Weekly Roster
    const nightTpl = await ShiftService.createTemplate(restaurant.id, {
      name: "Overnight Close",
      startTime: "22:00",
      endTime: "04:00",
      breakMinutes: 30,
      color: "#6366f1",
    });

    const roster = await ShiftService.createRoster(restaurant.id, {
      outletId: outletA.id,
      name: "Bi-Weekly July",
      startDate: "2026-07-06",
      endDate: "2026-07-19",
      availabilityDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Open availability & collect Emp1 specific time, leave Emp2 unsubmitted
    await ShiftService.updateRoster(restaurant.id, roster.id, { status: RosterStatus.AVAILABILITY_OPEN });
    await ShiftService.saveRosterDateAvailabilities(restaurant.id, roster.id, emp1.id, [
      { date: "2026-07-06", type: "SPECIFIC_TIME", availableFrom: "16:00", availableUntil: "23:59" },
    ]);
    await ShiftService.submitEmployeeAvailability(restaurant.id, roster.id, emp1.id);

    const availView = await ShiftService.getRosterAvailability(restaurant.id, roster.id);
    const emp1Avail = availView.availabilities.find((a) => a.employee.id === emp1.id);
    const emp2Avail = availView.availabilities.find((a) => a.employee.id === emp2.id);
    assert(emp1Avail?.days["2026-07-06"]?.type === "SPECIFIC_TIME", "Emp1 shows SPECIFIC_TIME availability");
    assert(emp2Avail?.days["2026-07-06"]?.type === "NOT_UPDATED", "Emp2 shows NOT_UPDATED (Not submitted)");
    assert(emp2Avail?.days["2026-07-08"]?.type === "LEAVE", "Emp2 shows Approved Leave on 2026-07-08");

    // Transition to scheduling
    await ShiftService.updateRoster(restaurant.id, roster.id, { status: RosterStatus.ASSIGNMENT_IN_PROGRESS });

    // Schedule overnight shift for Emp1 on 2026-07-06 (22:00–04:00)
    const overnightShift = await ShiftService.createAssignment(restaurant.id, {
      rosterId: roster.id,
      templateId: nightTpl.id,
      employeeId: emp1.id,
      outletId: outletA.id,
      shiftDate: "2026-07-06",
      startTime: nightTpl.startTime,
      endTime: nightTpl.endTime,
      breakMinutes: nightTpl.breakMinutes,
      roleName: "Closing Lead",
    });
    assert(!!overnightShift.id, "Scheduled overnight shift for Emp1 on 2026-07-06");

    // Reject overlap at Outlet B on 2026-07-07 02:00–08:00
    await assertThrows(
      () =>
        ShiftService.createAssignment(restaurant.id, {
          employeeId: emp1.id,
          outletId: outletB.id,
          shiftDate: "2026-07-07",
          startTime: "02:00",
          endTime: "08:00",
          breakMinutes: 0,
        }),
      "Shift conflict",
      "Cross-outlet overnight overlap rejected"
    );

    // Reject assignment during approved leave
    await assertThrows(
      () =>
        ShiftService.createAssignment(restaurant.id, {
          rosterId: roster.id,
          employeeId: emp2.id,
          outletId: outletA.id,
          shiftDate: "2026-07-08",
          startTime: "09:00",
          endTime: "17:00",
        }),
      "Leave conflict",
      "Approved leave conflict rejected"
    );

    // Reject assignment outside eligible outlet (Emp2 is only eligible for Outlet A)
    await assertThrows(
      () =>
        ShiftService.createAssignment(restaurant.id, {
          employeeId: emp2.id,
          outletId: outletB.id,
          shiftDate: "2026-07-09",
          startTime: "09:00",
          endTime: "15:00",
        }),
      "not eligible for outlet",
      "Ineligible outlet assignment rejected"
    );

    // Publish roster atomically
    const published = await ShiftService.publishRoster(restaurant.id, roster.id, {
      userId: "mgr-1",
      userEmail: "mgr@test.com",
    });
    assert(published.status === "PUBLISHED", "Roster published atomically");
    assert(published.lastNotifiedVersion === published.version, "Notification version recorded for deduplication");

    // Save a draft revision on the published roster; live assignments stay untouched
    await ShiftService.saveDraftRevision(
      restaurant.id,
      roster.id,
      {
        adds: [
          {
            draftId: "draft-1",
            action: "ADD",
            employeeId: emp2.id,
            outletId: outletA.id,
            shiftDate: "2026-07-09",
            startTime: "10:00",
            endTime: "16:00",
            breakMinutes: 30,
          },
        ],
        updates: [],
        deletes: [],
      },
      published.version
    );

    const liveBeforePublish = await ShiftService.getAssignments(restaurant.id, {
      rosterId: roster.id,
      publishedOnly: true,
    });
    assert(liveBeforePublish.length === 1, "Live published shifts remain untouched until revision is published");

    // Stale edit conflict detection
    await assertThrows(
      () =>
        ShiftService.publishRoster(
          restaurant.id,
          roster.id,
          { userId: "mgr-2", userEmail: "mgr2@test.com" },
          published.version // stale version!
        ),
      "Stale edit conflict",
      "Stale manager publish rejected with conflict"
    );

    // Publish with latest version
    const latestRoster = await ShiftService.getRosterById(restaurant.id, roster.id);
    await ShiftService.publishRoster(
      restaurant.id,
      roster.id,
      { userId: "mgr-1", userEmail: "mgr@test.com" },
      latestRoster.version
    );

    const liveAfterPublish = await ShiftService.getAssignments(restaurant.id, {
      rosterId: roster.id,
      publishedOnly: true,
    });
    assert(liveAfterPublish.length === 2, "Revision applied atomically on publish");

    // Swap workflow: peer acceptance + manager revalidation & atomic swap
    const swap = await ShiftService.createSwapRequest(restaurant.id, {
      assignmentId: liveAfterPublish[1].id, // Emp2's 2026-07-09 shift
      requesterEmployeeId: emp2.id,
      targetEmployeeId: emp1.id,
      reason: "Doctor appointment",
    });
    assert(swap.peerStatus === "PENDING_PEER", "Swap starts in PENDING_PEER");

    await assertThrows(
      () =>
        ShiftService.reviewSwapRequest(restaurant.id, swap.id, {
          status: SwapRequestStatus.APPROVED,
          reviewedBy: "mgr-1",
        }),
      "Coworker acceptance is required",
      "Manager cannot approve swap before coworker accepts"
    );

    await ShiftService.respondToSwapAsPeer(restaurant.id, swap.id, emp1.id, true);
    const approvedSwap = await ShiftService.reviewSwapRequest(restaurant.id, swap.id, {
      status: SwapRequestStatus.APPROVED,
      reviewedBy: "mgr-1",
      reviewedByEmail: "mgr@test.com",
    });
    assert(approvedSwap.status === "APPROVED", "Swap approved after peer acceptance & revalidation");

    const swappedShift = await prisma.shiftAssignment.findUnique({ where: { id: liveAfterPublish[1].id } });
    assert(swappedShift?.employeeId === emp1.id, "Live schedule updated atomically to Emp1");

    console.log("\n=========================================================");
    console.log(`  E2E Results: ${passed} Passed, ${failed} Failed`);
    console.log("=========================================================");
    if (failed > 0) process.exit(1);
  } finally {
    await prisma.restaurant.delete({ where: { id: restaurant.id } }).catch(() => {});
    await prisma.$disconnect();
  }
}

run();
