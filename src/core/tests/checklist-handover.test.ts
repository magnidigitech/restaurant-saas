import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/core/database/client";
import { ChecklistService, ChecklistError } from "@/modules/operations/checklistService";

describe("Module 6: Shift Checklists & Handover", () => {
  let restaurantId: string;
  let outlet1Id: string;
  let outlet2Id: string;
  let managerUserId: string;
  let staff1Id: string;
  let staff2Id: string;
  let shiftId: string;
  let templateId: string;
  let executionId: string;

  before(async () => {
    const slug = `chk-test-${Date.now()}`;
    const rest = await prisma.restaurant.create({
      data: { name: "Checklist Test Bistro", subdomain: slug },
    });
    restaurantId = rest.id;

    const [o1, o2, mgr] = await Promise.all([
      prisma.restaurantOutlet.create({ data: { restaurantId, name: "Downtown", timezone: "Asia/Kolkata" } }),
      prisma.restaurantOutlet.create({ data: { restaurantId, name: "Uptown", timezone: "Asia/Kolkata" } }),
      prisma.user.create({
        data: {
          email: `mgr-${Date.now()}@test.local`,
          name: "Supervisor Sam",
          passwordHash: "hash",
        },
      }),
    ]);
    outlet1Id = o1.id;
    outlet2Id = o2.id;
    managerUserId = mgr.id;

    const [e1, e2] = await Promise.all([
      prisma.employee.create({
        data: {
          restaurantId,
          employeeCode: `EMP1-${Date.now()}`,
          firstName: "Asha",
          lastName: "Chef",
          personalEmail: `asha-${Date.now()}@test.local`,
          joiningDate: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
      prisma.employee.create({
        data: {
          restaurantId,
          employeeCode: `EMP2-${Date.now()}`,
          firstName: "Vikram",
          lastName: "Cook",
          personalEmail: `vikram-${Date.now()}@test.local`,
          joiningDate: new Date("2026-01-01T00:00:00.000Z"),
        },
      }),
    ]);
    staff1Id = e1.id;
    staff2Id = e2.id;

    const shift = await prisma.shiftAssignment.create({
      data: {
        restaurantId,
        outletId: outlet1Id,
        employeeId: staff1Id,
        shiftDate: new Date("2026-11-26T00:00:00.000Z"),
        startTime: "08:00",
        endTime: "16:00",
        status: "SCHEDULED",
      },
    });
    shiftId = shift.id;

    const tpl = await ChecklistService.createTemplate(restaurantId, {
      name: "Morning Cold Chain",
      type: "FOOD_SAFETY",
      estimatedMinutes: 15,
      items: [
        {
          title: "Walk-in Cooler Temp",
          sectionName: "Cold Storage",
          isRequired: true,
          requiresValueInput: true,
          valueInputLabel: "Cooler Temp",
          minValue: 1,
          maxValue: 5,
          unit: "°C",
          requiresPhoto: true,
        },
        {
          title: "Sanitizer Check",
          sectionName: "Sanitation",
          isRequired: true,
        },
      ],
    });
    templateId = tpl.id;
  });

  after(async () => {
    await prisma.restaurant.delete({ where: { id: restaurantId } }).catch(() => {});
    await prisma.user.delete({ where: { id: managerUserId } }).catch(() => {});
  });

  it("snapshots template tasks on assignment and keeps assigned tasks stable when template is edited", async () => {
    const exec = await ChecklistService.startExecution(restaurantId, {
      templateId,
      outletId: outlet1Id,
      shiftAssignmentId: shiftId,
      stationName: "Cold Line",
      dueAt: "2026-11-26T09:00:00.000Z",
      actorUserId: managerUserId,
      actorEmail: "mgr@test.local",
    });
    executionId = exec.id;
    assert.equal(exec.assignedEmployeeId, staff1Id);
    assert.equal(exec.items.length, 2);

    await ChecklistService.updateTemplate(templateId, restaurantId, {
      name: "Morning Cold Chain v2",
      type: "FOOD_SAFETY",
      items: [{ title: "Completely Different Task", isRequired: true }],
    });

    const reloaded = await ChecklistService.getExecutionById(executionId, restaurantId);
    assert.equal(reloaded.items.length, 2);
    assert.equal(reloaded.items[0].title, "Walk-in Cooler Temp");
  });

  it("flags out-of-range reading while preserving value, enforces required photo, and detects concurrency conflict", async () => {
    const exec = await ChecklistService.getExecutionById(executionId, restaurantId);
    const tempItem = exec.items[0];
    const sanItem = exec.items[1];

    const updatedTemp = await ChecklistService.updateItemExecution(tempItem.id, restaurantId, {
      isCompleted: true,
      recordedValue: "9.4",
      notes: "Door gasket loose",
      actorId: managerUserId,
      actorName: "Asha Chef",
      expectedVersion: tempItem.version,
    });
    assert.equal(updatedTemp.inputValue, "9.4");
    assert.equal(updatedTemp.isOutOfRange, true);

    await assert.rejects(
      () =>
        ChecklistService.updateItemExecution(tempItem.id, restaurantId, {
          isCompleted: true,
          actorId: managerUserId,
          actorName: "Asha Chef",
          expectedVersion: tempItem.version, // stale version
        }),
      (err: any) => err instanceof ChecklistError && err.status === 409
    );

    await ChecklistService.updateItemExecution(sanItem.id, restaurantId, {
      isCompleted: true,
      actorId: managerUserId,
      actorName: "Asha Chef",
    });

    await assert.rejects(
      () =>
        ChecklistService.submitExecution(executionId, restaurantId, {
          employeeId: staff1Id,
          actorUserId: managerUserId,
          actorEmail: "asha@test.local",
        }),
      (err: any) =>
        err instanceof ChecklistError &&
        err.code === "MISSING_EVIDENCE" &&
        err.message.includes("Walk-in Cooler Temp") &&
        err.message.includes("upload required photo")
    );
  });

  it("preserves responses on shift reassignment, supports return/resubmit, and performs idempotent sign-off with carry-forward", async () => {
    const synced = await ChecklistService.syncAssigneeForShift(
      shiftId,
      staff2Id,
      managerUserId,
      "mgr@test.local"
    );
    assert.equal(synced, 1);

    let exec = await ChecklistService.getExecutionById(executionId, restaurantId);
    assert.equal(exec.assignedEmployeeId, staff2Id);
    assert.equal(exec.items[0].inputValue, "9.4");

    // Upload photo URL and submit
    await ChecklistService.updateItemExecution(exec.items[0].id, restaurantId, {
      photoUrl: `/api/uploads/${restaurantId}/checklists/${executionId}/cooler.png`,
      actorId: managerUserId,
      actorName: "Vikram Cook",
    });

    await ChecklistService.submitExecution(executionId, restaurantId, {
      employeeId: staff2Id,
      handoverNotes: "Cooler temp elevated, technician called",
      actorUserId: managerUserId,
      actorEmail: "vikram@test.local",
    });

    // Supervisor returns Sanitizer Check for correction
    exec = await ChecklistService.getExecutionById(executionId, restaurantId);
    await ChecklistService.returnItemForCorrection(executionId, exec.items[1].id, restaurantId, {
      returnReason: "Specify PPM strip reading in notes",
      actorUserId: managerUserId,
      actorEmail: "mgr@test.local",
      actorName: "Supervisor Sam",
    });

    // Sign-off blocked while returned item exists
    await assert.rejects(
      () =>
        ChecklistService.verifyExecution(executionId, restaurantId, {
          verifiedById: staff1Id,
          actorUserId: managerUserId,
          actorEmail: "mgr@test.local",
          actorName: "Supervisor Sam",
        }),
      (err: any) => err instanceof ChecklistError && err.code === "OPEN_RETURNED_ITEMS"
    );

    // Staff fixes and resubmits
    exec = await ChecklistService.getExecutionById(executionId, restaurantId);
    await ChecklistService.updateItemExecution(exec.items[1].id, restaurantId, {
      isCompleted: true,
      notes: "Verified 250 ppm",
      actorId: managerUserId,
      actorName: "Vikram Cook",
    });
    await ChecklistService.submitExecution(executionId, restaurantId, {
      employeeId: staff2Id,
      actorUserId: managerUserId,
      actorEmail: "vikram@test.local",
    });

    // Sign-off blocked by out-of-range cooler temp unless carry-forward is provided
    await assert.rejects(
      () =>
        ChecklistService.verifyExecution(executionId, restaurantId, {
          verifiedById: staff1Id,
          actorUserId: managerUserId,
          actorEmail: "mgr@test.local",
          actorName: "Supervisor Sam",
          allowCarryForwardExceptions: false,
        }),
      (err: any) => err instanceof ChecklistError && err.code === "OPEN_EXCEPTIONS"
    );

    // Sign off with carry-forward owner & note
    const verify1 = await ChecklistService.verifyExecution(executionId, restaurantId, {
      verifiedById: staff1Id,
      actorUserId: managerUserId,
      actorEmail: "mgr@test.local",
      actorName: "Supervisor Sam",
      allowCarryForwardExceptions: true,
      carryForwardOwner: "Evening Sous Chef",
      carryForwardNote: "Meet HVAC tech at 17:00",
    });
    assert.equal(verify1.alreadyVerified, false);
    assert.equal(verify1.execution.status, "VERIFIED");

    // Idempotent retry
    const verify2 = await ChecklistService.verifyExecution(executionId, restaurantId, {
      verifiedById: staff1Id,
      actorUserId: managerUserId,
      actorEmail: "mgr@test.local",
      actorName: "Supervisor Sam",
    });
    assert.equal(verify2.alreadyVerified, true);

    // Verify original reading + review history preserved
    const finalExec = await ChecklistService.getExecutionById(executionId, restaurantId);
    assert.equal(finalExec.items[0].inputValue, "9.4");
    const sanHistory = finalExec.items[1].responseHistory as any[];
    assert.ok(sanHistory.some((h) => h.action === "RETURNED"));
    assert.ok(sanHistory.some((h) => h.action === "RESUBMITTED"));
    assert.ok(outlet2Id);
  });
});
