import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/core/database/client";
import { calculateAttendanceMetrics } from "@/core/attendance/calculator";
import {
  AttendanceError,
  correctAndApproveAttendance,
  hashPin,
  identifyKioskEmployee,
  processPunch,
} from "@/core/attendance/punchService";

test("calculateAttendanceMetrics handles overnight shifts and DST spring-forward", () => {
  // 2026-03-08 is US/Canada DST spring forward (02:00 -> 03:00 in America/Toronto)
  // Clock in 01:30 EST (06:30 UTC), Clock out 03:30 EDT (07:30 UTC) => 60 minutes worked
  const dstResult = calculateAttendanceMetrics(
    [
      { punchType: "CLOCK_IN", punchTime: "2026-03-08T06:30:00.000Z" },
      { punchType: "CLOCK_OUT", punchTime: "2026-03-08T07:30:00.000Z" },
    ],
    {
      startTime: "01:30",
      endTime: "03:30",
      breakMinutes: 0,
      shiftDate: "2026-03-08",
      timezone: "America/Toronto",
    }
  );
  assert.equal(dstResult.totalWorkMinutes, 60);
  assert.equal(dstResult.lateMinutes, 0);

  // Overnight shift 22:00 -> 06:00 UTC with 30m break
  const overnight = calculateAttendanceMetrics(
    [
      { punchType: "CLOCK_IN", punchTime: "2026-11-20T22:00:00.000Z" },
      { punchType: "BREAK_START", punchTime: "2026-11-21T02:00:00.000Z" },
      { punchType: "BREAK_END", punchTime: "2026-11-21T02:30:00.000Z" },
      { punchType: "CLOCK_OUT", punchTime: "2026-11-21T06:00:00.000Z" },
    ],
    {
      startTime: "22:00",
      endTime: "06:00",
      breakMinutes: 30,
      shiftDate: "2026-11-20",
      timezone: "UTC",
    }
  );
  assert.equal(overnight.totalWorkMinutes, 450);
  assert.equal(overnight.totalBreakMinutes, 30);
  assert.equal(overnight.lateMinutes, 0);
  assert.equal(overnight.earlyExitMinutes, 0);
});

test("Attendance kiosk, idempotency, draft roster isolation, overnight matching, and manager corrections", async () => {
  const ts = Date.now();
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Attendance QA Kitchen",
      subdomain: `att-test-${ts}`,
      status: "ACTIVE",
    },
  });

  try {
    const outlet1 = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Outlet 1", timezone: "UTC" },
    });
    const outlet2 = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Outlet 2", timezone: "UTC" },
    });

    const emp1 = await prisma.employee.create({
      data: {
        restaurantId: restaurant.id,
        employeeCode: "EMP-30001",
        firstName: "Vikram",
        lastName: "Rao",
        kioskPin: hashPin("1357"),
        joiningDate: new Date("2026-01-01T00:00:00Z"),
        workerType: "FULL_TIME",
      },
    });
    await prisma.employmentRecord.create({
      data: {
        restaurantId: restaurant.id,
        employeeId: emp1.id,
        primaryOutletId: outlet1.id,
        employmentType: "FULL_TIME",
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        status: "ACTIVE",
      },
    });
    await prisma.employeeOutletAssignment.create({
      data: {
        restaurantId: restaurant.id,
        employeeId: emp1.id,
        outletId: outlet1.id,
        isPrimary: true,
        assignmentType: "PRIMARY",
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      },
    });

    // Draft roster must NOT match attendance
    const draftRoster = await prisma.shiftRoster.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet1.id,
        name: "Draft Roster",
        startDate: new Date("2026-11-18T00:00:00Z"),
        endDate: new Date("2026-11-25T00:00:00Z"),
        status: "DRAFT",
      },
    });
    await prisma.shiftAssignment.create({
      data: {
        restaurantId: restaurant.id,
        rosterId: draftRoster.id,
        outletId: outlet1.id,
        employeeId: emp1.id,
        shiftDate: new Date("2026-11-19T00:00:00Z"),
        startTime: "09:00",
        endTime: "17:00",
      },
    });

    // Published overnight shift on 2026-11-20 (with staged draftRevisionJson that must be ignored)
    const pubRoster = await prisma.shiftRoster.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outlet1.id,
        name: "Published Roster",
        startDate: new Date("2026-11-18T00:00:00Z"),
        endDate: new Date("2026-11-25T00:00:00Z"),
        status: "PUBLISHED",
        draftRevisionJson: { staged: true },
      },
    });
    await prisma.shiftAssignment.create({
      data: {
        restaurantId: restaurant.id,
        rosterId: pubRoster.id,
        outletId: outlet1.id,
        employeeId: emp1.id,
        shiftDate: new Date("2026-11-20T00:00:00Z"),
        startTime: "22:00",
        endTime: "06:00",
        breakMinutes: 30,
      },
    });

    // 1. Wrong outlet blocked
    await assert.rejects(
      () =>
        identifyKioskEmployee({
          restaurantId: restaurant.id,
          outletId: outlet2.id,
          kioskPin: "1357",
        }),
      (err: unknown) => err instanceof AttendanceError && err.code === "WRONG_OUTLET"
    );

    // 2. Identify at Outlet 1 -> never leaks kioskPin
    const identified = await identifyKioskEmployee({
      restaurantId: restaurant.id,
      outletId: outlet1.id,
      kioskPin: "1357",
    });
    assert.equal(identified.employee.id, emp1.id);
    assert.equal((identified.employee as Record<string, unknown>).kioskPin, undefined);
    assert.deepEqual(identified.validActions, ["CLOCK_IN"]);

    // 3. Unscheduled punch on 2026-11-19 (since draftRoster is DRAFT) + idempotency retry
    const idemKey = `idem-${ts}-1`;
    const p1 = await processPunch({
      restaurantId: restaurant.id,
      outletId: outlet1.id,
      employeeId: emp1.id,
      punchType: "CLOCK_IN",
      punchTime: new Date("2026-11-19T09:00:00.000Z"),
      idempotencyKey: idemKey,
    });
    assert.equal(p1.duplicate, false);
    assert.ok(p1.attendanceRecord);
    assert.equal(p1.attendanceRecord!.needsReview, true);
    assert.deepEqual(p1.attendanceRecord!.exceptionFlags, ["UNSCHEDULED"]);

    const p1Retry = await processPunch({
      restaurantId: restaurant.id,
      outletId: outlet1.id,
      employeeId: emp1.id,
      punchType: "CLOCK_IN",
      punchTime: new Date("2026-11-19T09:00:02.000Z"),
      idempotencyKey: idemKey,
    });
    assert.equal(p1Retry.duplicate, true);
    const punchCount19 = await prisma.timePunch.count({
      where: { attendanceRecordId: p1.attendanceRecord!.id },
    });
    assert.equal(punchCount19, 1);

    // 4. Manager correction requires reason, preserves original punch, and approves
    await assert.rejects(
      () =>
        correctAndApproveAttendance({
          restaurantId: restaurant.id,
          recordId: p1.attendanceRecord!.id,
          actor: { userId: "u-mgr", userEmail: "mgr@test.com" },
          accessibleOutletIds: [outlet1.id],
          addMissedPunch: {
            punchType: "CLOCK_OUT",
            punchTime: new Date("2026-11-19T17:00:00.000Z"),
          },
        }),
      (err: unknown) => err instanceof AttendanceError && err.code === "REASON_REQUIRED"
    );

    // Out-of-scope manager blocked (Outlet 2 only)
    await assert.rejects(
      () =>
        correctAndApproveAttendance({
          restaurantId: restaurant.id,
          recordId: p1.attendanceRecord!.id,
          actor: { userId: "u-mgr2", userEmail: "mgr2@test.com" },
          accessibleOutletIds: [outlet2.id],
          isApproved: true,
        }),
      (err: unknown) => err instanceof AttendanceError && err.status === 403
    );

    const corrected = await correctAndApproveAttendance({
      restaurantId: restaurant.id,
      recordId: p1.attendanceRecord!.id,
      actor: { userId: "u-mgr", userEmail: "mgr@test.com" },
      accessibleOutletIds: [outlet1.id],
      addMissedPunch: {
        punchType: "CLOCK_OUT",
        punchTime: new Date("2026-11-19T17:00:00.000Z"),
      },
      correctionReason: "Verified missed clock-out",
      isApproved: true,
    });
    assert.equal(corrected.isApproved, true);
    assert.equal(corrected.totalWorkMinutes, 480);
    assert.equal(corrected.timePunches.length, 2);
    assert.equal(corrected.timePunches[0].isManualAdjustment, false);
    assert.equal(corrected.timePunches[1].isManualAdjustment, true);

    // 5. Overnight shift matching on 2026-11-20 22:00 -> 2026-11-21 06:00
    const onIn = await processPunch({
      restaurantId: restaurant.id,
      outletId: outlet1.id,
      employeeId: emp1.id,
      punchType: "CLOCK_IN",
      punchTime: new Date("2026-11-20T22:00:00.000Z"),
    });
    await processPunch({
      restaurantId: restaurant.id,
      outletId: outlet1.id,
      employeeId: emp1.id,
      punchType: "BREAK_START",
      punchTime: new Date("2026-11-21T02:00:00.000Z"),
    });
    await processPunch({
      restaurantId: restaurant.id,
      outletId: outlet1.id,
      employeeId: emp1.id,
      punchType: "BREAK_END",
      punchTime: new Date("2026-11-21T02:30:00.000Z"),
    });
    const onOut = await processPunch({
      restaurantId: restaurant.id,
      outletId: outlet1.id,
      employeeId: emp1.id,
      punchType: "CLOCK_OUT",
      punchTime: new Date("2026-11-21T06:00:00.000Z"),
    });
    assert.ok(onOut.attendanceRecord);
    assert.ok(onIn.attendanceRecord);
    assert.equal(onOut.attendanceRecord!.id, onIn.attendanceRecord!.id);
    assert.equal(onOut.attendanceRecord!.totalWorkMinutes, 450);
    assert.equal(onOut.attendanceRecord!.totalBreakMinutes, 30);
  } finally {
    await prisma.restaurant.delete({ where: { id: restaurant.id } });
  }
});
