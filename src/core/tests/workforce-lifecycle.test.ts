import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/core/database/client";
import {
  EMPLOYMENT_STATUS_LABELS,
  VALID_EMPLOYMENT_TRANSITIONS,
  sanitizeAuditPayload,
  listDirectoryEmployees,
  getRosterEligibleEmployees,
  getEmployeeProfile,
  transitionEmploymentRecord,
  upsertOutletAssignment,
  endOutletAssignment,
  WorkforceError,
} from "@/modules/workforce/service";
import type { WorkforceActorContext } from "@/modules/workforce/authHelper";

test("Employment status labels and transition rules", () => {
  assert.equal(EMPLOYMENT_STATUS_LABELS.PROBATION, "On probation");
  assert.equal(EMPLOYMENT_STATUS_LABELS.ACTIVE, "Active");
  assert.equal(EMPLOYMENT_STATUS_LABELS.NOTICE, "Serving notice");
  assert.equal(EMPLOYMENT_STATUS_LABELS.TERMINATED, "Terminated");

  assert.ok(VALID_EMPLOYMENT_TRANSITIONS.PROBATION.includes("ACTIVE"));
  assert.ok(VALID_EMPLOYMENT_TRANSITIONS.ACTIVE.includes("NOTICE"));
  assert.ok(!VALID_EMPLOYMENT_TRANSITIONS.TERMINATED.includes("NOTICE"));
  assert.ok(VALID_EMPLOYMENT_TRANSITIONS.TERMINATED.includes("ACTIVE"));
});

test("sanitizeAuditPayload strips sensitive credentials and banking fields", () => {
  const raw = {
    status: "ACTIVE",
    kioskPin: "9876",
    documentNumber: "ABC12345",
    bankAccount: "0011223344",
    accountNumber: "998877",
    reason: "Promotion",
  };
  const cleaned = JSON.parse(sanitizeAuditPayload(raw) || "{}");
  assert.equal(cleaned.status, "ACTIVE");
  assert.equal(cleaned.reason, "Promotion");
  assert.equal(cleaned.kioskPin, undefined);
  assert.equal(cleaned.documentNumber, undefined);
  assert.equal(cleaned.bankAccount, undefined);
  assert.equal(cleaned.accountNumber, undefined);
});

test("Workforce directory scoping, sensitive field gating, roster eligibility, and lifecycle impact", async () => {
  const slug = `wf-test-${Date.now()}`;
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Workforce Test Kitchen",
      subdomain: slug,
      status: "ACTIVE",
    },
  });

  try {
    const outletA = await prisma.restaurantOutlet.create({
      data: {
        restaurantId: restaurant.id,
        name: "Outlet Alpha",
        timezone: "America/Toronto",
      },
    });
    const outletB = await prisma.restaurantOutlet.create({
      data: {
        restaurantId: restaurant.id,
        name: "Outlet Beta",
        timezone: "America/Toronto",
      },
    });

    const dept = await prisma.department.create({
      data: { restaurantId: restaurant.id, name: "Kitchen", code: "KIT" },
    });
    const desig = await prisma.designation.create({
      data: { restaurantId: restaurant.id, name: "Line Cook", code: "COOK" },
    });

    const empA = await prisma.employee.create({
      data: {
        restaurantId: restaurant.id,
        employeeCode: "EMP-10001",
        firstName: "Aarav",
        lastName: "Sharma",
        personalEmail: "aarav@example.com",
        kioskPin: "4321",
        joiningDate: new Date("2026-01-01T00:00:00Z"),
        workerType: "FULL_TIME",
      },
    });
    await prisma.employmentRecord.create({
      data: {
        restaurantId: restaurant.id,
        employeeId: empA.id,
        departmentId: dept.id,
        designationId: desig.id,
        primaryOutletId: outletA.id,
        employmentType: "FULL_TIME",
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        status: "PROBATION",
      },
    });
    await prisma.employeeOutletAssignment.create({
      data: {
        restaurantId: restaurant.id,
        employeeId: empA.id,
        outletId: outletA.id,
        isPrimary: true,
        assignmentType: "PRIMARY",
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const empB = await prisma.employee.create({
      data: {
        restaurantId: restaurant.id,
        employeeCode: "EMP-10002",
        firstName: "Maya",
        lastName: "Patel",
        kioskPin: "5678",
        joiningDate: new Date("2026-01-01T00:00:00Z"),
        workerType: "PART_TIME",
      },
    });
    await prisma.employmentRecord.create({
      data: {
        restaurantId: restaurant.id,
        employeeId: empB.id,
        departmentId: dept.id,
        designationId: desig.id,
        primaryOutletId: outletB.id,
        employmentType: "PART_TIME",
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
        status: "ACTIVE",
      },
    });
    await prisma.employeeOutletAssignment.create({
      data: {
        restaurantId: restaurant.id,
        employeeId: empB.id,
        outletId: outletB.id,
        isPrimary: true,
        assignmentType: "PRIMARY",
        effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      },
    });

    const adminCtx: WorkforceActorContext = {
      userId: "u-admin",
      userEmail: "admin@test.com",
      restaurantId: restaurant.id,
      membershipId: "m-admin",
      employeeId: null,
      isAdmin: true,
      canViewWorkforce: true,
      canManageWorkforce: true,
      canViewSensitive: true,
      canViewPayroll: true,
      canViewRoster: true,
      accessibleOutletIds: null,
    };

    const outletAManagerCtx: WorkforceActorContext = {
      userId: "u-mgr-a",
      userEmail: "mgra@test.com",
      restaurantId: restaurant.id,
      membershipId: "m-mgr-a",
      employeeId: null,
      isAdmin: false,
      canViewWorkforce: true,
      canManageWorkforce: true,
      canViewSensitive: false,
      canViewPayroll: false,
      canViewRoster: true,
      accessibleOutletIds: [outletA.id],
    };

    // 1. Directory scoping & no kioskPin/personalEmail leak
    const scopedDir = await listDirectoryEmployees(outletAManagerCtx, {});
    assert.equal(scopedDir.length, 1);
    assert.equal(scopedDir[0].id, empA.id);
    assert.equal(scopedDir[0].employmentStatusLabel, "On probation");
    assert.equal((scopedDir[0] as Record<string, unknown>).kioskPin, undefined);
    assert.equal((scopedDir[0] as Record<string, unknown>).personalEmail, undefined);

    // 2. Out-of-scope profile blocked
    await assert.rejects(
      () => getEmployeeProfile(outletAManagerCtx, empB.id),
      (err: unknown) => err instanceof WorkforceError && err.status === 403
    );

    // 3. Sensitive fields gated by permission
    const nonSensitiveProfile = await getEmployeeProfile(outletAManagerCtx, empA.id);
    assert.equal((nonSensitiveProfile as Record<string, unknown>).kioskPin, undefined);
    assert.equal(nonSensitiveProfile.hasKioskPin, true);
    assert.equal((nonSensitiveProfile as Record<string, unknown>).personalEmail, undefined);

    // 4. Shift manager without workforce:view can still get minimal roster-eligible list
    const shiftOnlyCtx: WorkforceActorContext = {
      ...outletAManagerCtx,
      canViewWorkforce: false,
      canManageWorkforce: false,
      canViewRoster: true,
      accessibleOutletIds: [outletA.id],
    };
    const eligible = await getRosterEligibleEmployees(shiftOnlyCtx, outletA.id);
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].employeeCode, "EMP-10001");
    assert.equal((eligible[0] as Record<string, unknown>).kioskPin, undefined);

    // 5. Grant secondary outlet B to empA, create published future shift at B + historical shift & attendance
    await upsertOutletAssignment(adminCtx, empA.id, {
      outletId: outletB.id,
      isPrimary: false,
      assignmentType: "TEMPORARY",
      effectiveFrom: new Date("2026-11-01T00:00:00Z"),
      reason: "Cross-outlet coverage",
    });

    const pastDate = new Date("2026-10-01T00:00:00Z");
    const futureDate = new Date("2026-12-20T00:00:00Z");

    const rosterB = await prisma.shiftRoster.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outletB.id,
        name: "Dec Roster",
        startDate: new Date("2026-12-14T00:00:00Z"),
        endDate: new Date("2026-12-27T00:00:00Z"),
        status: "PUBLISHED",
      },
    });
    await prisma.shiftAssignment.create({
      data: {
        restaurantId: restaurant.id,
        rosterId: rosterB.id,
        outletId: outletB.id,
        employeeId: empA.id,
        shiftDate: futureDate,
        startTime: "09:00",
        endTime: "17:00",
        roleName: "Line Cook",
      },
    });
    await prisma.attendanceRecord.create({
      data: {
        restaurantId: restaurant.id,
        outletId: outletA.id,
        employeeId: empA.id,
        workDate: pastDate,
        status: "PRESENT",
        totalWorkMinutes: 480,
      },
    });

    // Ending outlet B without resolution must throw 409 with affectedShifts
    await assert.rejects(
      () =>
        endOutletAssignment(adminCtx, empA.id, {
          outletId: outletB.id,
          effectiveTo: new Date("2026-12-15T00:00:00Z"),
          reason: "Coverage ended",
        }),
      (err: unknown) =>
        err instanceof WorkforceError &&
        err.status === 409 &&
        err.code === "AFFECTS_PUBLISHED_SHIFTS"
    );

    // Confirming with CANCEL_SHIFTS removes future shift at B, keeps historical attendance
    const endRes = await endOutletAssignment(adminCtx, empA.id, {
      outletId: outletB.id,
      effectiveTo: new Date("2026-12-15T00:00:00Z"),
      reason: "Coverage ended",
      resolution: "CANCEL_SHIFTS",
    });
    assert.equal(endRes.cancelledShiftsCount, 1);

    const remainingFutureShifts = await prisma.shiftAssignment.count({
      where: { employeeId: empA.id, outletId: outletB.id },
    });
    assert.equal(remainingFutureShifts, 0);

    const histAttendance = await prisma.attendanceRecord.count({
      where: { employeeId: empA.id },
    });
    assert.equal(histAttendance, 1);

    // 6. Valid status transition PROBATION -> ACTIVE
    const transRes = await transitionEmploymentRecord(adminCtx, empA.id, {
      status: "ACTIVE",
      workerType: "FULL_TIME",
      effectiveFrom: new Date("2026-11-25T00:00:00Z"),
      reason: "Probation passed",
    });
    assert.equal(transRes.record.status, "ACTIVE");
  } finally {
    await prisma.restaurant.delete({ where: { id: restaurant.id } });
  }
});
