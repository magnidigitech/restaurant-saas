import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/core/database/client";
import {
  HROnboardingService,
  ONBOARDING_STATUS_LABELS,
  OnboardingError,
} from "@/modules/hr-onboarding/service";
import { validateShiftCandidate } from "@/modules/shifts/service";
import { getRosterEligibleEmployees } from "@/modules/workforce/service";
import type { WorkforceActorContext } from "@/modules/workforce/authHelper";

test("Onboarding status labels match expected user-facing labels", () => {
  assert.equal(ONBOARDING_STATUS_LABELS.PENDING, "Invited");
  assert.equal(ONBOARDING_STATUS_LABELS.IN_PROGRESS, "In Progress");
  assert.equal(ONBOARDING_STATUS_LABELS.PENDING_APPROVAL, "Submitted");
  assert.equal(ONBOARDING_STATUS_LABELS.REJECTED, "Changes Requested");
  assert.equal(ONBOARDING_STATUS_LABELS.APPROVED, "Approved");
});

test("Digital Onboarding full lifecycle, security, template stability, idempotent approval, and Module 2 effective-date scheduling regression", async () => {
  const ts = Date.now();
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Onboarding QA Kitchen",
      subdomain: `onb-test-${ts}`,
      status: "ACTIVE",
    },
  });

  try {
    const outlet1 = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Outlet One", timezone: "America/Toronto" },
    });
    const outlet2 = await prisma.restaurantOutlet.create({
      data: { restaurantId: restaurant.id, name: "Outlet Two", timezone: "America/Toronto" },
    });

    const dept = await prisma.department.create({
      data: { restaurantId: restaurant.id, name: "BOH", code: "BOH" },
    });
    const desig = await prisma.designation.create({
      data: { restaurantId: restaurant.id, name: "Prep Cook", code: "PREP" },
    });

    const template = await HROnboardingService.createTemplate(restaurant.id, {
      name: "Prep Cook Onboarding",
      roleName: "Prep Cook",
      tasks: [
        { title: "Legal Name Confirmation", taskType: "FORM_INPUT", isRequired: true },
        { title: "Food Safety Acknowledgement", taskType: "CHECKBOX", isRequired: true },
      ],
    });
    assert.ok(template);
    const task1 = template.tasks[0];
    const task2 = template.tasks[1];

    const futureStartDate = new Date("2026-12-20T00:00:00Z");
    const session = await HROnboardingService.startOnboarding(restaurant.id, {
      candidate: {
        firstName: "Kabir",
        lastName: "Mehta",
        personalEmail: `kabir-${ts}@example.com`,
        phone: "+1-416-555-0199",
      },
      templateId: template.id,
      intendedOutletId: outlet1.id,
      intendedDepartmentId: dept.id,
      intendedDesignationId: desig.id,
      intendedStartDate: futureStartDate,
      intendedEmploymentStatus: "PROBATION",
      intendedWorkerType: "FULL_TIME",
      actor: { userId: "u-mgr-1", userEmail: "mgr1@test.com" },
    });

    // 1. Template edit stability: mutate template task title -> candidate snapshot stays unchanged
    await HROnboardingService.updateTask(restaurant.id, task1.id, {
      title: "MUTATED TEMPLATE TITLE",
    });
    const portal1 = await HROnboardingService.getSessionByToken(session.accessToken);
    assert.equal(portal1.progresses[0].task.title, "Legal Name Confirmation");

    // 2. Missing required task blocks submission
    await assert.rejects(
      () => HROnboardingService.submitByToken(session.accessToken),
      (err: unknown) =>
        err instanceof OnboardingError && err.code === "MISSING_REQUIRED_TASKS"
    );

    // 3. Complete tasks and submit
    await HROnboardingService.updateTaskProgressByToken(session.accessToken, task1.id, {
      status: "COMPLETED",
      responseValue: "Kabir Mehta",
    });
    await HROnboardingService.updateTaskProgressByToken(session.accessToken, task2.id, {
      status: "COMPLETED",
      responseValue: "Acknowledged",
    });
    const submitted = await HROnboardingService.submitByToken(session.accessToken);
    assert.equal(submitted.status, "PENDING_APPROVAL");

    // 4. Out-of-scope manager (Outlet 2 only) blocked from reviewing Outlet 1 session
    await assert.rejects(
      () => HROnboardingService.getSessionById(restaurant.id, session.id, [outlet2.id]),
      (err: unknown) => err instanceof OnboardingError && err.status === 403
    );

    // 5. Request correction on task1 -> keeps task2 COMPLETED
    await HROnboardingService.requestCorrections(
      restaurant.id,
      session.id,
      { userId: "u-mgr-1", userEmail: "mgr1@test.com" },
      {
        reviewNotes: "Please include middle name",
        taskCorrections: [{ taskId: task1.id, note: "Include full legal name" }],
      },
      [outlet1.id]
    );

    const afterReject = await HROnboardingService.getSessionById(restaurant.id, session.id);
    assert.equal(afterReject.status, "REJECTED");
    assert.equal(afterReject.progresses[0].status, "REJECTED");
    assert.equal(afterReject.progresses[0].reviewNote, "Include full legal name");
    assert.equal(afterReject.progresses[1].status, "COMPLETED");

    // 6. Resubmit task1 -> preserves submissionHistory
    await HROnboardingService.updateTaskProgressByToken(session.accessToken, task1.id, {
      status: "COMPLETED",
      responseValue: "Kabir Raj Mehta",
    });
    const afterResubmit = await HROnboardingService.getSessionById(restaurant.id, session.id);
    assert.ok(Array.isArray(afterResubmit.progresses[0].submissionHistory));
    assert.ok((afterResubmit.progresses[0].submissionHistory as unknown[]).length >= 1);
    await HROnboardingService.submitByToken(session.accessToken);

    // 7. Transactional idempotent approval + retry safety
    const approval1 = await HROnboardingService.approveOnboarding(
      restaurant.id,
      session.id,
      { userId: "u-mgr-1", userEmail: "mgr1@test.com" },
      { reviewNotes: "Approved", accessibleOutletIds: [outlet1.id] }
    );
    assert.equal(approval1.alreadyApproved, false);

    const approvalRetry = await HROnboardingService.approveOnboarding(
      restaurant.id,
      session.id,
      { userId: "u-mgr-1", userEmail: "mgr1@test.com" },
      { reviewNotes: "Approved", accessibleOutletIds: [outlet1.id] }
    );
    assert.equal(approvalRetry.alreadyApproved, true);
    assert.equal(approvalRetry.employeeId, approval1.employeeId);

    const empRecordsCount = await prisma.employmentRecord.count({
      where: { employeeId: approval1.employeeId },
    });
    assert.equal(empRecordsCount, 1);

    // 8. Audit log sanitization: no accessToken or sensitive form responses leaked
    const logs = await prisma.auditLog.findMany({
      where: { restaurantId: restaurant.id, entityId: session.id },
    });
    for (const l of logs) {
      const payload = l.newValues || "";
      assert.ok(!payload.includes(session.accessToken));
      assert.ok(!payload.includes("Kabir Raj Mehta"));
    }

    // 9. Module 2 & 3 effective-dated scheduling regression check
    const mgrCtx: WorkforceActorContext = {
      userId: "u-mgr-1",
      userEmail: "mgr1@test.com",
      restaurantId: restaurant.id,
      membershipId: "m-1",
      employeeId: null,
      isAdmin: false,
      canViewWorkforce: true,
      canManageWorkforce: true,
      canViewSensitive: true,
      canViewPayroll: false,
      canViewRoster: true,
      accessibleOutletIds: [outlet1.id],
    };

    const beforeStartList = await getRosterEligibleEmployees(
      mgrCtx,
      outlet1.id,
      new Date("2026-12-15T00:00:00Z")
    );
    assert.equal(beforeStartList.length, 0);

    const onStartList = await getRosterEligibleEmployees(
      mgrCtx,
      outlet1.id,
      new Date("2026-12-20T00:00:00Z")
    );
    assert.equal(onStartList.length, 1);

    const candidateBeforeStart = await validateShiftCandidate({
      restaurantId: restaurant.id,
      employeeId: approval1.employeeId,
      outletId: outlet1.id,
      shiftDate: "2026-12-15",
      startTime: "09:00",
      endTime: "17:00",
    });
    assert.equal(candidateBeforeStart.valid, false);
    assert.equal(candidateBeforeStart.blockingIssues[0].code, "OUTLET_INELIGIBLE");

    const candidateOnStart = await validateShiftCandidate({
      restaurantId: restaurant.id,
      employeeId: approval1.employeeId,
      outletId: outlet1.id,
      shiftDate: "2026-12-20",
      startTime: "09:00",
      endTime: "17:00",
    });
    assert.equal(candidateOnStart.valid, true);

    // 10. Revocation & Expiry validation on a second session
    const session2 = await HROnboardingService.startOnboarding(restaurant.id, {
      candidate: {
        firstName: "Simran",
        lastName: "Kaur",
        personalEmail: `simran-${ts}@example.com`,
      },
      templateId: template.id,
      intendedOutletId: outlet1.id,
    });
    await HROnboardingService.revokeInvitation(
      restaurant.id,
      session2.id,
      { userId: "u-mgr-1", userEmail: "mgr1@test.com" },
      "Withdrawn"
    );
    await assert.rejects(
      () => HROnboardingService.getSessionByToken(session2.accessToken),
      (err: unknown) => err instanceof OnboardingError && err.code === "LINK_REVOKED"
    );

    // Expired link check
    await prisma.employeeOnboarding.update({
      where: { id: session2.id },
      data: {
        revokedAt: null,
        tokenExpiresAt: new Date(Date.now() - 3600_000),
      },
    });
    await assert.rejects(
      () => HROnboardingService.getSessionByToken(session2.accessToken),
      (err: unknown) => err instanceof OnboardingError && err.code === "LINK_EXPIRED"
    );
  } finally {
    await prisma.restaurant.delete({ where: { id: restaurant.id } });
  }
});
