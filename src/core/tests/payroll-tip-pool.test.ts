import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/core/database/client";
import { calculateTipDistribution } from "@/core/payroll/tipPoolEngine";
import { TipPoolService } from "@/modules/payroll/tipPoolService";
import { PayrollService, PayrollError } from "@/modules/payroll/service";
import { ChecklistService } from "@/modules/operations/checklistService";
import { ShiftService } from "@/modules/shifts/service";

describe("Module 7: Tip Pooling, Payroll & Module 6 Staged Revision Regression", () => {
  let restaurantId: string;
  let outlet1Id: string;
  let outlet2Id: string;
  let userId: string;
  let empHourlyId: string;
  let empMidRateId: string;
  let empUnresolvedId: string;
  let payrollRunId: string;

  before(async () => {
    const slug = `pay-test-${Date.now()}`;
    const rest = await prisma.restaurant.create({
      data: { name: "Payroll Test Kitchen", subdomain: slug, status: "ACTIVE" },
    });
    restaurantId = rest.id;

    const [o1, o2, usr] = await Promise.all([
      prisma.restaurantOutlet.create({
        data: { restaurantId, name: "Downtown", currency: "USD", timezone: "America/New_York" },
      }),
      prisma.restaurantOutlet.create({
        data: { restaurantId, name: "Uptown", currency: "USD", timezone: "America/New_York" },
      }),
      prisma.user.create({
        data: { email: `paymgr-${Date.now()}@test.local`, name: "Pay Mgr", passwordHash: "hash" },
      }),
    ]);
    outlet1Id = o1.id;
    outlet2Id = o2.id;
    userId = usr.id;

    const [e1, e2, e3] = await Promise.all([
      prisma.employee.create({
        data: {
          restaurantId,
          employeeCode: `H1-${Date.now()}`,
          firstName: "Asha",
          lastName: "Hourly",
          joiningDate: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
      prisma.employee.create({
        data: {
          restaurantId,
          employeeCode: `M1-${Date.now()}`,
          firstName: "Vikram",
          lastName: "MidRate",
          joiningDate: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
      prisma.employee.create({
        data: {
          restaurantId,
          employeeCode: `U1-${Date.now()}`,
          firstName: "Riya",
          lastName: "Unresolved",
          joiningDate: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
    ]);
    empHourlyId = e1.id;
    empMidRateId = e2.id;
    empUnresolvedId = e3.id;

    await prisma.employeeOutletAssignment.createMany({
      data: [
        { restaurantId, employeeId: empHourlyId, outletId: outlet1Id, isPrimary: true },
        { restaurantId, employeeId: empMidRateId, outletId: outlet1Id, isPrimary: true },
        { restaurantId, employeeId: empUnresolvedId, outletId: outlet1Id, isPrimary: true },
      ],
    });

    // Salary structures: empHourly = $20/hr, empMidRate = $18/hr (Nov 1-10) -> $22/hr (Nov 11-30)
    await prisma.salaryStructure.createMany({
      data: [
        {
          restaurantId,
          employeeId: empHourlyId,
          payFrequency: "HOURLY",
          currency: "USD",
          baseSalary: 0,
          hourlyRate: 20,
          effectiveFrom: new Date("2026-11-01T00:00:00.000Z"),
        },
        {
          restaurantId,
          employeeId: empMidRateId,
          payFrequency: "HOURLY",
          currency: "USD",
          baseSalary: 0,
          hourlyRate: 18,
          effectiveFrom: new Date("2026-11-01T00:00:00.000Z"),
          effectiveTo: new Date("2026-11-10T23:59:59.999Z"),
        },
        {
          restaurantId,
          employeeId: empMidRateId,
          payFrequency: "HOURLY",
          currency: "USD",
          baseSalary: 0,
          hourlyRate: 22,
          effectiveFrom: new Date("2026-11-11T00:00:00.000Z"),
        },
        {
          restaurantId,
          employeeId: empUnresolvedId,
          payFrequency: "HOURLY",
          currency: "USD",
          baseSalary: 0,
          hourlyRate: 16,
          effectiveFrom: new Date("2026-11-01T00:00:00.000Z"),
        },
      ],
    });
  });

  after(async () => {
    await prisma.restaurant.delete({ where: { id: restaurantId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("reconciles tip pool rounding remainders deterministically and flags empty eligible groups", () => {
    // 100.00 split 70/30 across 3 FOH (equal) and 0 BOH -> 70.00 distributed (23.34 + 23.33 + 23.33), 30.00 undistributed
    const res = calculateTipDistribution(
      100,
      [
        { employeeId: "a", name: "A", isFoh: true, hoursWorked: 10 },
        { employeeId: "b", name: "B", isFoh: true, hoursWorked: 8 },
        { employeeId: "c", name: "C", isFoh: true, hoursWorked: 6 },
      ],
      {
        fohPercentage: 70,
        bohPercentage: 30,
        distributionMethod: "EQUAL_SPLIT",
        preserveEmptyGroupShare: true,
      }
    );
    assert.equal(res.totalDistributedTips, 70);
    assert.equal(res.undistributedAmount, 30);
    assert.ok(res.undistributedReason?.includes("Empty eligible BOH group"));
    assert.equal(
      Number((res.totalDistributedTips + res.undistributedAmount).toFixed(2)),
      res.totalCollectedTips
    );
  });

  it("finalizes tip pool from POS orders, previews payroll with blockers & mid-period rates, revalidates on change, and finalizes idempotently", async () => {
    // POS orders with cash & card tips + refund
    await prisma.posOrder.createMany({
      data: [
        {
          restaurantId,
          outletId: outlet1Id,
          orderNumber: `ORD1-${Date.now()}`,
          totalAmount: 200,
          tipAmount: 30,
          finalAmount: 230,
          paymentMethod: "CARD",
          status: "COMPLETED",
          createdAt: new Date("2026-11-05T14:00:00.000Z"),
        },
        {
          restaurantId,
          outletId: outlet1Id,
          orderNumber: `ORD2-${Date.now()}`,
          totalAmount: 100,
          tipAmount: 10.01,
          refundAmount: 5,
          finalAmount: 105.01,
          paymentMethod: "CASH",
          status: "COMPLETED",
          createdAt: new Date("2026-11-12T14:00:00.000Z"),
        },
      ],
    });

    // Attendance: overnight approved for empHourly, split-date approved for empMidRate, unresolved for empUnresolved
    await prisma.attendanceRecord.createMany({
      data: [
        {
          restaurantId,
          outletId: outlet1Id,
          employeeId: empHourlyId,
          workDate: new Date("2026-11-05T00:00:00.000Z"),
          clockInTime: new Date("2026-11-05T22:00:00.000Z"),
          clockOutTime: new Date("2026-11-06T08:00:00.000Z"),
          totalWorkMinutes: 600, // 10h (8h reg + 2h OT)
          overtimeMinutes: 120,
          isApproved: true,
        },
        {
          restaurantId,
          outletId: outlet1Id,
          employeeId: empMidRateId,
          workDate: new Date("2026-11-08T00:00:00.000Z"),
          totalWorkMinutes: 480, // 8h @ $18
          overtimeMinutes: 0,
          isApproved: true,
        },
        {
          restaurantId,
          outletId: outlet1Id,
          employeeId: empMidRateId,
          workDate: new Date("2026-11-12T00:00:00.000Z"),
          totalWorkMinutes: 480, // 8h @ $22
          overtimeMinutes: 0,
          isApproved: true,
        },
      ],
    });

    const unresolvedAtt = await prisma.attendanceRecord.create({
      data: {
        restaurantId,
        outletId: outlet1Id,
        employeeId: empUnresolvedId,
        workDate: new Date("2026-11-12T00:00:00.000Z"),
        clockInTime: new Date("2026-11-12T09:00:00.000Z"),
        clockOutTime: null,
        totalWorkMinutes: 0,
        isApproved: false,
      },
    });

    // Finalize tip pool ($30 + $10.01 - $5 refund = $35.01)
    const tipRes = await TipPoolService.saveOrFinalizeRun(restaurantId, {
      outletId: outlet1Id,
      startDate: "2026-11-01T00:00:00.000Z",
      endDate: "2026-11-15T23:59:59.999Z",
      fohPercentage: 0,
      bohPercentage: 100,
      distributionMethod: "HOURS_WORKED",
      finalize: true,
      actorUserId: userId,
      actorEmail: "paymgr@test.local",
    });
    assert.equal(tipRes.preview.eligiblePoolAmount, 35.01);
    assert.equal(tipRes.preview.distribution.totalDistributedTips, 35.01);

    const run = await PayrollService.createPayrollRun(restaurantId, {
      outletId: outlet1Id,
      title: "Nov 1-15 Run",
      periodStart: "2026-11-01T00:00:00.000Z",
      periodEnd: "2026-11-15T23:59:59.999Z",
      paymentDate: "2026-11-20T00:00:00.000Z",
    });
    payrollRunId = run.id;

    // Preview detects UNRESOLVED_ATTENDANCE blocker and mid-period rate segments
    const preview1 = await PayrollService.previewPayrollRun(restaurantId, payrollRunId, userId);
    assert.ok(preview1.blockers.some((b) => b.code === "UNRESOLVED_ATTENDANCE"));
    const midRow = preview1.employeeBreakdowns.find((b) => b.employeeId === empMidRateId)!;
    assert.equal(midRow.rateSegments.length, 2);
    assert.equal(midRow.regularEarnings, 8 * 18 + 8 * 22);

    // Resolve the open attendance record
    await prisma.attendanceRecord.update({
      where: { id: unresolvedAtt.id },
      data: {
        clockOutTime: new Date("2026-11-12T13:00:00.000Z"),
        totalWorkMinutes: 240,
        isApproved: true,
      },
    });

    // Finalizing with stale preview1.previewHash must fail with 409 PREVIEW_STALE
    await assert.rejects(
      () =>
        PayrollService.finalizePayrollRun(
          restaurantId,
          payrollRunId,
          userId,
          "paymgr@test.local",
          preview1.previewHash
        ),
      (err: any) => err instanceof PayrollError && err.code === "PREVIEW_STALE"
    );

    // Fresh preview -> finalize twice -> single set of payslips, tip pool locked
    const preview2 = await PayrollService.previewPayrollRun(restaurantId, payrollRunId, userId);
    assert.equal(preview2.blockers.length, 0);

    // Concurrent finalization: two simultaneous requests produce exactly one set of payslips
    const [fin1, fin2] = await Promise.all([
      PayrollService.finalizePayrollRun(
        restaurantId,
        payrollRunId,
        userId,
        "paymgr@test.local",
        preview2.previewHash
      ),
      PayrollService.finalizePayrollRun(
        restaurantId,
        payrollRunId,
        userId,
        "paymgr@test.local",
        preview2.previewHash
      ),
    ]);
    const alreadyFlags = [fin1.alreadyFinalized, fin2.alreadyFinalized].sort();
    assert.deepEqual(alreadyFlags, [false, true]);
    assert.equal(fin1.run.payslips.length, 3);
    assert.equal(fin2.run.payslips.length, 3);

    // Separate tip pool double-claim test: two eligible runs attempt to claim the same finalized tip pool
    const empOutlet2 = await prisma.employee.create({
      data: {
        restaurantId,
        employeeCode: `O2-${Date.now()}`,
        firstName: "Zara",
        lastName: "Uptown",
        joiningDate: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.employeeOutletAssignment.create({
      data: { restaurantId, employeeId: empOutlet2.id, outletId: outlet2Id, isPrimary: true },
    });
    await prisma.salaryStructure.create({
      data: {
        restaurantId,
        employeeId: empOutlet2.id,
        payFrequency: "HOURLY",
        currency: "USD",
        baseSalary: 0,
        hourlyRate: 20,
        effectiveFrom: new Date("2026-11-01T00:00:00.000Z"),
      },
    });
    await prisma.attendanceRecord.create({
      data: {
        restaurantId,
        outletId: outlet2Id,
        employeeId: empOutlet2.id,
        workDate: new Date("2026-11-18T00:00:00.000Z"),
        totalWorkMinutes: 480,
        isApproved: true,
      },
    });

    const tipPoolDoubleClaim = await TipPoolService.saveOrFinalizeRun(restaurantId, {
      outletId: outlet2Id,
      startDate: "2026-11-16T00:00:00.000Z",
      endDate: "2026-11-30T23:59:59.999Z",
      fohPercentage: 0,
      bohPercentage: 100,
      distributionMethod: "EQUAL_SPLIT",
      adjustmentsAmount: 50,
      finalize: true,
      actorUserId: userId,
      actorEmail: "paymgr@test.local",
    });
    assert.equal(tipPoolDoubleClaim.run.status, "FINALIZED");

    const [runA, runB] = await Promise.all([
      PayrollService.createPayrollRun(restaurantId, {
        outletId: outlet2Id,
        title: "Uptown Run A",
        periodStart: "2026-11-16T00:00:00.000Z",
        periodEnd: "2026-11-22T23:59:59.999Z",
        paymentDate: "2026-12-05T00:00:00.000Z",
      }),
      PayrollService.createPayrollRun(restaurantId, {
        outletId: outlet2Id,
        title: "Uptown Run B",
        periodStart: "2026-11-23T00:00:00.000Z",
        periodEnd: "2026-11-30T23:59:59.999Z",
        paymentDate: "2026-12-05T00:00:00.000Z",
      }),
    ]);

    // Both preview before either finalizes -> both see the unclaimed tip pool
    const [prevA, prevB] = await Promise.all([
      PayrollService.previewPayrollRun(restaurantId, runA.id, userId),
      PayrollService.previewPayrollRun(restaurantId, runB.id, userId),
    ]);
    assert.equal(prevA.totals.totalTips, 50);
    assert.equal(prevB.totals.totalTips, 50);

    // Run A claims it; Run B must be rejected on finalization
    await PayrollService.finalizePayrollRun(restaurantId, runA.id, userId, "paymgr@test.local", prevA.previewHash);
    await assert.rejects(
      () => PayrollService.finalizePayrollRun(restaurantId, runB.id, userId, "paymgr@test.local", prevB.previewHash),
      (err: any) => err instanceof PayrollError && err.status === 409
    );

    // Linked correction run: 0 delta when nothing changed, and delta-only when attendance increases by +2h ($40)
    const corrRun = await PayrollService.createCorrectionRun(
      restaurantId,
      payrollRunId,
      userId,
      "paymgr@test.local",
      "Missed 2h on Nov 6"
    );
    const corrPreviewZero = await PayrollService.previewPayrollRun(restaurantId, corrRun.id, userId);
    assert.equal(corrPreviewZero.employeeBreakdowns.length, 0);
    assert.equal(corrPreviewZero.totals.totalNet, 0);

    await prisma.attendanceRecord.create({
      data: {
        restaurantId,
        outletId: outlet1Id,
        employeeId: empHourlyId,
        workDate: new Date("2026-11-07T00:00:00.000Z"),
        totalWorkMinutes: 120, // +2h regular @ $20 = $40
        overtimeMinutes: 0,
        isApproved: true,
      },
    });

    const corrPreviewDelta = await PayrollService.previewPayrollRun(restaurantId, corrRun.id, userId);
    assert.equal(corrPreviewDelta.employeeBreakdowns.length, 1);
    assert.equal(corrPreviewDelta.employeeBreakdowns[0].employeeId, empHourlyId);
    assert.equal(corrPreviewDelta.employeeBreakdowns[0].netPay, 40);
    assert.equal(corrPreviewDelta.totals.totalTips, 0);

    const corrFinal = await PayrollService.finalizePayrollRun(
      restaurantId,
      corrRun.id,
      userId,
      "paymgr@test.local",
      corrPreviewDelta.previewHash
    );
    assert.equal(corrFinal.run.payslips.length, 1);
    assert.equal(Number(corrFinal.run.payslips[0].netPay), 40);

    // Original payslip remains untouched
    const origSlip = await prisma.payslip.findFirstOrThrow({
      where: { payrollRunId, employeeId: empHourlyId },
    });
    assert.equal(Number(origSlip.basePay), 160);
  });

  it("Module 6 regression: staged roster revision reassigning a shift syncs in-progress checklist while preserving responses", async () => {
    const roster = await prisma.shiftRoster.create({
      data: {
        restaurantId,
        outletId: outlet1Id,
        name: "Reg Roster",
        startDate: new Date("2026-11-26T00:00:00.000Z"),
        endDate: new Date("2026-11-26T00:00:00.000Z"),
        status: "PUBLISHED",
      },
    });

    const shift = await prisma.shiftAssignment.create({
      data: {
        restaurantId,
        rosterId: roster.id,
        outletId: outlet1Id,
        employeeId: empHourlyId,
        shiftDate: new Date("2026-11-26T00:00:00.000Z"),
        startTime: "08:00",
        endTime: "16:00",
        status: "SCHEDULED",
      },
    });

    const tpl = await ChecklistService.createTemplate(restaurantId, {
      name: "Regression Checklist",
      type: "OPENING",
      items: [{ title: "Check Grill", isRequired: true }],
    });
    const exec = await ChecklistService.startExecution(restaurantId, {
      templateId: tpl.id,
      outletId: outlet1Id,
      shiftAssignmentId: shift.id,
      actorUserId: userId,
      actorEmail: "mgr@test.local",
    });

    await ChecklistService.updateItemExecution(exec.items[0].id, restaurantId, {
      isCompleted: true,
      notes: "Grill prepped",
      actorId: userId,
      actorName: "Asha Hourly",
    });

    // Stage a draft revision that reassigns the shift from empHourlyId to empMidRateId
    await ShiftService.saveDraftRevision(
      restaurantId,
      roster.id,
      {
        adds: [],
        updates: [
          {
            draftId: shift.id,
            targetAssignmentId: shift.id,
            action: "UPDATE",
            employeeId: empMidRateId,
            outletId: outlet1Id,
            shiftDate: "2026-11-26",
            startTime: "08:00",
            endTime: "16:00",
            breakMinutes: 0,
          },
        ],
        deletes: [],
      },
      roster.version,
      { userId, userEmail: "mgr@test.local" }
    );

    await ShiftService.publishRoster(
      restaurantId,
      roster.id,
      { userId, userEmail: "mgr@test.local" },
      roster.version + 1
    );

    const updatedExec = await ChecklistService.getExecutionById(exec.id, restaurantId);
    assert.equal(updatedExec.assignedEmployeeId, empMidRateId);
    assert.equal(updatedExec.items[0].isCompleted, true);
    assert.equal(updatedExec.items[0].notes, "Grill prepped");
  });
});
