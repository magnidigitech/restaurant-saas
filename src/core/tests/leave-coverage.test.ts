import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/core/database/client";
import {
  createLeaveRequest,
  LeaveError,
  listLeaveRequests,
  previewLeaveShiftImpact,
  reviewLeaveRequest,
} from "@/modules/leaves/service";
import type { LeaveActorContext } from "@/modules/leaves/authHelper";
import { ShiftService, validateShiftCandidate } from "@/modules/shifts/service";

test("Leave & Coverage: overnight shift impact, cross-outlet blocker, atomic reassign, idempotent retry, and swap conflict", async () => {
  const ts = Date.now();
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Leave Coverage QA",
      subdomain: `lv-test-${ts}`,
      status: "ACTIVE",
    },
  });

  try {
    const outlet1 = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Outlet 1", timezone: "America/Toronto" },
    });
    const outlet2 = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Outlet 2", timezone: "America/Toronto" },
    });

    const emp1 = await prisma.employee.create({
      data: {
        restaurantId: restaurant.id,
        employeeCode: "EMP-50001",
        firstName: "Riya",
        lastName: "Sen",
        joiningDate: new Date("2026-01-01T00:00:00Z"),
        workerType: "FULL_TIME",
      },
    });
    const emp2 = await prisma.employee.create({
      data: {
        restaurantId: restaurant.id,
        employeeCode: "EMP-50002",
        firstName: "Dev",
        lastName: "Malhotra",
        joiningDate: new Date("2026-01-01T00:00:00Z"),
        workerType: "FULL_TIME",
      },
    });

    for (const emp of [emp1, emp2]) {
      await prisma.employmentRecord.create({
        data: {
          restaurantId: restaurant.id,
          employeeId: emp.id,
          primaryOutletId: outlet1.id,
          employmentType: "FULL_TIME",
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          status: "ACTIVE",
        },
      });
      await prisma.employeeOutletAssignment.create({
        data: {
          restaurantId: restaurant.id,
          employeeId: emp.id,
          outletId: outlet1.id,
          isPrimary: true,
          assignmentType: "PRIMARY",
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        },
      });
    }

    // Published roster at Outlet 1 with an overnight shift on 2026-12-19 22:00 -> 2026-12-20 06:00
    // and a future shift on 2026-12-22 for swap testing
    const roster1 = await prisma.shiftRoster.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet1.id,
        name: "Dec Roster",
        startDate: new Date("2026-12-14T00:00:00Z"),
        endDate: new Date("2026-12-27T00:00:00Z"),
        status: "PUBLISHED",
      },
    });

    const overnightShift = await prisma.shiftAssignment.create({
      data: {
        restaurantId: restaurant.id,
        rosterId: roster1.id,
        outletId: outlet1.id,
        employeeId: emp1.id,
        shiftDate: new Date("2026-12-19T00:00:00Z"),
        startTime: "22:00",
        endTime: "06:00",
        roleName: "Night Lead",
      },
    });

    const shiftForSwap = await prisma.shiftAssignment.create({
      data: {
        restaurantId: restaurant.id,
        rosterId: roster1.id,
        outletId: outlet1.id,
        employeeId: emp2.id,
        shiftDate: new Date("2026-12-22T00:00:00Z"),
        startTime: "10:00",
        endTime: "18:00",
        roleName: "Line Cook",
      },
    });

    // Pending swap where emp1 is target coworker to take emp2's 2026-12-22 shift
    const swap = await ShiftService.createSwapRequest(restaurant.id, {
      assignmentId: shiftForSwap.id,
      requesterEmployeeId: emp2.id,
      targetEmployeeId: emp1.id,
      reason: "Need Tuesday off",
    });
    await ShiftService.respondToSwapAsPeer(
      restaurant.id,
      swap.id,
      emp1.id,
      true
    );

    const emp1Ctx: LeaveActorContext = {
      userId: "u-emp1",
      userEmail: "riya@test.com",
      restaurantId: restaurant.id,
      membershipId: "m-emp1",
      employeeId: emp1.id,
      isAdmin: false,
      canViewLeaves: true,
      canRequestLeave: true,
      canApproveLeaves: false,
      accessibleOutletIds: [outlet1.id],
    };

    const mgr1Ctx: LeaveActorContext = {
      userId: "u-mgr1",
      userEmail: "mgr1@test.com",
      restaurantId: restaurant.id,
      membershipId: "m-mgr1",
      employeeId: null,
      isAdmin: false,
      canViewLeaves: true,
      canRequestLeave: false,
      canApproveLeaves: true,
      accessibleOutletIds: [outlet1.id],
    };

    const mgr2Ctx: LeaveActorContext = {
      ...mgr1Ctx,
      userId: "u-mgr2",
      accessibleOutletIds: [outlet2.id],
    };

    // 1. Employee submits leave for 2026-12-20 .. 2026-12-22 (overlaps 2026-12-19 overnight shift + 2026-12-22 swap!)
    const leave = await createLeaveRequest(emp1Ctx, {
      leaveType: "CASUAL",
      startDate: "2026-12-20T00:00:00.000Z",
      endDate: "2026-12-22T00:00:00.000Z",
      totalDays: 3,
      reason: "Private family event",
    });

    // 2. Out-of-scope manager (Outlet 2 only) cannot review Outlet 1 leave
    await assert.rejects(
      () => previewLeaveShiftImpact(mgr2Ctx, leave.id),
      (err: unknown) => err instanceof LeaveError && err.status === 403
    );

    // 3. In-scope manager sees overnight shift conflict
    const impact = await previewLeaveShiftImpact(mgr1Ctx, leave.id);
    assert.equal(impact.conflicts.length, 1);
    assert.equal(impact.conflicts[0].assignmentId, overnightShift.id);

    // 4. Approving without resolution throws 409 COVERAGE_RESOLUTION_REQUIRED
    await assert.rejects(
      () =>
        reviewLeaveRequest(mgr1Ctx, leave.id, {
          status: "APPROVED",
        }),
      (err: unknown) =>
        err instanceof LeaveError && err.code === "COVERAGE_RESOLUTION_REQUIRED"
    );

    // 5. Approve with REASSIGN to emp2 + retry safety
    const approved = await reviewLeaveRequest(mgr1Ctx, leave.id, {
      status: "APPROVED",
      managerNotes: "Covered by Dev",
      resolutions: [
        {
          assignmentId: overnightShift.id,
          action: "REASSIGN",
          replacementEmployeeId: emp2.id,
        },
      ],
    });
    assert.equal(approved.alreadyDecided, false);
    assert.equal(approved.resolvedShiftsCount, 1);

    const retry = await reviewLeaveRequest(mgr1Ctx, leave.id, {
      status: "APPROVED",
    });
    assert.equal(retry.alreadyDecided, true);

    const updatedShift = await prisma.shiftAssignment.findUniqueOrThrow({
      where: { id: overnightShift.id },
    });
    assert.equal(updatedShift.employeeId, emp2.id);

    // 6. Scheduler blocks assigning emp1 during approved leave
    const schedCheck = await validateShiftCandidate({
      restaurantId: restaurant.id,
      employeeId: emp1.id,
      outletId: outlet1.id,
      shiftDate: "2026-12-21",
      startTime: "10:00",
      endTime: "18:00",
    });
    assert.equal(schedCheck.valid, false);
    assert.equal(schedCheck.blockingIssues[0].code, "LEAVE_CONFLICT");

    // 7. Pending swap fails at manager approval due to new approved leave on emp1
    await assert.rejects(
      () =>
        ShiftService.reviewSwapRequest(restaurant.id, swap.id, {
          status: "APPROVED",
          reviewedBy: "u-mgr1",
          reviewedByEmail: "mgr1@test.com",
        }),
      /leave conflict/i
    );

    // Original swap shift remains intact with emp2
    const intactSwapShift = await prisma.shiftAssignment.findUniqueOrThrow({
      where: { id: shiftForSwap.id },
    });
    assert.equal(intactSwapShift.employeeId, emp2.id);

    // 8. Private leave reason is NOT copied into general audit logs
    const logs = await prisma.auditLog.findMany({
      where: { restaurantId: restaurant.id, entityId: leave.id },
    });
    for (const l of logs) {
      assert.ok(!(l.newValues || "").includes("Private family event"));
    }

    // 9. Partial-day leave only blocks overlapping hours
    const partialLeave = await createLeaveRequest(emp1Ctx, {
      leaveType: "SICK",
      startDate: "2026-12-24T00:00:00.000Z",
      endDate: "2026-12-24T00:00:00.000Z",
      isPartialDay: true,
      startTime: "14:00",
      endTime: "18:00",
      reason: "Dentist",
    });
    await reviewLeaveRequest(mgr1Ctx, partialLeave.id, { status: "APPROVED" });

    const morningShiftOk = await validateShiftCandidate({
      restaurantId: restaurant.id,
      employeeId: emp1.id,
      outletId: outlet1.id,
      shiftDate: "2026-12-24",
      startTime: "08:00",
      endTime: "12:00",
    });
    assert.equal(morningShiftOk.valid, true);

    const afternoonShiftBlocked = await validateShiftCandidate({
      restaurantId: restaurant.id,
      employeeId: emp1.id,
      outletId: outlet1.id,
      shiftDate: "2026-12-24",
      startTime: "13:00",
      endTime: "17:00",
    });
    assert.equal(afternoonShiftBlocked.valid, false);

    // Verify listLeaveRequests returns own requests for emp1
    const emp1Leaves = await listLeaveRequests(emp1Ctx);
    assert.equal(emp1Leaves.length, 2);
  } finally {
    await prisma.restaurant.delete({ where: { id: restaurant.id } });
  }
});
